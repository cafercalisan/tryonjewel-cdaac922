import { useSearchParams, useNavigate, Link } from 'react-router-dom';
import { AppLayout } from '@/components/layout/AppLayout';
import { Button } from '@/components/ui/button';
import { Download, RefreshCw, ArrowLeft, Check, Loader2, ZoomIn, ZoomOut, X, Maximize2 } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useState } from 'react';
import { downloadImageAs4kJpeg } from '@/lib/downloadImage';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'sonner';
import { VideoGenerateButton } from '@/components/video/VideoGenerateButton';

export default function Results() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const imageId = searchParams.get('id');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [zoomScale, setZoomScale] = useState(1);
  const [isDownloading, setIsDownloading] = useState<number | null>(null);

  const { data: image, isLoading } = useQuery({
    queryKey: ['image', imageId],
    queryFn: async () => {
      if (!imageId) return null;

      const { data, error } = await supabase
        .from('images')
        .select('*, scenes(*)')
        .eq('id', imageId)
        .single();

      if (error) throw error;
      return data;
    },
    enabled: !!imageId,
    refetchInterval: (query) => {
      const data = query.state.data;
      if (data && (data.status === 'pending' || data.status === 'analyzing' || data.status === 'generating')) {
        return 2000;
      }
      return false;
    },
  });

  const handleDownload = async (url: string, index: number) => {
    if (!imageId) return;
    setIsDownloading(index);
    try {
      // Download at maximum 4K quality
      await downloadImageAs4kJpeg({
        url,
        filenameBase: `jewelry-${imageId}-${index + 1}-4K`,
        width: 3840,
        height: 4800,
        quality: 1.0
      });
      toast.success('4K görsel indirildi');
    } catch (error) {
      console.error('Download error:', error);
      toast.error('İndirme sırasında hata oluştu');
    } finally {
      setIsDownloading(null);
    }
  };

  const openLightbox = () => {
    setZoomScale(1);
    setLightboxOpen(true);
  };

  if (isLoading) {
    return (
      <AppLayout showFooter={false}>
        <div className="container py-8 md:py-12">
          <div className="max-w-4xl mx-auto animate-pulse">
            <div className="h-8 w-48 bg-muted rounded mb-8" />
            <div className="aspect-[4/5] max-w-lg mx-auto bg-muted rounded-2xl" />
          </div>
        </div>
      </AppLayout>
    );
  }

  if (!image) {
    return (
      <AppLayout showFooter={false}>
        <div className="container py-8 md:py-12">
          <div className="max-w-4xl mx-auto text-center">
            <h1 className="text-2xl font-semibold mb-4">Görsel bulunamadı</h1>
            <Link to="/gorsellerim">
              <Button>Görsellerime Dön</Button>
            </Link>
          </div>
        </div>
      </AppLayout>
    );
  }

  // Still processing
  if (image.status !== 'completed') {
    return (
      <AppLayout showFooter={false}>
        <div className="container py-8 md:py-12">
          <div className="max-w-lg mx-auto text-center animate-fade-in">
            <Loader2 className="h-12 w-12 animate-spin text-primary mx-auto mb-6" />
            <h1 className="text-2xl font-semibold mb-2">
              {image.status === 'analyzing' ? 'Ürün Analiz Ediliyor...' : 'Görsel Oluşturuluyor...'}
            </h1>
            <p className="text-muted-foreground">
              {image.status === 'analyzing' 
                ? 'Mücevherinizin detayları inceleniyor' 
                : 'Premium görseliniz hazırlanıyor'}
            </p>
          </div>
        </div>
      </AppLayout>
    );
  }

  // Failed
  if (image.error_message) {
    return (
      <AppLayout showFooter={false}>
        <div className="container py-8 md:py-12">
          <div className="max-w-lg mx-auto text-center">
            <h1 className="text-2xl font-semibold mb-2 text-destructive">Hata Oluştu</h1>
            <p className="text-muted-foreground mb-6">{image.error_message || 'Görsel oluşturulurken bir hata oluştu.'}</p>
            <Link to="/olustur">
              <Button>Tekrar Dene</Button>
            </Link>
          </div>
        </div>
      </AppLayout>
    );
  }

  const generatedUrls = image.generated_image_urls || [];
  const selectedUrl = generatedUrls[selectedIndex];

  return (
    <AppLayout showFooter={false}>
      <div className="container py-8 md:py-12 animate-fade-in">
        <div className="max-w-5xl mx-auto">
          {/* Header */}
          <div className="flex items-center justify-between mb-8">
            <div>
              <button 
                onClick={() => navigate(-1)}
                className="flex items-center gap-2 text-muted-foreground hover:text-foreground mb-2"
              >
                <ArrowLeft className="h-4 w-4" />
                <span className="text-sm">Geri</span>
              </button>
              <h1 className="text-2xl font-semibold">Sonuçlar</h1>
              {image.scenes && (
                <p className="text-muted-foreground">{(image.scenes as any).name_tr}</p>
              )}
            </div>
          </div>

          <div className="grid md:grid-cols-[1fr,300px] gap-8">
            {/* Main Image */}
            <div>
              <div 
                className="aspect-[4/5] rounded-2xl overflow-hidden bg-muted shadow-luxury-lg mb-4 cursor-zoom-in relative group"
                onClick={openLightbox}
              >
                {selectedUrl && (
                  <>
                    <img 
                      src={selectedUrl} 
                      alt="Generated jewelry" 
                      className="w-full h-full object-cover"
                    />
                    <div className="absolute inset-0 bg-foreground/0 group-hover:bg-foreground/10 transition-colors flex items-center justify-center opacity-0 group-hover:opacity-100">
                      <div className="bg-background/80 backdrop-blur-sm rounded-full p-3">
                        <Maximize2 className="h-6 w-6 text-foreground" />
                      </div>
                    </div>
                  </>
                )}
              </div>
              
              {/* Thumbnails */}
              <div className="grid grid-cols-3 gap-3">
                {generatedUrls.map((url, index) => (
                  <button
                    key={index}
                    onClick={() => setSelectedIndex(index)}
                    className={`relative aspect-[4/5] rounded-xl overflow-hidden transition-all ${
                      selectedIndex === index 
                        ? 'ring-2 ring-primary ring-offset-2' 
                        : 'opacity-70 hover:opacity-100'
                    }`}
                  >
                    <img 
                      src={url} 
                      alt={`Variation ${index + 1}`}
                      className="w-full h-full object-cover"
                    />
                    {selectedIndex === index && (
                      <div className="pointer-events-none absolute inset-0 flex items-center justify-center bg-primary/20">
                        <Check className="h-6 w-6 text-primary" />
                      </div>
                    )}
                  </button>
                ))}
              </div>
            </div>

            {/* Sidebar */}
            <div className="space-y-4">
              <div className="bg-card rounded-xl p-6 shadow-luxury">
                <h3 className="font-medium mb-4">Seçili Görsel</h3>
                <p className="text-sm text-muted-foreground mb-4">
                  Varyasyon {selectedIndex + 1} / {generatedUrls.length}
                </p>
                <Button 
                  className="w-full" 
                  onClick={() => handleDownload(selectedUrl, selectedIndex)}
                  disabled={isDownloading === selectedIndex}
                >
                  {isDownloading === selectedIndex ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <Download className="mr-2 h-4 w-4" />
                  )}
                  4K İndir
                </Button>
              </div>

              <div className="bg-card rounded-xl p-6 shadow-luxury">
                <h3 className="font-medium mb-4">Tüm Varyasyonları İndir</h3>
                <div className="space-y-2">
                  {generatedUrls.map((url, index) => (
                    <Button 
                      key={index}
                      variant="outline" 
                      className="w-full justify-start"
                      onClick={() => handleDownload(url, index)}
                      disabled={isDownloading === index}
                    >
                      {isDownloading === index ? (
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      ) : (
                        <Download className="mr-2 h-4 w-4" />
                      )}
                      Varyasyon {index + 1} (4K)
                    </Button>
                  ))}
                </div>
              </div>

              {/* Video Generation */}
              <div className="bg-gradient-to-br from-primary/10 to-primary/5 rounded-xl p-6 shadow-luxury border border-primary/20">
                <h3 className="font-medium mb-2 flex items-center gap-2">
                  <span className="text-primary">✨</span>
                  Premium Video
                </h3>
                <p className="text-sm text-muted-foreground mb-4">
                  Slow-motion lüks animasyon ile görselinizi canlandırın
                </p>
                <VideoGenerateButton 
                  imageUrl={selectedUrl} 
                  variant="default"
                  className="w-full"
                />
              </div>

              <div className="flex gap-3">
                <Link to="/olustur" className="flex-1">
                  <Button variant="outline" className="w-full">
                    <RefreshCw className="mr-2 h-4 w-4" />
                    Yeni Oluştur
                  </Button>
                </Link>
                <Link to="/gorsellerim" className="flex-1">
                  <Button variant="ghost" className="w-full">
                    Galeriye Git
                  </Button>
                </Link>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Full-screen Lightbox for HD viewing */}
      <AnimatePresence>
        {lightboxOpen && selectedUrl && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] bg-background/98 backdrop-blur-xl flex items-center justify-center"
            onClick={() => setLightboxOpen(false)}
          >
            {/* Controls */}
            <div className="absolute top-4 right-4 flex items-center gap-2 z-10">
              <div className="bg-secondary/80 backdrop-blur-sm px-3 py-1.5 rounded-full mr-2">
                <span className="text-sm font-medium">{Math.round(zoomScale * 100)}%</span>
              </div>
              <Button
                size="icon"
                variant="secondary"
                onClick={(e) => {
                  e.stopPropagation();
                  setZoomScale(s => Math.max(0.5, s - 0.25));
                }}
              >
                <ZoomOut className="h-4 w-4" />
              </Button>
              <Button
                size="icon"
                variant="secondary"
                onClick={(e) => {
                  e.stopPropagation();
                  setZoomScale(s => Math.min(4, s + 0.25));
                }}
              >
                <ZoomIn className="h-4 w-4" />
              </Button>
              <Button
                size="icon"
                variant="secondary"
                onClick={(e) => {
                  e.stopPropagation();
                  handleDownload(selectedUrl, selectedIndex);
                }}
              >
                <Download className="h-4 w-4" />
              </Button>
              <Button
                size="icon"
                variant="secondary"
                onClick={() => setLightboxOpen(false)}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>

            {/* HD Image with zoom */}
            <motion.img
              src={selectedUrl}
              alt="High resolution jewelry view"
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: zoomScale, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              transition={{ type: 'spring', stiffness: 300, damping: 30 }}
              className="max-w-[95vw] max-h-[95vh] object-contain rounded-lg shadow-2xl cursor-grab active:cursor-grabbing"
              onClick={(e) => e.stopPropagation()}
              drag
              dragConstraints={{ left: -500, right: 500, top: -500, bottom: 500 }}
              dragElastic={0.1}
              style={{ imageRendering: zoomScale > 1 ? 'auto' : 'auto' }}
            />

            {/* Instructions */}
            <div className="absolute bottom-4 left-1/2 -translate-x-1/2 bg-secondary/80 backdrop-blur-sm px-4 py-2 rounded-full">
              <span className="text-sm text-muted-foreground">
                Yakınlaştırmak için + / - kullanın • Sürükleyerek hareket ettirin
              </span>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </AppLayout>
  );
}
