import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Gem, Sparkles, Lightbulb } from 'lucide-react';
import { getRandomFacts } from '@/lib/jewelryFacts';

interface GeneratingPanelProps {
  step: 'analyzing' | 'generating' | 'finalizing';
  currentImageIndex?: number;
  totalImages?: number;
  packageType?: 'standard' | 'master';
}

export function GeneratingPanel({ 
  step, 
  currentImageIndex = 1, 
  totalImages = 1,
  packageType = 'standard' 
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
          description: 'AI mücevherinizin detaylarını, taşları ve metal özelliklerini analiz ediyor...',
          icon: <Sparkles className="h-8 w-8 text-white" />,
        };
      case 'generating':
        if (packageType === 'master') {
          const labels = ['E-Ticaret Görseli', 'Lüks Katalog Görseli', 'Manken Çekimi'];
          return {
            title: labels[currentImageIndex - 1] || 'Görsel Oluşturuluyor',
            description: `Master paket: ${currentImageIndex}/${totalImages} görsel oluşturuluyor...`,
            icon: <Gem className="h-8 w-8 text-white" />,
          };
        }
        return {
          title: 'Görsel Oluşturuluyor',
          description: 'Profesyonel mücevher görseli render ediliyor...',
          icon: <Gem className="h-8 w-8 text-white" />,
        };
      case 'finalizing':
        return {
          title: 'Son Rötuşlar',
          description: '4K kalitede görselleriniz hazırlanıyor...',
          icon: <Sparkles className="h-8 w-8 text-white" />,
        };
      default:
        return {
          title: 'İşleniyor',
          description: 'Lütfen bekleyin...',
          icon: <Gem className="h-8 w-8 text-white" />,
        };
    }
  };

  const { title, description, icon } = getStepInfo();

  return (
    <motion.div
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: 20 }}
      className="bg-card border border-border rounded-2xl p-6 shadow-luxury h-full flex flex-col"
    >
      {/* Progress Header */}
      <div className="text-center mb-6">
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ duration: 3, repeat: Infinity, ease: "linear" }}
          className="w-20 h-20 mx-auto rounded-full bg-gradient-to-tr from-primary via-purple-500 to-pink-500 flex items-center justify-center shadow-xl mb-4"
        >
          {icon}
        </motion.div>
        
        <h3 className="text-xl font-semibold mb-1">{title}</h3>
        <p className="text-sm text-muted-foreground">{description}</p>
        
        {/* Progress dots */}
        {packageType === 'master' && totalImages > 1 && (
          <div className="flex justify-center gap-2 mt-4">
            {Array.from({ length: totalImages }).map((_, i) => (
              <div
                key={i}
                className={`w-2.5 h-2.5 rounded-full transition-colors ${
                  i < currentImageIndex ? 'bg-primary' : 'bg-muted-foreground/30'
                }`}
              />
            ))}
          </div>
        )}
      </div>

      {/* Animated dots */}
      <div className="flex justify-center gap-1.5 mb-8">
        {[0, 1, 2, 3, 4].map((i) => (
          <motion.div
            key={i}
            className="w-2 h-2 rounded-full bg-primary"
            animate={{ y: [0, -8, 0], opacity: [0.4, 1, 0.4] }}
            transition={{ duration: 0.7, repeat: Infinity, delay: i * 0.12 }}
          />
        ))}
      </div>

      {/* Jewelry Facts Section */}
      <div className="flex-1 flex flex-col justify-end">
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
