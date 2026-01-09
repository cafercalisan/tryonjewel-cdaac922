import { useSearchParams, useNavigate, Link } from 'react-router-dom';
import { AppLayout } from '@/components/layout/AppLayout';
import { Button } from '@/components/ui/button';
import { Download, RefreshCw, ArrowLeft, Check, Loader2 } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useState } from 'react';
import { downloadImageAs4kJpeg } from '@/lib/downloadImage';

export default function Results() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const imageId = searchParams.get('id');
  const [selectedIndex, setSelectedIndex] = useState(0);

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
    await downloadImageAs4kJpeg({
      url,
      filenameBase: `jewelry-${imageId}-${index + 1}-4k`,
      width: 3840,
      height: 4800,
      quality: 0.95,
    });
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
              <div className="aspect-[4/5] rounded-2xl overflow-hidden bg-muted shadow-luxury-lg mb-4">
                {selectedUrl && (
                  <img 
                    src={selectedUrl} 
                    alt="Generated jewelry" 
                    className="w-full h-full object-cover"
                  />
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
                >
                  <Download className="mr-2 h-4 w-4" />
                  İndir
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
                    >
                      <Download className="mr-2 h-4 w-4" />
                      Varyasyon {index + 1}
                    </Button>
                  ))}
                </div>
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
    </AppLayout>
  );
}
