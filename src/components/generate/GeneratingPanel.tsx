import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Lightbulb, Loader2, CheckCircle2, Camera, ShoppingBag, User, Focus } from 'lucide-react';
import { getRandomFacts } from '@/lib/jewelryFacts';

interface GeneratingPanelProps {
  step: 'idle' | 'analyzing' | 'generating' | 'finalizing';
  packageType?: 'standard' | 'single' | 'retouch';
  previewImage?: string | null;
  currentStep?: string | null;
  progress?: number;
  completedImages?: number;
  totalImages?: number;
  selectedScenes?: string[];
}

const SCENE_CONFIG: Record<string, { label: string; desc: string; Icon: typeof Camera; gradient: string }> = {
  editorial: { label: 'Editorial', desc: 'Yaratici sahne', Icon: Camera, gradient: 'from-amber-500/20 to-orange-500/10' },
  ecommerce: { label: 'E-Ticaret', desc: 'Urun cekimi', Icon: ShoppingBag, gradient: 'from-blue-500/20 to-cyan-500/10' },
  model: { label: 'Model', desc: 'Manken gorsel', Icon: User, gradient: 'from-pink-500/20 to-rose-500/10' },
  macro: { label: 'Macro', desc: 'Detay cekim', Icon: Focus, gradient: 'from-emerald-500/20 to-green-500/10' },
  model_closeup: { label: 'Yakin Cekim', desc: 'Model yakin plan', Icon: User, gradient: 'from-violet-500/20 to-purple-500/10' },
  model_lifestyle: { label: 'Yasam Tarzi', desc: 'Gunluk yasam', Icon: User, gradient: 'from-sky-500/20 to-indigo-500/10' },
};

const STEP_TO_SCENE: Record<string, string> = {
  generating_editorial: 'editorial',
  generating_ecommerce: 'ecommerce',
  generating_model: 'model',
  generating_macro: 'macro',
  generating_model_closeup: 'model_closeup',
  generating_model_lifestyle: 'model_lifestyle',
};

