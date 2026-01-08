import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { AppLayout } from '@/components/layout/AppLayout';
import { Gem, Sparkles, Image, Shield, ArrowRight, Camera, Palette, Download, Play } from 'lucide-react';
import { BeforeAfterShowcase } from '@/components/landing/BeforeAfterShowcase';
import { TransformationGallery } from '@/components/landing/TransformationGallery';

import emeraldBracelet from '@/assets/showcase/emerald-bracelet-result-1.webp';

export default function Landing() {
  return (
    <AppLayout>
      {/* Hero Section */}
      <section className="relative overflow-hidden bg-background">
        <div className="container py-16 md:py-24 lg:py-32">
          <div className="grid lg:grid-cols-2 gap-12 lg:gap-16 items-center">
            {/* Left - Text Content */}
            <motion.div 
              className="order-2 lg:order-1"
              initial={{ opacity: 0, x: -30 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.8, ease: "easeOut" }}
            >
              <motion.p 
                className="text-xs md:text-sm font-medium tracking-[0.2em] text-primary mb-6"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: 0.1 }}
              >
                GELECEK NESİL GÖRSELLEŞTİRME
              </motion.p>
              
              <motion.h1 
                className="text-4xl md:text-5xl lg:text-6xl font-semibold tracking-tight mb-6 leading-[1.1]"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, delay: 0.2 }}
              >
                Net, Temiz,
                <br />
                <span className="italic text-primary font-serif">Profesyonel.</span>
              </motion.h1>
              
              <motion.p 
                className="text-base md:text-lg text-muted-foreground mb-8 max-w-md leading-relaxed"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, delay: 0.3 }}
              >
                Ham fotoğrafları saniyeler içinde lüks kampanya karelerine dönüştürün. Fotoğrafçı maliyetlerini geride bırakın.
              </motion.p>
              
              <motion.div 
                className="flex flex-col sm:flex-row gap-4"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, delay: 0.4 }}
              >
                <Link to="/kayit">
                  <Button size="lg" className="w-full sm:w-auto text-sm font-medium tracking-wider px-8 rounded-full">
                    HEMEN ÜRET
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </Button>
                </Link>
                <Link to="#showcase">
                  <Button size="lg" variant="outline" className="w-full sm:w-auto text-sm font-medium tracking-wider px-8 rounded-full border-foreground/20 hover:bg-foreground/5">
                    <Play className="mr-2 h-3 w-3 fill-current" />
                    ÖRNEKLERİ İNCELE
                  </Button>
                </Link>
              </motion.div>
            </motion.div>
            
            {/* Right - Hero Image */}
            <motion.div 
              className="order-1 lg:order-2 flex justify-center lg:justify-end"
              initial={{ opacity: 0, x: 30 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.8, ease: "easeOut", delay: 0.2 }}
            >
              <div className="relative">
                <motion.div 
                  className="w-[280px] md:w-[340px] lg:w-[400px] aspect-[3/4] rounded-3xl overflow-hidden shadow-luxury-lg"
                  whileHover={{ scale: 1.02 }}
                  transition={{ duration: 0.3 }}
                >
                  <img 
                    src={emeraldBracelet} 
                    alt="Profesyonel mücevher görseli" 
                    className="w-full h-full object-cover"
                  />
                </motion.div>
                {/* Decorative element */}
                <motion.div 
                  className="absolute -z-10 -bottom-4 -right-4 w-full h-full rounded-3xl border-2 border-primary/20"
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ duration: 0.6, delay: 0.5 }}
                />
              </div>
            </motion.div>
          </div>
        </div>
      </section>

      {/* How It Works Section */}
      <section className="py-20 md:py-28 bg-background">
        <div className="container">
          <motion.div 
            className="text-center mb-16"
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            viewport={{ once: true }}
          >
            <p className="text-xs md:text-sm font-medium tracking-[0.2em] text-primary mb-4">
              OPERASYONEL MÜKEMMELLİK
            </p>
            <h2 className="text-3xl md:text-4xl lg:text-5xl font-semibold">
              Nasıl <span className="italic text-primary font-serif">Çalışır?</span>
            </h2>
          </motion.div>
          
          {/* Steps */}
          <div className="relative max-w-5xl mx-auto">
            {/* Connecting Lines SVG */}
            <svg 
              className="absolute top-20 left-0 w-full h-16 hidden md:block pointer-events-none"
              viewBox="0 0 1000 60"
              preserveAspectRatio="none"
            >
              <motion.path
                d="M 170 30 Q 330 60 500 30 Q 670 0 830 30"
                fill="none"
                stroke="hsl(var(--primary))"
                strokeWidth="2"
                strokeDasharray="4 4"
                initial={{ pathLength: 0 }}
                whileInView={{ pathLength: 1 }}
                transition={{ duration: 1.5, delay: 0.5 }}
                viewport={{ once: true }}
              />
            </svg>
            
            <div className="grid md:grid-cols-3 gap-8 md:gap-12">
              <HowItWorksStep
                number={1}
                category="HAZIRLIK"
                title="Ürünü Çek"
                description="Doğru ışıklandırma ve belirgin detaylar ile ürününüzü fotoğraflayın. AI motorumuz detayları analiz eder."
                icon={<Camera className="h-6 w-6" />}
                delay={0}
              />
              <HowItWorksStep
                number={2}
                category="YARATICILIK"
                title="Stilini Seç"
                description="Koleksiyonunuza en uygun kampanya temasını veya manken pozunu belirleyin. Saniyeler içinde üretim başlar."
                icon={<Palette className="h-6 w-6" />}
                delay={0.15}
              />
              <HowItWorksStep
                number={3}
                category="SONUÇ"
                title="4K Görselini İndir"
                description="Yayınlamaya hazır, yüksek çözünürlüklü lüks görsellerinizi anında indirin ve paylaşın."
                icon={<Download className="h-6 w-6" />}
                delay={0.3}
              />
            </div>
          </div>
        </div>
      </section>

      {/* Before/After Showcase */}
      <div id="showcase">
        <BeforeAfterShowcase />
      </div>

      {/* Features Section */}
      <section className="py-20 md:py-28 bg-muted/30">
        <div className="container">
          <motion.div 
            className="text-center mb-16"
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            viewport={{ once: true }}
          >
            <h2 className="text-3xl md:text-4xl font-semibold mb-4">Neden TryOnJewel?</h2>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
              Mücevher markalarının dijital varlıklarını yönetmek için tasarlandı
            </p>
          </motion.div>
          <div className="grid md:grid-cols-3 gap-8">
            <FeatureCard
              icon={<Sparkles className="h-6 w-6" />}
              title="AI Destekli"
              description="Gelişmiş yapay zeka modellerimiz, ürününüzün her detayını analiz ederek kusursuz görseller oluşturur."
              delay={0}
            />
            <FeatureCard
              icon={<Image className="h-6 w-6" />}
              title="Stüdyo Kalitesi"
              description="Profesyonel stüdyo ortamında çekilmiş gibi görünen yüksek kaliteli görseller elde edin."
              delay={0.1}
            />
            <FeatureCard
              icon={<Shield className="h-6 w-6" />}
              title="Marka Tutarlılığı"
              description="Ürün detayları korunur: taş sayısı, tırnak yapısı, metal rengi ve dokusu değişmez."
              delay={0.2}
            />
          </div>
        </div>
      </section>

      {/* Transformation Gallery */}
      <TransformationGallery />

      {/* Scenes Preview */}
      <section className="py-20 md:py-28">
        <div className="container">
          <motion.div 
            className="text-center mb-16"
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            viewport={{ once: true }}
          >
            <h2 className="text-3xl md:text-4xl font-semibold mb-4">8 Premium Sahne</h2>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
              Stüdyo ve yaşam tarzı sahneleri ile mücevherlerinizi sergileyın
            </p>
          </motion.div>
          <motion.div 
            className="grid grid-cols-2 md:grid-cols-4 gap-4"
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            transition={{ duration: 0.6 }}
            viewport={{ once: true }}
          >
            {scenes.map((scene, index) => (
              <motion.div 
                key={scene.name}
                className="aspect-square rounded-xl bg-muted flex items-center justify-center text-center p-4 shadow-luxury hover:shadow-luxury-lg transition-shadow"
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4, delay: index * 0.05 }}
                viewport={{ once: true }}
                whileHover={{ y: -4 }}
              >
                <div>
                  <Gem className="h-8 w-8 text-primary mx-auto mb-2" />
                  <p className="font-medium">{scene.name}</p>
                  <p className="text-xs text-muted-foreground">{scene.category}</p>
                </div>
              </motion.div>
            ))}
          </motion.div>
          <motion.div 
            className="text-center mt-8"
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.3 }}
            viewport={{ once: true }}
          >
            <Link to="/sahneler">
              <Button variant="outline" size="lg">
                Tüm Sahneleri Gör
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </Link>
          </motion.div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20 md:py-28 bg-primary text-primary-foreground relative overflow-hidden">
        {/* Animated background */}
        <motion.div 
          className="absolute inset-0 opacity-10"
          style={{
            backgroundImage: 'radial-gradient(circle at 20% 50%, white 1px, transparent 1px), radial-gradient(circle at 80% 50%, white 1px, transparent 1px)',
            backgroundSize: '40px 40px',
          }}
          animate={{ 
            backgroundPosition: ['0px 0px', '40px 40px'],
          }}
          transition={{ duration: 20, repeat: Infinity, ease: "linear" }}
        />
        
        <div className="container relative">
          <motion.div 
            className="max-w-3xl mx-auto text-center"
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            viewport={{ once: true }}
          >
            <h2 className="text-3xl md:text-4xl font-semibold mb-4">
              Mücevher Görsellerinizi Dönüştürmeye Hazır mısınız?
            </h2>
            <p className="text-lg opacity-90 mb-8">
              Hemen ücretsiz hesap oluşturun ve 10 kredi ile başlayın.
            </p>
            <Link to="/kayit">
              <Button size="lg" variant="secondary" className="text-base px-8">
                Ücretsiz Hesap Oluştur
                <ArrowRight className="ml-2 h-5 w-5" />
              </Button>
            </Link>
          </motion.div>
        </div>
      </section>
    </AppLayout>
  );
}

