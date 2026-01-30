import { motion } from 'framer-motion';
import { useRef, useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { getSignedImageUrl } from '@/lib/getSignedImageUrl';

// Fallback static images (imported from assets)
import blueSapphireBraceletResult from '@/assets/showcase/blue-sapphire-bracelet-result.webp';
import earringResult from '@/assets/showcase/earring-result.webp';
import emeraldBraceletResult1 from '@/assets/showcase/emerald-bracelet-result-1.webp';
import emeraldBraceletResult2 from '@/assets/showcase/emerald-bracelet-result-2.webp';
import emeraldBraceletResult3 from '@/assets/showcase/emerald-bracelet-result-3.webp';
import ringResult from '@/assets/showcase/ring-result.webp';
import sapphireBraceletResult from '@/assets/showcase/sapphire-bracelet-result.webp';

const fallbackImages = [
  blueSapphireBraceletResult,
  emeraldBraceletResult1,
  earringResult,
  ringResult,
  sapphireBraceletResult,
  emeraldBraceletResult2,
  emeraldBraceletResult3,
];

interface MarqueeRowProps {
  images: string[];
  direction: 'left' | 'right';
  duration?: number;
  className?: string;
}

const MarqueeRow = ({ images, direction, duration = 60, className = '' }: MarqueeRowProps) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [loadedImages, setLoadedImages] = useState<Set<string>>(new Set());
  
  // Duplicate images for seamless loop - 4x for smoother infinite scroll
  const duplicatedImages = [...images, ...images, ...images, ...images];
  
  // Calculate total width for animation
  const imageWidth = 380;
  const gap = 24;
  const singleSetWidth = images.length * (imageWidth + gap);

  const handleImageLoad = (src: string) => {
    setLoadedImages(prev => new Set(prev).add(src));
  };

  const handleImageError = (e: React.SyntheticEvent<HTMLImageElement>, index: number) => {
    // Replace with fallback image
    const target = e.target as HTMLImageElement;
    const fallbackIndex = index % fallbackImages.length;
    if (target.src !== fallbackImages[fallbackIndex]) {
      target.src = fallbackImages[fallbackIndex];
    }
  };
  
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
            key={`${index}-${image.substring(0, 20)}`}
            className="relative flex-shrink-0 w-[280px] sm:w-[320px] md:w-[360px] lg:w-[380px] aspect-[3/4] rounded-3xl overflow-hidden group"
            style={{
              background: 'linear-gradient(145deg, hsl(var(--card)) 0%, hsl(var(--muted)) 100%)',
              boxShadow: '0 8px 32px -8px hsl(var(--foreground) / 0.15), 0 0 0 1px hsl(var(--foreground) / 0.08), inset 0 1px 0 0 hsl(var(--foreground) / 0.05)',
            }}
          >
            <div className="absolute inset-2 rounded-2xl overflow-hidden border border-foreground/10 bg-background/50 backdrop-blur-sm">
              <img
                src={image}
                alt={`Mücevher görseli ${index + 1}`}
                className="w-full h-full object-cover transition-all duration-700 ease-out group-hover:scale-110"
                loading="lazy"
                decoding="async"
                onLoad={() => handleImageLoad(image)}
                onError={(e) => handleImageError(e, index)}
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

export function DynamicShowcase() {
  const [signedUrls, setSignedUrls] = useState<{ top: string[]; bottom: string[] }>({
    top: fallbackImages,
    bottom: [...fallbackImages].reverse(),
  });

  // Fetch showcase images from database
  const { data: dbImages } = useQuery({
    queryKey: ['showcase-images'],
    queryFn: async () => {
      // Get completed images - prioritize variety
      const { data, error } = await supabase
        .from('images')
        .select('generated_image_urls')
        .eq('status', 'completed')
        .order('created_at', { ascending: false })
        .limit(30);

      if (error) throw error;
      
      // Flatten and shuffle all generated URLs
      const allUrls: string[] = [];
      data?.forEach(record => {
        if (record.generated_image_urls && Array.isArray(record.generated_image_urls)) {
          // Take only first image from each record for variety
          allUrls.push(...record.generated_image_urls.slice(0, 2));
        }
      });

      return allUrls;
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
  });

  // Load and sign URLs when db images are available
  useEffect(() => {
    if (!dbImages || dbImages.length < 10) return;

    const loadSignedUrls = async () => {
      try {
        // Get signed URLs for all images
        const signedPromises = dbImages.slice(0, 20).map(url => getSignedImageUrl(url));
        const signed = await Promise.all(signedPromises);
        const validUrls = signed.filter(Boolean) as string[];

        if (validUrls.length >= 10) {
          // Split into two rows with different ordering
          const mid = Math.ceil(validUrls.length / 2);
          const topRow = validUrls.slice(0, mid);
          const bottomRow = validUrls.slice(mid).reverse();

          setSignedUrls({
            top: topRow.length >= 5 ? topRow : [...topRow, ...fallbackImages.slice(0, 5 - topRow.length)],
            bottom: bottomRow.length >= 5 ? bottomRow : [...bottomRow, ...fallbackImages.slice(0, 5 - bottomRow.length)],
          });
        }
      } catch (err) {
        console.error('Failed to load showcase images:', err);
        // Keep fallback images
      }
    };

    loadSignedUrls();
  }, [dbImages]);

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

      {/* Minimal spacing */}
      <div className="h-8 md:h-12" />

      {/* Two diagonal strips - opposite directions */}
      <div className="relative -rotate-2 py-6">
        {/* Top row - scrolls right */}
        <div className="mb-6">
          <MarqueeRow 
            images={signedUrls.top} 
            direction="right" 
            duration={80}
          />
        </div>
        
        {/* Bottom row - scrolls left (opposite direction) */}
        <div>
          <MarqueeRow 
            images={signedUrls.bottom} 
            direction="left" 
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
