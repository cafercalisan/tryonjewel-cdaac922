import { Link } from 'react-router-dom';
import { motion, useScroll, useTransform, useInView, AnimatePresence } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { AppLayout } from '@/components/layout/AppLayout';
import {
  ArrowRight, Camera, Palette, Download,
  X, Check, Mail, Sparkles,
} from 'lucide-react';
import { InfiniteProductShowcase } from '@/components/landing/InfiniteProductShowcase';
import { useRef, useState, useEffect } from 'react';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from '@/components/ui/dialog';

// ─── Scroll-triggered word-by-word reveal ────────────────────────────────────
function RevealText({ children, className = '' }: { children: string; className?: string }) {
  const words = children.split(' ');
  return (
    <motion.span
      className={className}
      initial="hidden"
      whileInView="visible"
      viewport={{ once: true, margin: '-8%' }}
    >
      {words.map((word, i) => (
        <motion.span
          key={i}
          className="inline-block mr-[0.25em]"
          variants={{
            hidden: { opacity: 0, y: 20, filter: 'blur(6px)' },
            visible: {
              opacity: 1,
              y: 0,
              filter: 'blur(0px)',
              transition: { delay: i * 0.04, duration: 0.6, ease: [0.22, 1, 0.36, 1] },
            },
          }}
        >
          {word}
        </motion.span>
      ))}
    </motion.span>
  );
}

// ─── Animated counter ────────────────────────────────────────────────────────
function CountUp({ target, suffix = '', prefix = '' }: { target: number; suffix?: string; prefix?: string }) {
  const ref = useRef<HTMLSpanElement>(null);
  const isInView = useInView(ref, { once: true });
  const [count, setCount] = useState(0);

  useEffect(() => {
    if (!isInView) return;
    const duration = 2;
    const start = performance.now();
    const step = (now: number) => {
      const elapsed = (now - start) / 1000;
      const progress = Math.min(elapsed / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      setCount(Math.floor(target * eased));
      if (progress < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  }, [isInView, target]);

  return <span ref={ref}>{prefix}{count}{suffix}</span>;
}

// ─── Gold animated word ──────────────────────────────────────────────────────
function GoldAnimatedWord({ words, interval = 3000 }: { words: string[]; interval?: number }) {
  const [index, setIndex] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setIndex(i => (i + 1) % words.length), interval);
    return () => clearInterval(t);
  }, [words.length, interval]);

  return (
    <span className="relative inline-block min-w-[3em]">
      <AnimatePresence mode="wait">
        <motion.span
          key={index}
          initial={{ opacity: 0, y: 30, filter: 'blur(8px)' }}
          animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
          exit={{ opacity: 0, y: -30, filter: 'blur(8px)' }}
          transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
          className="inline-block italic font-serif"
          style={{ color: 'hsl(38, 45%, 60%)' }}
        >
          {words[index]}
        </motion.span>
      </AnimatePresence>
    </span>
  );
}

// ─── Noise overlay ───────────────────────────────────────────────────────────
const NOISE_BG = `url("data:image/svg+xml,%3Csvg viewBox='0 0 512 512' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='.7' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E")`;

// ─── Staggered fade-in wrapper ───────────────────────────────────────────────
const stagger = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.08 } },
};
const fadeUp = {
  hidden: { opacity: 0, y: 30 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.6, ease: [0.22, 1, 0.36, 1] } },
};

