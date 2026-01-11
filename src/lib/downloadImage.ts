export async function downloadImage(url: string, filename: string) {
  try {
    // Try canvas approach for CORS compatibility
    const img = new Image();
    img.crossOrigin = 'anonymous';

    await new Promise<void>((resolve, reject) => {
      img.onload = () => resolve();
      img.onerror = () => reject(new Error('Image load failed'));
      img.src = url;
    });

    const canvas = document.createElement('canvas');
    canvas.width = img.naturalWidth || img.width;
    canvas.height = img.naturalHeight || img.height;

    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Canvas not supported');

    ctx.drawImage(img, 0, 0);

    const blob: Blob = await new Promise((resolve, reject) => {
      canvas.toBlob(
        (b) => (b ? resolve(b) : reject(new Error('Export failed'))),
        'image/png',
        1.0
      );
    });

    const downloadUrl = URL.createObjectURL(blob);
    triggerDownload(downloadUrl, filename);
    URL.revokeObjectURL(downloadUrl);
    return;
  } catch {
    // Fallback: try fetch
    try {
      const response = await fetch(url, { mode: 'cors' });
      const blob = await response.blob();
      const downloadUrl = URL.createObjectURL(blob);
      triggerDownload(downloadUrl, filename);
      URL.revokeObjectURL(downloadUrl);
    } catch {
      // Last resort: open image in new tab
      window.open(url, '_blank');
    }
  }
}

/**
 * Download image at maximum quality preserving original resolution
 * If the original is already high-res, keep it. Only upscale if smaller than target.
 */
export async function downloadImageAs4kJpeg(params: {
  url: string;
  filenameBase: string;
  width?: number;
  height?: number;
  quality?: number;
}) {
  const { url, filenameBase, width = 3840, height = 4800, quality = 1.0 } = params;

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

    // Use original resolution if it's already high quality, otherwise use target
    // Keep aspect ratio intact
    const targetRatio = width / height;
    const srcRatio = srcW / srcH;
    
    let finalWidth: number;
    let finalHeight: number;
    
    // If source is already high-res (>= 2K), preserve original dimensions
    const isHighRes = srcW >= 2048 || srcH >= 2048;
    
    if (isHighRes) {
      // Keep original resolution
      finalWidth = srcW;
      finalHeight = srcH;
    } else {
      // Upscale to target resolution maintaining aspect ratio
      if (srcRatio > targetRatio) {
        finalWidth = width;
        finalHeight = Math.round(width / srcRatio);
      } else {
        finalHeight = height;
        finalWidth = Math.round(height * srcRatio);
      }
    }

    const canvas = document.createElement('canvas');
    canvas.width = finalWidth;
    canvas.height = finalHeight;

    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Canvas not supported');

    // Use highest quality rendering
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    
    // Draw image without cropping - preserve full image
    ctx.drawImage(img, 0, 0, finalWidth, finalHeight);

    // Export as PNG for maximum quality (lossless)
    const blob: Blob = await new Promise((resolve, reject) => {
      canvas.toBlob(
        (b) => (b ? resolve(b) : reject(new Error('Export failed'))),
        'image/png', // PNG for lossless quality
        quality
      );
    });

    const downloadUrl = URL.createObjectURL(blob);
    triggerDownload(downloadUrl, `${filenameBase}.png`);
    URL.revokeObjectURL(downloadUrl);
    return;
  } catch {
    // Fallback: try direct fetch
    try {
      const response = await fetch(url, { mode: 'cors' });
      const blob = await response.blob();
      const downloadUrl = URL.createObjectURL(blob);
      triggerDownload(downloadUrl, `${filenameBase}.png`);
      URL.revokeObjectURL(downloadUrl);
    } catch {
      // Last resort: open image in new tab
      window.open(url, '_blank');
    }
  }
}

/**
 * Download image at original resolution without any processing
 */
export async function downloadOriginalImage(url: string, filename: string) {
  try {
    const response = await fetch(url, { mode: 'cors' });
    const blob = await response.blob();
    
    // Detect original format from blob type
    const extension = blob.type.includes('png') ? '.png' : 
                      blob.type.includes('webp') ? '.webp' : '.jpg';
    
    const downloadUrl = URL.createObjectURL(blob);
    triggerDownload(downloadUrl, `${filename}${extension}`);
    URL.revokeObjectURL(downloadUrl);
  } catch {
    // Fallback: open in new tab
    window.open(url, '_blank');
  }
}

function triggerDownload(url: string, filename: string) {
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.style.display = 'none';
  document.body.appendChild(a);
  a.click();
  setTimeout(() => {
    document.body.removeChild(a);
  }, 100);
}
