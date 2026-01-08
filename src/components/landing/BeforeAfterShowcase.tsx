import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowRight, Sparkles } from 'lucide-react';

// Import showcase images
import earringOriginal from '@/assets/showcase/earring-original.webp';
import earringResult from '@/assets/showcase/earring-result.webp';
import emeraldBraceletOriginal from '@/assets/showcase/emerald-bracelet-original.webp';
import emeraldBraceletResult1 from '@/assets/showcase/emerald-bracelet-result-1.webp';
import emeraldBraceletResult2 from '@/assets/showcase/emerald-bracelet-result-2.webp';
import emeraldBraceletResult3 from '@/assets/showcase/emerald-bracelet-result-3.webp';
import sapphireBraceletOriginal from '@/assets/showcase/sapphire-bracelet-original.webp';
import sapphireBraceletResult from '@/assets/showcase/sapphire-bracelet-result.webp';
import blueSapphireBraceletOriginal from '@/assets/showcase/blue-sapphire-bracelet-original.webp';
import blueSapphireBraceletResult from '@/assets/showcase/blue-sapphire-bracelet-result.webp';
import ringOriginal from '@/assets/showcase/ring-original.webp';
import ringResult from '@/assets/showcase/ring-result.webp';

interface ShowcaseItem {
  id: string;
  name: string;
  original: string;
  results: string[];
}

const showcaseItems: ShowcaseItem[] = [
  {
    id: 'earring',
    name: 'Pırlanta Küpe',
    original: earringOriginal,
    results: [earringResult],
  },
  {
    id: 'emerald-bracelet',
    name: 'Zümrüt Pırlanta Bilezik',
    original: emeraldBraceletOriginal,
    results: [emeraldBraceletResult1, emeraldBraceletResult2, emeraldBraceletResult3],
  },
  {
    id: 'sapphire-bracelet',
    name: 'Safir Pırlanta Bilezik',
    original: sapphireBraceletOriginal,
    results: [sapphireBraceletResult],
  },
  {
    id: 'blue-sapphire-bracelet',
    name: 'Mavi Safir Bilezik',
    original: blueSapphireBraceletOriginal,
    results: [blueSapphireBraceletResult],
  },
  {
    id: 'ring',
    name: 'Pırlanta Yüzük',
    original: ringOriginal,
    results: [ringResult],
  },
];