// ─── MAIN LANDING ────────────────────────────────────────────────────────────
export default function Landing() {
  const [showContactModal, setShowContactModal] = useState(false);

  // ── Hero scroll zoom-out ──
  const heroRef = useRef<HTMLElement>(null);
  const { scrollYProgress: heroScroll } = useScroll({
    target: heroRef,
    offset: ['start start', 'end start'],
  });
  const heroScale = useTransform(heroScroll, [0, 1], [1, 0.85]);
  const heroOpacity = useTransform(heroScroll, [0, 0.7], [1, 0]);

  // ── Transformation section parallax ──
  const transformRef = useRef<HTMLElement>(null);
  const { scrollYProgress: transScroll } = useScroll({
    target: transformRef,
    offset: ['start end', 'end start'],
  });
  const origParallaxY = useTransform(transScroll, [0, 1], [50, -50]);
  const resultsParallaxY = useTransform(transScroll, [0, 1], [80, -30]);

  return (
    <AppLayout>
      {/* ═══════════════════ HERO — TEXT-ONLY WITH SCROLL ZOOM ═══════════════════ */}
      <section
        ref={heroRef}
        className="relative min-h-screen flex items-center justify-center overflow-hidden"
        style={{ background: 'linear-gradient(180deg, #050505 0%, #0a0a0a 60%, #0e0e0e 100%)' }}
      >
        {/* Ambient glow + grain */}
        <div className="absolute inset-0 pointer-events-none">
          <div
            className="absolute -top-[30%] right-[-15%] w-[70vw] h-[70vw] rounded-full opacity-[0.04]"
            style={{ background: 'radial-gradient(circle, hsl(38,45%,55%) 0%, transparent 70%)' }}
          />
          <div
            className="absolute bottom-[-20%] left-[-10%] w-[50vw] h-[50vw] rounded-full opacity-[0.03]"
            style={{ background: 'radial-gradient(circle, hsl(38,45%,55%) 0%, transparent 70%)' }}
          />
          <div className="absolute inset-0 opacity-[0.035]" style={{ backgroundImage: NOISE_BG }} />
          {/* Subtle center glow from a blurred image */}
          <div className="absolute inset-0 flex items-center justify-center">
            <img
              src="/landing/after-2b.jpg"
              alt=""
              className="w-[50vw] max-w-[500px] aspect-square object-cover rounded-full opacity-[0.04]"
              style={{ filter: 'blur(80px)' }}
            />
          </div>
        </div>

        {/* Content — scales down and fades on scroll */}
        <motion.div
          className="container relative z-10 text-center px-4"
          style={{ scale: heroScale, opacity: heroOpacity }}
        >
          {/* Tagline */}
          <motion.p
            className="text-[10px] md:text-xs tracking-[0.3em] uppercase mb-6"
            style={{ color: 'hsl(38,45%,55%)' }}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.3 }}
          >
            AI Destekli Mücevher Görsel Platformu
          </motion.p>

          {/* Headline */}
          <motion.h1
            className="text-[2.2rem] sm:text-5xl md:text-6xl lg:text-7xl xl:text-[5.5rem] font-semibold text-white leading-[1.08] tracking-tight"
            initial={{ opacity: 0, y: 40 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.9, ease: [0.22, 1, 0.36, 1] }}
          >
            Mücevher Fotoğraflarınızı
            <br />
            <GoldAnimatedWord words={['Kampanya', 'Vitrin', 'E-Ticaret']} />{' '}
            Görsellerine
            <br />
            Dönüştürün
          </motion.h1>

          {/* Subtitle */}
          <motion.p
            className="mt-6 text-sm md:text-base lg:text-lg max-w-2xl mx-auto leading-relaxed"
            style={{ color: 'rgba(255,255,255,0.4)' }}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.5 }}
          >
            Tek bir ürün fotoğrafından profesyonel 4K kampanya görselleri üretin.
            Stüdyo maliyetlerini geride bırakın.
          </motion.p>

          {/* CTA */}
          <motion.div
            className="mt-8 flex flex-col sm:flex-row gap-3 justify-center"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.7 }}
          >
            <Link to="/kayit">
              <Button
                size="lg"
                className="w-full sm:w-auto h-12 px-10 text-sm font-medium tracking-wider rounded-none bg-white text-black hover:bg-white/90"
              >
                HEMEN DENEYIN
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </Link>
            <Link to="/ornekler">
              <Button
                size="lg"
                variant="outline"
                className="w-full sm:w-auto h-12 px-10 text-sm font-medium tracking-wider rounded-none border-white/20 text-white bg-transparent hover:bg-white/10"
              >
                ÖRNEKLERİ İNCELE
              </Button>
            </Link>
          </motion.div>

          {/* Scroll indicator */}
          <motion.div
            className="mt-16 flex flex-col items-center"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 1.2 }}
          >
            <motion.div
              className="w-5 h-8 rounded-full border border-white/20 flex justify-center pt-1.5"
              animate={{ y: [0, 6, 0] }}
              transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
            >
              <div className="w-0.5 h-2 rounded-full bg-white/40" />
            </motion.div>
          </motion.div>
        </motion.div>
      </section>

      {/* ═══════════════════ TRANSFORMATION 1→3 WITH PARALLAX ═══════════════════ */}
      <section
        ref={transformRef}
        className="relative py-24 md:py-32 overflow-hidden"
        style={{ background: '#0a0a0a' }}
      >
        <div className="absolute inset-0 opacity-[0.02]" style={{ backgroundImage: NOISE_BG }} />

        <div className="container relative z-10">
          {/* Section title */}
          <div className="text-center mb-12 md:mb-16">
            <motion.p
              className="text-[10px] md:text-xs tracking-[0.3em] uppercase mb-4"
              style={{ color: 'hsl(38,45%,50%)' }}
              initial={{ opacity: 0 }}
              whileInView={{ opacity: 1 }}
              viewport={{ once: true }}
            >
              Tek Fotoğraf — Üç Çıktı
            </motion.p>
            <h2 className="text-2xl sm:text-3xl md:text-4xl lg:text-5xl font-semibold text-white">
              <RevealText>Bir Fotoğraf, Üç Profesyonel Görsel</RevealText>
            </h2>
          </div>

          <div className="max-w-5xl mx-auto">
            {/* Original Image — with parallax wrapper */}
            <motion.div style={{ y: origParallaxY }}>
              <motion.div
                className="flex justify-center mb-4 md:mb-6"
                initial={{ opacity: 0, scale: 0.9 }}
                whileInView={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
                viewport={{ once: true }}
              >
                <div className="relative w-44 sm:w-52 md:w-60 lg:w-64">
                  <div
                    className="relative aspect-square rounded-xl overflow-hidden"
                    style={{
                      border: '2px solid rgba(255,255,255,0.06)',
                      boxShadow: '0 20px 60px -12px rgba(0,0,0,0.7)',
                    }}
                  >
                    <img src="/landing/before-2.jpg" alt="Ürün fotoğrafı" className="w-full h-full object-cover" />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/50 via-transparent to-black/10" />
                    <div className="absolute inset-0" style={{ background: 'rgba(0,0,0,0.08)', mixBlendMode: 'saturation' }} />
                  </div>
                  <motion.div
                    className="absolute -bottom-3 left-1/2 -translate-x-1/2 px-4 py-1 rounded-full backdrop-blur-md"
                    style={{ background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.1)' }}
                    initial={{ opacity: 0, y: 8 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true }}
                  >
                    <span className="text-[9px] md:text-[10px] tracking-[0.2em] uppercase font-medium" style={{ color: 'rgba(255,255,255,0.6)' }}>
                      Ürün Fotoğrafı
                    </span>
                  </motion.div>
                </div>
              </motion.div>
            </motion.div>

            {/* AI Transformation connector */}
            <div className="flex justify-center my-3 md:my-5">
              <div className="flex flex-col items-center">
                <motion.div
                  className="w-px h-6 md:h-10"
                  style={{ background: 'linear-gradient(180deg, transparent, hsl(38,45%,55%))' }}
                  animate={{ opacity: [0.3, 1, 0.3] }}
                  transition={{ duration: 2, repeat: Infinity }}
                />
                <motion.div
                  className="relative w-10 h-10 md:w-11 md:h-11 rounded-full flex items-center justify-center"
                  style={{ background: 'linear-gradient(135deg, hsl(38,45%,55%), hsl(38,50%,42%))' }}
                  animate={{
                    boxShadow: [
                      '0 0 20px hsla(38,45%,55%,0.2)',
                      '0 0 40px hsla(38,45%,55%,0.4)',
                      '0 0 20px hsla(38,45%,55%,0.2)',
                    ],
                  }}
                  transition={{ duration: 2.5, repeat: Infinity }}
                >
                  <Sparkles className="h-4 w-4 text-white" />
                </motion.div>
                {/* 3-way fan lines */}
                <svg width="120" height="28" viewBox="0 0 120 28" className="hidden sm:block mt-px">
                  <motion.path d="M60 0 L20 28" stroke="hsl(38,45%,55%)" strokeWidth="1" fill="none"
                    initial={{ pathLength: 0, opacity: 0 }} whileInView={{ pathLength: 1, opacity: 0.4 }}
                    transition={{ delay: 0.2, duration: 0.6 }} viewport={{ once: true }}
                  />
                  <motion.path d="M60 0 L60 28" stroke="hsl(38,45%,55%)" strokeWidth="1" fill="none"
                    initial={{ pathLength: 0, opacity: 0 }} whileInView={{ pathLength: 1, opacity: 0.5 }}
                    transition={{ delay: 0.3, duration: 0.6 }} viewport={{ once: true }}
                  />
                  <motion.path d="M60 0 L100 28" stroke="hsl(38,45%,55%)" strokeWidth="1" fill="none"
                    initial={{ pathLength: 0, opacity: 0 }} whileInView={{ pathLength: 1, opacity: 0.4 }}
                    transition={{ delay: 0.4, duration: 0.6 }} viewport={{ once: true }}
                  />
                </svg>
                <motion.div
                  className="w-px h-6 sm:hidden"
                  style={{ background: 'linear-gradient(180deg, hsl(38,45%,55%), transparent)' }}
                />
                <span className="text-[7px] md:text-[8px] tracking-[0.3em] uppercase mt-1" style={{ color: 'hsl(38,45%,50%)' }}>
                  AI
                </span>
              </div>
            </div>

            {/* 3 Results — with parallax + asymmetric cascade */}
            <motion.div style={{ y: resultsParallaxY }}>
              <div className="relative flex justify-center items-end gap-2 sm:gap-3 md:gap-5 px-2">
                {[
                  { src: '/landing/after-2a.jpg', label: 'Editorial', desc: 'Lüks sahne çekimi', rotate: -3, yOff: 0, zIdx: 1 },
                  { src: '/landing/after-2b.jpg', label: 'Model', desc: 'Manken çekimi', rotate: 0, yOff: -16, zIdx: 10 },
                  { src: '/landing/after-2c.jpg', label: 'E-Ticaret', desc: 'Ürün çekimi', rotate: 3, yOff: 4, zIdx: 1 },
                ].map((item, i) => (
                  <motion.div
                    key={item.label}
                    className="relative"
                    style={{
                      width: i === 1 ? '34%' : '30%',
                      maxWidth: i === 1 ? '260px' : '220px',
                      zIndex: item.zIdx,
                    }}
                    initial={{ opacity: 0, y: 50, rotate: 0 }}
                    whileInView={{ opacity: 1, y: item.yOff, rotate: item.rotate }}
                    transition={{ delay: 0.15 + i * 0.12, duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
                    viewport={{ once: true }}
                    whileHover={{
                      rotate: 0,
                      scale: 1.06,
                      y: item.yOff - 12,
                      zIndex: 20,
                      transition: { type: 'spring', stiffness: 300, damping: 25 },
                    }}
                  >
                    {/* Gold glow on center card */}
                    {i === 1 && (
                      <motion.div
                        className="absolute -inset-1.5 rounded-2xl -z-10"
                        style={{ background: 'hsla(38,45%,55%,0.12)', filter: 'blur(16px)' }}
                        animate={{ opacity: [0.4, 0.7, 0.4] }}
                        transition={{ duration: 3, repeat: Infinity }}
                      />
                    )}
                    <div
                      className="relative aspect-[4/5] rounded-xl overflow-hidden"
                      style={{
                        border: i === 1 ? '2px solid hsla(38,45%,55%,0.25)' : '1px solid rgba(255,255,255,0.08)',
                        boxShadow: i === 1
                          ? '0 25px 60px -12px rgba(0,0,0,0.7)'
                          : '0 15px 40px -10px rgba(0,0,0,0.6)',
                      }}
                    >
                      <img src={item.src} alt={item.label} className="w-full h-full object-cover" />
                      <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />
                      <div className="absolute bottom-0 left-0 right-0 p-2 sm:p-3">
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="text-[9px] sm:text-[10px] md:text-xs font-medium tracking-[0.12em] uppercase" style={{ color: 'hsl(38,45%,62%)' }}>
                              {item.label}
                            </p>
                            <p className="text-[7px] sm:text-[9px] hidden sm:block" style={{ color: 'rgba(255,255,255,0.4)' }}>
                              {item.desc}
                            </p>
                          </div>
                          <span className="text-[6px] sm:text-[7px] tracking-wider" style={{ color: 'rgba(255,255,255,0.2)' }}>4K</span>
                        </div>
                      </div>
                    </div>
                  </motion.div>
                ))}
              </div>
            </motion.div>

            {/* Surface glow */}
            <div
              className="absolute -bottom-4 left-[10%] right-[10%] h-16 rounded-full opacity-[0.04] blur-2xl"
              style={{ background: 'radial-gradient(ellipse, hsl(38,45%,55%) 0%, transparent 70%)' }}
            />
          </div>
        </div>
      </section>

      {/* ═══════════════════ VALUE / STATS ═══════════════════ */}
      <section
        className="relative py-24 md:py-32 overflow-hidden"
        style={{ background: 'linear-gradient(135deg, hsl(38,30%,7%) 0%, hsl(38,20%,4%) 50%, #080808 100%)' }}
      >
        <div className="absolute inset-0 pointer-events-none">
          <div
            className="absolute top-0 left-1/2 -translate-x-1/2 w-[60vw] h-[40vh] rounded-full opacity-[0.05]"
            style={{ background: 'radial-gradient(ellipse, hsl(38,45%,55%) 0%, transparent 70%)' }}
          />
        </div>

        <div className="container relative z-10">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl lg:text-5xl font-semibold text-white">
              <RevealText>Neden MooreLabs?</RevealText>
            </h2>
          </div>

          {/* Stats with counter animation */}
          <motion.div
            className="max-w-4xl mx-auto grid grid-cols-2 md:grid-cols-4 gap-4 md:gap-6"
            variants={stagger}
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
          >
            {[
              { value: 90, suffix: '%', label: 'Maliyet Tasarrufu', desc: 'Stüdyo & model yerine' },
              { value: 60, suffix: 's', label: 'Üretim Süresi', desc: 'Saniyeler içinde hazır' },
              { value: 4, suffix: 'K', label: 'Çözünürlük', desc: 'Ultra yüksek kalite' },
              { value: 6, suffix: '+', label: 'Sahne Seçeneği', desc: 'Tek fotoğraftan' },
            ].map((stat) => (
              <motion.div
                key={stat.label}
                variants={fadeUp}
                className="text-center p-5 md:p-6 rounded-xl border border-white/[0.06]"
                style={{ background: 'rgba(255,255,255,0.02)' }}
              >
                <p className="text-3xl md:text-4xl lg:text-5xl font-bold" style={{ color: 'hsl(38,45%,55%)' }}>
                  <CountUp target={stat.value} suffix={stat.suffix} />
                </p>
                <p className="text-sm font-medium text-white mt-2">{stat.label}</p>
                <p className="text-[11px] text-white/35 mt-1">{stat.desc}</p>
              </motion.div>
            ))}
          </motion.div>

          {/* Comparison */}
          <div className="max-w-4xl mx-auto mt-16 grid md:grid-cols-2 gap-6">
            <motion.div
              className="rounded-xl p-6 md:p-8 border border-white/[0.06]"
              style={{ background: 'rgba(255,255,255,0.02)' }}
              initial={{ opacity: 0, x: -40 }}
              whileInView={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
              viewport={{ once: true }}
            >
              <div className="flex items-center gap-3 mb-5">
                <div className="w-8 h-8 rounded-full bg-red-500/10 flex items-center justify-center">
                  <X className="h-4 w-4 text-red-400" />
                </div>
                <h3 className="text-base font-semibold text-white/60">Geleneksel Yöntem</h3>
              </div>
              <ul className="space-y-3">
                {['Profesyonel stüdyo kirası', 'Model ve manken ücretleri', 'Günlerce süren çekim süreci', 'Sınırlı revizyon hakkı'].map(item => (
                  <li key={item} className="flex items-start gap-2.5 text-sm text-white/40">
                    <span className="w-1 h-1 rounded-full bg-red-400/60 mt-2 flex-shrink-0" />
                    {item}
                  </li>
                ))}
              </ul>
            </motion.div>

            <motion.div
              className="rounded-xl p-6 md:p-8"
              style={{
                background: 'linear-gradient(135deg, hsla(38,45%,55%,0.08), rgba(255,255,255,0.03))',
                border: '1px solid hsla(38,45%,55%,0.15)',
              }}
              initial={{ opacity: 0, x: 40 }}
              whileInView={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.7, delay: 0.1, ease: [0.22, 1, 0.36, 1] }}
              viewport={{ once: true }}
            >
              <div className="flex items-center gap-3 mb-5">
                <div className="w-8 h-8 rounded-full flex items-center justify-center" style={{ background: 'hsla(38,45%,55%,0.15)' }}>
                  <Check className="h-4 w-4" style={{ color: 'hsl(38,45%,55%)' }} />
                </div>
                <h3 className="text-base font-semibold text-white">MooreLabs ile</h3>
              </div>
              <ul className="space-y-3">
                {['Yapay zeka ile anında üretim', 'Kendi AI modeliniz, manken tasarrufu', 'Saniyeler içinde profesyonel sonuç', "%90'a varan maliyet tasarrufu"].map(item => (
                  <li key={item} className="flex items-start gap-2.5 text-sm text-white/70">
                    <span className="w-1 h-1 rounded-full mt-2 flex-shrink-0" style={{ background: 'hsl(38,45%,55%)' }} />
                    {item}
                  </li>
                ))}
              </ul>
            </motion.div>
          </div>
        </div>
      </section>

      {/* ═══════════════════ HOW IT WORKS ═══════════════════ */}
      <section
        className="relative py-24 md:py-32 overflow-hidden"
        style={{ background: '#0a0a0a' }}
      >
        <div className="absolute inset-0 opacity-[0.025]" style={{ backgroundImage: NOISE_BG }} />

        <div className="container relative z-10">
          <div className="text-center mb-16">
            <motion.p
              className="text-[10px] md:text-xs tracking-[0.3em] uppercase mb-4"
              style={{ color: 'hsl(38,45%,50%)' }}
              initial={{ opacity: 0 }}
              whileInView={{ opacity: 1 }}
              viewport={{ once: true }}
            >
              3 Basit Adım
            </motion.p>
            <h2 className="text-3xl md:text-4xl lg:text-5xl font-semibold text-white">
              <RevealText>Nasıl Çalışır?</RevealText>
            </h2>
          </div>

          <div className="max-w-5xl mx-auto">
            <div className="grid md:grid-cols-3 gap-8 md:gap-6 relative">
              {/* Animated connecting line */}
              <div className="hidden md:block absolute top-24 left-[20%] right-[20%] h-[2px] overflow-hidden">
                <motion.div
                  className="h-full"
                  style={{ background: 'linear-gradient(90deg, transparent, hsla(38,45%,55%,0.4), transparent)' }}
                  initial={{ x: '-100%' }}
                  whileInView={{ x: '100%' }}
                  transition={{ duration: 2.5, repeat: Infinity, ease: 'linear' }}
                  viewport={{ once: false }}
                />
              </div>

              {[
                { num: 1, title: 'Fotoğrafı Yükle', desc: 'Mücevher ürün fotoğrafınızı platforma yükleyin.', icon: <Camera className="h-6 w-6 text-white" /> },
                { num: 2, title: 'Sahneleri Seç', desc: 'Editorial, e-ticaret, model gibi 6 sahne türünden 3 tanesini seçin.', icon: <Palette className="h-6 w-6 text-white" /> },
                { num: 3, title: '4K İndir', desc: 'Profesyonel kampanya görsellerinizi anında indirin.', icon: <Download className="h-6 w-6 text-white" /> },
              ].map((step, idx) => (
                <motion.div
                  key={step.num}
                  className="text-center relative"
                  initial={{ opacity: 0, y: 40 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.6, delay: idx * 0.15, ease: [0.22, 1, 0.36, 1] }}
                  viewport={{ once: true }}
                >
                  <div className="flex justify-center mb-6">
                    <motion.div className="relative" whileHover={{ scale: 1.05 }} transition={{ duration: 0.2 }}>
                      <div
                        className="relative w-16 h-16 rounded-2xl flex items-center justify-center"
                        style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}
                      >
                        {step.icon}
                      </div>
                      <div
                        className="absolute -top-2 -right-2 w-6 h-6 rounded-full text-xs font-semibold flex items-center justify-center text-white"
                        style={{ background: 'linear-gradient(135deg, hsl(38,45%,55%), hsl(38,50%,42%))' }}
                      >
                        {step.num}
                      </div>
                    </motion.div>
                  </div>
                  <h3 className="text-xl font-semibold mb-3 text-white">{step.title}</h3>
                  <p className="text-sm leading-relaxed max-w-[280px] mx-auto" style={{ color: 'rgba(255,255,255,0.45)' }}>
                    {step.desc}
                  </p>
                </motion.div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ═══════════════════ INFINITE SHOWCASE ═══════════════════ */}
      <InfiniteProductShowcase />

      <section className="py-8" style={{ background: '#0a0a0a' }}>
        <div className="container">
          <motion.div
            className="flex justify-center"
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            viewport={{ once: true }}
          >
            <Link to="/ornekler">
              <Button
                size="lg"
                variant="outline"
                className="rounded-full px-10 py-6 text-base font-medium border-2 bg-transparent transition-all duration-300 group"
                style={{ borderColor: 'rgba(255,255,255,0.15)', color: '#fff' }}
              >
                <Sparkles className="mr-2 h-5 w-5 group-hover:scale-110 transition-transform" style={{ color: 'hsl(38,45%,55%)' }} />
                Örnek Çalışmaları Keşfedin
                <ArrowRight className="ml-2 h-5 w-5 group-hover:translate-x-1 transition-transform" />
              </Button>
            </Link>
          </motion.div>
        </div>
      </section>

      {/* ═══════════════════ PRICING ═══════════════════ */}
      <section
        className="relative py-24 md:py-32 overflow-hidden"
        style={{ background: 'linear-gradient(180deg, #0a0a0a 0%, #0d0d0d 50%, #0a0a0a 100%)' }}
      >
        <div className="absolute inset-0 pointer-events-none">
          <div
            className="absolute top-1/3 left-1/2 -translate-x-1/2 w-[60vw] h-[40vh] rounded-full opacity-[0.03]"
            style={{ background: 'radial-gradient(ellipse, hsl(38,45%,55%) 0%, transparent 70%)' }}
          />
          <div className="absolute inset-0 opacity-[0.02]" style={{ backgroundImage: NOISE_BG }} />
        </div>

        <div className="container relative z-10">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl lg:text-5xl font-semibold text-white mb-4">
              <RevealText>Size Uygun Paketi Seçin</RevealText>
            </h2>
            <motion.p
              className="text-lg max-w-2xl mx-auto"
              style={{ color: 'rgba(255,255,255,0.4)' }}
              initial={{ opacity: 0 }}
              whileInView={{ opacity: 1 }}
              viewport={{ once: true }}
            >
              İhtiyaçlarınıza göre esnek fiyatlandırma seçenekleri
            </motion.p>
            <motion.p
              className="text-sm mt-2"
              style={{ color: 'rgba(255,255,255,0.25)' }}
              initial={{ opacity: 0 }}
              whileInView={{ opacity: 1 }}
              transition={{ delay: 0.1 }}
              viewport={{ once: true }}
            >
              1 görsel = 10 kredi · 1 video = 200 kredi
            </motion.p>
          </div>

          <motion.div
            className="max-w-6xl mx-auto"
            variants={stagger}
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
          >
            <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
              {/* Free */}
              <motion.div
                variants={fadeUp}
                className="relative rounded-3xl p-6"
                style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)' }}
              >
                <div className="text-center mb-6">
                  <h3 className="text-lg font-semibold mb-2 text-white">Free</h3>
                  <p className="text-xs mb-4" style={{ color: 'rgba(255,255,255,0.4)' }}>Deneme için</p>
                  <div className="flex items-baseline justify-center gap-1">
                    <span className="text-3xl font-bold text-white">100</span>
                    <span className="text-sm" style={{ color: 'rgba(255,255,255,0.4)' }}>kredi</span>
                  </div>
                  <p className="text-xs mt-1" style={{ color: 'rgba(255,255,255,0.3)' }}>Ücretsiz</p>
                </div>
                <ul className="space-y-2 mb-6">
                  {['≈ 10 görsel üretimi', '4K çözünürlük', 'Tüm sahne seçenekleri'].map(f => (
                    <li key={f} className="flex items-center gap-2 text-xs text-white/60">
                      <Check className="h-3.5 w-3.5 flex-shrink-0" style={{ color: 'hsl(38,45%,55%)' }} />
                      <span>{f}</span>
                    </li>
                  ))}
                </ul>
                <Link to="/kayit" className="block">
                  <Button variant="outline" className="w-full rounded-full text-sm bg-transparent text-white" style={{ borderColor: 'rgba(255,255,255,0.15)' }}>
                    Ücretsiz Başla
                  </Button>
                </Link>
              </motion.div>

              {/* Starter */}
              <motion.div
                variants={fadeUp}
                className="relative rounded-3xl p-6"
                style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)' }}
              >
                <div className="text-center mb-6">
                  <h3 className="text-lg font-semibold mb-2 text-white">Starter</h3>
                  <p className="text-xs mb-4" style={{ color: 'rgba(255,255,255,0.4)' }}>Keşfetmek için</p>
                  <div className="flex items-baseline justify-center gap-1">
                    <span className="text-3xl font-bold text-white">1.000</span>
                    <span className="text-sm" style={{ color: 'rgba(255,255,255,0.4)' }}>kredi/ay</span>
                  </div>
                  <div className="mt-2">
                    <span className="text-sm line-through" style={{ color: 'rgba(255,255,255,0.3)' }}>₺3.699</span>
                    <span className="text-xl font-bold ml-2" style={{ color: 'hsl(38,45%,55%)' }}>₺2.499</span>
                    <span className="text-xs" style={{ color: 'rgba(255,255,255,0.3)' }}>/ay</span>
                  </div>
                </div>
                <ul className="space-y-2 mb-6">
                  {['≈ 100 görsel üretimi', '≈ 5 video üretimi', '4K çözünürlük', 'Tüm sahne seçenekleri'].map(f => (
                    <li key={f} className="flex items-center gap-2 text-xs text-white/60">
                      <Check className="h-3.5 w-3.5 flex-shrink-0" style={{ color: 'hsl(38,45%,55%)' }} />
                      <span>{f}</span>
                    </li>
                  ))}
                </ul>
                <Button variant="outline" className="w-full rounded-full text-sm bg-transparent text-white" style={{ borderColor: 'rgba(255,255,255,0.15)' }} onClick={() => setShowContactModal(true)}>
                  Satın Al
                </Button>
              </motion.div>

              {/* Pro */}
              <motion.div
                variants={fadeUp}
                className="relative rounded-3xl p-6"
                style={{
                  background: 'linear-gradient(180deg, hsla(38,45%,55%,0.08) 0%, rgba(255,255,255,0.02) 100%)',
                  border: '2px solid hsl(38,45%,55%)',
                  boxShadow: '0 8px 40px -4px hsla(38,45%,55%,0.12)',
                }}
              >
                <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                  <span className="text-xs font-medium px-4 py-1.5 rounded-full text-white" style={{ background: 'linear-gradient(135deg, hsl(38,45%,55%), hsl(38,50%,42%))' }}>
                    En Popüler
                  </span>
                </div>
                <div className="text-center mb-6">
                  <h3 className="text-lg font-semibold mb-2 text-white">Pro</h3>
                  <p className="text-xs mb-4" style={{ color: 'rgba(255,255,255,0.4)' }}>Büyüyen markalar için</p>
                  <div className="flex items-baseline justify-center gap-1">
                    <span className="text-3xl font-bold" style={{ color: 'hsl(38,45%,55%)' }}>3.000</span>
                    <span className="text-sm" style={{ color: 'rgba(255,255,255,0.4)' }}>kredi/ay</span>
                  </div>
                  <div className="mt-2">
                    <span className="text-sm line-through" style={{ color: 'rgba(255,255,255,0.3)' }}>₺9.999</span>
                    <span className="text-xl font-bold ml-2" style={{ color: 'hsl(38,45%,55%)' }}>₺6.999</span>
                    <span className="text-xs" style={{ color: 'rgba(255,255,255,0.3)' }}>/ay</span>
                  </div>
                </div>
                <ul className="space-y-2 mb-6">
                  {['≈ 300 görsel üretimi', '≈ 15 video üretimi', '4K çözünürlük', 'Tüm sahne seçenekleri', 'Manken görselleri'].map(f => (
                    <li key={f} className="flex items-center gap-2 text-xs text-white/60">
                      <Check className="h-3.5 w-3.5 flex-shrink-0" style={{ color: 'hsl(38,45%,55%)' }} />
                      <span>{f}</span>
                    </li>
                  ))}
                </ul>
                <Button className="w-full rounded-full text-sm text-white border-0 hover:opacity-90" style={{ background: 'linear-gradient(135deg, hsl(38,45%,55%), hsl(38,50%,42%))' }} onClick={() => setShowContactModal(true)}>
                  Pro'ya Geç
                </Button>
              </motion.div>

              {/* Enterprise */}
              <motion.div
                variants={fadeUp}
                className="relative rounded-3xl p-6"
                style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)' }}
              >
                <div className="text-center mb-6">
                  <h3 className="text-lg font-semibold mb-2 text-white">Enterprise</h3>
                  <p className="text-xs mb-4" style={{ color: 'rgba(255,255,255,0.4)' }}>Kurumsal çözümler</p>
                  <div className="flex items-baseline justify-center gap-1">
                    <span className="text-xl font-bold text-white">Özel Fiyat</span>
                  </div>
                  <p className="text-xs mt-2" style={{ color: 'rgba(255,255,255,0.3)' }}>Size özel teklif</p>
                </div>
                <ul className="space-y-2 mb-6">
                  {['Markanıza özel çalışmalar', 'Firma içi entegrasyon', 'Özel sahne tasarımları', 'API erişimi', 'Öncelikli destek'].map(f => (
                    <li key={f} className="flex items-center gap-2 text-xs text-white/60">
                      <Check className="h-3.5 w-3.5 flex-shrink-0" style={{ color: 'hsl(38,45%,55%)' }} />
                      <span>{f}</span>
                    </li>
                  ))}
                </ul>
                <Button variant="outline" className="w-full rounded-full text-sm bg-transparent text-white" style={{ borderColor: 'rgba(255,255,255,0.15)' }} onClick={() => setShowContactModal(true)}>
                  İletişime Geç
                </Button>
              </motion.div>
            </div>
          </motion.div>
        </div>
      </section>

      {/* ═══════════════════ CTA ═══════════════════ */}
      <section className="py-24 md:py-32 relative overflow-hidden" style={{ background: '#0a0a0a' }}>
        <div className="absolute inset-0 pointer-events-none">
          <div
            className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[80vw] h-[60vh] rounded-full opacity-[0.06]"
            style={{ background: 'radial-gradient(ellipse, hsl(38,45%,55%) 0%, transparent 70%)' }}
          />
          <div className="absolute inset-0 opacity-[0.03]" style={{ backgroundImage: NOISE_BG }} />
        </div>

        <div className="container relative z-10">
          <motion.div
            className="max-w-3xl mx-auto text-center"
            initial={{ opacity: 0, scale: 0.95 }}
            whileInView={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
            viewport={{ once: true }}
          >
            <h2 className="text-3xl md:text-4xl lg:text-5xl font-semibold text-white mb-4">
              Mücevher Görsellerinizi{' '}
              <span className="italic font-serif" style={{ color: 'hsl(38,45%,60%)' }}>Dönüştürmeye</span>{' '}
              Hazır mısınız?
            </h2>
            <p className="text-base md:text-lg mb-8" style={{ color: 'rgba(255,255,255,0.45)' }}>
              Hemen ücretsiz hesap oluşturun ve 100 kredi ile başlayın.
            </p>
            <Link to="/kayit">
              <Button
                size="lg"
                className="h-13 px-10 text-base font-medium tracking-wide rounded-none bg-white text-black hover:bg-white/90"
              >
                Ücretsiz Hesap Oluştur
                <ArrowRight className="ml-2 h-5 w-5" />
              </Button>
            </Link>
          </motion.div>
        </div>
      </section>

      {/* Contact Modal */}
      <Dialog open={showContactModal} onOpenChange={setShowContactModal}>
        <DialogContent
          className="sm:max-w-md"
          style={{ background: '#111', border: '1px solid rgba(255,255,255,0.1)', color: '#fff' }}
        >
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-white">
              <Mail className="h-5 w-5" style={{ color: 'hsl(38,45%,55%)' }} />
              Kredi Satın Alma
            </DialogTitle>
            <DialogDescription style={{ color: 'rgba(255,255,255,0.5)' }}>
              Ödeme altyapımız yakında aktif olacaktır. Şu an için kredi yüklemek istiyorsanız aşağıdaki e-posta adresinden bizimle iletişime geçebilirsiniz.
            </DialogDescription>
          </DialogHeader>
          <div className="mt-4 p-4 rounded-xl text-center" style={{ background: 'rgba(255,255,255,0.05)' }}>
            <p className="text-sm mb-2" style={{ color: 'rgba(255,255,255,0.5)' }}>E-posta:</p>
            <a
              href="mailto:moorestudioai@gmail.com?subject=Kredi%20Yükleme%20Talebi"
              className="text-lg font-medium hover:underline"
              style={{ color: 'hsl(38,45%,55%)' }}
            >
              moorestudioai@gmail.com
            </a>
            <p className="text-xs mt-4" style={{ color: 'rgba(255,255,255,0.35)' }}>
              Kredi yükleme süreciniz hakkında bilgi alabilir ve ödeme yapabilirsiniz.
            </p>
          </div>
          <div className="flex justify-center mt-4">
            <Button
              variant="outline"
              className="bg-transparent text-white"
              style={{ borderColor: 'rgba(255,255,255,0.15)' }}
              onClick={() => setShowContactModal(false)}
            >
              Kapat
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
}
