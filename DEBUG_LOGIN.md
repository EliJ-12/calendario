# Debug Checklist for Login Issues

## Environment Variables Required
Make sure these are set in your `.env.local` file:

```bash
# Database Configuration
DATABASE_URL=postgresql://user:password@localhost:5432/prueba_horas

# Supabase Configuration  
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key

# Session Secret
SESSION_SECRET=your-session-secret-here
```

## Common Issues & Solutions

### 1. Database Connection Error
**Symptoms:** "Login failed" immediately
**Check:** Run `npm run dev` and look for database connection errors

### 2. Password Format Issues
**Symptoms:** "Login failed" even with correct credentials
**Cause:** Existing passwords might be in old format before scrypt hashing
**Solution:** Reset admin password in database

### 3. Session Issues
**Symptoms:** Login works but immediately logs out
**Check:** SESSION_SECRET is set and consistent

## Quick Test
Add this to any route to test environment variables:
```javascript
console.log('DATABASE_URL:', process.env.DATABASE_URL);
console.log('SESSION_SECRET:', process.env.SESSION_SECRET ? 'SET' : 'MISSING');
```

## Database Reset (if needed)
If you need to reset the admin user:
```sql
-- Delete existing admin user
DELETE FROM users WHERE username = 'admin';

-- Insert new admin user with password "admin123"
INSERT INTO users (username, password, full_name, role) 
VALUES ('admin', 'hashed_password_here', 'Administrador', 'admin');
```

Then login with: username: `admin`, password: `admin123`
