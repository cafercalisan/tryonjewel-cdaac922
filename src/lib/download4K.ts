import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

/**
 * Download image with 4K upscaling via edge function
 */
export async function download4KImage(
  imageUrl: string,
  filename: string,
  onProgress?: (stage: 'fetching' | 'upscaling' | 'downloading') => void
): Promise<void> {
  try {
    onProgress?.('fetching');
    
    // Call the upscale edge function
    onProgress?.('upscaling');
    
    const { data, error } = await supabase.functions.invoke('upscale-image', {
      body: { 
        imageUrl,
        upscaleFactor: 'x4'
      }
    });

    if (error) {
      console.error('Upscale error:', error);
      // Fallback to direct download
      await fallbackDownload(imageUrl, filename);
      return;
    }

    if (!data?.upscaledImageBase64) {
      console.warn('No upscaled image returned, using original');
      await fallbackDownload(imageUrl, filename);
      return;
    }

    onProgress?.('downloading');

    // Convert base64 to blob and download
    const mimeType = data.mimeType || 'image/png';
    const byteCharacters = atob(data.upscaledImageBase64);
    const byteNumbers = new Array(byteCharacters.length);
    
    for (let i = 0; i < byteCharacters.length; i++) {
      byteNumbers[i] = byteCharacters.charCodeAt(i);
    }
    
    const byteArray = new Uint8Array(byteNumbers);
    const blob = new Blob([byteArray], { type: mimeType });

    // Create download link
    const url = URL.createObjectURL(blob);
    const extension = mimeType.includes('png') ? 'png' : 'jpg';
    
    const link = document.createElement('a');
    link.href = url;
    link.download = `${filename}-4K.${extension}`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    toast.success('4K görsel indirildi');
  } catch (err) {
    console.error('4K download error:', err);
    // Fallback to regular download
    await fallbackDownload(imageUrl, filename);
  }
}

/**
 * Fallback to canvas-based high-quality download
 */
async function fallbackDownload(url: string, filename: string): Promise<void> {
  try {
    const img = new Image();
    img.crossOrigin = 'anonymous';

    await new Promise<void>((resolve, reject) => {
      img.onload = () => resolve();
      img.onerror = () => reject(new Error('Image load failed'));
      img.src = url;
    });

    const srcW = img.naturalWidth || img.width;
    const srcH = img.naturalHeight || img.height;

    // Scale up to 4K maintaining aspect ratio
    const targetWidth = 3840;
    const scale = targetWidth / srcW;
    const finalWidth = Math.min(targetWidth, srcW * 2); // Max 2x upscale
    const finalHeight = Math.round(srcH * (finalWidth / srcW));

    const canvas = document.createElement('canvas');
    canvas.width = finalWidth;
    canvas.height = finalHeight;

    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Canvas not supported');

    // High quality rendering
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(img, 0, 0, finalWidth, finalHeight);

    // Export as PNG for max quality
    const blob: Blob = await new Promise((resolve, reject) => {
      canvas.toBlob(
        (b) => (b ? resolve(b) : reject(new Error('Export failed'))),
        'image/png',
        1.0
      );
    });

    const downloadUrl = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = downloadUrl;
    link.download = `${filename}-HQ.png`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(downloadUrl);

    toast.success('Yüksek çözünürlüklü görsel indirildi');
  } catch (err) {
    console.error('Fallback download error:', err);
    // Last resort: open in new tab
    window.open(url, '_blank');
    toast.info('Görsel yeni sekmede açıldı');
  }
}
