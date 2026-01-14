import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { AppLayout } from '@/components/layout/AppLayout';
import { Gem, Sparkles, Image, Shield, ArrowRight, Camera, Palette, Download, Play, Clock, Zap, TrendingUp, X, Check, Share2 } from 'lucide-react';
import { BeforeAfterShowcase } from '@/components/landing/BeforeAfterShowcase';
import { TransformationGallery } from '@/components/landing/TransformationGallery';
import { InfiniteProductShowcase } from '@/components/landing/InfiniteProductShowcase';
import { AnimatedWord } from '@/components/landing/AnimatedWord';
import emeraldBracelet from '@/assets/showcase/emerald-bracelet-result-1.webp';
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
                <motion.p className="text-xs md:text-sm font-medium tracking-[0.2em] text-primary mb-4" initial={{
                opacity: 0,
                y: 10
              }} animate={{
                opacity: 1,
                y: 0
              }} transition={{
                duration: 0.5,
                delay: 0.1
              }}>
                  GELECEK NESİL GÖRSELLEŞTİRME
                </motion.p>
                
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
                  Net, Temiz,
                  <br />
                  <span className="italic text-primary font-serif">Profesyonel.</span>
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
              }} className="text-base md:text-lg text-muted-foreground mb-6 max-w-md mx-auto lg:mx-0 leading-relaxed font-serif">
                  Ham fotoğrafları saniyeler içinde lüks kampanya karelerine dönüştürün. Fotoğrafçı maliyetlerini geride bırakın.
                </motion.p>
                
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
                  <Link to="/ornekler">
                    <Button size="lg" variant="outline" className="w-full sm:w-auto text-sm font-medium tracking-wider px-8 rounded-full border-foreground/20 hover:bg-foreground/5">
                      <Play className="mr-2 h-3 w-3 fill-current" />
                      ÖRNEKLERİ İNCELE
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
              
              <HowItWorksStep number={1} category="HAZIRLIK" title="Ürünü Çek" description="Doğru ışıklandırma ve belirgin detaylar ile ürününüzü fotoğraflayın. AI motorumuz detayları analiz eder." icon={<Camera className="h-6 w-6" />} delay={0} />
              <HowItWorksStep number={2} category="YARATICILIK" title="Stilini Seç" description="Koleksiyonunuza en uygun kampanya temasını veya manken pozunu belirleyin. Saniyeler içinde üretim başlar." icon={<Palette className="h-6 w-6" />} delay={0.15} />
              <HowItWorksStep number={3} category="SONUÇ" title="4K Görselini İndir" description="Yayınlamaya hazır, yüksek çözünürlüklü lüks görsellerinizi anında indirin ve paylaşın." icon={<Download className="h-6 w-6" />} delay={0.3} />
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
              <motion.div className="relative rounded-3xl border border-border/50 bg-muted/30 p-8 md:p-10" initial={{
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

      {/* Digital Story Section */}
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
                  {/* Background decorative elements */}
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
                      {/* Brand mockup */}
                      <div className="w-full max-w-[280px] space-y-4">
                        {/* Logo placeholder */}
                        <motion.div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-primary to-primary/60 flex items-center justify-center mx-auto shadow-lg" initial={{
                        scale: 0
                      }} whileInView={{
                        scale: 1
                      }} transition={{
                        duration: 0.5,
                        delay: 0.2
                      }} viewport={{
                        once: true
                      }}>
                          <Gem className="h-8 w-8 text-primary-foreground" />
                        </motion.div>
                        
                        {/* Social media mockups with icons and slogans */}
                        <div className="grid grid-cols-2 gap-3 mt-6">
                          {[
                            { icon: 'instagram', slogan: 'Hikayeni Paylaş', color: 'from-pink-500 to-purple-600' },
                            { icon: 'facebook', slogan: 'Topluluğunu Büyüt', color: 'from-blue-600 to-blue-700' },
                            { icon: 'pinterest', slogan: 'İlham Ver', color: 'from-red-500 to-red-600' },
                            { icon: 'twitter', slogan: 'Trende Gir', color: 'from-sky-400 to-sky-500' },
                          ].map((item, i) => (
                            <motion.div 
                              key={item.icon} 
                              className="aspect-square rounded-xl bg-muted/50 border border-border/30 overflow-hidden group cursor-pointer hover:border-primary/30 transition-colors" 
                              initial={{ opacity: 0, y: 20 }}
                              whileInView={{ opacity: 1, y: 0 }}
                              transition={{ duration: 0.4, delay: 0.1 * i }}
                              viewport={{ once: true }}
                              whileHover={{ scale: 1.02 }}
                            >
                              <div className={`w-full h-full bg-gradient-to-br ${item.color} flex flex-col items-center justify-center p-3 gap-2`}>
                                {item.icon === 'instagram' && (
                                  <svg className="h-7 w-7 text-white" fill="currentColor" viewBox="0 0 24 24">
                                    <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z"/>
                                  </svg>
                                )}
                                {item.icon === 'facebook' && (
                                  <svg className="h-7 w-7 text-white" fill="currentColor" viewBox="0 0 24 24">
                                    <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
                                  </svg>
                                )}
                                {item.icon === 'pinterest' && (
                                  <svg className="h-7 w-7 text-white" fill="currentColor" viewBox="0 0 24 24">
                                    <path d="M12.017 0C5.396 0 .029 5.367.029 11.987c0 5.079 3.158 9.417 7.618 11.162-.105-.949-.199-2.403.041-3.439.219-.937 1.406-5.957 1.406-5.957s-.359-.72-.359-1.781c0-1.663.967-2.911 2.168-2.911 1.024 0 1.518.769 1.518 1.688 0 1.029-.653 2.567-.992 3.992-.285 1.193.6 2.165 1.775 2.165 2.128 0 3.768-2.245 3.768-5.487 0-2.861-2.063-4.869-5.008-4.869-3.41 0-5.409 2.562-5.409 5.199 0 1.033.394 2.143.889 2.741.099.12.112.225.085.345-.09.375-.293 1.199-.334 1.363-.053.225-.172.271-.401.165-1.495-.69-2.433-2.878-2.433-4.646 0-3.776 2.748-7.252 7.92-7.252 4.158 0 7.392 2.967 7.392 6.923 0 4.135-2.607 7.462-6.233 7.462-1.214 0-2.354-.629-2.758-1.379l-.749 2.848c-.269 1.045-1.004 2.352-1.498 3.146 1.123.345 2.306.535 3.55.535 6.607 0 11.985-5.365 11.985-11.987C23.97 5.39 18.592.026 11.985.026L12.017 0z"/>
                                  </svg>
                                )}
                                {item.icon === 'twitter' && (
                                  <svg className="h-7 w-7 text-white" fill="currentColor" viewBox="0 0 24 24">
                                    <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>
                                  </svg>
                                )}
                                <span className="text-white text-[10px] font-medium text-center leading-tight opacity-90">
                                  {item.slogan}
                                </span>
                              </div>
                            </motion.div>
                          ))}
                        </div>
                        
                        {/* Color palette indicator */}
                        <div className="flex justify-center gap-2 mt-4">
                          <motion.div className="w-8 h-8 rounded-full bg-primary shadow-md" whileHover={{
                          scale: 1.1
                        }} />
                          <motion.div className="w-8 h-8 rounded-full bg-foreground shadow-md" whileHover={{
                          scale: 1.1
                        }} />
                          <motion.div className="w-8 h-8 rounded-full bg-muted border border-border shadow-md" whileHover={{
                          scale: 1.1
                        }} />
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
                <p className="text-xs md:text-sm font-medium tracking-[0.2em] text-primary mb-4">
                  MARKA KİMLİĞİ
                </p>
                <h2 className="text-3xl md:text-4xl lg:text-5xl font-semibold mb-6">
                  Satış Getiren <AnimatedWord words={['Görseller', 'Hikayeler']} interval={3000} /> Yaratın
                </h2>
                <p className="text-lg text-muted-foreground mb-8 max-w-lg mx-auto lg:mx-0 leading-relaxed">
                  Logo ve marka renklerinize göre kreatifler oluşturun. Tutarlı bir görsel kimlik ile sosyal medyada öne çıkın.
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
                      <Palette className="h-5 w-5 text-primary" />
                    </div>
                    <p className="text-sm md:text-base">Marka renklerinize uyumlu görseller</p>
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
                    <p className="text-sm md:text-base">Sosyal medya için optimize boyutlar</p>
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
                      <Sparkles className="h-5 w-5 text-primary" />
                    </div>
                    <p className="text-sm md:text-base">Profesyonel ve tutarlı içerikler</p>
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
      
      {/* Category label with subtle animation */}
      <motion.p className="text-xs font-medium tracking-[0.15em] text-primary mb-2" initial={{
      opacity: 0
    }} whileInView={{
      opacity: 1
    }} transition={{
      duration: 0.4,
      delay: delay + 0.1
    }} viewport={{
      once: true
    }}>
        {category}
      </motion.p>
      
      {/* Title */}
      <h3 className="text-xl font-semibold mb-3">{title}</h3>
      
      {/* Description */}
      <p className="text-sm text-muted-foreground leading-relaxed max-w-[280px] mx-auto">
        {description}
      </p>
    </motion.div>;
}