import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Lightbulb } from 'lucide-react';
import { getRandomFacts } from '@/lib/jewelryFacts';

interface GeneratingPanelProps {
  step: 'idle' | 'analyzing' | 'generating' | 'finalizing';
  currentImageIndex?: number;
  totalImages?: number;
  packageType?: 'standard' | 'master';
  previewImage?: string | null;
}

export function GeneratingPanel({ 
  step, 
  currentImageIndex = 1, 
  totalImages = 1,
  packageType = 'standard',
  previewImage = null
}: GeneratingPanelProps) {
  const [facts, setFacts] = useState<string[]>([]);
  const [currentFactIndex, setCurrentFactIndex] = useState(0);

  useEffect(() => {
    setFacts(getRandomFacts(10));
  }, []);

  useEffect(() => {
    if (facts.length === 0) return;
    
    const interval = setInterval(() => {
      setCurrentFactIndex((prev) => (prev + 1) % facts.length);
    }, 6000);

    return () => clearInterval(interval);
  }, [facts.length]);

  const getStepInfo = () => {
    switch (step) {
      case 'analyzing':
        return {
          title: 'Ürün Analiz Ediliyor',
          description: 'AI mücevherinizin detaylarını analiz ediyor...',
        };
      case 'generating':
        if (packageType === 'master') {
          const labels = ['E-Ticaret Görseli', 'Lüks Katalog Görseli', 'Manken Çekimi'];
          return {
            title: labels[currentImageIndex - 1] || 'Görsel Oluşturuluyor',
            description: `Master paket: ${currentImageIndex}/${totalImages} görsel oluşturuluyor...`,
          };
        }
        return {
          title: 'Görsel Oluşturuluyor',
          description: 'Profesyonel mücevher görseli render ediliyor...',
        };
      case 'finalizing':
        return {
          title: 'Son Rötuşlar',
          description: '4K kalitede görselleriniz hazırlanıyor...',
        };
      default:
        return {
          title: 'İşleniyor',
          description: 'Lütfen bekleyin...',
        };
    }
  };

  const { title, description } = getStepInfo();

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-card border border-border rounded-2xl overflow-hidden shadow-luxury"
    >
      {/* Blurred Preview Image */}
      <div className="relative h-64 overflow-hidden">
        {previewImage ? (
          <>
            <motion.img
              src={previewImage}
              alt="Processing preview"
              className="w-full h-full object-cover"
              initial={{ scale: 1.1, filter: 'blur(20px)' }}
              animate={{ 
                scale: [1.1, 1.15, 1.1],
                filter: ['blur(20px)', 'blur(15px)', 'blur(20px)']
              }}
              transition={{ 
                duration: 4,
                repeat: Infinity,
                ease: "easeInOut"
              }}
            />
            {/* Gradient overlay */}
            <div className="absolute inset-0 bg-gradient-to-t from-card via-card/50 to-transparent" />
            
            {/* Animated shimmer effect */}
            <motion.div
              className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent"
              initial={{ x: '-100%' }}
              animate={{ x: '100%' }}
              transition={{
                duration: 2,
                repeat: Infinity,
                ease: "linear",
                repeatDelay: 1
              }}
            />
          </>
        ) : (
          <div className="w-full h-full bg-gradient-to-br from-muted to-muted-foreground/10 flex items-center justify-center">
            <motion.div
              className="w-20 h-20 rounded-full bg-primary/20"
              animate={{ scale: [1, 1.2, 1], opacity: [0.5, 1, 0.5] }}
              transition={{ duration: 2, repeat: Infinity }}
            />
          </div>
        )}

        {/* Centered Progress Indicator */}
        <div className="absolute inset-0 flex items-center justify-center">
          <motion.div 
            className="relative"
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
          >
            {/* Outer ring */}
            <motion.div
              className="w-24 h-24 rounded-full border-4 border-primary/30"
              animate={{ rotate: 360 }}
              transition={{ duration: 8, repeat: Infinity, ease: "linear" }}
            />
            
            {/* Inner spinning ring */}
            <motion.div
              className="absolute inset-2 rounded-full border-4 border-transparent border-t-primary"
              animate={{ rotate: -360 }}
              transition={{ duration: 1.5, repeat: Infinity, ease: "linear" }}
            />
            
            {/* Center dot */}
            <motion.div
              className="absolute inset-0 flex items-center justify-center"
              animate={{ scale: [1, 1.1, 1] }}
              transition={{ duration: 1.5, repeat: Infinity }}
            >
              <div className="w-4 h-4 rounded-full bg-primary" />
            </motion.div>
          </motion.div>
        </div>
      </div>

      {/* Content */}
      <div className="p-6 space-y-4">
        {/* Progress Header */}
        <div className="text-center">
          <h3 className="text-lg font-semibold mb-1">{title}</h3>
          <p className="text-sm text-muted-foreground">{description}</p>
          
          {/* Progress dots for master package */}
          {packageType === 'master' && totalImages > 1 && (
            <div className="flex justify-center gap-2 mt-4">
              {Array.from({ length: totalImages }).map((_, i) => (
                <motion.div
                  key={i}
                  className={`w-2.5 h-2.5 rounded-full transition-colors ${
                    i < currentImageIndex ? 'bg-primary' : 'bg-muted-foreground/30'
                  }`}
                  animate={i === currentImageIndex - 1 ? { scale: [1, 1.3, 1] } : {}}
                  transition={{ duration: 0.6, repeat: Infinity }}
                />
              ))}
            </div>
          )}
        </div>

        {/* Progress bar */}
        <div className="h-1.5 bg-muted rounded-full overflow-hidden">
          <motion.div
            className="h-full bg-gradient-to-r from-primary to-primary/70 rounded-full"
            initial={{ width: '0%' }}
            animate={{ width: '100%' }}
            transition={{ duration: 45, ease: "linear" }}
          />
        </div>

        {/* Jewelry Facts Section */}
        <div className="bg-muted/50 rounded-xl p-4 border border-border/50">
          <div className="flex items-center gap-2 mb-3">
            <Lightbulb className="h-4 w-4 text-primary" />
            <span className="text-xs font-medium text-primary uppercase tracking-wider">
              Biliyor muydunuz?
            </span>
          </div>
          
          <AnimatePresence mode="wait">
            <motion.p
              key={currentFactIndex}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.4 }}
              className="text-sm text-muted-foreground leading-relaxed"
            >
              {facts[currentFactIndex] || 'Mücevherler yüzyıllardır insanlığın en değerli hazineleri arasında yer almaktadır.'}
            </motion.p>
          </AnimatePresence>
        </div>
      </div>
    </motion.div>
  );
}
