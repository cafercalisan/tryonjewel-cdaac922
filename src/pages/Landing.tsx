import { Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { AppLayout } from '@/components/layout/AppLayout';
import {
  ArrowRight, Camera, Palette, Download,
  X, Check, Mail, Sparkles
} from 'lucide-react';
import { InfiniteProductShowcase } from '@/components/landing/InfiniteProductShowcase';
import { useState, useEffect } from 'react';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from "@/components/ui/dialog";

// ─── Gold Animated Word (for dark hero) ─────────────────────────────────────
function GoldAnimatedWord({ words, interval = 3000 }: { words: string[]; interval?: number }) {
  const [index, setIndex] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setIndex(i => (i + 1) % words.length), interval);
    return () => clearInterval(t);
  }, [words.length, interval]);

  return (
    <span className="relative inline-block">
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

// ─── Noise overlay (reusable) ───────────────────────────────────────────────
const NOISE_BG = `url("data:image/svg+xml,%3Csvg viewBox='0 0 512 512' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='.7' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E")`;

// ─── Main Landing Page ──────────────────────────────────────────────────────
export default function Landing() {
  const [showContactModal, setShowContactModal] = useState(false);

  return (
    <AppLayout>
      {/* ═══════════════════ HERO ═══════════════════ */}
      <section
        className="relative min-h-[92vh] flex items-center overflow-hidden"
        style={{ background: 'linear-gradient(180deg, #050505 0%, #0a0a0a 60%, #111 100%)' }}
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
        </div>

        <div className="container relative z-10 py-12 md:py-20">
          <div className="max-w-7xl mx-auto">
            {/* Headline */}
            <motion.div
              className="text-center mb-10 md:mb-14"
              initial={{ opacity: 0, y: 40 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.9, ease: [0.22, 1, 0.36, 1] }}
            >
              <motion.p
                className="text-[10px] md:text-xs tracking-[0.3em] uppercase mb-5"
                style={{ color: 'hsl(38,45%,55%)' }}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.2 }}
              >
                Yapay Zeka ile Mücevher Görsel Üretimi
              </motion.p>

              <h1 className="text-[2.5rem] sm:text-5xl md:text-6xl lg:text-7xl xl:text-[5.5rem] font-semibold text-white leading-[1.08] tracking-tight">
                Atölye Fotoğrafınız
                <br />
                <GoldAnimatedWord words={['Kampanyaya', 'Vitrine', 'Satışa']} />{' '}
                Dönüşsün
              </h1>

              <motion.p
                className="mt-6 text-sm md:text-base lg:text-lg max-w-2xl mx-auto leading-relaxed"
                style={{ color: 'rgba(255,255,255,0.45)' }}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.4 }}
              >
                Ham mücevher fotoğraflarınızı saniyeler içinde 4K profesyonel
                kampanya görsellerine dönüştürün. Stüdyo maliyetlerini geride bırakın.
              </motion.p>

              <motion.div
                className="mt-8 flex flex-col sm:flex-row gap-3 justify-center"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.6 }}
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
            </motion.div>

            {/* Hero: 1 Photo → 3 Results */}
            <motion.div
              className="relative max-w-5xl mx-auto"
              initial={{ opacity: 0, y: 60 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.35, duration: 1, ease: [0.22, 1, 0.36, 1] }}
            >
              {/* Original — prominently sized, centered */}
              <motion.div
                className="flex justify-center mb-5 md:mb-7"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.5, duration: 0.7 }}
              >
                <div className="w-44 sm:w-52 md:w-60 lg:w-64">
                  <div className="relative aspect-square rounded-lg overflow-hidden border border-white/10 bg-neutral-900 shadow-xl">
                    <img src="/landing/before-2.jpg" alt="Orijinal fotoğraf" className="w-full h-full object-cover" />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent" />
                    <span className="absolute bottom-2 left-2 md:bottom-3 md:left-3 px-2 py-0.5 text-[8px] md:text-[10px] font-mono tracking-[0.15em] uppercase bg-black/50 text-white/60 backdrop-blur-sm rounded">
                      Orijinal
                    </span>
                  </div>
                </div>
              </motion.div>

              {/* AI indicator */}
              <motion.div
                className="flex justify-center mb-5 md:mb-7"
                initial={{ opacity: 0, scale: 0 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: 0.7, type: 'spring', stiffness: 200 }}
              >
                <div className="flex flex-col items-center">
                  <motion.div
                    className="w-10 h-10 md:w-12 md:h-12 rounded-full flex items-center justify-center"
                    style={{
                      background: 'linear-gradient(135deg, hsl(38,45%,55%), hsl(38,50%,42%))',
                      boxShadow: '0 0 30px hsla(38,45%,55%,0.25)',
                    }}
                    animate={{
                      boxShadow: [
                        '0 0 20px hsla(38,45%,55%,0.15)',
                        '0 0 40px hsla(38,45%,55%,0.35)',
                        '0 0 20px hsla(38,45%,55%,0.15)',
                      ],
                    }}
                    transition={{ duration: 2.5, repeat: Infinity }}
                  >
                    <Sparkles className="h-4 w-4 md:h-5 md:w-5 text-white" />
                  </motion.div>
                  <span className="text-[8px] md:text-[9px] tracking-[0.3em] uppercase mt-1.5" style={{ color: 'hsl(38,45%,55%)' }}>
                    AI
                  </span>
                </div>
              </motion.div>

              {/* 3 Results row */}
              <motion.div
                className="grid grid-cols-3 gap-3 md:gap-5"
                initial={{ opacity: 0, y: 30 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.8, duration: 0.8 }}
              >
                {[
                  { src: '/landing/after-2a.jpg', label: 'E-Ticaret', desc: 'Ürün çekimi' },
                  { src: '/landing/after-2b.jpg', label: 'Macro', desc: 'Detay plan' },
                  { src: '/landing/after-2c.jpg', label: 'Model', desc: 'Manken çekimi' },
                ].map((item, i) => (
                  <motion.div
                    key={item.label}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.9 + i * 0.15, duration: 0.6 }}
                  >
                    <div
                      className="relative aspect-[4/5] rounded-lg overflow-hidden shadow-xl"
                      style={{ border: '1px solid hsla(38,45%,55%,0.1)' }}
                    >
                      <img src={item.src} alt={item.label} className="w-full h-full object-cover" />
                      <div className="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent" />
                      <div className="absolute bottom-2 left-2 sm:bottom-3 sm:left-3">
                        <p className="text-[9px] sm:text-[10px] md:text-xs tracking-[0.15em] uppercase font-medium" style={{ color: 'hsl(38,45%,60%)' }}>
                          {item.label}
                        </p>
                        <p className="text-[8px] sm:text-[10px] text-white/50 hidden sm:block">{item.desc}</p>
                      </div>
                      <span className="absolute bottom-2 right-2 sm:bottom-3 sm:right-3 text-[7px] sm:text-[8px] tracking-wider text-white/30">
                        4K
                      </span>
                    </div>
                  </motion.div>
                ))}
              </motion.div>
            </motion.div>
          </div>
        </div>
      </section>

      {/* ═══════════════════ VALUE / STATS ═══════════════════ */}
      <section
        className="relative py-20 md:py-28 overflow-hidden"
        style={{ background: 'linear-gradient(135deg, hsl(38,30%,8%) 0%, hsl(38,20%,5%) 50%, #0a0a0a 100%)' }}
      >
        <div className="absolute inset-0 pointer-events-none">
          <div
            className="absolute top-0 left-1/2 -translate-x-1/2 w-[60vw] h-[40vh] rounded-full opacity-[0.05]"
            style={{ background: 'radial-gradient(ellipse, hsl(38,45%,55%) 0%, transparent 70%)' }}
          />
        </div>

        <div className="container relative z-10">
          <motion.div
            className="text-center mb-16"
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7 }}
            viewport={{ once: true }}
          >
            <h2 className="text-3xl md:text-4xl lg:text-5xl font-semibold text-white">
              Neden{' '}
              <span className="italic font-serif" style={{ color: 'hsl(38,45%,60%)' }}>MooreLabs?</span>
            </h2>
          </motion.div>

          {/* Stats */}
          <div className="max-w-4xl mx-auto grid grid-cols-2 md:grid-cols-4 gap-4 md:gap-6">
            {[
              { value: '%90', label: 'Maliyet Tasarrufu', desc: 'Stüdyo & model yerine' },
              { value: '60s', label: 'Üretim Süresi', desc: 'Saniyeler içinde hazır' },
              { value: '4K', label: 'Çözünürlük', desc: 'Ultra yüksek kalite' },
              { value: '3+', label: 'Sahne Seçeneği', desc: 'Tek fotoğraftan' },
            ].map((stat, i) => (
              <motion.div
                key={stat.label}
                className="text-center p-5 md:p-6 rounded-xl border border-white/[0.06]"
                style={{ background: 'rgba(255,255,255,0.02)' }}
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: i * 0.1 }}
                viewport={{ once: true }}
              >
                <p className="text-3xl md:text-4xl lg:text-5xl font-bold" style={{ color: 'hsl(38,45%,55%)' }}>
                  {stat.value}
                </p>
                <p className="text-sm font-medium text-white mt-2">{stat.label}</p>
                <p className="text-[11px] text-white/35 mt-1">{stat.desc}</p>
              </motion.div>
            ))}
          </div>

          {/* Comparison */}
          <div className="max-w-4xl mx-auto mt-16 grid md:grid-cols-2 gap-6">
            <motion.div
              className="rounded-xl p-6 md:p-8 border border-white/[0.06]"
              style={{ background: 'rgba(255,255,255,0.02)' }}
              initial={{ opacity: 0, x: -30 }}
              whileInView={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.6 }}
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
              initial={{ opacity: 0, x: 30 }}
              whileInView={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.6, delay: 0.1 }}
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

      {/* ═══════════════════ DARK→LIGHT TRANSITION ═══════════════════ */}
      <div className="h-24 md:h-32" style={{ background: 'linear-gradient(180deg, #0a0a0a 0%, hsl(var(--background)) 100%)' }} />

      {/* ═══════════════════ HOW IT WORKS ═══════════════════ */}
      <section className="py-16 md:py-24 bg-background">
        <div className="container">
          <motion.div
            className="text-center mb-16"
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            viewport={{ once: true }}
          >
            <h2 className="text-3xl md:text-4xl lg:text-5xl font-semibold">
              Nasıl <span className="italic text-primary font-serif">Çalışır?</span>
            </h2>
          </motion.div>

          <div className="max-w-5xl mx-auto">
            <div className="grid md:grid-cols-3 gap-8 md:gap-6 relative">
              <div className="hidden md:block absolute top-24 left-[20%] right-[20%] h-[2px] overflow-hidden">
                <motion.div
                  className="h-full bg-gradient-to-r from-transparent via-primary/40 to-transparent"
                  initial={{ x: '-100%' }}
                  whileInView={{ x: '100%' }}
                  transition={{ duration: 2, repeat: Infinity, ease: 'linear' }}
                  viewport={{ once: false }}
                />
              </div>
              <HowItWorksStep number={1} title="Ürünü Çek" description="Doğru ışıklandırma ve belirgin detaylar ile ürününüzü fotoğraflayın." icon={<Camera className="h-6 w-6" />} delay={0} />
              <HowItWorksStep number={2} title="Stilini Seç" description="Koleksiyonunuza en uygun kampanya temasını belirleyin." icon={<Palette className="h-6 w-6" />} delay={0.15} />
              <HowItWorksStep number={3} title="4K Görselini İndir" description="Yayınlamaya hazır, yüksek çözünürlüklü görselleri indirin." icon={<Download className="h-6 w-6" />} delay={0.3} />
            </div>
          </div>
        </div>
      </section>

      {/* ═══════════════════ INFINITE SHOWCASE ═══════════════════ */}
      <InfiniteProductShowcase />

      <section className="py-8 bg-background">
        <div className="container">
          <motion.div
            className="flex justify-center"
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            viewport={{ once: true }}
          >
            <Link to="/ornekler">
              <Button size="lg" variant="outline" className="rounded-full px-10 py-6 text-base font-medium border-2 border-primary/30 hover:border-primary hover:bg-primary/5 transition-all duration-300 group">
                <Sparkles className="mr-2 h-5 w-5 text-primary group-hover:scale-110 transition-transform" />
                Örnek Çalışmaları Keşfedin
                <ArrowRight className="ml-2 h-5 w-5 group-hover:translate-x-1 transition-transform" />
              </Button>
            </Link>
          </motion.div>
        </div>
      </section>

      {/* ═══════════════════ PRICING ═══════════════════ */}
      <section className="py-20 md:py-28 bg-background">
        <div className="container">
          <motion.div
            className="text-center mb-16"
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            viewport={{ once: true }}
          >
            <h2 className="text-3xl md:text-4xl lg:text-5xl font-semibold mb-4">
              Size Uygun <span className="italic text-primary font-serif">Paketi</span> Seçin
            </h2>
            <p className="text-muted-foreground text-lg max-w-2xl mx-auto">
              İhtiyaçlarınıza göre esnek fiyatlandırma seçenekleri
            </p>
            <p className="text-sm text-muted-foreground mt-2">
              1 görsel = 10 kredi · 1 video = 200 kredi
            </p>
          </motion.div>

          <div className="max-w-6xl mx-auto">
            <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
              {/* Free */}
              <motion.div
                className="relative rounded-3xl border border-border/50 bg-card p-6 hover:border-primary/30 transition-colors"
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5 }}
                viewport={{ once: true }}
              >
                <div className="text-center mb-6">
                  <h3 className="text-lg font-semibold mb-2">Free</h3>
                  <p className="text-muted-foreground text-xs mb-4">Deneme için</p>
                  <div className="flex items-baseline justify-center gap-1">
                    <span className="text-3xl font-bold">100</span>
                    <span className="text-muted-foreground text-sm">kredi</span>
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">Ücretsiz</p>
                </div>
                <ul className="space-y-2 mb-6">
                  {['≈ 10 görsel üretimi', '4K çözünürlük', 'Tüm sahne seçenekleri'].map(f => (
                    <li key={f} className="flex items-center gap-2 text-xs">
                      <Check className="h-3.5 w-3.5 text-primary flex-shrink-0" />
                      <span>{f}</span>
                    </li>
                  ))}
                </ul>
                <Link to="/kayit" className="block">
                  <Button variant="outline" className="w-full rounded-full text-sm">Ücretsiz Başla</Button>
                </Link>
              </motion.div>

              {/* Starter */}
              <motion.div
                className="relative rounded-3xl border border-border/50 bg-card p-6 hover:border-primary/30 transition-colors"
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: 0.1 }}
                viewport={{ once: true }}
              >
                <div className="text-center mb-6">
                  <h3 className="text-lg font-semibold mb-2">Starter</h3>
                  <p className="text-muted-foreground text-xs mb-4">Keşfetmek için</p>
                  <div className="flex items-baseline justify-center gap-1">
                    <span className="text-3xl font-bold">1.000</span>
                    <span className="text-muted-foreground text-sm">kredi/ay</span>
                  </div>
                  <div className="mt-2">
                    <span className="text-sm text-muted-foreground line-through">₺3.699</span>
                    <span className="text-xl font-bold text-primary ml-2">₺2.499</span>
                    <span className="text-xs text-muted-foreground">/ay</span>
                  </div>
                </div>
                <ul className="space-y-2 mb-6">
                  {['≈ 100 görsel üretimi', '≈ 5 video üretimi', '4K çözünürlük', 'Tüm sahne seçenekleri'].map(f => (
                    <li key={f} className="flex items-center gap-2 text-xs">
                      <Check className="h-3.5 w-3.5 text-primary flex-shrink-0" />
                      <span>{f}</span>
                    </li>
                  ))}
                </ul>
                <Button variant="outline" className="w-full rounded-full text-sm" onClick={() => setShowContactModal(true)}>Satın Al</Button>
              </motion.div>

              {/* Pro */}
              <motion.div
                className="relative rounded-3xl border-2 border-primary bg-gradient-to-b from-primary/10 to-transparent p-6 shadow-luxury-lg"
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: 0.2 }}
                viewport={{ once: true }}
              >
                <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                  <span className="bg-primary text-primary-foreground text-xs font-medium px-4 py-1.5 rounded-full">En Popüler</span>
                </div>
                <div className="text-center mb-6">
                  <h3 className="text-lg font-semibold mb-2">Pro</h3>
                  <p className="text-muted-foreground text-xs mb-4">Büyüyen markalar için</p>
                  <div className="flex items-baseline justify-center gap-1">
                    <span className="text-3xl font-bold text-primary">3.000</span>
                    <span className="text-muted-foreground text-sm">kredi/ay</span>
                  </div>
                  <div className="mt-2">
                    <span className="text-sm text-muted-foreground line-through">₺9.999</span>
                    <span className="text-xl font-bold text-primary ml-2">₺6.999</span>
                    <span className="text-xs text-muted-foreground">/ay</span>
                  </div>
                </div>
                <ul className="space-y-2 mb-6">
                  {['≈ 300 görsel üretimi', '≈ 15 video üretimi', '4K çözünürlük', 'Tüm sahne seçenekleri', 'Manken görselleri'].map(f => (
                    <li key={f} className="flex items-center gap-2 text-xs">
                      <Check className="h-3.5 w-3.5 text-primary flex-shrink-0" />
                      <span>{f}</span>
                    </li>
                  ))}
                </ul>
                <Button className="w-full rounded-full text-sm" onClick={() => setShowContactModal(true)}>Pro'ya Geç</Button>
              </motion.div>

              {/* Enterprise */}
              <motion.div
                className="relative rounded-3xl border border-border/50 bg-card p-6 hover:border-primary/30 transition-colors"
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: 0.3 }}
                viewport={{ once: true }}
              >
                <div className="text-center mb-6">
                  <h3 className="text-lg font-semibold mb-2">Enterprise</h3>
                  <p className="text-muted-foreground text-xs mb-4">Kurumsal çözümler</p>
                  <div className="flex items-baseline justify-center gap-1">
                    <span className="text-xl font-bold">Özel Fiyat</span>
                  </div>
                  <p className="text-xs text-muted-foreground mt-2">Size özel teklif</p>
                </div>
                <ul className="space-y-2 mb-6">
                  {['Markanıza özel çalışmalar', 'Firma içi entegrasyon', 'Özel sahne tasarımları', 'API erişimi', 'Öncelikli destek'].map(f => (
                    <li key={f} className="flex items-center gap-2 text-xs">
                      <Check className="h-3.5 w-3.5 text-primary flex-shrink-0" />
                      <span>{f}</span>
                    </li>
                  ))}
                </ul>
                <Button variant="outline" className="w-full rounded-full text-sm" onClick={() => setShowContactModal(true)}>İletişime Geç</Button>
              </motion.div>
            </div>
          </div>
        </div>
      </section>

      {/* ═══════════════════ CTA ═══════════════════ */}
      <section className="py-20 md:py-28 relative overflow-hidden" style={{ background: '#0a0a0a' }}>
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
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            viewport={{ once: true }}
          >
            <h2 className="text-3xl md:text-4xl lg:text-5xl font-semibold text-white mb-4">
              Mücevher Görsellerinizi{' '}
              <span className="italic font-serif" style={{ color: 'hsl(38,45%,60%)' }}>Dönüştürmeye</span>{' '}
              Hazır mısınız?
            </h2>
            <p className="text-base md:text-lg mb-8" style={{ color: 'rgba(255,255,255,0.5)' }}>
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
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Mail className="h-5 w-5 text-primary" />
              Kredi Satın Alma
            </DialogTitle>
            <DialogDescription>
              Ödeme altyapımız yakında aktif olacaktır. Şu an için kredi yüklemek istiyorsanız aşağıdaki e-posta adresinden bizimle iletişime geçebilirsiniz.
            </DialogDescription>
          </DialogHeader>
          <div className="mt-4 p-4 bg-muted/50 rounded-xl text-center">
            <p className="text-sm text-muted-foreground mb-2">E-posta:</p>
            <a
              href="mailto:moorestudioai@gmail.com?subject=Kredi%20Yükleme%20Talebi"
              className="text-lg font-medium text-primary hover:underline"
            >
              moorestudioai@gmail.com
            </a>
            <p className="text-xs text-muted-foreground mt-4">
              Kredi yükleme süreciniz hakkında bilgi alabilir ve ödeme yapabilirsiniz.
            </p>
          </div>
          <div className="flex justify-center mt-4">
            <Button variant="outline" onClick={() => setShowContactModal(false)}>Kapat</Button>
          </div>
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
}

