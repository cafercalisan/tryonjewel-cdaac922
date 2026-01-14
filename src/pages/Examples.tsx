import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence, useScroll, useTransform } from 'framer-motion';
import { ArrowLeft, ChevronDown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Link } from 'react-router-dom';

// Import showcase images
import earringResult from '@/assets/showcase/earring-result.webp';
import emeraldBraceletResult1 from '@/assets/showcase/emerald-bracelet-result-1.webp';
import emeraldBraceletResult2 from '@/assets/showcase/emerald-bracelet-result-2.webp';
import emeraldBraceletResult3 from '@/assets/showcase/emerald-bracelet-result-3.webp';
import sapphireBraceletResult from '@/assets/showcase/sapphire-bracelet-result.webp';
import blueSapphireBraceletResult from '@/assets/showcase/blue-sapphire-bracelet-result.webp';
import ringResult from '@/assets/showcase/ring-result.webp';

const mannequinResult = '/lovable-uploads/d9abf31c-925c-4750-961f-11908e4e649a.webp';

// External high-quality images
const externalImages = [
  'http://eurodiamond.com.tr/wp-content/uploads/2026/01/jewelry-0eb9fe47-c9d8-4cb0-b151-3a2b11fb0c19-2-4k-scaled.webp',
  'http://eurodiamond.com.tr/wp-content/uploads/2026/01/jewelry-7960246d-a583-48c1-b0d8-c2229cc8014c-2-4k-scaled.webp',
  'http://eurodiamond.com.tr/wp-content/uploads/2026/01/jewelry-4ba486bd-af31-4dc7-9ab9-2a78bf929700-3-4k-scaled.webp',
  'http://eurodiamond.com.tr/wp-content/uploads/2026/01/jewelry-fb6d0874-1cf3-4abc-a826-6eca5da5bb0c-2-4k-1-scaled.webp',
  'http://eurodiamond.com.tr/wp-content/uploads/2026/01/jewelry-840e1052-e824-4365-aa4b-f8ae3509a93d-3-4k-scaled.webp',
];

const galleryImages = [
  mannequinResult,
  externalImages[0],
  earringResult,
  externalImages[1],
  emeraldBraceletResult1,
  externalImages[2],
  sapphireBraceletResult,
  externalImages[3],
  blueSapphireBraceletResult,
  emeraldBraceletResult2,
  ringResult,
  externalImages[4],
  emeraldBraceletResult3,
];

interface FullscreenImageProps {
  src: string;
  index: number;
}

function FullscreenImage({ src, index }: FullscreenImageProps) {
  const ref = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ["start end", "end start"]
  });
  
  const opacity = useTransform(scrollYProgress, [0, 0.3, 0.7, 1], [0, 1, 1, 0]);
  const scale = useTransform(scrollYProgress, [0, 0.3, 0.7, 1], [0.8, 1, 1, 0.8]);
  const y = useTransform(scrollYProgress, [0, 0.5, 1], [100, 0, -100]);
  
  return (
    <motion.div
      ref={ref}
      style={{ opacity, scale, y }}
      className="h-screen w-full flex items-center justify-center p-4 md:p-8 snap-start"
    >
      <div className="relative w-full h-full max-w-6xl max-h-[85vh] rounded-3xl overflow-hidden shadow-2xl">
        <img
          src={src}
          alt={`Örnek çalışma ${index + 1}`}
          className="w-full h-full object-cover"
          loading={index < 3 ? "eager" : "lazy"}
        />
        {/* Elegant vignette effect */}
        <div className="absolute inset-0 pointer-events-none bg-gradient-to-t from-background/40 via-transparent to-background/20" />
        
        {/* Corner accents */}
        <div className="absolute top-4 left-4 w-12 h-12 border-t-2 border-l-2 border-primary/40 rounded-tl-2xl" />
        <div className="absolute bottom-4 right-4 w-12 h-12 border-b-2 border-r-2 border-primary/40 rounded-br-2xl" />
      </div>
    </motion.div>
  );
}

export default function Examples() {
  const [showScrollHint, setShowScrollHint] = useState(true);
  const containerRef = useRef<HTMLDivElement>(null);
  
  useEffect(() => {
    const handleScroll = () => {
      if (window.scrollY > 100) {
        setShowScrollHint(false);
      }
    };
    
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  return (
    <div ref={containerRef} className="bg-background min-h-screen">
      {/* Fixed Header */}
      <div className="fixed top-0 left-0 right-0 z-50 p-4 md:p-6">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <Link to="/">
            <Button variant="secondary" size="sm" className="rounded-full backdrop-blur-md bg-background/80 shadow-lg border border-border/50">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Ana Sayfa
            </Button>
          </Link>
          <Link to="/kayit">
            <Button size="sm" className="rounded-full shadow-lg">
              Hemen Deneyin
            </Button>
          </Link>
        </div>
      </div>
      
      {/* Scroll Hint */}
      <AnimatePresence>
        {showScrollHint && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
            className="fixed bottom-8 left-1/2 -translate-x-1/2 z-50 flex flex-col items-center gap-2"
          >
            <span className="text-sm text-muted-foreground bg-background/80 backdrop-blur-md px-4 py-2 rounded-full border border-border/50">
              Kaydırarak keşfedin
            </span>
            <motion.div
              animate={{ y: [0, 8, 0] }}
              transition={{ duration: 1.5, repeat: Infinity }}
            >
              <ChevronDown className="h-5 w-5 text-muted-foreground" />
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
      
      {/* Gallery - Full screen images with scroll animations */}
      <div className="snap-y snap-mandatory">
        {galleryImages.map((src, index) => (
          <FullscreenImage key={index} src={src} index={index} />
        ))}
      </div>
      
      {/* Final CTA Section */}
      <motion.div
        initial={{ opacity: 0 }}
        whileInView={{ opacity: 1 }}
        transition={{ duration: 0.6 }}
        viewport={{ once: true }}
        className="h-screen flex items-center justify-center snap-start"
      >
        <div className="text-center px-4">
          <h2 className="text-3xl md:text-5xl font-semibold mb-6">
            Kendi <span className="italic text-primary font-serif">Dönüşümünüzü</span> Yaratın
          </h2>
          <p className="text-muted-foreground mb-8 max-w-xl mx-auto text-lg">
            Ürün fotoğraflarınızı profesyonel kampanya görsellerine dönüştürün
          </p>
          <Link to="/kayit">
            <Button size="lg" className="px-12 rounded-full text-base">
              Hemen Başlayın
            </Button>
          </Link>
        </div>
      </motion.div>
    </div>
  );
}
