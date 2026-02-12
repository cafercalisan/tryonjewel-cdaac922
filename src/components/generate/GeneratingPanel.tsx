import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Lightbulb, Loader2, CheckCircle2, Camera, ShoppingBag, User } from 'lucide-react';
import { getRandomFacts } from '@/lib/jewelryFacts';

interface GeneratingPanelProps {
  step: 'idle' | 'analyzing' | 'generating' | 'finalizing';
  packageType?: 'standard' | 'retouch';
  previewImage?: string | null;
  currentStep?: string | null;
  progress?: number;
  completedImages?: number;
  totalImages?: number;
}

const IMAGE_TYPE_CONFIG = [
  { label: 'Editorial', Icon: Camera, desc: 'Yaratici sahne' },
  { label: 'E-Ticaret', Icon: ShoppingBag, desc: 'Urun cekimi' },
  { label: 'Model', Icon: User, desc: 'Lifestyle gorsel' },
];

export function GeneratingPanel({
  step,
  packageType = 'standard',
  previewImage = null,
  currentStep = null,
  progress = 0,
  completedImages = 0,
  totalImages = 3,
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

  const isRetouch = packageType === 'retouch';
  const title = isRetouch ? 'Rotus Yapiliyor' : 'Gorsel Olusturuluyor';

  const stepLabels: Record<string, string> = {
    'pending': 'Kuyrukta bekleniyor...',
    'downloading': 'Gorseller indiriliyor...',
    'analyzing': 'Mucevher analiz ediliyor...',
    'generating': 'AI gorsel olusturuyor...',
    'generating_1': 'Gorsel 1/3 olusturuluyor...',
    'generating_2': 'Gorsel 2/3 olusturuluyor...',
    'generating_3': 'Gorsel 3/3 olusturuluyor...',
    'generating_editorial': 'Editorial gorsel olusturuluyor...',
    'generating_ecommerce': 'E-Ticaret gorseli olusturuluyor...',
    'generating_model': 'Model gorseli olusturuluyor...',
    'saving': 'Sonuclar kaydediliyor...',
    'completed': 'Tamamlandi!',
    'failed': 'Hata olustu',
  };

  const description = currentStep
    ? stepLabels[currentStep] || 'Isleniyor...'
    : isRetouch
      ? 'AI profesyonel rotus uyguluyor...'
      : 'Profesyonel mucevher gorseli render ediliyor...';

  const displayProgress = progress > 0 ? progress : (step === 'analyzing' ? 15 : step === 'generating' ? 40 : 5);

  const masterStepMap: Record<string, number> = {
    'generating_editorial': 0,
    'generating_ecommerce': 1,
    'generating_model': 2,
  };
  const currentImageIndex = currentStep
    ? masterStepMap[currentStep] ?? (currentStep.startsWith('generating_') ? parseInt(currentStep.split('_')[1]) - 1 : completedImages)
    : completedImages;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-card border border-border rounded-2xl overflow-hidden shadow-luxury"
    >
      {/* Header with gold spinner */}
      <div className="relative p-6 pb-4">
        <div className="flex items-center gap-4">
          <div className="relative w-12 h-12 flex-shrink-0">
            <motion.div
              className="absolute inset-0 rounded-full border-2 border-gold/20"
              animate={{ rotate: 360 }}
              transition={{ duration: 8, repeat: Infinity, ease: 'linear' }}
            />
            <motion.div
              className="absolute inset-1 rounded-full border-2 border-transparent"
              style={{ borderTopColor: 'hsl(38, 45%, 55%)' }}
              animate={{ rotate: -360 }}
              transition={{ duration: 1.5, repeat: Infinity, ease: 'linear' }}
            />
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="w-2.5 h-2.5 rounded-full" style={{ background: 'hsl(38, 45%, 55%)' }} />
            </div>
          </div>
          <div>
            <h3 className="text-lg font-semibold">{title}</h3>
            <p className="text-sm text-muted-foreground">{description}</p>
          </div>
        </div>
      </div>

      {/* Per-image progress cards (only for standard package) */}
      {!isRetouch && totalImages > 1 && (
        <div className="px-6 pb-3">
          <div className="grid grid-cols-3 gap-2">
            {Array.from({ length: Math.min(totalImages, 3) }, (_, i) => {
              const isDone = i < completedImages;
              const isActive = i === currentImageIndex && !isDone && currentStep?.startsWith('generating');
              const config = IMAGE_TYPE_CONFIG[i];

              return (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.1 }}
                  className={`relative rounded-xl p-2.5 border transition-all ${
                    isDone
                      ? 'bg-green-50 dark:bg-green-950/30 border-green-200 dark:border-green-800'
                      : isActive
                      ? 'gradient-gold-subtle border-gold animate-glow-gold'
                      : 'bg-muted/30 border-border/50'
                  }`}
                >
                  <div className="flex items-center gap-2 mb-1">
                    {isDone ? (
                      <motion.div
                        initial={{ scale: 0 }}
                        animate={{ scale: 1 }}
                        transition={{ type: 'spring', stiffness: 300 }}
                      >
                        <CheckCircle2 className="h-4 w-4 text-green-500" />
                      </motion.div>
                    ) : isActive ? (
                      <Loader2 className="h-4 w-4 animate-spin" style={{ color: 'hsl(38, 45%, 55%)' }} />
                    ) : (
                      <config.Icon className="h-4 w-4 text-muted-foreground/40" />
                    )}
                    <span className={`text-[11px] font-semibold ${
                      isDone ? 'text-green-600 dark:text-green-400' : isActive ? 'text-foreground' : 'text-muted-foreground/50'
                    }`}>
                      {config?.label || `Gorsel ${i + 1}`}
                    </span>
                  </div>
                  <p className={`text-[9px] leading-tight ${
                    isDone ? 'text-green-500/70' : isActive ? 'text-muted-foreground' : 'text-muted-foreground/30'
                  }`}>
                    {config?.desc}
                  </p>
                </motion.div>
              );
            })}
          </div>
        </div>
      )}

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
        {/* Gold gradient progress bar */}
        <div className="space-y-2">
          <div className="h-1.5 bg-muted rounded-full overflow-hidden">
            <motion.div
              className="h-full rounded-full gradient-gold"
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
              {!isRetouch && totalImages > 1 && (
                <span className="text-muted-foreground mr-1">
                  {completedImages}/{totalImages}
                </span>
              )}
              <span className="font-medium" style={{ color: 'hsl(38, 45%, 55%)' }}>{displayProgress}%</span>
              <Loader2 className="h-3 w-3 animate-spin" style={{ color: 'hsl(38, 45%, 55%)' }} />
            </div>
          </div>
        </div>

        {/* Jewelry Facts */}
        <div className="gradient-gold-subtle rounded-xl p-4 border border-gold/10">
          <div className="flex items-center gap-2 mb-3">
            <Lightbulb className="h-4 w-4" style={{ color: 'hsl(38, 45%, 55%)' }} />
            <span className="text-xs font-medium uppercase tracking-wider" style={{ color: 'hsl(38, 45%, 55%)' }}>
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
              {facts[currentFactIndex] || 'Mucevherler yuzyillardir insanligin en degerli hazineleri arasinda yer almaktadir.'}
            </motion.p>
          </AnimatePresence>
        </div>
      </div>
    </motion.div>
  );
}