// ─── How It Works Step ──────────────────────────────────────────────────────
function HowItWorksStep({
  number,
  title,
  description,
  icon,
  delay = 0,
}: {
  number: number;
  title: string;
  description: string;
  icon: React.ReactNode;
  delay?: number;
}) {
  return (
    <motion.div
      className="text-center relative"
      initial={{ opacity: 0, y: 30 }}
      whileInView={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay }}
      viewport={{ once: true }}
    >
      <div className="flex justify-center mb-6">
        <motion.div className="relative" whileHover={{ scale: 1.05 }} transition={{ duration: 0.2 }}>
          <motion.div
            className="absolute inset-0 rounded-2xl bg-primary/20 blur-xl"
            initial={{ opacity: 0, scale: 0.8 }}
            whileHover={{ opacity: 1, scale: 1.2 }}
            transition={{ duration: 0.3 }}
          />
          <div className="relative w-16 h-16 rounded-2xl bg-background border border-border shadow-luxury flex items-center justify-center">
            {icon}
          </div>
          <div className="absolute -top-2 -right-2 w-6 h-6 rounded-full bg-foreground text-background text-xs font-semibold flex items-center justify-center">
            {number}
          </div>
        </motion.div>
      </div>
      <h3 className="text-xl font-semibold mb-3">{title}</h3>
      <p className="text-sm text-muted-foreground leading-relaxed max-w-[280px] mx-auto">{description}</p>
    </motion.div>
  );
}
