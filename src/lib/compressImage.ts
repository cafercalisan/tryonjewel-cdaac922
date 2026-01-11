/**
 * Compress an image file to a target size while maintaining quality
 * @param file - The original image file
 * @param maxSizeMB - Maximum size in MB (default 1.4 to stay under 1.5MB limit)
 * @param maxDimension - Maximum width/height dimension (default 2048)
 * @returns Compressed file or original if already small enough
 */
export async function compressImage(
  file: File,
  maxSizeMB: number = 1.4,
  maxDimension: number = 2048
): Promise<File> {
  const maxSizeBytes = maxSizeMB * 1024 * 1024;

  // If file is already small enough, return as-is
  if (file.size <= maxSizeBytes) {
    return file;
  }

  return new Promise((resolve, reject) => {
    const img = new Image();
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');

    if (!ctx) {
      reject(new Error('Canvas not supported'));
      return;
    }

    img.onload = () => {
      let { width, height } = img;

      // Scale down if dimensions are too large
      if (width > maxDimension || height > maxDimension) {
        const ratio = Math.min(maxDimension / width, maxDimension / height);
        width = Math.round(width * ratio);
        height = Math.round(height * ratio);
      }

      canvas.width = width;
      canvas.height = height;

      // Draw image with high quality
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = 'high';
      ctx.drawImage(img, 0, 0, width, height);

      // Try different quality levels to find the best one that fits
      const tryCompress = (quality: number): void => {
        canvas.toBlob(
          (blob) => {
            if (!blob) {
              reject(new Error('Failed to compress image'));
              return;
            }

            // If it fits or we've reached minimum quality, use it
            if (blob.size <= maxSizeBytes || quality <= 0.5) {
              const compressedFile = new File([blob], file.name, {
                type: 'image/jpeg',
                lastModified: Date.now(),
              });
              resolve(compressedFile);
            } else {
              // Try again with lower quality
              tryCompress(quality - 0.1);
            }
          },
          'image/jpeg',
          quality
        );
      };

      // Start with 0.9 quality
      tryCompress(0.9);
    };

    img.onerror = () => {
      reject(new Error('Failed to load image'));
    };

    img.src = URL.createObjectURL(file);
  });
}

/**
 * Get file size in human readable format
 */
export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}
