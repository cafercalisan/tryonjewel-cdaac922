export async function downloadImageAs4kJpeg(params: {
  url: string;
  filenameBase: string;
  width?: number;
  height?: number;
  quality?: number;
}) {
  const { url, filenameBase, width = 3840, height = 4800, quality = 0.95 } = params;

  // Try canvas approach first for 4K export
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

    const srcW = img.naturalWidth || img.width;
    const srcH = img.naturalHeight || img.height;
    const targetRatio = width / height;
    const srcRatio = srcW / srcH;

    let sx = 0;
    let sy = 0;
    let sWidth = srcW;
    let sHeight = srcH;

    if (srcRatio > targetRatio) {
      sWidth = Math.round(srcH * targetRatio);
      sx = Math.round((srcW - sWidth) / 2);
    } else if (srcRatio < targetRatio) {
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
    triggerDownload(downloadUrl, `${filenameBase}.jpg`);
    URL.revokeObjectURL(downloadUrl);
    return;
  } catch {
    // Fallback: open in new tab for manual save
    try {
      // Try fetch with no-cors fallback
      const response = await fetch(url, { mode: 'cors' });
      const blob = await response.blob();
      const downloadUrl = URL.createObjectURL(blob);
      triggerDownload(downloadUrl, `${filenameBase}.jpg`);
      URL.revokeObjectURL(downloadUrl);
    } catch {
      // Last resort: open image in new tab
      window.open(url, '_blank');
    }
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
