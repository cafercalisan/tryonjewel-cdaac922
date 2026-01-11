import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, ZoomIn, ZoomOut, Download } from 'lucide-react';
import { Button } from './button';
import { downloadImageAs4kJpeg } from '@/lib/downloadImage';

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
                  setScale(s => Math.max(0.5, s - 0.25));
                }}
              >
                <ZoomOut className="h-4 w-4" />
              </Button>
              <Button
                size="icon"
                variant="secondary"
                onClick={(e) => {
                  e.stopPropagation();
                  setScale(s => Math.min(3, s + 0.25));
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
              initial={{ scale: 0.9 }}
              animate={{ scale }}
              exit={{ scale: 0.9 }}
              transition={{ type: 'spring', stiffness: 300, damping: 30 }}
              className="max-w-[90vw] max-h-[90vh] object-contain rounded-lg shadow-2xl"
              onClick={(e) => e.stopPropagation()}
              drag
              dragConstraints={{ left: 0, right: 0, top: 0, bottom: 0 }}
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
