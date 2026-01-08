import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { AppLayout } from '@/components/layout/AppLayout';
import { Gem, Sparkles, Image, Shield, ArrowRight, Camera, Palette, Download, Play, Clock, Zap, TrendingUp, X, Check } from 'lucide-react';
import { BeforeAfterShowcase } from '@/components/landing/BeforeAfterShowcase';
import { TransformationGallery } from '@/components/landing/TransformationGallery';

import emeraldBracelet from '@/assets/showcase/emerald-bracelet-result-1.webp';

export default function Landing() {
  return (
    <AppLayout>
      {/* Hero Section */}
      <section className="relative overflow-hidden bg-background">
        <div className="container py-16 md:py-24 lg:py-32">
          <div className="max-w-6xl mx-auto">
            <div className="grid lg:grid-cols-2 gap-12 lg:gap-20 items-center">
              {/* Left - Text Content */}
              <motion.div 
                className="order-2 lg:order-1 text-center lg:text-left"
                initial={{ opacity: 0, y: 30 }}
                animate={{ opacity: 1, y: 0 }}
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
                  className="text-base md:text-lg text-muted-foreground mb-8 max-w-md mx-auto lg:mx-0 leading-relaxed"
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.6, delay: 0.3 }}
                >
                  Ham fotoğrafları saniyeler içinde lüks kampanya karelerine dönüştürün. Fotoğrafçı maliyetlerini geride bırakın.
                </motion.p>
                
                <motion.div 
                  className="flex flex-col sm:flex-row gap-4 justify-center lg:justify-start"
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
                className="order-1 lg:order-2 flex justify-center"
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.8, ease: "easeOut", delay: 0.2 }}
              >
                <div className="relative">
                  <motion.div 
                    className="w-[280px] md:w-[340px] lg:w-[380px] aspect-[3/4] rounded-3xl overflow-hidden shadow-luxury-lg"
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
        </div>
      </section>

      {/* How It Works Section */}
      <section className="py-20 md:py-28 bg-muted/20">
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
          
          {/* Steps with elegant flowing animation */}
          <div className="max-w-5xl mx-auto">
            <div className="grid md:grid-cols-3 gap-8 md:gap-6 relative">
              {/* Animated flowing line between steps */}
              <div className="hidden md:block absolute top-24 left-[20%] right-[20%] h-[2px] overflow-hidden">
                <motion.div 
                  className="h-full bg-gradient-to-r from-transparent via-primary/40 to-transparent"
                  initial={{ x: '-100%' }}
                  whileInView={{ x: '100%' }}
                  transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
                  viewport={{ once: false }}
                />
              </div>
              
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

      {/* Why TryOnJewel - Modern Comparison Section */}
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
              NEDEN TRYONJEWEl?
            </p>
            <h2 className="text-3xl md:text-4xl lg:text-5xl font-semibold">
              Geleneksel Yöntemleri <span className="italic text-primary font-serif">Bırakın</span>
            </h2>
          </motion.div>
          
          {/* Comparison Cards */}
          <div className="max-w-5xl mx-auto">
            <div className="grid md:grid-cols-2 gap-6 md:gap-8">
              {/* Traditional Method Card */}
              <motion.div 
                className="relative rounded-3xl border border-border/50 bg-muted/30 p-8 md:p-10"
                initial={{ opacity: 0, x: -30 }}
                whileInView={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.6 }}
                viewport={{ once: true }}
              >
                <div className="absolute top-6 right-6">
                  <div className="w-10 h-10 rounded-full bg-destructive/10 flex items-center justify-center">
                    <X className="h-5 w-5 text-destructive" />
                  </div>
                </div>
                <h3 className="text-xl font-semibold mb-6 text-muted-foreground">Geleneksel Yöntem</h3>
                <ul className="space-y-4">
                  <li className="flex items-start gap-3">
                    <Clock className="h-5 w-5 text-muted-foreground mt-0.5 flex-shrink-0" />
                    <span className="text-muted-foreground">Günlerce süren stüdyo çekimleri</span>
                  </li>
                  <li className="flex items-start gap-3">
                    <TrendingUp className="h-5 w-5 text-muted-foreground mt-0.5 flex-shrink-0" />
                    <span className="text-muted-foreground">Yüksek fotoğrafçı ve ekipman maliyetleri</span>
                  </li>
                  <li className="flex items-start gap-3">
                    <Image className="h-5 w-5 text-muted-foreground mt-0.5 flex-shrink-0" />
                    <span className="text-muted-foreground">Sınırlı sahne ve poz seçenekleri</span>
                  </li>
                  <li className="flex items-start gap-3">
                    <Shield className="h-5 w-5 text-muted-foreground mt-0.5 flex-shrink-0" />
                    <span className="text-muted-foreground">Tutarsız marka görünümü</span>
                  </li>
                </ul>
              </motion.div>
              
              {/* TryOnJewel Method Card */}
              <motion.div 
                className="relative rounded-3xl border-2 border-primary/30 bg-gradient-to-br from-primary/5 to-transparent p-8 md:p-10 shadow-luxury"
                initial={{ opacity: 0, x: 30 }}
                whileInView={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.6, delay: 0.1 }}
                viewport={{ once: true }}
              >
                <div className="absolute top-6 right-6">
                  <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                    <Check className="h-5 w-5 text-primary" />
                  </div>
                </div>
                <h3 className="text-xl font-semibold mb-6">TryOnJewel ile</h3>
                <ul className="space-y-4">
                  <li className="flex items-start gap-3">
                    <Zap className="h-5 w-5 text-primary mt-0.5 flex-shrink-0" />
                    <span>Saniyeler içinde profesyonel görseller</span>
                  </li>
                  <li className="flex items-start gap-3">
                    <TrendingUp className="h-5 w-5 text-primary mt-0.5 flex-shrink-0" />
                    <span>%90'a varan maliyet tasarrufu</span>
                  </li>
                  <li className="flex items-start gap-3">
                    <Image className="h-5 w-5 text-primary mt-0.5 flex-shrink-0" />
                    <span>Sınırsız sahne ve yaşam tarzı seçeneği</span>
                  </li>
                  <li className="flex items-start gap-3">
                    <Shield className="h-5 w-5 text-primary mt-0.5 flex-shrink-0" />
                    <span>Her görselde tutarlı marka kimliği</span>
                  </li>
                </ul>
              </motion.div>
            </div>
            
            {/* Feature highlights */}
            <motion.div 
              className="grid grid-cols-3 gap-4 mt-12"
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.2 }}
              viewport={{ once: true }}
            >
              <div className="text-center p-6 rounded-2xl bg-muted/30">
                <Sparkles className="h-6 w-6 text-primary mx-auto mb-3" />
                <p className="text-sm font-medium">AI Destekli</p>
              </div>
              <div className="text-center p-6 rounded-2xl bg-muted/30">
                <Image className="h-6 w-6 text-primary mx-auto mb-3" />
                <p className="text-sm font-medium">4K Kalite</p>
              </div>
              <div className="text-center p-6 rounded-2xl bg-muted/30">
                <Shield className="h-6 w-6 text-primary mx-auto mb-3" />
                <p className="text-sm font-medium">Detay Koruma</p>
              </div>
            </motion.div>
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
      className="text-center relative"
      initial={{ opacity: 0, y: 30 }}
      whileInView={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay }}
      viewport={{ once: true }}
    >
      {/* Icon with number */}
      <div className="flex justify-center mb-6">
        <motion.div 
          className="relative"
          whileHover={{ scale: 1.05 }}
          transition={{ duration: 0.2 }}
        >
          {/* Subtle glow effect on hover */}
          <motion.div 
            className="absolute inset-0 rounded-2xl bg-primary/20 blur-xl"
            initial={{ opacity: 0, scale: 0.8 }}
            whileHover={{ opacity: 1, scale: 1.2 }}
            transition={{ duration: 0.3 }}
          />
          <div className="relative w-16 h-16 rounded-2xl bg-background border border-border shadow-luxury flex items-center justify-center">
            {icon}
          </div>
          {/* Number badge */}
          <div className="absolute -top-2 -right-2 w-6 h-6 rounded-full bg-foreground text-background text-xs font-semibold flex items-center justify-center">
            {number}
          </div>
        </motion.div>
      </div>
      
      {/* Category label with subtle animation */}
      <motion.p 
        className="text-xs font-medium tracking-[0.15em] text-primary mb-2"
        initial={{ opacity: 0 }}
        whileInView={{ opacity: 1 }}
        transition={{ duration: 0.4, delay: delay + 0.1 }}
        viewport={{ once: true }}
      >
        {category}
      </motion.p>
      
      {/* Title */}
      <h3 className="text-xl font-semibold mb-3">{title}</h3>
      
      {/* Description */}
      <p className="text-sm text-muted-foreground leading-relaxed max-w-[280px] mx-auto">
        {description}
      </p>
    </motion.div>
  );
}
