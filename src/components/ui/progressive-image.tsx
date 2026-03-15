import { useState, useCallback, useRef, useEffect } from 'react';
import { cn } from '@/lib/utils';

interface ProgressiveImageProps {
  src: string;
  alt: string;
  thumbnailSrc?: string;
  className?: string;
  containerClassName?: string;
  eager?: boolean;
  aspectRatio?: string;
}

export function ProgressiveImage({
  src,
  alt,
  thumbnailSrc: _thumbnailSrc, // MinIO has no transform pipeline — ignore thumbnail, load full directly
  className,
  containerClassName,
  eager = false,
  aspectRatio,
}: ProgressiveImageProps) {
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState(false);
  const [isVisible, setIsVisible] = useState(eager);
  const containerRef = useRef<HTMLDivElement>(null);

  // IntersectionObserver for lazy rendering — load when 300px before viewport
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
      { rootMargin: '300px' },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [eager, isVisible]);

  const handleLoad = useCallback(() => setLoaded(true), []);
  const handleError = useCallback(() => setError(true), []);

  return (
    <div
      ref={containerRef}
      className={cn('relative overflow-hidden', containerClassName)}
      style={aspectRatio ? { aspectRatio } : undefined}
    >
      {/* Shimmer skeleton */}
      {!loaded && !error && (
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
        <img
          src={src}
          alt={alt}
          loading={eager ? 'eager' : 'lazy'}
          decoding={eager ? 'sync' : 'async'}
          fetchPriority={eager ? 'high' : 'auto'}
          onLoad={handleLoad}
          onError={handleError}
          className={cn(
            'transition-opacity duration-500 ease-out',
            loaded ? 'opacity-100' : 'opacity-0',
            className,
          )}
        />
      ) : null}
    </div>
  );
}
