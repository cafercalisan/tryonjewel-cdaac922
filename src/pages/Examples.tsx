import { motion } from 'framer-motion';
import { AppLayout } from '@/components/layout/AppLayout';
import { Sparkles, ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Link } from 'react-router-dom';

// Import showcase images
import earringOriginal from '@/assets/showcase/earring-original.webp';
import earringResult from '@/assets/showcase/earring-result.webp';
import emeraldBraceletOriginal from '@/assets/showcase/emerald-bracelet-original.webp';
import emeraldBraceletResult1 from '@/assets/showcase/emerald-bracelet-result-1.webp';
import sapphireBraceletOriginal from '@/assets/showcase/sapphire-bracelet-original.webp';
import sapphireBraceletResult from '@/assets/showcase/sapphire-bracelet-result.webp';
import blueSapphireBraceletOriginal from '@/assets/showcase/blue-sapphire-bracelet-original.webp';
import blueSapphireBraceletResult from '@/assets/showcase/blue-sapphire-bracelet-result.webp';
import ringOriginal from '@/assets/showcase/ring-original.webp';
import ringResult from '@/assets/showcase/ring-result.webp';
import diamondSetOriginal from '@/assets/showcase/diamond-set-original.webp';

const mannequinResult = '/lovable-uploads/d9abf31c-925c-4750-961f-11908e4e649a.webp';

interface ShowcaseItem {
  id: string;
  name: string;
  description: string;
  original: string;
  result: string;
}

const showcaseItems: ShowcaseItem[] = [
  {
    id: 'diamond-set-mannequin',
    name: 'Pırlanta Set - Manken Çekimi',
    description: 'Lüks marka kampanyaları için profesyonel manken görseli',
    original: diamondSetOriginal,
    result: mannequinResult,
  },
  {
    id: 'earring',
    name: 'Pırlanta Küpe',
    description: 'Detaylı yakın plan stüdyo çekimi kalitesinde',
    original: earringOriginal,
    result: earringResult,
  },
  {
    id: 'emerald-bracelet',
    name: 'Zümrüt Pırlanta Bilezik',
    description: 'Yaşam tarzı kampanya görseli',
    original: emeraldBraceletOriginal,
    result: emeraldBraceletResult1,
  },
  {
    id: 'sapphire-bracelet',
    name: 'Safir Pırlanta Bilezik',
    description: 'Profesyonel stüdyo paketi görseli',
    original: sapphireBraceletOriginal,
    result: sapphireBraceletResult,
  },
  {
    id: 'blue-sapphire-bracelet',
    name: 'Mavi Safir Bilezik',
    description: 'Editoryal kampanya çekimi',
    original: blueSapphireBraceletOriginal,
    result: blueSapphireBraceletResult,
  },
  {
    id: 'ring',
    name: 'Pırlanta Yüzük',
    description: 'Premium ürün görseli',
    original: ringOriginal,
    result: ringResult,
  },
];

export default function Examples() {
  return (
    <AppLayout>
      {/* Hero Section */}
      <section className="py-12 md:py-16">
        <div className="container">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            className="text-center mb-12"
          >
            <Link to="/">
              <Button variant="ghost" className="mb-6">
                <ArrowLeft className="mr-2 h-4 w-4" />
                Ana Sayfa
              </Button>
            </Link>
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-accent text-accent-foreground text-sm font-medium mb-6">
              <Sparkles className="h-4 w-4" />
              <span>Gerçek Dönüşümler</span>
            </div>
            <h1 className="text-4xl md:text-5xl lg:text-6xl font-semibold mb-4">
              Önce & <span className="italic text-primary font-serif">Sonra</span>
            </h1>
            <p className="text-lg md:text-xl text-muted-foreground max-w-2xl mx-auto">
              Basit ürün fotoğraflarından profesyonel kampanya görsellerine dönüşümü keşfedin
            </p>
          </motion.div>
        </div>
      </section>

      {/* Examples Grid */}
      <section className="pb-20 md:pb-28">
        <div className="container">
          <div className="space-y-20 md:space-y-28">
            {showcaseItems.map((item, index) => (
              <motion.div
                key={item.id}
                initial={{ opacity: 0, y: 40 }}
                whileInView={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, delay: 0.1 }}
                viewport={{ once: true, margin: "-100px" }}
                className="max-w-6xl mx-auto"
              >
                {/* Item Header */}
                <div className="text-center mb-8">
                  <span className="text-xs font-medium tracking-[0.2em] text-primary">
                    ÖRNEK {index + 1}
                  </span>
                  <h2 className="text-2xl md:text-3xl font-semibold mt-2 mb-2">
                    {item.name}
                  </h2>
                  <p className="text-muted-foreground">
                    {item.description}
                  </p>
                </div>

                {/* Before/After Images */}
                <div className="grid md:grid-cols-2 gap-6 md:gap-8">
                  {/* Before Image */}
                  <div className="relative group">
                    <div className="absolute top-4 left-4 z-10">
                      <span className="px-4 py-2 rounded-full bg-background/90 backdrop-blur-sm text-sm font-medium border border-border/50 shadow-sm">
                        Önce
                      </span>
                    </div>
                    <div className="aspect-[4/5] rounded-2xl overflow-hidden bg-muted border border-border/50 shadow-luxury">
                      <img
                        src={item.original}
                        alt={`${item.name} - Önce`}
                        className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                      />
                    </div>
                  </div>

                  {/* After Image */}
                  <div className="relative group">
                    <div className="absolute top-4 left-4 z-10">
                      <span className="px-4 py-2 rounded-full bg-primary text-primary-foreground text-sm font-medium shadow-sm">
                        Sonra
                      </span>
                    </div>
                    <div className="aspect-[4/5] rounded-2xl overflow-hidden bg-muted border-2 border-primary/20 shadow-luxury-lg">
                      <img
                        src={item.result}
                        alt={`${item.name} - Sonra`}
                        className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                      />
                    </div>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>

          {/* CTA Section */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            viewport={{ once: true }}
            className="text-center mt-20 md:mt-28"
          >
            <h3 className="text-2xl md:text-3xl font-semibold mb-4">
              Kendi Dönüşümünüzü <span className="italic text-primary font-serif">Yaratın</span>
            </h3>
            <p className="text-muted-foreground mb-8 max-w-xl mx-auto">
              Ürün fotoğraflarınızı profesyonel kampanya görsellerine dönüştürmek için hemen başlayın
            </p>
            <Link to="/kayit">
              <Button size="lg" className="px-10 rounded-full">
                Hemen Deneyin
              </Button>
            </Link>
          </motion.div>
        </div>
      </section>
    </AppLayout>
  );
}
