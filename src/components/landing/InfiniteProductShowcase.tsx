import { motion } from 'framer-motion';
import { useRef, useEffect, useState } from 'react';

// Import only AI-generated result images (no originals)
import blueSapphireBraceletResult from '@/assets/showcase/blue-sapphire-bracelet-result.webp';
import earringResult from '@/assets/showcase/earring-result.webp';
import emeraldBraceletResult1 from '@/assets/showcase/emerald-bracelet-result-1.webp';
import emeraldBraceletResult2 from '@/assets/showcase/emerald-bracelet-result-2.webp';
import emeraldBraceletResult3 from '@/assets/showcase/emerald-bracelet-result-3.webp';
import ringResult from '@/assets/showcase/ring-result.webp';
import sapphireBraceletResult from '@/assets/showcase/sapphire-bracelet-result.webp';

// Two strips with AI results only - opposite directions
const topRowImages = [
  blueSapphireBraceletResult,
  emeraldBraceletResult1,
  earringResult,
  ringResult,
  sapphireBraceletResult,
  emeraldBraceletResult2,
  emeraldBraceletResult3,
];

const bottomRowImages = [
  emeraldBraceletResult3,
  sapphireBraceletResult,
  emeraldBraceletResult2,
  blueSapphireBraceletResult,
  ringResult,
  earringResult,
  emeraldBraceletResult1,
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
  const imageWidth = 380;
  const gap = 24;
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
              background: 'linear-gradient(145deg, rgba(255,255,255,0.03) 0%, rgba(255,255,255,0.01) 100%)',
              boxShadow: '0 8px 32px -8px rgba(0,0,0,0.5), 0 0 0 1px rgba(255,255,255,0.06)',
            }}
          >
            {/* Inner frame */}
            <div
              className="absolute inset-2 rounded-2xl overflow-hidden"
              style={{ border: '1px solid rgba(255,255,255,0.06)', background: 'rgba(0,0,0,0.3)' }}
            >
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
                  background: 'radial-gradient(ellipse at center, hsla(38,45%,55%,0.1) 0%, transparent 70%)',
                }}
              />

              {/* Elegant overlay gradient */}
              <div className="absolute inset-0 bg-gradient-to-t from-black/40 via-transparent to-black/5 opacity-40 group-hover:opacity-20 transition-opacity duration-500" />
            </div>

            {/* Corner accent decorations */}
            <div className="absolute top-0 left-0 w-8 h-8 border-t-2 border-l-2 rounded-tl-3xl" style={{ borderColor: 'hsla(38,45%,55%,0.2)' }} />
            <div className="absolute bottom-0 right-0 w-8 h-8 border-b-2 border-r-2 rounded-br-3xl" style={{ borderColor: 'hsla(38,45%,55%,0.2)' }} />
          </div>
        ))}
      </motion.div>
    </div>
  );
};

export function InfiniteProductShowcase() {
  return (
    <section
      className="relative py-20 md:py-32 overflow-hidden"
      style={{ background: '#0a0a0a' }}
    >
      {/* Ambient background effects */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div
          className="absolute top-1/4 left-1/4 w-96 h-96 rounded-full blur-3xl opacity-[0.06]"
          style={{ background: 'radial-gradient(circle, hsl(38,45%,55%) 0%, transparent 70%)' }}
        />
        <div
          className="absolute bottom-1/4 right-1/4 w-96 h-96 rounded-full blur-3xl opacity-[0.04]"
          style={{ background: 'radial-gradient(circle, hsl(38,45%,55%) 0%, transparent 70%)' }}
        />
      </div>

      {/* Minimal spacing */}
      <div className="h-8 md:h-12" />

      {/* Two diagonal strips - opposite directions */}
      <div className="relative -rotate-2 py-6">
        {/* Top row - scrolls right */}
        <div className="mb-6">
          <MarqueeRow
            images={topRowImages}
            direction="right"
            duration={80}
          />
        </div>

        {/* Bottom row - scrolls left (opposite direction) */}
        <div>
          <MarqueeRow
            images={bottomRowImages}
            direction="left"
            duration={75}
          />
        </div>
      </div>

      {/* Enhanced edge gradients — dark explicit */}
      <div
        className="absolute top-0 left-0 w-40 md:w-64 h-full pointer-events-none z-10"
        style={{ background: 'linear-gradient(to right, #0a0a0a 0%, rgba(10,10,10,0.8) 30%, transparent 100%)' }}
      />
      <div
        className="absolute top-0 right-0 w-40 md:w-64 h-full pointer-events-none z-10"
        style={{ background: 'linear-gradient(to left, #0a0a0a 0%, rgba(10,10,10,0.8) 30%, transparent 100%)' }}
      />
    </section>
  );
}