export function BeforeAfterShowcase() {
  const [activeIndex, setActiveIndex] = useState(0);
  const [resultIndex, setResultIndex] = useState(0);
  const [isHovered, setIsHovered] = useState(false);

  const currentItem = showcaseItems[activeIndex];

  // Auto-rotate through items
  useEffect(() => {
    if (isHovered) return;
    
    const interval = setInterval(() => {
      setActiveIndex((prev) => (prev + 1) % showcaseItems.length);
      setResultIndex(0);
    }, 5000);

    return () => clearInterval(interval);
  }, [isHovered]);

  // Auto-rotate through results for items with multiple results
  useEffect(() => {
    if (currentItem.results.length <= 1) return;
    
    const interval = setInterval(() => {
      setResultIndex((prev) => (prev + 1) % currentItem.results.length);
    }, 2000);

    return () => clearInterval(interval);
  }, [currentItem, activeIndex]);

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

        {/* Main showcase */}
        <div 
          className="relative max-w-6xl mx-auto"
          onMouseEnter={() => setIsHovered(true)}
          onMouseLeave={() => setIsHovered(false)}
        >
          {/* Main comparison */}
          <div className="grid md:grid-cols-2 gap-6 md:gap-12 items-center">
            {/* Before */}
            <motion.div 
              initial={{ opacity: 0, x: -40 }}
              whileInView={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.6 }}
              viewport={{ once: true }}
              className="relative"
            >
              <div className="absolute -top-3 left-4 z-10 px-3 py-1 bg-muted text-muted-foreground text-xs font-medium rounded-full">
                Önce
              </div>
              <div className="relative aspect-square rounded-2xl overflow-hidden bg-muted shadow-luxury">
                <AnimatePresence mode="wait">
                  <motion.img
                    key={`before-${currentItem.id}`}
                    src={currentItem.original}
                    alt={`${currentItem.name} - Orijinal`}
                    className="w-full h-full object-cover"
                    initial={{ opacity: 0, scale: 1.05 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.95 }}
                    transition={{ duration: 0.5 }}
                  />
                </AnimatePresence>
                
                {/* Subtle overlay pattern */}
                <div className="absolute inset-0 bg-gradient-to-t from-background/20 to-transparent pointer-events-none" />
              </div>
            </motion.div>

            {/* Arrow indicator */}
            <motion.div 
              className="hidden md:flex absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-20"
              initial={{ opacity: 0, scale: 0.8 }}
              whileInView={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.4, delay: 0.3 }}
              viewport={{ once: true }}
            >
              <div className="w-16 h-16 rounded-full bg-primary text-primary-foreground flex items-center justify-center shadow-luxury-lg">
                <motion.div
                  animate={{ x: [0, 4, 0] }}
                  transition={{ duration: 1.5, repeat: Infinity, ease: "easeInOut" }}
                >
                  <ArrowRight className="h-6 w-6" />
                </motion.div>
              </div>
            </motion.div>

            {/* After */}
            <motion.div 
              initial={{ opacity: 0, x: 40 }}
              whileInView={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.6 }}
              viewport={{ once: true }}
              className="relative"
            >
              <div className="absolute -top-3 left-4 z-10 px-3 py-1 bg-primary text-primary-foreground text-xs font-medium rounded-full">
                Sonra
              </div>
              <div className="relative aspect-square rounded-2xl overflow-hidden bg-muted shadow-luxury-lg">
                <AnimatePresence mode="wait">
                  <motion.img
                    key={`after-${currentItem.id}-${resultIndex}`}
                    src={currentItem.results[resultIndex]}
                    alt={`${currentItem.name} - AI Sonucu`}
                    className="w-full h-full object-cover"
                    initial={{ opacity: 0, scale: 1.05 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.95 }}
                    transition={{ duration: 0.5 }}
                  />
                </AnimatePresence>
                
                {/* Shimmer effect */}
                <motion.div 
                  className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent pointer-events-none"
                  animate={{ x: ['-100%', '200%'] }}
                  transition={{ duration: 2, repeat: Infinity, repeatDelay: 3 }}
                />
                
                {/* Multiple results indicator */}
                {currentItem.results.length > 1 && (
                  <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex gap-2">
                    {currentItem.results.map((_, idx) => (
                      <motion.button
                        key={idx}
                        onClick={() => setResultIndex(idx)}
                        className={`w-2 h-2 rounded-full transition-all duration-300 ${
                          idx === resultIndex 
                            ? 'bg-primary w-6' 
                            : 'bg-primary/40 hover:bg-primary/60'
                        }`}
                        whileHover={{ scale: 1.2 }}
                        whileTap={{ scale: 0.9 }}
                      />
                    ))}
                  </div>
                )}
              </div>
            </motion.div>
          </div>

          {/* Mobile arrow */}
          <div className="flex md:hidden justify-center my-6">
            <div className="w-12 h-12 rounded-full bg-primary text-primary-foreground flex items-center justify-center shadow-luxury rotate-90">
              <ArrowRight className="h-5 w-5" />
            </div>
          </div>

          {/* Product name */}
          <motion.div 
            className="text-center mt-8"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            key={currentItem.id}
          >
            <p className="text-lg font-medium text-foreground">{currentItem.name}</p>
          </motion.div>

          {/* Thumbnail navigation */}
          <div className="flex justify-center gap-3 mt-10">
            {showcaseItems.map((item, index) => (
              <motion.button
                key={item.id}
                onClick={() => {
                  setActiveIndex(index);
                  setResultIndex(0);
                }}
                className={`relative w-16 h-16 md:w-20 md:h-20 rounded-xl overflow-hidden transition-all duration-300 ${
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