function FeatureCard({ 
  icon, 
  title, 
  description, 
  delay = 0 
}: { 
  icon: React.ReactNode; 
  title: string; 
  description: string;
  delay?: number;
}) {
  return (
    <motion.div 
      className="bg-card rounded-2xl p-8 shadow-luxury hover:shadow-luxury-lg transition-shadow"
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay }}
      viewport={{ once: true }}
      whileHover={{ y: -4 }}
    >
      <div className="w-12 h-12 rounded-xl bg-accent flex items-center justify-center text-accent-foreground mb-4">
        {icon}
      </div>
      <h3 className="text-xl font-semibold mb-2">{title}</h3>
      <p className="text-muted-foreground">{description}</p>
    </motion.div>
  );
}

const scenes = [
  { name: 'Siyah Kadife', category: 'Stüdyo' },
  { name: 'Beyaz Mermer', category: 'Stüdyo' },
  { name: 'Şampanya İpek', category: 'Stüdyo' },
  { name: 'Cam Yansıma', category: 'Stüdyo' },
  { name: 'Saf E-ticaret', category: 'Stüdyo' },
  { name: 'Boyun Modeli', category: 'Yaşam Tarzı' },
  { name: 'El Modeli', category: 'Yaşam Tarzı' },
  { name: 'Lüks Yaşam', category: 'Yaşam Tarzı' },
];

