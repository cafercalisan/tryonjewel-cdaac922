import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Lightbulb, CheckCircle2, Loader2, Clock, AlertCircle } from 'lucide-react';
import { getRandomFacts } from '@/lib/jewelryFacts';

interface GeneratingPanelProps {
  step: 'idle' | 'analyzing' | 'generating' | 'finalizing' | 'polling';
  currentImageIndex?: number;
  totalImages?: number;
  completedImages?: number;
  packageType?: 'standard' | 'master' | 'retouch';
  previewImage?: string | null;
  jobProgress?: number;
  jobCurrentStep?: string;
  resultUrls?: string[];
}

const MASTER_CARDS = [
  { label: 'Editorial', emoji: '📸', description: 'Lüks katalog görseli' },
  { label: 'E-Ticaret', emoji: '🛒', description: 'Temiz arka plan' },
  { label: 'Model', emoji: '👤', description: 'Manken çekimi' },
];

type CardStatus = 'waiting' | 'generating' | 'completed' | 'failed';

function getCardStatuses(
  jobCurrentStep: string,
  completedImages: number,
  totalImages: number,
  jobStatus?: string,
): CardStatus[] {
  if (jobStatus === 'failed') {
    return MASTER_CARDS.map((_, i) => (i < completedImages ? 'completed' : 'failed'));
  }
  if (jobStatus === 'completed' || completedImages >= totalImages) {
    return MASTER_CARDS.map(() => 'completed');
  }

  const statuses: CardStatus[] = [];
  for (let i = 0; i < 3; i++) {
    if (i < completedImages) {
      statuses.push('completed');
    } else if (i === completedImages) {
      // Currently generating this one
      if (jobCurrentStep === 'analyzing' || jobCurrentStep === 'downloading' || jobCurrentStep === 'pending') {
        statuses.push('waiting');
      } else {
        statuses.push('generating');
      }
    } else {
      statuses.push('waiting');
    }
  }
  return statuses;
}

function MasterCard({
  card,
  status,
  resultUrl,
  index,
}: {
  card: typeof MASTER_CARDS[0];
  status: CardStatus;
  resultUrl?: string;
  index: number;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.1 }}
      className={`relative rounded-xl border overflow-hidden transition-all ${
        status === 'completed'
          ? 'border-primary/40 bg-primary/5'
          : status === 'generating'
          ? 'border-primary/30 bg-card'
          : status === 'failed'
          ? 'border-destructive/40 bg-destructive/5'
          : 'border-border bg-card/50'
      }`}
    >
      {/* Image area */}
      <div className="aspect-[3/4] relative bg-muted/30 flex items-center justify-center overflow-hidden">
        {status === 'completed' && resultUrl ? (
          <motion.img
            src={resultUrl}
            alt={card.label}
            className="w-full h-full object-cover"
            initial={{ opacity: 0, scale: 1.05 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.5 }}
          />
        ) : status === 'generating' ? (
          <div className="flex flex-col items-center gap-2">
            <motion.div
              animate={{ rotate: 360 }}
              transition={{ duration: 1.5, repeat: Infinity, ease: 'linear' }}
            >
              <Loader2 className="h-8 w-8 text-primary" />
            </motion.div>
            <motion.div
              className="absolute inset-0 bg-gradient-to-r from-transparent via-primary/5 to-transparent"
              initial={{ x: '-100%' }}
              animate={{ x: '100%' }}
              transition={{ duration: 2, repeat: Infinity, ease: 'linear' }}
            />
          </div>
        ) : status === 'failed' ? (
          <AlertCircle className="h-8 w-8 text-destructive/50" />
        ) : (
          <Clock className="h-6 w-6 text-muted-foreground/40" />
        )}
      </div>

      {/* Label */}
      <div className="p-2.5 text-center">
        <div className="flex items-center justify-center gap-1.5">
          <span className="text-sm">{card.emoji}</span>
          <span className="text-xs font-medium">{card.label}</span>
          {status === 'completed' && (
            <CheckCircle2 className="h-3.5 w-3.5 text-primary" />
          )}
        </div>
        <p className="text-[10px] text-muted-foreground mt-0.5">
          {status === 'completed'
            ? 'Tamamlandı'
            : status === 'generating'
            ? 'Oluşturuluyor...'
            : status === 'failed'
            ? 'Başarısız'
            : 'Bekliyor'}
        </p>
      </div>
    </motion.div>
  );
}

