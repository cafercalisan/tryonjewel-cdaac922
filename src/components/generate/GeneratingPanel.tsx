import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Lightbulb, Check, AlertCircle, Loader2, Clock } from 'lucide-react';
import { getRandomFacts } from '@/lib/jewelryFacts';
import { Card, CardContent } from '@/components/ui/card';
import { cn } from '@/lib/utils';

interface GeneratingPanelProps {
  step: 'idle' | 'analyzing' | 'generating' | 'finalizing';
  currentImageIndex?: number;
  totalImages?: number;
  completedImages?: number;
  packageType?: 'standard' | 'master' | 'retouch';
  previewImage?: string | null;
  // New props for background job status
  currentStep?: string;
  progress?: number;
  resultUrls?: string[];
  failedImageIndices?: number[];
  partialRefundAmount?: number;
}

// Image card status type
type CardStatus = 'waiting' | 'generating' | 'completed' | 'failed';

// Master package image labels
const masterPackageLabels = [
  { title: 'Lüks Katalog', description: 'Editorial sahneleme' },
  { title: 'E-Ticaret', description: 'Sade arka plan' },
  { title: 'Model Çekimi', description: 'Manken ile sunum' },
];

// Retouch package image labels
const retouchPackageLabels = [
  { title: 'Siyah Arka Plan', description: 'Lüks yansımalı' },
  { title: 'Beyaz Arka Plan', description: 'E-ticaret standardı' },
];

