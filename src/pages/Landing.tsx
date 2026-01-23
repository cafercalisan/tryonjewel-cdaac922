import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { AppLayout } from '@/components/layout/AppLayout';
import { Sparkles, Image, Shield, ArrowRight, Camera, Palette, Download, Clock, Zap, TrendingUp, X, Check, Share2, Instagram, Calendar, Repeat, MessageCircle } from 'lucide-react';
import { InfiniteProductShowcase } from '@/components/landing/InfiniteProductShowcase';
import { AnimatedWord } from '@/components/landing/AnimatedWord';
export default function Landing() {
  return <AppLayout>
      {/* Hero Section */}
      <section className="relative overflow-hidden bg-background">
        <div className="container pt-6 md:pt-10 pb-16 md:pb-20">
          <div className="max-w-5xl mx-auto">
            <div className="grid lg:grid-cols-2 gap-8 lg:gap-12 items-center">
              {/* Left - Text Content */}
              <motion.div initial={{
              opacity: 0,
              y: 30
            }} animate={{
              opacity: 1,
              y: 0
            }} transition={{
              duration: 0.8,
              ease: "easeOut"
            }} className="order-2 lg:order-1 text-center lg:text-left mx-0">
                <motion.h1 initial={{
                opacity: 0,
                y: 20
              }} animate={{
                opacity: 1,
                y: 0
              }} transition={{
                duration: 0.6,
                delay: 0.2
              }} className="text-4xl md:text-5xl lg:text-6xl font-semibold tracking-tight mb-5 leading-[1.1] font-sans">
                  Satış Getiren
                  <br />
                  <AnimatedWord words={['Görseller', 'Hikayeler']} interval={3000} /> Yaratın
                </motion.h1>
                
                <motion.p initial={{
                opacity: 0,
                y: 20
              }} animate={{
                opacity: 1,
                y: 0
              }} transition={{
                duration: 0.6,
                delay: 0.3
              }} className="text-base md:text-lg text-muted-foreground mb-6 max-w-md mx-auto lg:mx-0 leading-relaxed font-serif">Ham mücevher fotoğraflarınızı saniyeler içinde lüks kampanya görsellerine dönüştürün.Stüdyo maliyetlerini geride bırakın.</motion.p>
                
                <motion.div className="flex flex-col sm:flex-row gap-3 justify-center lg:justify-start" initial={{
                opacity: 0,
                y: 20
              }} animate={{
                opacity: 1,
                y: 0
              }} transition={{
                duration: 0.6,
                delay: 0.4
              }}>
                  <Link to="/kayit">
                    <Button size="lg" className="w-full sm:w-auto text-sm font-medium tracking-wider px-8 rounded-full">
                      HEMEN ÜRET
                      <ArrowRight className="ml-2 h-4 w-4" />
                    </Button>
                  </Link>
                </motion.div>
              </motion.div>
              
              {/* Right - Hero Image */}
              <motion.div className="order-1 lg:order-2 flex justify-center lg:justify-end" initial={{
              opacity: 0,
              scale: 0.95
            }} animate={{
              opacity: 1,
              scale: 1
            }} transition={{
              duration: 0.8,
              ease: "easeOut",
              delay: 0.2
            }}>
                <div className="relative">
                  <motion.div className="w-[260px] md:w-[300px] lg:w-[340px] aspect-[3/4] rounded-3xl overflow-hidden shadow-luxury-lg" whileHover={{
                  scale: 1.02
                }} transition={{
                  duration: 0.3
                }}>
                    <img alt="Profesyonel mücevher görseli" className="w-full h-full object-cover" src="/lovable-uploads/d9abf31c-925c-4750-961f-11908e4e649a.webp" />
                  </motion.div>
                  {/* Decorative element */}
                  <motion.div className="absolute -z-10 -bottom-3 -right-3 w-full h-full rounded-3xl border-2 border-primary/20" initial={{
                  opacity: 0,
                  scale: 0.9
                }} animate={{
                  opacity: 1,
                  scale: 1
                }} transition={{
                  duration: 0.6,
                  delay: 0.5
                }} />
                </div>
              </motion.div>
            </div>
          </div>
        </div>
      </section>

      {/* Infinite Product Showcase */}
      <InfiniteProductShowcase />
      
      {/* Example Works Button */}
      <section className="py-8 bg-background">
        <div className="container">
          <motion.div className="flex justify-center" initial={{
          opacity: 0,
          y: 20
        }} whileInView={{
          opacity: 1,
          y: 0
        }} transition={{
          duration: 0.5
        }} viewport={{
          once: true
        }}>
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

      {/* How It Works Section */}
      <section className="py-20 md:py-28 bg-muted/20">
        <div className="container">
          <motion.div className="text-center mb-16" initial={{
          opacity: 0,
          y: 20
        }} whileInView={{
          opacity: 1,
          y: 0
        }} transition={{
          duration: 0.6
        }} viewport={{
          once: true
        }}>
            <h2 className="text-3xl md:text-4xl lg:text-5xl font-semibold">
              Nasıl <span className="italic text-primary font-serif">Çalışır?</span>
            </h2>
          </motion.div>
          
          {/* Steps with elegant flowing animation */}
          <div className="max-w-5xl mx-auto">
            <div className="grid md:grid-cols-3 gap-8 md:gap-6 relative">
              {/* Animated flowing line between steps */}
              <div className="hidden md:block absolute top-24 left-[20%] right-[20%] h-[2px] overflow-hidden">
                <motion.div className="h-full bg-gradient-to-r from-transparent via-primary/40 to-transparent" initial={{
                x: '-100%'
              }} whileInView={{
                x: '100%'
              }} transition={{
                duration: 2,
                repeat: Infinity,
                ease: "linear"
              }} viewport={{
                once: false
              }} />
              </div>
              
              <HowItWorksStep number={1} title="Ürünü Çek" description="Doğru ışıklandırma ve belirgin detaylar ile ürününüzü fotoğraflayın." icon={<Camera className="h-6 w-6" />} delay={0} />
              <HowItWorksStep number={2} title="Stilini Seç" description="Koleksiyonunuza en uygun kampanya temasını belirleyin." icon={<Palette className="h-6 w-6" />} delay={0.15} />
              <HowItWorksStep number={3} title="4K Görselini İndir" description="Yayınlamaya hazır, yüksek çözünürlüklü görselleri indirin." icon={<Download className="h-6 w-6" />} delay={0.3} />
            </div>
          </div>
        </div>
      </section>

      {/* Why TryOnJewel - Modern Comparison Section */}
      <section className="py-20 md:py-28 bg-background">
        <div className="container">
          <motion.div className="text-center mb-16" initial={{
          opacity: 0,
          y: 20
        }} whileInView={{
          opacity: 1,
          y: 0
        }} transition={{
          duration: 0.6
        }} viewport={{
          once: true
        }}>
            <h2 className="text-3xl md:text-4xl lg:text-5xl font-semibold">
              Geleneksel Yöntemleri <span className="italic text-primary font-serif">Bırakın</span>
            </h2>
          </motion.div>
          
          {/* Comparison Cards */}
          <div className="max-w-5xl mx-auto">
            <div className="grid md:grid-cols-2 gap-6 md:gap-8">
              {/* Traditional Method Card */}
              <motion.div className="relative rounded-3xl border-2 border-border/30 bg-muted/20 p-8 md:p-10" initial={{
              opacity: 0,
              x: -30
            }} whileInView={{
              opacity: 1,
              x: 0
            }} transition={{
              duration: 0.6
            }} viewport={{
              once: true
            }}>
                <div className="absolute top-6 right-6">
                  <div className="w-10 h-10 rounded-full bg-destructive/10 flex items-center justify-center">
                    <X className="h-5 w-5 text-destructive" />
                  </div>
                </div>
                <h3 className="text-xl font-semibold mb-6 text-muted-foreground">Geleneksel Yöntem</h3>
                <ul className="space-y-4">
                  <li className="flex items-start gap-3">
                    <TrendingUp className="h-5 w-5 text-muted-foreground mt-0.5 flex-shrink-0" />
                    <span className="text-muted-foreground">Profesyonel görseller için yüzlerce dolar</span>
                  </li>
                  <li className="flex items-start gap-3">
                    <Clock className="h-5 w-5 text-muted-foreground mt-0.5 flex-shrink-0" />
                    <span className="text-muted-foreground">Günlerce süren stüdyo çekimleri</span>
                  </li>
                  <li className="flex items-start gap-3">
                    <Image className="h-5 w-5 text-muted-foreground mt-0.5 flex-shrink-0" />
                    <span className="text-muted-foreground">Manken ve model ücretleri</span>
                  </li>
                  <li className="flex items-start gap-3">
                    <Shield className="h-5 w-5 text-muted-foreground mt-0.5 flex-shrink-0" />
                    <span className="text-muted-foreground">Sınırlı revizyon hakkı</span>
                  </li>
                </ul>
              </motion.div>
              
              {/* TryOnJewel Method Card */}
              <motion.div className="relative rounded-3xl border-2 border-primary/30 bg-gradient-to-br from-primary/5 to-transparent p-8 md:p-10 shadow-luxury" initial={{
              opacity: 0,
              x: 30
            }} whileInView={{
              opacity: 1,
              x: 0
            }} transition={{
              duration: 0.6,
              delay: 0.1
            }} viewport={{
              once: true
            }}>
                <div className="absolute top-6 right-6">
                  <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                    <Check className="h-5 w-5 text-primary" />
                  </div>
                </div>
                <h3 className="text-xl font-semibold mb-6">TryOnJewel ile</h3>
                <ul className="space-y-4">
                  <li className="flex items-start gap-3">
                    <Zap className="h-5 w-5 text-primary mt-0.5 flex-shrink-0" />
                    <span>İşinizi yapay zekaya bırakın</span>
                  </li>
                  <li className="flex items-start gap-3">
                    <Clock className="h-5 w-5 text-primary mt-0.5 flex-shrink-0" />
                    <span>Zamandan tasarruf edin</span>
                  </li>
                  <li className="flex items-start gap-3">
                    <Image className="h-5 w-5 text-primary mt-0.5 flex-shrink-0" />
                    <span>Kendi modeliniz ile manken ücretlerinden tasarruf</span>
                  </li>
                  <li className="flex items-start gap-3">
                    <TrendingUp className="h-5 w-5 text-primary mt-0.5 flex-shrink-0" />
                    <span>%90'a varan maliyet tasarrufu</span>
                  </li>
                </ul>
              </motion.div>
            </div>
            
            {/* Feature highlights */}
            <motion.div className="grid grid-cols-3 gap-4 mt-12" initial={{
            opacity: 0,
            y: 20
          }} whileInView={{
            opacity: 1,
            y: 0
          }} transition={{
            duration: 0.6,
            delay: 0.2
          }} viewport={{
            once: true
          }}>
              <div className="text-center p-6 rounded-2xl bg-muted/30 border border-border/30">
                <Sparkles className="h-6 w-6 text-primary mx-auto mb-3" />
                <p className="text-sm font-medium">Yüksek doğrulukta üretim</p>
              </div>
              <div className="text-center p-6 rounded-2xl bg-muted/30 border border-border/30">
                <Image className="h-6 w-6 text-primary mx-auto mb-3" />
                <p className="text-sm font-medium">4K Kalite</p>
              </div>
              <div className="text-center p-6 rounded-2xl bg-muted/30 border border-border/30">
                <Shield className="h-6 w-6 text-primary mx-auto mb-3" />
                <p className="text-sm font-medium">Detay Koruma</p>
              </div>
            </motion.div>
          </div>
        </div>
      </section>

      {/* Social Media Content Section */}
      <section className="py-20 md:py-28 bg-muted/20">
        <div className="container">
          <div className="max-w-6xl mx-auto">
            <div className="grid lg:grid-cols-2 gap-12 lg:gap-16 items-center">
              {/* Left - Visual */}
              <motion.div className="relative" initial={{
              opacity: 0,
              x: -30
            }} whileInView={{
              opacity: 1,
              x: 0
            }} transition={{
              duration: 0.6
            }} viewport={{
              once: true
            }}>
                <div className="relative aspect-square max-w-md mx-auto lg:mx-0">
                  {/* Background glow */}
                  <motion.div className="absolute inset-4 rounded-3xl bg-gradient-to-br from-primary/10 to-primary/5 blur-2xl" animate={{
                  scale: [1, 1.05, 1],
                  opacity: [0.5, 0.7, 0.5]
                }} transition={{
                  duration: 4,
                  repeat: Infinity,
                  ease: "easeInOut"
                }} />
                  
                  {/* Main visual container */}
                  <div className="relative rounded-3xl overflow-hidden border border-border/50 bg-background shadow-luxury-lg">
                    <div className="aspect-square p-8 flex flex-col items-center justify-center">
                      <div className="w-full max-w-[280px] space-y-6">
                        {/* Social Platform Icons */}
                        <div className="flex justify-center gap-4">
                          {[{
                          icon: Instagram,
                          color: 'from-pink-500 to-purple-600'
                        }, {
                          icon: Calendar,
                          color: 'from-blue-500 to-blue-600'
                        }, {
                          icon: Repeat,
                          color: 'from-green-500 to-green-600'
                        }].map((item, i) => <motion.div key={i} className={`w-14 h-14 rounded-2xl bg-gradient-to-br ${item.color} flex items-center justify-center shadow-lg`} initial={{
                          opacity: 0,
                          scale: 0
                        }} whileInView={{
                          opacity: 1,
                          scale: 1
                        }} transition={{
                          duration: 0.4,
                          delay: 0.1 * i
                        }} viewport={{
                          once: true
                        }}>
                              <item.icon className="h-7 w-7 text-white" />
                            </motion.div>)}
                        </div>
                        
                        {/* Calendar Grid Preview */}
                        <div className="grid grid-cols-7 gap-1.5 mt-6">
                          {Array.from({
                          length: 21
                        }).map((_, i) => <motion.div key={i} className={`aspect-square rounded-lg ${i % 3 === 0 ? 'bg-primary/60' : i % 2 === 0 ? 'bg-primary/30' : 'bg-muted'}`} initial={{
                          opacity: 0
                        }} whileInView={{
                          opacity: 1
                        }} transition={{
                          duration: 0.2,
                          delay: 0.02 * i
                        }} viewport={{
                          once: true
                        }} />)}
                        </div>
                        
                        {/* Stats */}
                        <div className="flex justify-center gap-8 mt-6">
                          <div className="text-center">
                            <p className="text-2xl font-semibold text-primary">30+</p>
                            <p className="text-xs text-muted-foreground">Aylık İçerik</p>
                          </div>
                          <div className="text-center">
                            <p className="text-2xl font-semibold text-primary">%300</p>
                            <p className="text-xs text-muted-foreground">Etkileşim Artışı</p>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </motion.div>
              
              {/* Right - Content */}
              <motion.div className="text-center lg:text-left" initial={{
              opacity: 0,
              x: 30
            }} whileInView={{
              opacity: 1,
              x: 0
            }} transition={{
              duration: 0.6,
              delay: 0.1
            }} viewport={{
              once: true
            }}>
                <h2 className="text-3xl md:text-4xl lg:text-5xl font-semibold mb-6">
                  Dijital Gücünüzü <span className="italic text-primary font-serif">Artırın</span>
                </h2>
                <p className="text-lg text-muted-foreground mb-8 max-w-lg mx-auto lg:mx-0 leading-relaxed">
                  Sosyal medyada düzenli ve profesyonel içerik üretimi artık çok kolay. Her gün paylaşım yapın, takipçilerinizi büyütün.
                </p>
                
                {/* Features list */}
                <div className="space-y-4 mb-8">
                  <motion.div className="flex items-center gap-4 justify-center lg:justify-start" initial={{
                  opacity: 0,
                  x: -20
                }} whileInView={{
                  opacity: 1,
                  x: 0
                }} transition={{
                  duration: 0.4,
                  delay: 0.2
                }} viewport={{
                  once: true
                }}>
                    <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center flex-shrink-0">
                      <Calendar className="h-5 w-5 text-primary" />
                    </div>
                    <p className="text-sm md:text-base">Günlük içerik takvimi kolayca doldurun</p>
                  </motion.div>
                  <motion.div className="flex items-center gap-4 justify-center lg:justify-start" initial={{
                  opacity: 0,
                  x: -20
                }} whileInView={{
                  opacity: 1,
                  x: 0
                }} transition={{
                  duration: 0.4,
                  delay: 0.3
                }} viewport={{
                  once: true
                }}>
                    <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center flex-shrink-0">
                      <Share2 className="h-5 w-5 text-primary" />
                    </div>
                    <p className="text-sm md:text-base">Instagram, Tiktok ve diğer sosyal platformlar için optimize</p>
                  </motion.div>
                  <motion.div className="flex items-center gap-4 justify-center lg:justify-start" initial={{
                  opacity: 0,
                  x: -20
                }} whileInView={{
                  opacity: 1,
                  x: 0
                }} transition={{
                  duration: 0.4,
                  delay: 0.4
                }} viewport={{
                  once: true
                }}>
                    <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center flex-shrink-0">
                      <MessageCircle className="h-5 w-5 text-primary" />
                    </div>
                    <p className="text-sm md:text-base">Etkileşimi artıran profesyonel görseller</p>
                  </motion.div>
                </div>

                <Link to="/kayit">
                  <Button size="lg" className="rounded-full px-8">
                    Hemen Başla
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </Button>
                </Link>
              </motion.div>
            </div>
          </div>
        </div>
      </section>

      {/* Pricing Section */}
      <section className="py-20 md:py-28 bg-background">
        <div className="container">
          <motion.div className="text-center mb-16" initial={{
          opacity: 0,
          y: 20
        }} whileInView={{
          opacity: 1,
          y: 0
        }} transition={{
          duration: 0.6
        }} viewport={{
          once: true
        }}>
            <h2 className="text-3xl md:text-4xl lg:text-5xl font-semibold mb-4">
              Size Uygun <span className="italic text-primary font-serif">Paketi</span> Seçin
            </h2>
            <p className="text-muted-foreground text-lg max-w-2xl mx-auto">
              İhtiyaçlarınıza göre esnek fiyatlandırma seçenekleri
            </p>
          </motion.div>
          
          <div className="max-w-5xl mx-auto">
            <div className="grid md:grid-cols-3 gap-6 md:gap-8">
              {/* Starter Package */}
              <motion.div className="relative rounded-3xl border border-border/50 bg-card p-8 hover:border-primary/30 transition-colors" initial={{
              opacity: 0,
              y: 30
            }} whileInView={{
              opacity: 1,
              y: 0
            }} transition={{
              duration: 0.5
            }} viewport={{
              once: true
            }}>
                <div className="text-center mb-8">
                  <h3 className="text-xl font-semibold mb-2">Starter</h3>
                  <p className="text-muted-foreground text-sm mb-4">Keşfetmek için</p>
                  <div className="flex items-baseline justify-center gap-1">
                    <span className="text-4xl font-bold">10</span>
                    <span className="text-muted-foreground">kredi</span>
                  </div>
                </div>
                <ul className="space-y-3 mb-8">
                  <li className="flex items-center gap-3 text-sm">
                    <Check className="h-4 w-4 text-primary flex-shrink-0" />
                    <span>10 adet görsel üretimi</span>
                  </li>
                  <li className="flex items-center gap-3 text-sm">
                    <Check className="h-4 w-4 text-primary flex-shrink-0" />
                    <span>4K çözünürlük</span>
                  </li>
                  <li className="flex items-center gap-3 text-sm">
                    <Check className="h-4 w-4 text-primary flex-shrink-0" />
                    <span>Tüm sahne seçenekleri</span>
                  </li>
                </ul>
                <Link to="/kayit" className="block">
                  <Button variant="outline" className="w-full rounded-full">
                    Başla
                  </Button>
                </Link>
              </motion.div>
              
              {/* Pro Package */}
              <motion.div className="relative rounded-3xl border-2 border-primary bg-gradient-to-b from-primary/10 to-transparent p-8 shadow-luxury-lg" initial={{
              opacity: 0,
              y: 30
            }} whileInView={{
              opacity: 1,
              y: 0
            }} transition={{
              duration: 0.5,
              delay: 0.1
            }} viewport={{
              once: true
            }}>
                <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                  <span className="bg-primary text-primary-foreground text-xs font-medium px-4 py-1.5 rounded-full">
                    En Popüler
                  </span>
                </div>
                <div className="text-center mb-8">
                  <h3 className="text-xl font-semibold mb-2">Pro</h3>
                  <p className="text-muted-foreground text-sm mb-4">Büyüyen markalar için</p>
                  <div className="flex items-baseline justify-center gap-1">
                    <span className="text-4xl font-bold text-primary">50</span>
                    <span className="text-muted-foreground">kredi</span>
                  </div>
                </div>
                <ul className="space-y-3 mb-8">
                  <li className="flex items-center gap-3 text-sm">
                    <Check className="h-4 w-4 text-primary flex-shrink-0" />
                    <span>50 adet görsel üretimi</span>
                  </li>
                  <li className="flex items-center gap-3 text-sm">
                    <Check className="h-4 w-4 text-primary flex-shrink-0" />
                    <span>4K çözünürlük</span>
                  </li>
                  <li className="flex items-center gap-3 text-sm">
                    <Check className="h-4 w-4 text-primary flex-shrink-0" />
                    <span>Tüm sahne seçenekleri</span>
                  </li>
                  <li className="flex items-center gap-3 text-sm">
                    <Check className="h-4 w-4 text-primary flex-shrink-0" />
                    <span>Manken görselleri</span>
                  </li>
                </ul>
                <a href="https://wa.me/905393165217?text=Merhaba%2C%20Pro%20paket%20hakkında%20bilgi%20almak%20istiyorum" target="_blank" rel="noopener noreferrer" className="block">
                  <Button className="w-full rounded-full">
                    Pro'ya Geç
                  </Button>
                </a>
              </motion.div>
              
              {/* Enterprise Package */}
              <motion.div className="relative rounded-3xl border border-border/50 bg-card p-8 hover:border-primary/30 transition-colors" initial={{
              opacity: 0,
              y: 30
            }} whileInView={{
              opacity: 1,
              y: 0
            }} transition={{
              duration: 0.5,
              delay: 0.2
            }} viewport={{
              once: true
            }}>
                <div className="text-center mb-8">
                  <h3 className="text-xl font-semibold mb-2">Enterprise</h3>
                  <p className="text-muted-foreground text-sm mb-4">Kurumsal çözümler</p>
                  <div className="flex items-baseline justify-center gap-1">
                    <span className="text-2xl font-bold">Özel Fiyat</span>
                  </div>
                </div>
                <ul className="space-y-3 mb-8">
                  <li className="flex items-center gap-3 text-sm">
                    <Check className="h-4 w-4 text-primary flex-shrink-0" />
                    <span>Markanıza özel çalışmalar</span>
                  </li>
                  <li className="flex items-center gap-3 text-sm">
                    <Check className="h-4 w-4 text-primary flex-shrink-0" />
                    <span>Firma içi entegrasyon</span>
                  </li>
                  <li className="flex items-center gap-3 text-sm">
                    <Check className="h-4 w-4 text-primary flex-shrink-0" />
                    <span>Özel sahne tasarımları</span>
                  </li>
                  <li className="flex items-center gap-3 text-sm">
                    <Check className="h-4 w-4 text-primary flex-shrink-0" />
                    <span>API erişimi</span>
                  </li>
                </ul>
                <a href="https://wa.me/905393165217?text=Merhaba%2C%20Enterprise%20paket%20hakkında%20bilgi%20almak%20istiyorum" target="_blank" rel="noopener noreferrer" className="block">
                  <Button variant="outline" className="w-full rounded-full">
                    İletişime Geç
                  </Button>
                </a>
              </motion.div>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20 md:py-28 bg-primary text-primary-foreground relative overflow-hidden">
        {/* Animated background */}
        <motion.div className="absolute inset-0 opacity-10" style={{
        backgroundImage: 'radial-gradient(circle at 20% 50%, white 1px, transparent 1px), radial-gradient(circle at 80% 50%, white 1px, transparent 1px)',
        backgroundSize: '40px 40px'
      }} animate={{
        backgroundPosition: ['0px 0px', '40px 40px']
      }} transition={{
        duration: 20,
        repeat: Infinity,
        ease: "linear"
      }} />
        
        <div className="container relative">
          <motion.div className="max-w-3xl mx-auto text-center" initial={{
          opacity: 0,
          y: 30
        }} whileInView={{
          opacity: 1,
          y: 0
        }} transition={{
          duration: 0.6
        }} viewport={{
          once: true
        }}>
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
    </AppLayout>;
}
function HowItWorksStep({
  number,
  title,
  description,
  icon,
  delay = 0
}: {
  number: number;
  title: string;
  description: string;
  icon: React.ReactNode;
  delay?: number;
}) {
  return <motion.div className="text-center relative" initial={{
    opacity: 0,
    y: 30
  }} whileInView={{
    opacity: 1,
    y: 0
  }} transition={{
    duration: 0.5,
    delay
  }} viewport={{
    once: true
  }}>
      {/* Icon with number */}
      <div className="flex justify-center mb-6">
        <motion.div className="relative" whileHover={{
        scale: 1.05
      }} transition={{
        duration: 0.2
      }}>
          {/* Subtle glow effect on hover */}
          <motion.div className="absolute inset-0 rounded-2xl bg-primary/20 blur-xl" initial={{
          opacity: 0,
          scale: 0.8
        }} whileHover={{
          opacity: 1,
          scale: 1.2
        }} transition={{
          duration: 0.3
        }} />
          <div className="relative w-16 h-16 rounded-2xl bg-background border border-border shadow-luxury flex items-center justify-center">
            {icon}
          </div>
          {/* Number badge */}
          <div className="absolute -top-2 -right-2 w-6 h-6 rounded-full bg-foreground text-background text-xs font-semibold flex items-center justify-center">
            {number}
          </div>
        </motion.div>
      </div>
      
      {/* Title */}
      <h3 className="text-xl font-semibold mb-3">{title}</h3>
      
      {/* Description */}
      <p className="text-sm text-muted-foreground leading-relaxed max-w-[280px] mx-auto">
        {description}
      </p>
    </motion.div>;
}