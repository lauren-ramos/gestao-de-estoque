import * as FileSystem from 'expo-file-system';
import { supabase } from './supabase';

async function uriToBlob(uri: string): Promise<Blob> {
  const base64 = await FileSystem.readAsStringAsync(uri, {
    encoding: FileSystem.EncodingType.Base64,
  });
  const byteArray = Uint8Array.from(atob(base64), (c) => c.charCodeAt(0));
  return new Blob([byteArray]);
}

export async function uploadFile(
  uri: string,
  bucket: 'fotos' | 'notas-fiscais',
  folder: string,
): Promise<string> {
  const ext = uri.split('.').pop() ?? 'jpg';
  const fileName = `${folder}/${Date.now()}.${ext}`;

  const blob = await uriToBlob(uri);
  const { error } = await supabase.storage
    .from(bucket)
    .upload(fileName, blob, { contentType: `image/${ext}` });

  if (error) throw error;

  const { data } = supabase.storage.from(bucket).getPublicUrl(fileName);
  return data.publicUrl;
}