export function GeneratingPanel({
  step,
  packageType = 'standard',
  previewImage = null,
  currentStep = null,
  progress = 0,
  completedImages = 0,
  totalImages = 3,
  selectedScenes = [],
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
  const isSingle = packageType === 'single';
  const isStandard = packageType === 'standard';
  const title = isRetouch ? 'Rotus Yapiliyor' : isSingle ? 'Gorsel Olusturuluyor' : 'Gorsel Olusturuluyor';

  const stepLabels: Record<string, string> = {
    'pending': 'Kuyrukta bekleniyor...',
    'downloading': 'Gorseller indiriliyor...',
    'analyzing': 'Mucevher analiz ediliyor...',
    'analyzing_style': 'Stil referansi analiz ediliyor...',
    'generating': 'AI gorsel olusturuyor...',
    'generating_editorial': 'Editorial gorsel olusturuluyor...',
    'generating_ecommerce': 'E-Ticaret gorseli olusturuluyor...',
    'generating_model': 'Model gorseli olusturuluyor...',
    'generating_macro': 'Macro detay gorseli olusturuluyor...',
    'generating_model_closeup': 'Yakin cekim gorseli olusturuluyor...',
    'generating_model_lifestyle': 'Yasam tarzi gorseli olusturuluyor...',
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

  // Determine which scene is currently active
  const activeSceneKey = currentStep ? STEP_TO_SCENE[currentStep] : null;

  // Build completed scenes list
  const sceneOrder = selectedScenes.length > 0 ? selectedScenes : ['editorial', 'ecommerce', 'model', 'macro', 'model_closeup', 'model_lifestyle'];
  const activeSceneIndex = activeSceneKey ? sceneOrder.indexOf(activeSceneKey) : -1;

  // Show 3-card layout for standard package with selected scenes
  const showSceneCards = isStandard && selectedScenes.length > 0;

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

      {/* 3-card scene progress (standard with selected scenes) */}
      {showSceneCards && (
        <div className="px-6 pb-3">
          <div className="grid grid-cols-3 gap-2 sm:gap-3">
            {selectedScenes.map((sceneKey, i) => {
              const config = SCENE_CONFIG[sceneKey];
              if (!config) return null;

              const isDone = i < completedImages;
              const isActive = sceneKey === activeSceneKey && !isDone;
              const isPending = !isDone && !isActive;

              return (
                <motion.div
                  key={sceneKey}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.15 }}
                  className={`relative aspect-[4/5] rounded-2xl overflow-hidden transition-all ${
                    isDone
                      ? 'ring-2 ring-green-500/60'
                      : isActive
                      ? 'ring-2 ring-gold animate-glow-gold'
                      : ''
                  }`}
                >
                  {/* Background gradient */}
                  <div className={`absolute inset-0 bg-gradient-to-br ${config.gradient} ${isPending ? 'opacity-40' : ''}`} />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/30 to-transparent" />

                  {/* Shimmer effect for active card */}
                  {isActive && (
                    <motion.div
                      className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent"
                      animate={{ x: ['-100%', '100%'] }}
                      transition={{ duration: 2, repeat: Infinity, ease: 'linear', repeatDelay: 0.5 }}
                    />
                  )}

                  {/* Center icon/status */}
                  <div className="absolute inset-0 flex items-center justify-center">
                    {isDone ? (
                      <motion.div
                        initial={{ scale: 0 }}
                        animate={{ scale: 1 }}
                        transition={{ type: 'spring', stiffness: 300 }}
                      >
                        <CheckCircle2 className="h-10 w-10 text-green-400" />
                      </motion.div>
                    ) : isActive ? (
                      <Loader2 className="h-10 w-10 animate-spin" style={{ color: 'hsl(38, 45%, 55%)' }} />
                    ) : (
                      <config.Icon className="h-10 w-10 text-white/30" />
                    )}
                  </div>

                  {/* Bottom label */}
                  <div className="absolute bottom-0 left-0 right-0 p-3 text-center">
                    <span className={`text-xs font-semibold ${isDone ? 'text-green-300' : isActive ? 'text-white' : 'text-white/40'}`}>
                      {config.label}
                    </span>
                    <p className={`text-[9px] ${isDone ? 'text-green-200/70' : isActive ? 'text-white/70' : 'text-white/20'}`}>
                      {config.desc}
                    </p>
                  </div>
                </motion.div>
              );
            })}
          </div>
        </div>
      )}

      {/* Simple per-image cards for standard without selectedScenes (backward compat) */}
      {isStandard && selectedScenes.length === 0 && totalImages > 1 && (
        <div className="px-6 pb-3">
          <div className="grid grid-cols-3 gap-2">
            {Array.from({ length: Math.min(totalImages, 6) }, (_, i) => {
              const sceneKeys = ['editorial', 'ecommerce', 'model', 'macro', 'model_closeup', 'model_lifestyle'];
              const key = sceneKeys[i];
              const config = key ? SCENE_CONFIG[key] : null;
              const isDone = i < completedImages;
              const isActive = i === (activeSceneKey ? sceneOrder.indexOf(activeSceneKey) : completedImages) && !isDone && currentStep?.startsWith('generating');

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
                      <CheckCircle2 className="h-4 w-4 text-green-500" />
                    ) : isActive ? (
                      <Loader2 className="h-4 w-4 animate-spin" style={{ color: 'hsl(38, 45%, 55%)' }} />
                    ) : config ? (
                      <config.Icon className="h-4 w-4 text-muted-foreground/40" />
                    ) : (
                      <Camera className="h-4 w-4 text-muted-foreground/40" />
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

      {/* Blurred preview (for single/retouch) */}
      {(isSingle || isRetouch) && previewImage && (
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
              {totalImages > 1 && (
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