export function GeneratingPanel({ 
  step, 
  currentImageIndex = 1, 
  totalImages = 1,
  completedImages = 0,
  packageType = 'standard',
  previewImage = null,
  jobProgress = 0,
  jobCurrentStep = 'pending',
  resultUrls = [],
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

  const isMaster = packageType === 'master';

  const getStepInfo = () => {
    const effectiveStep = step === 'polling' ? jobCurrentStep : step;

    if (effectiveStep === 'pending' || effectiveStep === 'downloading') {
      return { title: 'Hazırlanıyor...', description: 'Görseller indiriliyor ve hazırlanıyor...' };
    }
    if (effectiveStep === 'analyzing') {
      return {
        title: packageType === 'retouch' ? 'Görsel Analiz Ediliyor' : 'Ürün Analiz Ediliyor',
        description: packageType === 'retouch'
          ? 'AI görselinizi profesyonel rötuş için analiz ediyor...'
          : 'AI mücevherinizin detaylarını analiz ediyor...',
      };
    }
    if (effectiveStep === 'generating' || effectiveStep === 'generating_ecommerce' || effectiveStep === 'generating_model') {
      return {
        title: isMaster
          ? `${completedImages}/${totalImages} Görsel Hazır`
          : 'Görsel Oluşturuluyor',
        description: isMaster
          ? '4K ultra yüksek çözünürlükte üretim devam ediyor...'
          : 'Profesyonel mücevher görseli render ediliyor...',
      };
    }
    if (effectiveStep === 'completed') {
      return { title: 'Tamamlandı!', description: '4K görselleriniz hazır!' };
    }
    if (effectiveStep === 'failed') {
      return { title: 'Hata Oluştu', description: 'Görsel oluşturulurken bir sorun yaşandı.' };
    }
    if (step === 'finalizing') {
      return { title: 'Son Rötuşlar', description: '4K kalitede görselleriniz hazırlanıyor...' };
    }
    return { title: 'İşleniyor...', description: 'Arka planda işlem devam ediyor...' };
  };

  const { title, description } = getStepInfo();
  const cardStatuses = isMaster ? getCardStatuses(jobCurrentStep, completedImages, totalImages) : [];

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-card border border-border rounded-2xl overflow-hidden shadow-luxury"
    >
      {/* Header with spinner */}
      <div className="relative p-6 pb-4">
        <div className="flex items-center gap-4">
          {step !== 'finalizing' && jobCurrentStep !== 'completed' ? (
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
          ) : (
            <div className="w-12 h-12 flex-shrink-0 rounded-full bg-primary/10 flex items-center justify-center">
              <CheckCircle2 className="h-6 w-6 text-primary" />
            </div>
          )}
          <div>
            <h3 className="text-lg font-semibold">{title}</h3>
            <p className="text-sm text-muted-foreground">{description}</p>
          </div>
        </div>
      </div>

      {/* Master Package: 3 Cards */}
      {isMaster && (
        <div className="px-6 pb-2">
          <div className="grid grid-cols-3 gap-3">
            {MASTER_CARDS.map((card, i) => (
              <MasterCard
                key={card.label}
                card={card}
                status={cardStatuses[i]}
                resultUrl={resultUrls[i]}
                index={i}
              />
            ))}
          </div>
        </div>
      )}

      {/* Non-master: blurred preview */}
      {!isMaster && previewImage && (
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
              animate={{ width: `${jobProgress}%` }}
              transition={{ duration: 0.8, ease: 'easeOut' }}
            />
          </div>
          <div className="flex justify-between items-center text-xs">
            <span className="text-muted-foreground">
              {isMaster
                ? `${completedImages}/${totalImages} görsel tamamlandı`
                : jobProgress < 100
                ? 'İşleniyor...'
                : 'Tamamlandı'}
            </span>
            <span className="text-primary font-medium">{jobProgress}%</span>
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
