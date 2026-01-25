import { useCallback, useEffect } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { motion, AnimatePresence } from 'framer-motion';

interface ImageNavigatorProps {
  currentIndex: number;
  totalImages: number;
  onNavigate: (index: number) => void;
  showArrows?: boolean;
  className?: string;
}

export function ImageNavigator({
  currentIndex,
  totalImages,
  onNavigate,
  showArrows = true,
  className = '',
}: ImageNavigatorProps) {
  // Keyboard navigation
  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (e.key === 'ArrowLeft') {
      e.preventDefault();
      onNavigate(currentIndex > 0 ? currentIndex - 1 : totalImages - 1);
    } else if (e.key === 'ArrowRight') {
      e.preventDefault();
      onNavigate(currentIndex < totalImages - 1 ? currentIndex + 1 : 0);
    }
  }, [currentIndex, totalImages, onNavigate]);

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);

  if (totalImages <= 1) return null;

  return (
    <div className={`flex items-center gap-2 ${className}`}>
      {showArrows && (
        <Button
          size="icon"
          variant="secondary"
          onClick={() => onNavigate(currentIndex > 0 ? currentIndex - 1 : totalImages - 1)}
          className="h-8 w-8"
        >
          <ChevronLeft className="h-4 w-4" />
        </Button>
      )}
      
      {/* Dots indicator */}
      <div className="flex items-center gap-1.5">
        {Array.from({ length: totalImages }).map((_, index) => (
          <button
            key={index}
            onClick={() => onNavigate(index)}
            className={`w-2 h-2 rounded-full transition-all ${
              index === currentIndex
                ? 'bg-primary w-4'
                : 'bg-muted-foreground/30 hover:bg-muted-foreground/50'
            }`}
          />
        ))}
      </div>

      {showArrows && (
        <Button
          size="icon"
          variant="secondary"
          onClick={() => onNavigate(currentIndex < totalImages - 1 ? currentIndex + 1 : 0)}
          className="h-8 w-8"
        >
          <ChevronRight className="h-4 w-4" />
        </Button>
      )}
      
      {/* Counter */}
      <span className="text-xs text-muted-foreground ml-2">
        {currentIndex + 1} / {totalImages}
      </span>
    </div>
  );
}
