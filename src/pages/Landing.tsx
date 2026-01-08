import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { AppLayout } from '@/components/layout/AppLayout';
import { Gem, Sparkles, Image, Shield, ArrowRight } from 'lucide-react';
import { BeforeAfterShowcase } from '@/components/landing/BeforeAfterShowcase';
import { TransformationGallery } from '@/components/landing/TransformationGallery';

export default function Landing() {
  return (
    <AppLayout>
      {/* Hero Section */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-b from-accent/50 to-transparent pointer-events-none" />
        
        {/* Animated background elements */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <motion.div 
            className="absolute top-20 left-10 w-64 h-64 bg-primary/5 rounded-full blur-3xl"
            animate={{ 
              scale: [1, 1.2, 1],
              opacity: [0.3, 0.5, 0.3],
            }}
            transition={{ duration: 8, repeat: Infinity, ease: "easeInOut" }}
          />
          <motion.div 
            className="absolute bottom-20 right-10 w-80 h-80 bg-primary/5 rounded-full blur-3xl"
            animate={{ 
              scale: [1.2, 1, 1.2],
              opacity: [0.5, 0.3, 0.5],
            }}
            transition={{ duration: 8, repeat: Infinity, ease: "easeInOut" }}
          />
        </div>

        <div className="container py-24 md:py-32 lg:py-40 relative">
          <motion.div 
            className="max-w-3xl mx-auto text-center"
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, ease: "easeOut" }}
          >
            <motion.div 
              className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-accent text-accent-foreground text-sm font-medium mb-6"
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.5, delay: 0.2 }}
            >
              <Sparkles className="h-4 w-4" />
              <span>AI Destekli Mücevher Görselleştirme</span>
            </motion.div>
            <motion.h1 
              className="text-4xl md:text-5xl lg:text-6xl font-semibold tracking-tight mb-6"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.3 }}
            >
              Mücevherlerinizi
              <span className="text-primary"> Premium</span>
              <br />
              Görsellere Dönüştürün
            </motion.h1>
            <motion.p 
              className="text-lg md:text-xl text-muted-foreground mb-8 max-w-2xl mx-auto"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.4 }}
            >
              Yapay zeka teknolojisiyle ürün fotoğraflarınızı profesyonel stüdyo ve yaşam tarzı görsellerine dönüştürün. Marka tutarlılığınızı koruyarak.
            </motion.p>
            <motion.div 
              className="flex flex-col sm:flex-row gap-4 justify-center"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.5 }}
            >
              <Link to="/kayit">
                <Button size="lg" className="w-full sm:w-auto text-base px-8">
                  Ücretsiz Başla
                  <ArrowRight className="ml-2 h-5 w-5" />
                </Button>
              </Link>
              <Link to="/sahneler">
                <Button size="lg" variant="outline" className="w-full sm:w-auto text-base px-8">
                  Sahneleri İncele
                </Button>
              </Link>
            </motion.div>
            <motion.p 
              className="text-sm text-muted-foreground mt-4"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.6, delay: 0.6 }}
            >
              10 ücretsiz kredi ile başlayın • Kredi kartı gerekmez
            </motion.p>
          </motion.div>
        </div>
      </section>

      {/* Before/After Showcase */}
      <BeforeAfterShowcase />

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
