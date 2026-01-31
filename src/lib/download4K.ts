import { toast } from 'sonner';

/**
 * Download image at highest available resolution
 * Since we now generate at 4K via API, this just downloads the original file
 */
export async function download4KImage(
  imageUrl: string,
  filename: string,
  onProgress?: (stage: 'fetching' | 'downloading') => void
): Promise<void> {
  try {
    onProgress?.('fetching');
    
    // Fetch the original image (already 4K from Gemini API)
    const response = await fetch(imageUrl, { mode: 'cors' });
    
    if (!response.ok) {
      throw new Error(`Failed to fetch image: ${response.status}`);
    }
    
    const blob = await response.blob();
    
    onProgress?.('downloading');
    
    // Determine file extension from blob type
    const extension = blob.type.includes('png') ? 'png' : 
                      blob.type.includes('webp') ? 'webp' : 'jpg';
    
    // Create download link
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${filename}-4K.${extension}`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    toast.success('4K görsel indirildi');
  } catch (err) {
    console.error('Download error:', err);
    // Fallback: open in new tab
    window.open(imageUrl, '_blank');
    toast.info('Görsel yeni sekmede açıldı');
  }
}
