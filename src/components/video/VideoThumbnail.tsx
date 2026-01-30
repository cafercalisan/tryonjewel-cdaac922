import { useState, useEffect, useCallback } from 'react';
import { getSignedImageUrl } from '@/lib/getSignedImageUrl';
import { ImageIcon } from 'lucide-react';

interface VideoThumbnailProps {
  src: string;
  alt: string;
  className?: string;
}

/**
 * Robust video thumbnail component with signed URL support and fallback
 */
export function VideoThumbnail({ src, alt, className = '' }: VideoThumbnailProps) {
  const [imageSrc, setImageSrc] = useState<string | null>(null);
  const [hasError, setHasError] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  const loadImage = useCallback(async () => {
    if (!src) {
      setHasError(true);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setHasError(false);

    try {
      // First try to get a signed URL
      const signedUrl = await getSignedImageUrl(src);
      
      if (signedUrl) {
        // Test if the URL works
        const img = new Image();
        img.onload = () => {
          setImageSrc(signedUrl);
          setIsLoading(false);
        };
        img.onerror = () => {
          // Try original URL as fallback
          const fallbackImg = new Image();
          fallbackImg.onload = () => {
            setImageSrc(src);
            setIsLoading(false);
          };
          fallbackImg.onerror = () => {
            setHasError(true);
            setIsLoading(false);
          };
          fallbackImg.src = src;
        };
        img.src = signedUrl;
      } else {
        // No signed URL, try original
        setImageSrc(src);
        setIsLoading(false);
      }
    } catch (err) {
      console.error('Thumbnail load error:', err);
      // Try original as last resort
      setImageSrc(src);
      setIsLoading(false);
    }
  }, [src]);

  useEffect(() => {
    loadImage();
  }, [loadImage]);

  const handleImageError = () => {
    if (imageSrc !== src && src) {
      // Try original URL if signed URL failed
      setImageSrc(src);
    } else {
      setHasError(true);
    }
  };

  if (hasError) {
    return (
      <div className={`w-full h-full flex items-center justify-center bg-muted ${className}`}>
        <div className="text-center text-muted-foreground">
          <ImageIcon className="h-8 w-8 mx-auto mb-2 opacity-50" />
          <p className="text-xs">Görsel yüklenemedi</p>
        </div>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className={`w-full h-full bg-muted animate-pulse ${className}`} />
    );
  }

  return (
    <img
      src={imageSrc || src}
      alt={alt}
      className={`w-full h-full object-cover ${className}`}
      onError={handleImageError}
    />
  );
}
