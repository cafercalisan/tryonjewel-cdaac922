export async function downloadImageAs4kJpeg(params: {
  url: string;
  filenameBase: string;
  width?: number;
  height?: number;
  quality?: number;
}) {
  const { url, filenameBase, width = 3840, height = 4800, quality = 0.95 } = params;

  // Prefer a real 4K JPEG export via canvas.
  // If CORS/canvas fails, fall back to direct download.
  try {
    const img = new Image();
    img.crossOrigin = 'anonymous';

    await new Promise<void>((resolve, reject) => {
      img.onload = () => resolve();
      img.onerror = () => reject(new Error('Image load failed'));
      img.src = url;
    });

    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;

    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Canvas not supported');

    // Cover crop to 4:5 while keeping subject centered
    const srcW = img.naturalWidth || img.width;
    const srcH = img.naturalHeight || img.height;
    const targetRatio = width / height;
    const srcRatio = srcW / srcH;

    let sx = 0;
    let sy = 0;
    let sWidth = srcW;
    let sHeight = srcH;

    if (srcRatio > targetRatio) {
      // source is wider: crop width
      sWidth = Math.round(srcH * targetRatio);
      sx = Math.round((srcW - sWidth) / 2);
    } else if (srcRatio < targetRatio) {
      // source is taller: crop height
      sHeight = Math.round(srcW / targetRatio);
      sy = Math.round((srcH - sHeight) / 2);
    }

    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(img, sx, sy, sWidth, sHeight, 0, 0, width, height);

    const blob: Blob = await new Promise((resolve, reject) => {
      canvas.toBlob(
        (b) => (b ? resolve(b) : reject(new Error('JPEG export failed'))),
        'image/jpeg',
        quality
      );
    });

    const downloadUrl = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = downloadUrl;
    a.download = `${filenameBase}.jpg`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(downloadUrl);
    return;
  } catch {
    // Fallback: direct download (keeps original format)
    const response = await fetch(url);
    const blob = await response.blob();
    const downloadUrl = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = downloadUrl;
    a.download = `${filenameBase}`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(downloadUrl);
  }
}
