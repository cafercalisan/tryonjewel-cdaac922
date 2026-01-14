import { supabase } from "@/integrations/supabase/client";

export interface Temp4KResult {
  imageBase64: string;
  mimeType: string;
  dataUrl: string;
}

/**
 * Generate a 4K temporary image that is NOT stored in cloud storage.
 * User can view and download, but image is lost on page refresh.
 */
export async function generate4KTempImage(
  imageFile: File,
  prompt: string,
  aspectRatio: string = '1:1',
  onProgress?: (status: string) => void
): Promise<Temp4KResult> {
  onProgress?.('Görsel hazırlanıyor...');
  
  // Convert file to base64
  const base64 = await fileToBase64(imageFile);
  
  onProgress?.('4K görsel oluşturuluyor...');
  
  const { data, error } = await supabase.functions.invoke('generate-4k-temp', {
    body: {
      imageBase64: base64,
      prompt,
      aspectRatio,
    },
  });

  if (error) {
    throw new Error(error.message || 'Generation failed');
  }

  if (!data?.success || !data?.imageBase64) {
    throw new Error(data?.error || 'No image returned');
  }

  onProgress?.('Tamamlandı!');

  const dataUrl = `data:${data.mimeType};base64,${data.imageBase64}`;

  return {
    imageBase64: data.imageBase64,
    mimeType: data.mimeType,
    dataUrl,
  };
}

/**
 * Convert File to base64 string (without data URL prefix)
 */
function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      // Remove data URL prefix to get pure base64
      const base64 = result.split(',')[1];
      resolve(base64);
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

/**
 * Download a data URL as a file
 */
export function downloadDataUrl(dataUrl: string, filename: string = 'jewelry-4k.png') {
  const link = document.createElement('a');
  link.href = dataUrl;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}
