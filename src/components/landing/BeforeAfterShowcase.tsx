import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Sparkles } from 'lucide-react';
import { ImageComparisonSlider } from './ImageComparisonSlider';

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

interface ShowcaseItem {
  id: string;
  name: string;
  original: string;
  result: string;
}

const showcaseItems: ShowcaseItem[] = [
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

        {/* Main showcase */}
        <div 
          className="relative max-w-3xl mx-auto"
          onMouseEnter={() => setIsHovered(true)}
          onMouseLeave={() => setIsHovered(false)}
        >
          {/* Slider Comparison */}
          <motion.div
            key={currentItem.id}
            initial={{ opacity: 0, scale: 0.98 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.4 }}
          >
            <ImageComparisonSlider
              beforeImage={currentItem.original}
              afterImage={currentItem.result}
            />
          </motion.div>

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
