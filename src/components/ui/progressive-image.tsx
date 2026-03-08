import { useState, useCallback, useRef, useEffect } from 'react';
import { cn } from '@/lib/utils';

interface ProgressiveImageProps {
  src: string;
  alt: string;
  thumbnailSrc?: string;
  className?: string;
  containerClassName?: string;
  eager?: boolean;
}

export function ProgressiveImage({
  src,
  alt,
  thumbnailSrc,
  className,
  containerClassName,
  eager = false,
}: ProgressiveImageProps) {
  const [thumbLoaded, setThumbLoaded] = useState(false);
  const [fullLoaded, setFullLoaded] = useState(false);
  const [error, setError] = useState(false);
  const [isVisible, setIsVisible] = useState(eager);
  const containerRef = useRef<HTMLDivElement>(null);

  // IntersectionObserver for lazy rendering
  useEffect(() => {
    if (eager || isVisible) return;
    const el = containerRef.current;
    if (!el) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsVisible(true);
          observer.disconnect();
        }
      },
      { rootMargin: '200px' },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [eager, isVisible]);

  const handleThumbLoad = useCallback(() => setThumbLoaded(true), []);
  const handleFullLoad = useCallback(() => setFullLoaded(true), []);
  const handleError = useCallback(() => setError(true), []);

  const activeSrc = thumbnailSrc || src;

  return (
    <div ref={containerRef} className={cn('relative overflow-hidden', containerClassName)}>
      {/* Shimmer skeleton — shown until something loads */}
      {!thumbLoaded && !fullLoaded && !error && (
        <div className="absolute inset-0 bg-muted animate-pulse">
          <div className="absolute inset-0 bg-gradient-to-r from-transparent via-foreground/5 to-transparent animate-[shimmer_1.5s_infinite]" />
        </div>
      )}

      {error ? (
        <div className="absolute inset-0 bg-muted flex flex-col items-center justify-center gap-1.5">
          <div className="w-8 h-8 rounded-full bg-muted-foreground/10 flex items-center justify-center">
            <svg className="w-4 h-4 text-muted-foreground" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="m2.25 15.75 5.159-5.159a2.25 2.25 0 0 1 3.182 0l5.159 5.159m-1.5-1.5 1.409-1.409a2.25 2.25 0 0 1 3.182 0l2.909 2.909M3.75 21h16.5A2.25 2.25 0 0 0 22.5 18.75V5.25A2.25 2.25 0 0 0 20.25 3H3.75A2.25 2.25 0 0 0 1.5 5.25v13.5A2.25 2.25 0 0 0 3.75 21Z" />
            </svg>
          </div>
        </div>
      ) : isVisible ? (
        <>
          {/* Thumbnail (small, fast) — shown first */}
          {thumbnailSrc && !fullLoaded && (
            <img
              src={thumbnailSrc}
              alt={alt}
              loading={eager ? 'eager' : 'lazy'}
              decoding="async"
              onLoad={handleThumbLoad}
              onError={handleError}
              className={cn(
                'transition-opacity duration-500 ease-out',
                thumbLoaded ? 'opacity-100' : 'opacity-0',
                className,
              )}
            />
          )}

          {/* Full resolution — loads on top of thumbnail */}
          <img
            src={thumbnailSrc ? src : activeSrc}
            alt={alt}
            loading={eager ? 'eager' : 'lazy'}
            decoding="async"
            onLoad={thumbnailSrc ? handleFullLoad : handleThumbLoad}
            onError={handleError}
            className={cn(
              'transition-all duration-700 ease-out',
              thumbnailSrc
                ? (fullLoaded ? 'opacity-100' : 'opacity-0 absolute inset-0')
                : (thumbLoaded ? 'blur-0 opacity-100 scale-100' : 'blur-md opacity-0 scale-105'),
              className,
            )}
          />
        </>
      ) : null}
    </div>
  );
}
