import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { AppLayout } from '@/components/layout/AppLayout';
import { Gem, Sparkles, Image, Shield, ArrowRight } from 'lucide-react';

export default function Landing() {
  return (
    <AppLayout>
      {/* Hero Section */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-b from-accent/50 to-transparent pointer-events-none" />
        <div className="container py-24 md:py-32 lg:py-40">
          <div className="max-w-3xl mx-auto text-center animate-fade-in">
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-accent text-accent-foreground text-sm font-medium mb-6">
              <Sparkles className="h-4 w-4" />
              <span>AI Destekli Mücevher Görselleştirme</span>
            </div>
            <h1 className="text-4xl md:text-5xl lg:text-6xl font-semibold tracking-tight mb-6">
              Mücevherlerinizi
              <span className="text-primary"> Premium</span>
              <br />
              Görsellere Dönüştürün
            </h1>
            <p className="text-lg md:text-xl text-muted-foreground mb-8 max-w-2xl mx-auto">
              Yapay zeka teknolojisiyle ürün fotoğraflarınızı profesyonel stüdyo ve yaşam tarzı görsellerine dönüştürün. Marka tutarlılığınızı koruyarak.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
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
            </div>
            <p className="text-sm text-muted-foreground mt-4">
              10 ücretsiz kredi ile başlayın • Kredi kartı gerekmez
            </p>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="py-20 md:py-28 bg-muted/30">
        <div className="container">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-semibold mb-4">Neden TryOnJewel?</h2>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
              Mücevher markalarının dijital varlıklarını yönetmek için tasarlandı
            </p>
          </div>
          <div className="grid md:grid-cols-3 gap-8">
            <FeatureCard
              icon={<Sparkles className="h-6 w-6" />}
              title="AI Destekli"
              description="Gelişmiş yapay zeka modellerimiz, ürününüzün her detayını analiz ederek kusursuz görseller oluşturur."
            />
            <FeatureCard
              icon={<Image className="h-6 w-6" />}
              title="Stüdyo Kalitesi"
              description="Profesyonel stüdyo ortamında çekilmiş gibi görünen yüksek kaliteli görseller elde edin."
            />
            <FeatureCard
              icon={<Shield className="h-6 w-6" />}
              title="Marka Tutarlılığı"
              description="Ürün detayları korunur: taş sayısı, tırnak yapısı, metal rengi ve dokusu değişmez."
            />
          </div>
        </div>
      </section>

      {/* Scenes Preview */}
      <section className="py-20 md:py-28">
        <div className="container">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-semibold mb-4">8 Premium Sahne</h2>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
              Stüdyo ve yaşam tarzı sahneleri ile mücevherlerinizi sergileyın
            </p>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {scenes.map((scene) => (
              <div 
                key={scene.name}
                className="aspect-square rounded-xl bg-muted flex items-center justify-center text-center p-4 shadow-luxury hover:shadow-luxury-lg transition-shadow"
              >
                <div>
                  <Gem className="h-8 w-8 text-primary mx-auto mb-2" />
                  <p className="font-medium">{scene.name}</p>
                  <p className="text-xs text-muted-foreground">{scene.category}</p>
                </div>
              </div>
            ))}
          </div>
          <div className="text-center mt-8">
            <Link to="/sahneler">
              <Button variant="outline" size="lg">
                Tüm Sahneleri Gör
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </Link>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20 md:py-28 bg-primary text-primary-foreground">
        <div className="container">
          <div className="max-w-3xl mx-auto text-center">
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
          </div>
        </div>
      </section>
    </AppLayout>
  );
}

function FeatureCard({ icon, title, description }: { icon: React.ReactNode; title: string; description: string }) {
  return (
    <div className="bg-card rounded-2xl p-8 shadow-luxury hover:shadow-luxury-lg transition-shadow">
      <div className="w-12 h-12 rounded-xl bg-accent flex items-center justify-center text-accent-foreground mb-4">
        {icon}
      </div>
      <h3 className="text-xl font-semibold mb-2">{title}</h3>
      <p className="text-muted-foreground">{description}</p>
    </div>
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
