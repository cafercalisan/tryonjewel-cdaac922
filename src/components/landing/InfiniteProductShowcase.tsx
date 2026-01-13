import { motion } from 'framer-motion';
import { useRef, useEffect, useState } from 'react';

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

const MarqueeRow = ({ images, direction, duration = 60, className = '' }: MarqueeRowProps) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [containerWidth, setContainerWidth] = useState(0);
  
  // Duplicate images for seamless loop - 4x for smoother infinite scroll
  const duplicatedImages = [...images, ...images, ...images, ...images];
  
  // Calculate total width for animation
  const imageWidth = 380; // Base width for larger images
  const gap = 24; // Gap between images
  const singleSetWidth = images.length * (imageWidth + gap);
  
  useEffect(() => {
    if (containerRef.current) {
      setContainerWidth(containerRef.current.offsetWidth);
    }
    
    const handleResize = () => {
      if (containerRef.current) {
        setContainerWidth(containerRef.current.offsetWidth);
      }
    };
    
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);
  
  return (
    <div 
      ref={containerRef}
      className={`relative overflow-hidden ${className}`}
    >
      <motion.div
        className="flex will-change-transform"
        style={{ 
          gap: `${gap}px`,
          width: `${duplicatedImages.length * (imageWidth + gap)}px`,
        }}
        animate={{
          x: direction === 'right' 
            ? [0, -singleSetWidth] 
            : [-singleSetWidth, 0],
        }}
        transition={{
          x: {
            repeat: Infinity,
            repeatType: 'loop',
            duration: duration,
            ease: 'linear',
          },
        }}
      >
        {duplicatedImages.map((image, index) => (
          <div
            key={`${image}-${index}`}
            className="relative flex-shrink-0 w-[280px] sm:w-[320px] md:w-[360px] lg:w-[380px] aspect-[3/4] rounded-3xl overflow-hidden group"
            style={{
              background: 'linear-gradient(145deg, hsl(var(--card)) 0%, hsl(var(--muted)) 100%)',
              boxShadow: '0 8px 32px -8px hsl(var(--foreground) / 0.15), 0 0 0 1px hsl(var(--foreground) / 0.08), inset 0 1px 0 0 hsl(var(--foreground) / 0.05)',
            }}
          >
            {/* Inner frame with dark luxurious border */}
            <div className="absolute inset-2 rounded-2xl overflow-hidden border border-foreground/10 bg-background/50 backdrop-blur-sm">
              <img
                src={image}
                alt={`Mücevher görseli ${index + 1}`}
                className="w-full h-full object-cover transition-all duration-700 ease-out group-hover:scale-110"
                loading="lazy"
                decoding="async"
              />
              
              {/* Premium glow effect on hover */}
              <div 
                className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none"
                style={{
                  background: 'radial-gradient(ellipse at center, hsl(var(--primary) / 0.15) 0%, transparent 70%)',
                }}
              />
              
              {/* Elegant overlay gradient */}
              <div className="absolute inset-0 bg-gradient-to-t from-foreground/30 via-transparent to-foreground/5 opacity-40 group-hover:opacity-20 transition-opacity duration-500" />
            </div>
            
            {/* Corner accent decorations */}
            <div className="absolute top-0 left-0 w-8 h-8 border-t-2 border-l-2 border-primary/30 rounded-tl-3xl" />
            <div className="absolute bottom-0 right-0 w-8 h-8 border-b-2 border-r-2 border-primary/30 rounded-br-3xl" />
          </div>
        ))}
      </motion.div>
    </div>
  );
};

export function InfiniteProductShowcase() {
  return (
    <section className="relative py-20 md:py-32 overflow-hidden bg-gradient-to-b from-background via-muted/20 to-background">
      {/* Ambient background effects */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div 
          className="absolute top-1/4 left-1/4 w-96 h-96 rounded-full blur-3xl opacity-20"
          style={{ background: 'radial-gradient(circle, hsl(var(--primary) / 0.3) 0%, transparent 70%)' }}
        />
        <div 
          className="absolute bottom-1/4 right-1/4 w-96 h-96 rounded-full blur-3xl opacity-20"
          style={{ background: 'radial-gradient(circle, hsl(var(--primary) / 0.2) 0%, transparent 70%)' }}
        />
      </div>

      {/* Section header */}
      <motion.div
        className="container mb-16 md:mb-20 text-center relative z-10"
        initial={{ opacity: 0, y: 30 }}
        whileInView={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.8, ease: 'easeOut' }}
        viewport={{ once: true, margin: '-100px' }}
      >
        <p className="text-xs md:text-sm font-medium tracking-[0.25em] text-primary/80 mb-5 uppercase">
          Profesyonel Görsel Galerisi
        </p>
        <h2 className="text-4xl md:text-5xl lg:text-6xl font-light tracking-tight">
          Sınırsız <span className="italic text-primary font-serif font-normal">Yaratıcılık</span>
        </h2>
        <div className="mt-6 w-20 h-px bg-gradient-to-r from-transparent via-primary/50 to-transparent mx-auto" />
      </motion.div>

      {/* Diagonal strips container with subtle rotation */}
      <div className="relative -rotate-2 py-6">
        {/* Top row - scrolls right */}
        <div className="mb-6">
          <MarqueeRow 
            images={topRowImages} 
            direction="right" 
            duration={80}
          />
        </div>
        
        {/* Middle row - scrolls left (opposite direction) */}
        <div className="mb-6">
          <MarqueeRow 
            images={middleRowImages} 
            direction="left" 
            duration={90}
          />
        </div>
        
        {/* Bottom row - scrolls right */}
        <div>
          <MarqueeRow 
            images={bottomRowImages} 
            direction="right" 
            duration={75}
          />
        </div>
      </div>

      {/* Enhanced edge gradients for smooth fade effect */}
      <div 
        className="absolute top-0 left-0 w-40 md:w-64 h-full pointer-events-none z-10"
        style={{ background: 'linear-gradient(to right, hsl(var(--background)) 0%, hsl(var(--background) / 0.8) 30%, transparent 100%)' }}
      />
      <div 
        className="absolute top-0 right-0 w-40 md:w-64 h-full pointer-events-none z-10"
        style={{ background: 'linear-gradient(to left, hsl(var(--background)) 0%, hsl(var(--background) / 0.8) 30%, transparent 100%)' }}
      />
    </section>
  );
}
