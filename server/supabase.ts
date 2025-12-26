import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing Supabase environment variables');
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

export async function uploadToSupabase(file: Express.Multer.File, userId: number): Promise<string> {
  const fileName = `${Date.now()}-${file.originalname}`;
  const filePath = `absence-files/${userId}/${fileName}`;

  // Convert Multer.File buffer to File-like object for Supabase
  const fileBuffer = file.buffer;
  const mimeType = file.mimetype;

  const { data, error } = await supabase.storage
    .from('absence-files')
    .upload(filePath, fileBuffer, {
      contentType: mimeType,
      cacheControl: '3600',
      upsert: false
    });

  if (error) {
    throw new Error(`Failed to upload file: ${error.message}`);
  }

  const { data: { publicUrl } } = supabase.storage
    .from('absence-files')
    .getPublicUrl(filePath);

  return publicUrl;
}
