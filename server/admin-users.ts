import { createClient } from '@supabase/supabase-js';
import { Router } from 'express';
import { z } from 'zod';

const router = Router();

// Función para crear cliente de Supabase con Service Role Key
function getSupabaseAdmin() {
  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  
  if (!supabaseUrl || !supabaseServiceKey) {
    throw new Error('Supabase Service Role configuration is missing');
  }
  
  return createClient(supabaseUrl, supabaseServiceKey);
}

// Schema para validación
const createUserSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
  role: z.enum(['admin', 'employee']),
  fullName: z.string().min(2)
});

// Crear usuario (solo para administradores)
router.post('/admin/users', async (req, res) => {
  console.log('POST /admin/users - Auth check:', req.isAuthenticated());
  console.log('POST /admin/users - User:', req.user);
  console.log('POST /admin/users - Body:', req.body);
  
  if (!req.isAuthenticated()) {
    return res.status(401).json({ message: "Unauthorized" });
  }

  const user = req.user as any;
  if (user.role !== 'admin') {
    return res.status(403).json({ message: "Only admins can create users" });
  }

  try {
    const validatedData = createUserSchema.parse(req.body);
    console.log('Validated data:', validatedData);

    const supabaseAdmin = getSupabaseAdmin();

    // Crear usuario en Supabase Auth
    const { data: authUser, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email: validatedData.email,
      password: validatedData.password,
      email_confirm: true // Auto-confirmar email
    });

    if (authError) {
      console.error('Auth error:', authError);
      return res.status(400).json({ error: authError.message });
    }

    console.log('Auth user created:', authUser);

    // Hashear la contraseña para la tabla users
    const bcrypt = require('bcrypt');
    const hashedPassword = await bcrypt.hash(validatedData.password, 10);

    // Crear perfil en la tabla users
    const { data: profile, error: profileError } = await supabaseAdmin
      .from('users')
      .insert({
        id: authUser.user.id, // Usar el ID de Supabase Auth
        username: validatedData.email.split('@')[0], // Username basado en email
        password: hashedPassword,
        role: validatedData.role,
        fullName: validatedData.fullName
      })
      .select()
      .single();

    if (profileError) {
      console.error('Profile error:', profileError);
      // Si falla la creación del perfil, eliminar el usuario de Auth
      await supabaseAdmin.auth.admin.deleteUser(authUser.user.id);
      return res.status(400).json({ error: profileError.message });
    }

    console.log('Profile created:', profile);

    res.status(201).json({
      message: "User created successfully",
      user: {
        id: profile.id,
        email: validatedData.email,
        role: validatedData.role,
        fullName: validatedData.fullName
      }
    });

  } catch (error) {
    console.error('Error creating user:', error);
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: error.errors[0].message });
    }
    res.status(500).json({ error: "Failed to create user" });
  }
});

// Listar todos los usuarios (solo para administradores)
router.get('/admin/users', async (req, res) => {
  if (!req.isAuthenticated()) {
    return res.status(401).json({ message: "Unauthorized" });
  }

  const user = req.user as any;
  if (user.role !== 'admin') {
    return res.status(403).json({ message: "Only admins can view users" });
  }

  try {
    const supabaseAdmin = getSupabaseAdmin();
    const { data: users, error } = await supabaseAdmin
      .from('users')
      .select('id, username, role, fullName, createdAt')
      .order('createdAt', { ascending: false });

    if (error) {
      console.error('Error fetching users:', error);
      return res.status(500).json({ error: error.message });
    }

    res.json(users);
  } catch (error) {
    console.error('Error fetching users:', error);
    res.status(500).json({ error: "Failed to fetch users" });
  }
});

// Eliminar usuario (solo para administradores)
router.delete('/admin/users/:id', async (req, res) => {
  if (!req.isAuthenticated()) {
    return res.status(401).json({ message: "Unauthorized" });
  }

  const user = req.user as any;
  if (user.role !== 'admin') {
    return res.status(403).json({ message: "Only admins can delete users" });
  }

  const userId = req.params.id;

  try {
    const supabaseAdmin = getSupabaseAdmin();
    
    // Eliminar perfil de la tabla users
    const { error: profileError } = await supabaseAdmin
      .from('users')
      .delete()
      .eq('id', userId);

    if (profileError) {
      console.error('Error deleting profile:', profileError);
      return res.status(500).json({ error: profileError.message });
    }

    // Eliminar usuario de Supabase Auth
    const { error: authError } = await supabaseAdmin.auth.admin.deleteUser(userId);

    if (authError) {
      console.error('Error deleting auth user:', authError);
      return res.status(500).json({ error: authError.message });
    }

    res.json({ message: "User deleted successfully" });
  } catch (error) {
    console.error('Error deleting user:', error);
    res.status(500).json({ error: "Failed to delete user" });
  }
});

export default router;
