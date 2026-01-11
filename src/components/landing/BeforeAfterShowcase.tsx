import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Sparkles, ZoomIn, X, ZoomOut } from 'lucide-react';
import { Button } from '@/components/ui/button';

// Import showcase images
import earringOriginal from '@/assets/showcase/earring-original.webp';
import earringResult from '@/assets/showcase/earring-result.webp';
import emeraldBraceletOriginal from '@/assets/showcase/emerald-bracelet-original.webp';
import emeraldBraceletResult1 from '@/assets/showcase/emerald-bracelet-result-1.webp';
import sapphireBraceletOriginal from '@/assets/showcase/sapphire-bracelet-original.webp';
import sapphireBraceletResult from '@/assets/showcase/sapphire-bracelet-result.webp';
import blueSapphireBraceletOriginal from '@/assets/showcase/blue-sapphire-bracelet-original.webp';
import blueSapphireBraceletResult from '@/assets/showcase/blue-sapphire-bracelet-result.webp';
import ringOriginal from '@/assets/showcase/ring-original.webp';
import ringResult from '@/assets/showcase/ring-result.webp';
import diamondSetOriginal from '@/assets/showcase/diamond-set-original.webp';

// Mannequin result image
const mannequinResult = '/lovable-uploads/d9abf31c-925c-4750-961f-11908e4e649a.webp';

interface ShowcaseItem {
  id: string;
  name: string;
  original: string;
  result: string;
}

const showcaseItems: ShowcaseItem[] = [
  {
    id: 'diamond-set-mannequin',
    name: 'Pırlanta Set - Manken Çekimi',
    original: diamondSetOriginal,
    result: mannequinResult,
  },
  {
    id: 'earring',
    name: 'Pırlanta Küpe',
    original: earringOriginal,
    result: earringResult,
  },
  {
    id: 'emerald-bracelet',
    name: 'Zümrüt Pırlanta Bilezik',
    original: emeraldBraceletOriginal,
    result: emeraldBraceletResult1,
  },
  {
    id: 'sapphire-bracelet',
    name: 'Safir Pırlanta Bilezik',
    original: sapphireBraceletOriginal,
    result: sapphireBraceletResult,
  },
  {
    id: 'blue-sapphire-bracelet',
    name: 'Mavi Safir Bilezik',
    original: blueSapphireBraceletOriginal,
    result: blueSapphireBraceletResult,
  },
  {
    id: 'ring',
    name: 'Pırlanta Yüzük',
    original: ringOriginal,
    result: ringResult,
  },
];

