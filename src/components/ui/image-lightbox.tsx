import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, ZoomIn, ZoomOut, Download } from 'lucide-react';
import { Button } from './button';
import { downloadImageAs4kJpeg } from '@/lib/downloadImage';

/** Controlled overlay lightbox — parent manages open/close via src */
export function LightboxOverlay({ src, onClose }: { src: string | null; onClose: () => void }) {
  const [scale, setScale] = useState(1);

  // Reset zoom when image changes
  useEffect(() => {
    setScale(1);
  }, [src]);

  // Body scroll lock
  useEffect(() => {
    if (!src) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = prev; };
  }, [src]);

  // ESC key support
  useEffect(() => {
    if (!src) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [src, onClose]);

  // Double-click zoom toggle
  const handleDoubleClick = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    setScale(s => s === 1 ? 2 : 1);
  }, []);

  return (
    <AnimatePresence>
      {src && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.25 }}
          className="fixed inset-0 z-[100] bg-black/90 backdrop-blur-sm flex items-center justify-center p-4 md:p-8"
          onClick={onClose}
        >
          {/* Close button */}
          <button
            className="absolute top-4 right-4 z-10 w-10 h-10 rounded-full flex items-center justify-center transition-colors cursor-pointer hover:bg-white/20"
            style={{ background: 'rgba(255,255,255,0.1)', color: 'hsl(38,45%,55%)' }}
            onClick={onClose}
          >
            <X className="h-5 w-5" />
          </button>

          {/* Zoom controls */}
          <div className="absolute top-4 left-4 z-10 flex items-center gap-2">
            <button
              className="w-9 h-9 rounded-full flex items-center justify-center transition-colors cursor-pointer hover:bg-white/20"
              style={{ background: 'rgba(255,255,255,0.1)', color: 'hsl(38,45%,55%)' }}
              onClick={(e) => { e.stopPropagation(); setScale(s => Math.max(0.5, s - 0.5)); }}
            >
              <ZoomOut className="h-4 w-4" />
            </button>
            <button
              className="w-9 h-9 rounded-full flex items-center justify-center transition-colors cursor-pointer hover:bg-white/20"
              style={{ background: 'rgba(255,255,255,0.1)', color: 'hsl(38,45%,55%)' }}
              onClick={(e) => { e.stopPropagation(); setScale(s => Math.min(3, s + 0.5)); }}
            >
              <ZoomIn className="h-4 w-4" />
            </button>
          </div>

          {/* Scale indicator */}
          <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-10 px-4 py-1.5 rounded-full backdrop-blur-md"
            style={{ background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.1)' }}
          >
            <span className="text-xs font-medium tracking-wider" style={{ color: 'rgba(255,255,255,0.6)' }}>
              {Math.round(scale * 100)}%
            </span>
          </div>

          {/* Image */}
          <motion.img
            src={src}
            alt="Büyütülmüş görsel"
            initial={{ scale: 0.92, opacity: 0 }}
            animate={{ scale, opacity: 1 }}
            exit={{ scale: 0.92, opacity: 0 }}
            transition={{ type: 'spring', stiffness: 300, damping: 30 }}
            className="max-h-[85vh] max-w-full object-contain rounded-xl cursor-zoom-in"
            style={{ border: '1px solid hsla(38,45%,55%,0.2)' }}
            onClick={(e) => e.stopPropagation()}
            onDoubleClick={handleDoubleClick}
            drag={scale > 1}
            dragConstraints={{ left: -200, right: 200, top: -200, bottom: 200 }}
            dragElastic={0.1}
          />
        </motion.div>
      )}
    </AnimatePresence>
  );
}

interface ImageLightboxProps {
  src: string;
  alt: string;
  className?: string;
  enableDownload?: boolean;
  downloadFilename?: string;
}

export function ImageLightbox({
  src,
  alt,
  className = '',
  enableDownload = false,
  downloadFilename = 'jewelry-image'
}: ImageLightboxProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [scale, setScale] = useState(1);

  // Body scroll lock
  useEffect(() => {
    if (!isOpen) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = prev; };
  }, [isOpen]);

  // ESC key support
  useEffect(() => {
    if (!isOpen) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setIsOpen(false);
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [isOpen]);

  // Reset zoom on close
  useEffect(() => {
    if (!isOpen) setScale(1);
  }, [isOpen]);

  const handleDoubleClick = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    setScale(s => s === 1 ? 2 : 1);
  }, []);

  const handleDownload = async () => {
    await downloadImageAs4kJpeg({
      url: src,
      filenameBase: downloadFilename,
      width: 3840,
      height: 4800,
      quality: 0.95,
    });
  };

  return (
    <>
      <div
        className={`cursor-zoom-in relative group ${className}`}
        onClick={() => setIsOpen(true)}
      >
        <img src={src} alt={alt} className="w-full h-full object-cover" />
        <div className="absolute inset-0 bg-foreground/0 group-hover:bg-foreground/20 transition-colors flex items-center justify-center opacity-0 group-hover:opacity-100">
          <ZoomIn className="h-8 w-8 text-white drop-shadow-lg" />
        </div>
      </div>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.25 }}
            className="fixed inset-0 z-[100] bg-background/95 backdrop-blur-md flex items-center justify-center p-4"
            onClick={() => setIsOpen(false)}
          >
            {/* Controls */}
            <div className="absolute top-4 right-4 flex items-center gap-2 z-10">
              <Button
                size="icon"
                variant="secondary"
                onClick={(e) => {
                  e.stopPropagation();
                  setScale(s => Math.max(0.5, s - 0.5));
                }}
              >
                <ZoomOut className="h-4 w-4" />
              </Button>
              <Button
                size="icon"
                variant="secondary"
                onClick={(e) => {
                  e.stopPropagation();
                  setScale(s => Math.min(3, s + 0.5));
                }}
              >
                <ZoomIn className="h-4 w-4" />
              </Button>
              {enableDownload && (
                <Button
                  size="icon"
                  variant="secondary"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleDownload();
                  }}
                >
                  <Download className="h-4 w-4" />
                </Button>
              )}
              <Button
                size="icon"
                variant="secondary"
                onClick={() => setIsOpen(false)}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>

            {/* Image */}
            <motion.img
              src={src}
              alt={alt}
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              transition={{ type: 'spring', stiffness: 300, damping: 30 }}
              className="max-w-[90vw] max-h-[90vh] object-contain rounded-lg shadow-2xl cursor-zoom-in"
              onClick={(e) => e.stopPropagation()}
              onDoubleClick={handleDoubleClick}
              drag={scale > 1}
              dragConstraints={{ left: -200, right: 200, top: -200, bottom: 200 }}
              dragElastic={0.1}
            />

            {/* Scale indicator */}
            <div className="absolute bottom-4 left-1/2 -translate-x-1/2 bg-secondary/80 backdrop-blur-sm px-3 py-1.5 rounded-full">
              <span className="text-sm font-medium">{Math.round(scale * 100)}%</span>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
