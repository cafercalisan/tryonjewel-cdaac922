import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Sparkles } from 'lucide-react';

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

  const currentItem = showcaseItems[activeIndex];

  // Auto-rotate through items
  useEffect(() => {
    if (isHovered) return;
    
    const interval = setInterval(() => {
      setActiveIndex((prev) => (prev + 1) % showcaseItems.length);
    }, 6000);

    return () => clearInterval(interval);
  }, [isHovered]);

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
                className="aspect-square rounded-2xl overflow-hidden bg-muted border border-border/50 shadow-luxury"
              >
                <img
                  src={currentItem.original}
                  alt={`${currentItem.name} - Önce`}
                  className="w-full h-full object-cover"
                />
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
                className="aspect-square rounded-2xl overflow-hidden bg-muted border border-primary/20 shadow-luxury-lg"
              >
                <img
                  src={currentItem.result}
                  alt={`${currentItem.name} - Sonra`}
                  className="w-full h-full object-cover"
                />
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
    </section>
  );
}
