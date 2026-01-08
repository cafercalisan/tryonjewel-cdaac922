import { useState, useRef, useCallback } from 'react';
import { motion } from 'framer-motion';
import { GripVertical } from 'lucide-react';

interface ImageComparisonSliderProps {
  beforeImage: string;
  afterImage: string;
  beforeLabel?: string;
  afterLabel?: string;
}

export function ImageComparisonSlider({
  beforeImage,
  afterImage,
  beforeLabel = 'Önce',
  afterLabel = 'Sonra',
}: ImageComparisonSliderProps) {
  const [sliderPosition, setSliderPosition] = useState(50);
  const [isDragging, setIsDragging] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const handleMove = useCallback(
    (clientX: number) => {
      if (!containerRef.current) return;

      const rect = containerRef.current.getBoundingClientRect();
      const x = Math.max(0, Math.min(clientX - rect.left, rect.width));
      const percent = Math.max(0, Math.min(100, (x / rect.width) * 100));
      setSliderPosition(percent);
    },
    []
  );

  const handleMouseDown = useCallback(() => {
    setIsDragging(true);
  }, []);

  const handleMouseUp = useCallback(() => {
    setIsDragging(false);
  }, []);

  const handleMouseMove = useCallback(
    (e: React.MouseEvent) => {
      if (!isDragging) return;
      handleMove(e.clientX);
    },
    [isDragging, handleMove]
  );

  const handleTouchMove = useCallback(
    (e: React.TouchEvent) => {
      handleMove(e.touches[0].clientX);
    },
    [handleMove]
  );

  const handleClick = useCallback(
    (e: React.MouseEvent) => {
      handleMove(e.clientX);
    },
    [handleMove]
  );

  return (
    <div
      ref={containerRef}
      className="relative aspect-square w-full rounded-2xl overflow-hidden cursor-ew-resize select-none shadow-luxury-lg"
      onMouseMove={handleMouseMove}
      onMouseDown={handleMouseDown}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
      onTouchMove={handleTouchMove}
      onTouchStart={handleMouseDown}
      onTouchEnd={handleMouseUp}
      onClick={handleClick}
    >
      {/* After Image (Full) */}
      <img
        src={afterImage}
        alt={afterLabel}
        className="absolute inset-0 w-full h-full object-cover"
        draggable={false}
      />

      {/* Before Image (Clipped) */}
      <div
        className="absolute inset-0 overflow-hidden"
        style={{ clipPath: `inset(0 ${100 - sliderPosition}% 0 0)` }}
      >
        <img
          src={beforeImage}
          alt={beforeLabel}
          className="absolute inset-0 w-full h-full object-cover"
          draggable={false}
        />
      </div>

      {/* Slider Line */}
      <motion.div
        className="absolute top-0 bottom-0 w-1 bg-white shadow-lg"
        style={{ left: `${sliderPosition}%`, transform: 'translateX(-50%)' }}
        animate={{ 
          boxShadow: isDragging 
            ? '0 0 20px rgba(255,255,255,0.5)' 
            : '0 0 10px rgba(0,0,0,0.3)' 
        }}
      >
        {/* Slider Handle */}
        <motion.div
          className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-12 h-12 rounded-full bg-white shadow-luxury-lg flex items-center justify-center"
          whileHover={{ scale: 1.1 }}
          whileTap={{ scale: 0.95 }}
          animate={{ 
            scale: isDragging ? 1.1 : 1,
          }}
          transition={{ type: 'spring', stiffness: 300, damping: 20 }}
        >
          <GripVertical className="h-5 w-5 text-muted-foreground" />
        </motion.div>
      </motion.div>

      {/* Labels */}
      <motion.div
        className="absolute top-4 left-4 px-3 py-1.5 bg-muted/90 backdrop-blur-sm text-muted-foreground text-xs font-medium rounded-full"
        initial={{ opacity: 0, x: -10 }}
        animate={{ opacity: sliderPosition > 15 ? 1 : 0, x: 0 }}
        transition={{ duration: 0.2 }}
      >
        {beforeLabel}
      </motion.div>
      <motion.div
        className="absolute top-4 right-4 px-3 py-1.5 bg-primary/90 backdrop-blur-sm text-primary-foreground text-xs font-medium rounded-full"
        initial={{ opacity: 0, x: 10 }}
        animate={{ opacity: sliderPosition < 85 ? 1 : 0, x: 0 }}
        transition={{ duration: 0.2 }}
      >
        {afterLabel}
      </motion.div>

      {/* Instruction hint */}
      <motion.div
        className="absolute bottom-4 left-1/2 -translate-x-1/2 px-4 py-2 bg-background/80 backdrop-blur-sm text-foreground text-xs font-medium rounded-full flex items-center gap-2"
        initial={{ opacity: 1, y: 0 }}
        animate={{ opacity: isDragging ? 0 : 1, y: isDragging ? 10 : 0 }}
        transition={{ duration: 0.3 }}
      >
        <motion.div
          animate={{ x: [-3, 3, -3] }}
          transition={{ duration: 1.5, repeat: Infinity, ease: 'easeInOut' }}
        >
          <GripVertical className="h-4 w-4" />
        </motion.div>
        <span>Karşılaştırmak için kaydırın</span>
      </motion.div>
    </div>
  );
}
