import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Lightbulb, Loader2 } from 'lucide-react';
import { getRandomFacts } from '@/lib/jewelryFacts';

interface GeneratingPanelProps {
  step: 'idle' | 'analyzing' | 'generating' | 'finalizing';
  packageType?: 'standard' | 'retouch';
  previewImage?: string | null;
  currentStep?: string | null;
  progress?: number;
}

export function GeneratingPanel({ 
  step, 
  packageType = 'standard',
  previewImage = null,
  currentStep = null,
  progress = 0,
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

  const title = packageType === 'retouch' ? 'Rötuş Yapılıyor' : 'Görsel Oluşturuluyor';
  
  const stepLabels: Record<string, string> = {
    'pending': 'Kuyrukta bekleniyor...',
    'downloading': 'Görseller indiriliyor...',
    'analyzing': 'Mücevher analiz ediliyor...',
    'generating': 'AI görsel oluşturuyor...',
    'completed': 'Tamamlandı!',
    'failed': 'Hata oluştu',
  };

  const description = currentStep 
    ? stepLabels[currentStep] || 'İşleniyor...'
    : packageType === 'retouch'
      ? 'AI profesyonel rötuş uyguluyor...'
      : 'Profesyonel mücevher görseli render ediliyor...';

  // Use polling progress if available, otherwise estimate
  const displayProgress = progress > 0 ? progress : (step === 'analyzing' ? 15 : step === 'generating' ? 40 : 5);

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-card border border-border rounded-2xl overflow-hidden shadow-luxury"
    >
      {/* Header with spinner */}
      <div className="relative p-6 pb-4">
        <div className="flex items-center gap-4">
          <div className="relative w-12 h-12 flex-shrink-0">
            <motion.div
              className="absolute inset-0 rounded-full border-2 border-primary/20"
              animate={{ rotate: 360 }}
              transition={{ duration: 8, repeat: Infinity, ease: 'linear' }}
            />
            <motion.div
              className="absolute inset-1 rounded-full border-2 border-transparent border-t-primary"
              animate={{ rotate: -360 }}
              transition={{ duration: 1.5, repeat: Infinity, ease: 'linear' }}
            />
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="w-2.5 h-2.5 rounded-full bg-primary" />
            </div>
          </div>
          <div>
            <h3 className="text-lg font-semibold">{title}</h3>
            <p className="text-sm text-muted-foreground">{description}</p>
          </div>
        </div>
      </div>

      {/* Blurred preview */}
      {previewImage && (
        <div className="relative h-48 mx-6 rounded-xl overflow-hidden">
          <motion.img
            src={previewImage}
            alt="Processing preview"
            className="w-full h-full object-cover"
            initial={{ scale: 1.1, filter: 'blur(20px)' }}
            animate={{
              scale: [1.1, 1.15, 1.1],
              filter: ['blur(20px)', 'blur(15px)', 'blur(20px)'],
            }}
            transition={{ duration: 4, repeat: Infinity, ease: 'easeInOut' }}
          />
          <div className="absolute inset-0 bg-gradient-to-t from-card via-card/50 to-transparent" />
          <motion.div
            className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent"
            initial={{ x: '-100%' }}
            animate={{ x: '100%' }}
            transition={{ duration: 2, repeat: Infinity, ease: 'linear', repeatDelay: 1 }}
          />
        </div>
      )}

      {/* Progress & Facts */}
      <div className="p-6 pt-4 space-y-4">
        {/* Progress bar */}
        <div className="space-y-2">
          <div className="h-1.5 bg-muted rounded-full overflow-hidden">
            <motion.div
              className="h-full bg-gradient-to-r from-primary to-primary/70 rounded-full"
              initial={{ width: '0%' }}
              animate={{ width: `${Math.min(displayProgress, 95)}%` }}
              transition={{ duration: 1, ease: 'easeOut' }}
            />
          </div>
          <div className="flex justify-between items-center text-xs">
            <span className="text-muted-foreground">
              {description}
            </span>
            <div className="flex items-center gap-1.5">
              <span className="text-muted-foreground">{displayProgress}%</span>
              <Loader2 className="h-3 w-3 animate-spin text-primary" />
            </div>
          </div>
        </div>

        {/* Jewelry Facts */}
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
