import { motion } from 'framer-motion';

// Import all showcase images
import blueSapphireBraceletOriginal from '@/assets/showcase/blue-sapphire-bracelet-original.webp';
import blueSapphireBraceletResult from '@/assets/showcase/blue-sapphire-bracelet-result.webp';
import diamondSetOriginal from '@/assets/showcase/diamond-set-original.webp';
import earringOriginal from '@/assets/showcase/earring-original.webp';
import earringResult from '@/assets/showcase/earring-result.webp';
import emeraldBraceletOriginal from '@/assets/showcase/emerald-bracelet-original.webp';
import emeraldBraceletResult1 from '@/assets/showcase/emerald-bracelet-result-1.webp';
import emeraldBraceletResult2 from '@/assets/showcase/emerald-bracelet-result-2.webp';
import emeraldBraceletResult3 from '@/assets/showcase/emerald-bracelet-result-3.webp';
import ringOriginal from '@/assets/showcase/ring-original.webp';
import ringResult from '@/assets/showcase/ring-result.webp';
import sapphireBraceletOriginal from '@/assets/showcase/sapphire-bracelet-original.webp';
import sapphireBraceletResult from '@/assets/showcase/sapphire-bracelet-result.webp';
import heroImage from '/lovable-uploads/d9abf31c-925c-4750-961f-11908e4e649a.webp';

// Organize images into rows
const topRowImages = [
  blueSapphireBraceletResult,
  emeraldBraceletResult1,
  earringResult,
  ringResult,
  sapphireBraceletResult,
];

const middleRowImages = [
  emeraldBraceletResult2,
  diamondSetOriginal,
  heroImage,
  emeraldBraceletOriginal,
  blueSapphireBraceletOriginal,
  earringOriginal,
];

const bottomRowImages = [
  emeraldBraceletResult3,
  ringOriginal,
  sapphireBraceletOriginal,
  emeraldBraceletResult1,
  earringResult,
];

interface MarqueeRowProps {
  images: string[];
  direction: 'left' | 'right';
  duration?: number;
  className?: string;
}

const MarqueeRow = ({ images, direction, duration = 30, className = '' }: MarqueeRowProps) => {
  // Duplicate images for seamless loop
  const duplicatedImages = [...images, ...images, ...images];
  
  return (
    <div className={`relative overflow-hidden ${className}`}>
      <motion.div
        className="flex gap-4"
        animate={{
          x: direction === 'right' ? [0, -100 * images.length + '%'] : [-100 * images.length + '%', 0],
        }}
        transition={{
          x: {
            repeat: Infinity,
            repeatType: 'loop',
            duration: duration,
            ease: 'linear',
          },
        }}
        style={{
          width: `${duplicatedImages.length * 280}px`,
        }}
      >
        {duplicatedImages.map((image, index) => (
          <div
            key={`${image}-${index}`}
            className="relative flex-shrink-0 w-[220px] md:w-[260px] lg:w-[280px] aspect-[4/5] rounded-2xl overflow-hidden border-2 border-foreground/10 bg-card shadow-luxury group"
          >
            <img
              src={image}
              alt={`Mücevher görseli ${index + 1}`}
              className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
              loading="lazy"
            />
            {/* Elegant overlay on hover */}
            <div className="absolute inset-0 bg-gradient-to-t from-foreground/20 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
          </div>
        ))}
      </motion.div>
    </div>
  );
};

export function InfiniteProductShowcase() {
  return (
    <section className="relative py-16 md:py-24 overflow-hidden bg-muted/30">
      {/* Section header */}
      <motion.div
        className="container mb-12 text-center"
        initial={{ opacity: 0, y: 20 }}
        whileInView={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6 }}
        viewport={{ once: true }}
      >
        <p className="text-xs md:text-sm font-medium tracking-[0.2em] text-primary mb-4">
          PROFESYONEL GÖRSEL GALERİSİ
        </p>
        <h2 className="text-3xl md:text-4xl lg:text-5xl font-semibold">
          Sınırsız <span className="italic text-primary font-serif">Yaratıcılık</span>
        </h2>
      </motion.div>

      {/* Diagonal strips container with rotation */}
      <div className="relative -rotate-3 py-8">
        {/* Background decorative gradient */}
        <div className="absolute inset-0 bg-gradient-to-b from-transparent via-muted/50 to-transparent pointer-events-none" />
        
        {/* Top row - scrolls right */}
        <div className="mb-4">
          <MarqueeRow 
            images={topRowImages} 
            direction="right" 
            duration={35}
          />
        </div>
        
        {/* Middle row - scrolls left (opposite direction) */}
        <div className="mb-4">
          <MarqueeRow 
            images={middleRowImages} 
            direction="left" 
            duration={40}
          />
        </div>
        
        {/* Bottom row - scrolls right */}
        <div>
          <MarqueeRow 
            images={bottomRowImages} 
            direction="right" 
            duration={32}
          />
        </div>
      </div>

      {/* Decorative edge gradients for smooth fade effect */}
      <div className="absolute top-0 left-0 w-32 h-full bg-gradient-to-r from-background to-transparent pointer-events-none z-10" />
      <div className="absolute top-0 right-0 w-32 h-full bg-gradient-to-l from-background to-transparent pointer-events-none z-10" />
    </section>
  );
}