function HowItWorksStep({ 
  number, 
  category, 
  title, 
  description, 
  icon,
  delay = 0 
}: { 
  number: number;
  category: string;
  title: string; 
  description: string;
  icon: React.ReactNode;
  delay?: number;
}) {
  return (
    <motion.div 
      className="text-center"
      initial={{ opacity: 0, y: 30 }}
      whileInView={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay }}
      viewport={{ once: true }}
    >
      {/* Number badge */}
      <div className="flex justify-center mb-4">
        <div className="relative">
          <div className="absolute -top-2 -right-2 w-6 h-6 rounded-full bg-foreground text-background text-xs font-semibold flex items-center justify-center z-10">
            {number}
          </div>
          <motion.div 
            className="w-16 h-16 rounded-2xl bg-background border border-border shadow-luxury flex items-center justify-center"
            whileHover={{ scale: 1.05, y: -2 }}
            transition={{ duration: 0.2 }}
          >
            {icon}
          </motion.div>
        </div>
      </div>
      
      {/* Category label */}
      <p className="text-xs font-medium tracking-[0.15em] text-primary mb-2">
        {category}
      </p>
      
      {/* Title */}
      <h3 className="text-xl font-semibold mb-3">{title}</h3>
      
      {/* Description */}
      <p className="text-sm text-muted-foreground leading-relaxed max-w-xs mx-auto">
        {description}
      </p>
    </motion.div>
  );
}