export function GeneratingPanel({ 
  step, 
  currentImageIndex = 1, 
  totalImages = 1,
  completedImages = 0,
  packageType = 'standard',
  previewImage = null,
  currentStep,
  progress: jobProgress,
  resultUrls = [],
  failedImageIndices = [],
  partialRefundAmount = 0,
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

  // Determine card status for each image slot
  const getCardStatus = (index: number): CardStatus => {
    if (failedImageIndices.includes(index)) return 'failed';
    if (resultUrls[index]) return 'completed';
    if (index === resultUrls.length) return 'generating';
    return 'waiting';
  };

  // Get image labels based on package type
  const getImageLabels = () => {
    if (packageType === 'master') return masterPackageLabels;
    if (packageType === 'retouch') return retouchPackageLabels;
    return [{ title: 'Görsel', description: 'İşleniyor' }];
  };

  const imageLabels = getImageLabels();
  const showCards = packageType === 'master' || packageType === 'retouch';

  const getStepInfo = () => {
    // If we have a currentStep from the job, use it as description
    const jobDescription = currentStep && currentStep !== 'Bekliyor...' ? currentStep : null;
    
    switch (step) {
      case 'analyzing':
        return {
          title: packageType === 'retouch' ? 'Görsel Analiz Ediliyor' : 'Ürün Analiz Ediliyor',
          description: jobDescription || (packageType === 'retouch' 
            ? 'AI görselinizi profesyonel rötuş için analiz ediyor...'
            : 'AI mücevherinizin detaylarını analiz ediyor...'),
        };
      case 'generating':
        if (packageType === 'retouch') {
          return {
            title: 'Profesyonel Rötuş',
            description: jobDescription || 'Görselinize stüdyo kalitesinde rötuş uygulanıyor...',
          };
        }
        if (packageType === 'master') {
          const labels = ['Lüks Katalog Görseli', 'E-Ticaret Görseli', 'Manken Çekimi'];
          return {
            title: labels[currentImageIndex - 1] || 'Görsel Oluşturuluyor',
            description: jobDescription || `Master paket: ${currentImageIndex}/${totalImages} görsel oluşturuluyor...`,
          };
        }
        return {
          title: 'Görsel Oluşturuluyor',
          description: jobDescription || 'Profesyonel mücevher görseli render ediliyor...',
        };
      case 'finalizing':
        return {
          title: 'Son Rötuşlar',
          description: packageType === 'retouch' 
            ? 'Rötuşlu görseliniz hazırlanıyor...'
            : '4K kalitede görselleriniz hazırlanıyor...',
        };
      default:
        return {
          title: 'İşleniyor',
          description: jobDescription || 'Lütfen bekleyin...',
        };
    }
  };

  const { title, description } = getStepInfo();
  
  // Calculate progress: use job progress if available, otherwise calculate from completedImages
  const displayProgress = jobProgress !== undefined 
    ? jobProgress 
    : step === 'analyzing' 
      ? 10 
      : step === 'finalizing'
        ? 100
        : 10 + (completedImages / totalImages) * 90;

  // Render individual image card
  const renderImageCard = (index: number) => {
    const status = getCardStatus(index);
    const label = imageLabels[index] || { title: `Görsel ${index + 1}`, description: '' };
    const imageUrl = resultUrls[index];

    return (
      <motion.div
        key={index}
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: index * 0.1 }}
        className="flex-1"
      >
        <Card className={cn(
          "overflow-hidden transition-all duration-300",
          status === 'generating' && "ring-2 ring-primary ring-offset-2",
          status === 'completed' && "ring-2 ring-green-500 ring-offset-2",
          status === 'failed' && "ring-2 ring-destructive ring-offset-2",
        )}>
          <div className="aspect-[4/5] relative bg-muted">
            {/* Completed: Show actual image */}
            {status === 'completed' && imageUrl && (
              <motion.img
                src={imageUrl}
                alt={label.title}
                className="w-full h-full object-cover"
                initial={{ opacity: 0, scale: 1.1 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.5 }}
              />
            )}

            {/* Generating: Show spinner with preview background */}
            {status === 'generating' && (
              <>
                {previewImage && (
                  <motion.img
                    src={previewImage}
                    alt="Preview"
                    className="w-full h-full object-cover opacity-30 blur-sm"
                    animate={{ scale: [1, 1.02, 1] }}
                    transition={{ duration: 2, repeat: Infinity }}
                  />
                )}
                <div className="absolute inset-0 flex items-center justify-center bg-background/50">
                  <motion.div
                    animate={{ rotate: 360 }}
                    transition={{ duration: 1.5, repeat: Infinity, ease: "linear" }}
                  >
                    <Loader2 className="h-10 w-10 text-primary" />
                  </motion.div>
                </div>
                <motion.div
                  className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent"
                  initial={{ x: '-100%' }}
                  animate={{ x: '100%' }}
                  transition={{ duration: 1.5, repeat: Infinity, ease: "linear" }}
                />
              </>
            )}

            {/* Waiting: Show placeholder */}
            {status === 'waiting' && (
              <div className="absolute inset-0 flex items-center justify-center bg-muted">
                <Clock className="h-8 w-8 text-muted-foreground/50" />
              </div>
            )}

            {/* Failed: Show error state */}
            {status === 'failed' && (
              <div className="absolute inset-0 flex flex-col items-center justify-center bg-destructive/10">
                <AlertCircle className="h-10 w-10 text-destructive mb-2" />
                <span className="text-xs text-destructive font-medium">Başarısız</span>
              </div>
            )}

            {/* Status badge */}
            <div className={cn(
              "absolute top-2 right-2 w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold",
              status === 'completed' && "bg-green-500 text-white",
              status === 'generating' && "bg-primary text-primary-foreground",
              status === 'waiting' && "bg-muted-foreground/30 text-muted-foreground",
              status === 'failed' && "bg-destructive text-white",
            )}>
              {status === 'completed' && <Check className="h-4 w-4" />}
              {status === 'generating' && <Loader2 className="h-3 w-3 animate-spin" />}
              {status === 'waiting' && (index + 1)}
              {status === 'failed' && <AlertCircle className="h-3 w-3" />}
            </div>
          </div>

          <CardContent className="p-3">
            <h4 className="font-medium text-sm truncate">{label.title}</h4>
            <p className="text-xs text-muted-foreground truncate">{label.description}</p>
          </CardContent>
        </Card>
      </motion.div>
    );
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-card border border-border rounded-2xl overflow-hidden shadow-luxury"
    >
      {/* Show cards for master/retouch packages */}
      {showCards ? (
        <div className="p-6 pb-4">
          <div className="grid grid-cols-3 gap-3">
            {Array.from({ length: totalImages }).map((_, i) => renderImageCard(i))}
          </div>
        </div>
      ) : (
        /* Standard package: Blurred Preview Image */
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
      )}

      {/* Content */}
      <div className="p-6 space-y-4">
        {/* Progress Header */}
        <div className="text-center">
          <h3 className="text-lg font-semibold mb-1">{title}</h3>
          <p className="text-sm text-muted-foreground">{description}</p>
          
          {/* Partial refund notice */}
          {partialRefundAmount > 0 && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              className="mt-2 text-xs text-amber-600 bg-amber-50 rounded-lg px-3 py-1.5 inline-flex items-center gap-1"
            >
              <AlertCircle className="h-3 w-3" />
              {partialRefundAmount} kredi iade edildi
            </motion.div>
          )}
        </div>

        {/* Progress bar - based on job progress or completed images */}
        <div className="space-y-2">
          <div className="h-1.5 bg-muted rounded-full overflow-hidden">
            <motion.div
              className="h-full bg-gradient-to-r from-primary to-primary/70 rounded-full"
              initial={{ width: '0%' }}
              animate={{ width: `${displayProgress}%` }}
              transition={{ duration: 0.8, ease: "easeOut" }}
            />
          </div>
          
          {/* Progress text - show for all package types now */}
          <div className="flex justify-between items-center text-xs">
            <span className="text-muted-foreground">
              {step === 'analyzing' 
                ? 'Analiz ediliyor...'
                : step === 'finalizing'
                  ? 'Tamamlandı'
                  : totalImages > 1 
                    ? `${resultUrls.length}/${totalImages} görsel oluşturuldu`
                    : 'İşleniyor...'
              }
            </span>
            <span className="text-primary font-medium">
              {Math.round(displayProgress)}%
            </span>
          </div>
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
