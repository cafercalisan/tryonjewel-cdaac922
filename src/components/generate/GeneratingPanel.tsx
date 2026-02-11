import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Lightbulb, CheckCircle2, Loader2, Clock, AlertCircle, ArrowRight } from 'lucide-react';
import { getRandomFacts } from '@/lib/jewelryFacts';
import { ImageLightbox } from '@/components/ui/image-lightbox';
import { Button } from '@/components/ui/button';

type CardStatus = 'waiting' | 'generating' | 'completed' | 'failed';

interface GeneratingPanelProps {
  step: 'idle' | 'analyzing' | 'generating' | 'finalizing';
  currentImageIndex?: number;
  totalImages?: number;
  completedImages?: number;
  packageType?: 'standard' | 'master' | 'retouch';
  previewImage?: string | null;
  resultUrls?: string[];
  cardStatuses?: CardStatus[];
  waitingForUser?: boolean;
  onContinue?: () => void;
  currentMasterStep?: number;
}

const MASTER_CARDS = [
  { label: 'Editorial', emoji: '📸', description: 'Lüks katalog görseli' },
  { label: 'E-Ticaret', emoji: '🛒', description: 'Temiz arka plan' },
  { label: 'Model', emoji: '👤', description: 'Manken çekimi' },
];

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
          <ImageLightbox
            src={resultUrl}
            alt={card.label}
            className="w-full h-full"
            enableDownload
            downloadFilename={`jewelry-${card.label.toLowerCase()}`}
          />
        ) : status === 'generating' ? (
          <div className="flex flex-col items-center gap-2">
            <motion.div
              animate={{ rotate: 360 }}
              transition={{ duration: 1.5, repeat: Infinity, ease: 'linear' }}
            >
              <Loader2 className="h-8 w-8 text-primary" />
            </motion.div>
            <p className="text-xs text-muted-foreground mt-1">Oluşturuluyor...</p>
            <motion.div
              className="absolute inset-0 bg-gradient-to-r from-transparent via-primary/5 to-transparent"
              initial={{ x: '-100%' }}
              animate={{ x: '100%' }}
              transition={{ duration: 2, repeat: Infinity, ease: 'linear' }}
            />
          </div>
        ) : status === 'failed' ? (
          <div className="flex flex-col items-center gap-1">
            <AlertCircle className="h-8 w-8 text-destructive/50" />
            <p className="text-xs text-destructive/60">Başarısız</p>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-1">
            <Clock className="h-6 w-6 text-muted-foreground/40" />
            <p className="text-xs text-muted-foreground/50">Sırada</p>
          </div>
        )}
      </div>

      {/* Label */}
      <div className="p-3 text-center">
        <div className="flex items-center justify-center gap-1.5">
          <span className="text-base">{card.emoji}</span>
          <span className="text-sm font-medium">{card.label}</span>
          {status === 'completed' && (
            <CheckCircle2 className="h-4 w-4 text-primary" />
          )}
        </div>
        <p className="text-xs text-muted-foreground mt-0.5">
          {card.description}
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
  resultUrls = [],
  cardStatuses = ['waiting', 'waiting', 'waiting'],
  waitingForUser = false,
  onContinue,
  currentMasterStep = 0,
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
  const progressPercent = isMaster
    ? Math.round((completedImages / 3) * 100)
    : completedImages >= totalImages ? 100 : 50;

  const allDone = isMaster
    ? cardStatuses.every(s => s === 'completed' || s === 'failed')
    : completedImages >= totalImages;

  const getStepInfo = () => {
    if (allDone) {
      return { title: 'Tamamlandı!', description: '4K görselleriniz hazır!' };
    }
    if (isMaster) {
      if (waitingForUser) {
        return {
          title: `${completedImages}/${totalImages} Görsel Hazır`,
          description: 'Görseli inceleyin, hazır olduğunuzda devam edin.',
        };
      }
      const generating = cardStatuses.findIndex(s => s === 'generating');
      if (generating >= 0) {
        return {
          title: `${completedImages}/${totalImages} Görsel Hazır`,
          description: `${MASTER_CARDS[generating].label} görseli oluşturuluyor...`,
        };
      }
      return { title: 'Hazırlanıyor...', description: '4K ultra yüksek çözünürlükte üretim...' };
    }
    return {
      title: packageType === 'retouch' ? 'Rötuş Yapılıyor' : 'Görsel Oluşturuluyor',
      description: packageType === 'retouch'
        ? 'AI profesyonel rötuş uyguluyor...'
        : 'Profesyonel mücevher görseli render ediliyor...',
    };
  };

  const { title, description } = getStepInfo();

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-card border border-border rounded-2xl overflow-hidden shadow-luxury"
    >
      {/* Header with spinner */}
      <div className="relative p-6 pb-4">
        <div className="flex items-center gap-4">
          {!allDone ? (
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
        <div className="px-4 sm:px-6 pb-2 space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
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
          
          {/* Continue button - shown when waiting for user */}
          {waitingForUser && currentMasterStep < 3 && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="flex justify-center pt-2"
            >
              <Button
                size="lg"
                onClick={onContinue}
                className="gap-2 px-8"
              >
                {currentMasterStep === 1 ? 'E-Ticaret Görseli Oluştur' : 'Model Görseli Oluştur'}
                <ArrowRight className="h-4 w-4" />
              </Button>
            </motion.div>
          )}
        </div>
      )}

      {/* Non-master: blurred preview */}
      {!isMaster && previewImage && !allDone && (
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
              animate={{ width: `${progressPercent}%` }}
              transition={{ duration: 0.8, ease: 'easeOut' }}
            />
          </div>
          <div className="flex justify-between items-center text-xs">
            <span className="text-muted-foreground">
              {isMaster
                ? `${completedImages}/${totalImages} görsel tamamlandı`
                : allDone
                ? 'Tamamlandı'
                : 'İşleniyor...'}
            </span>
            <span className="text-primary font-medium">{progressPercent}%</span>
          </div>
        </div>

        {/* Jewelry Facts */}
        {!allDone && (
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
        )}
      </div>
    </motion.div>
  );
}