export function BeforeAfterShowcase() {
  const [activeIndex, setActiveIndex] = useState(0);
  const [isHovered, setIsHovered] = useState(false);
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [lightboxImage, setLightboxImage] = useState<{ src: string; alt: string; type: 'before' | 'after' } | null>(null);
  const [lightboxScale, setLightboxScale] = useState(1);

  const currentItem = showcaseItems[activeIndex];

  // Auto-rotate through items
  useEffect(() => {
    if (isHovered) return;
    
    const interval = setInterval(() => {
      setActiveIndex((prev) => (prev + 1) % showcaseItems.length);
    }, 6000);

    return () => clearInterval(interval);
  }, [isHovered]);

  const openLightbox = (src: string, alt: string, type: 'before' | 'after') => {
    setLightboxImage({ src, alt, type });
    setLightboxScale(1);
    setLightboxOpen(true);
  };

  return (
    <section className="py-20 md:py-28 overflow-hidden">
      <div className="container">
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          viewport={{ once: true }}
          className="text-center mb-16"
        >
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-accent text-accent-foreground text-sm font-medium mb-6">
            <Sparkles className="h-4 w-4" />
            <span>Gerçek Dönüşümler</span>
          </div>
          <h2 className="text-3xl md:text-4xl font-semibold mb-4">
            Önce & Sonra
          </h2>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            Basit ürün fotoğraflarından profesyonel görsel içeriklere
          </p>
        </motion.div>

        {/* 2-Column Grid Layout */}
        <div className="max-w-5xl mx-auto">
          <div 
            className="grid md:grid-cols-2 gap-6 md:gap-8"
            onMouseEnter={() => setIsHovered(true)}
            onMouseLeave={() => setIsHovered(false)}
          >
            {/* Before Image */}
            <motion.div
              initial={{ opacity: 0, x: -20 }}
              whileInView={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.5 }}
              viewport={{ once: true }}
              className="relative"
            >
              <div className="absolute top-4 left-4 z-10">
                <span className="px-3 py-1.5 rounded-full bg-background/90 backdrop-blur-sm text-sm font-medium border border-border/50 shadow-sm">
                  Önce
                </span>
              </div>
              <motion.div 
                key={`before-${currentItem.id}`}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 0.4 }}
                className="aspect-square rounded-2xl overflow-hidden bg-muted border border-border/50 shadow-luxury cursor-zoom-in group relative"
                onClick={() => openLightbox(currentItem.original, `${currentItem.name} - Önce`, 'before')}
              >
                <img
                  src={currentItem.original}
                  alt={`${currentItem.name} - Önce`}
                  className="w-full h-full object-cover"
                />
                <div className="absolute inset-0 bg-foreground/0 group-hover:bg-foreground/20 transition-colors flex items-center justify-center opacity-0 group-hover:opacity-100">
                  <div className="w-12 h-12 rounded-full bg-background/80 backdrop-blur-sm flex items-center justify-center">
                    <ZoomIn className="h-6 w-6" />
                  </div>
                </div>
              </motion.div>
            </motion.div>

            {/* After Image */}
            <motion.div
              initial={{ opacity: 0, x: 20 }}
              whileInView={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.5, delay: 0.1 }}
              viewport={{ once: true }}
              className="relative"
            >
              <div className="absolute top-4 left-4 z-10">
                <span className="px-3 py-1.5 rounded-full bg-primary text-primary-foreground text-sm font-medium shadow-sm">
                  Sonra
                </span>
              </div>
              <motion.div 
                key={`after-${currentItem.id}`}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 0.4 }}
                className="aspect-square rounded-2xl overflow-hidden bg-muted border border-primary/20 shadow-luxury-lg cursor-zoom-in group relative"
                onClick={() => openLightbox(currentItem.result, `${currentItem.name} - Sonra`, 'after')}
              >
                <img
                  src={currentItem.result}
                  alt={`${currentItem.name} - Sonra`}
                  className="w-full h-full object-cover"
                />
                <div className="absolute inset-0 bg-foreground/0 group-hover:bg-foreground/20 transition-colors flex items-center justify-center opacity-0 group-hover:opacity-100">
                  <div className="w-12 h-12 rounded-full bg-primary/80 backdrop-blur-sm flex items-center justify-center">
                    <ZoomIn className="h-6 w-6 text-primary-foreground" />
                  </div>
                </div>
              </motion.div>
            </motion.div>
          </div>

          {/* Product name */}
          <motion.div 
            className="text-center mt-8"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            key={`name-${currentItem.id}`}
          >
            <p className="text-lg font-medium text-foreground">{currentItem.name}</p>
          </motion.div>

          {/* Thumbnail navigation */}
          <div className="flex justify-center gap-3 mt-10">
            {showcaseItems.map((item, index) => (
              <motion.button
                key={item.id}
                onClick={() => setActiveIndex(index)}
                className={`relative w-14 h-14 md:w-16 md:h-16 rounded-xl overflow-hidden transition-all duration-300 ${
                  index === activeIndex 
                    ? 'ring-2 ring-primary ring-offset-2 ring-offset-background scale-105' 
                    : 'opacity-50 hover:opacity-80'
                }`}
                whileHover={{ scale: index === activeIndex ? 1.05 : 1.1 }}
                whileTap={{ scale: 0.95 }}
              >
                <img
                  src={item.original}
                  alt={item.name}
                  className="w-full h-full object-cover"
                />
                {index === activeIndex && (
                  <motion.div 
                    className="absolute inset-0 border-2 border-primary rounded-xl"
                    layoutId="activeThumb"
                  />
                )}
              </motion.button>
            ))}
          </div>
        </div>
      </div>

      {/* Fullscreen Lightbox */}
      <AnimatePresence>
        {lightboxOpen && lightboxImage && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] bg-background/95 backdrop-blur-md flex items-center justify-center p-4"
            onClick={() => setLightboxOpen(false)}
          >
            {/* Controls */}
            <div className="absolute top-4 right-4 flex items-center gap-2 z-10">
              <Button
                size="icon"
                variant="secondary"
                onClick={(e) => {
                  e.stopPropagation();
                  setLightboxScale(s => Math.max(0.5, s - 0.25));
                }}
              >
                <ZoomOut className="h-4 w-4" />
              </Button>
              <Button
                size="icon"
                variant="secondary"
                onClick={(e) => {
                  e.stopPropagation();
                  setLightboxScale(s => Math.min(3, s + 0.25));
                }}
              >
                <ZoomIn className="h-4 w-4" />
              </Button>
              <Button
                size="icon"
                variant="secondary"
                onClick={() => setLightboxOpen(false)}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>

            {/* Image */}
            <motion.img
              src={lightboxImage.src}
              alt={lightboxImage.alt}
              initial={{ scale: 0.9 }}
              animate={{ scale: lightboxScale }}
              exit={{ scale: 0.9 }}
              transition={{ type: 'spring', stiffness: 300, damping: 30 }}
              className="max-w-[90vw] max-h-[90vh] object-contain rounded-lg shadow-2xl"
              onClick={(e) => e.stopPropagation()}
              drag
              dragConstraints={{ left: 0, right: 0, top: 0, bottom: 0 }}
            />

            {/* Info */}
            <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex items-center gap-3">
              <span className={`px-3 py-1.5 rounded-full text-sm font-medium ${
                lightboxImage.type === 'after' 
                  ? 'bg-primary text-primary-foreground' 
                  : 'bg-secondary text-secondary-foreground'
              }`}>
                {lightboxImage.type === 'after' ? 'Sonra' : 'Önce'}
              </span>
              <span className="bg-secondary/80 backdrop-blur-sm px-3 py-1.5 rounded-full text-sm font-medium">
                {Math.round(lightboxScale * 100)}%
              </span>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </section>
  );
}
