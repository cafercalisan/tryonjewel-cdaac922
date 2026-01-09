import { useState } from 'react';
import { Link } from 'react-router-dom';
import { AppLayout } from '@/components/layout/AppLayout';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Plus, Download, Trash2, Eye, Image as ImageIcon, Loader2 } from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';
import { downloadImageAs4kJpeg } from '@/lib/downloadImage';

interface ImageRecord {
  id: string;
  original_image_url: string;
  generated_image_urls: string[];
  status: string;
  created_at: string;
  scenes: {
    name_tr: string;
  } | null;
}

export default function Gallery() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [selectedImage, setSelectedImage] = useState<ImageRecord | null>(null);
  const [selectedVariation, setSelectedVariation] = useState(0);

  const { data: images, isLoading } = useQuery({
    queryKey: ['images', user?.id],
    queryFn: async (): Promise<ImageRecord[]> => {
      const { data, error } = await supabase
        .from('images')
        .select('id, original_image_url, generated_image_urls, status, created_at, scenes(name_tr)')
        .eq('user_id', user!.id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data as ImageRecord[];
    },
    enabled: !!user,
  });

  const deleteMutation = useMutation({
    mutationFn: async (imageId: string) => {
      const { error } = await supabase
        .from('images')
        .delete()
        .eq('id', imageId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['images', user?.id] });
      toast.success('Görsel silindi');
      setSelectedImage(null);
    },
    onError: () => {
      toast.error('Görsel silinirken hata oluştu');
    },
  });

  const handleDownload = async (url: string, index: number) => {
    const id = selectedImage?.id;
    if (!id) return;

    await downloadImageAs4kJpeg({
      url,
      filenameBase: `jewelry-${id}-${index + 1}-4k`,
      width: 3840,
      height: 4800,
      quality: 0.95,
    });
  };

  const completedImages = images?.filter(i => i.status === 'completed') || [];
  const pendingImages = images?.filter(i => i.status !== 'completed' && i.status !== 'failed') || [];

  return (
    <AppLayout>
      <div className="container py-8 md:py-12 animate-fade-in">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-semibold mb-2">Görsellerim</h1>
            <p className="text-muted-foreground">
              Tüm oluşturduğunuz görselleri buradan yönetin
            </p>
          </div>
          <Link to="/olustur">
            <Button>
              <Plus className="mr-2 h-4 w-4" />
              Yeni Oluştur
            </Button>
          </Link>
        </div>

        {isLoading ? (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {[1, 2, 3, 4].map(i => (
              <div key={i} className="aspect-[4/5] bg-muted rounded-xl animate-pulse" />
            ))}
          </div>
        ) : !images || images.length === 0 ? (
          <div className="text-center py-20 bg-muted/30 rounded-2xl">
            <ImageIcon className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-xl font-semibold mb-2">Henüz görsel yok</h3>
            <p className="text-muted-foreground mb-6">İlk mücevher görselinizi oluşturun</p>
            <Link to="/olustur">
              <Button size="lg">
                <Plus className="mr-2 h-5 w-5" />
                İlk Görselimi Oluştur
              </Button>
            </Link>
          </div>
        ) : (
          <>
            {/* Pending Images */}
            {pendingImages.length > 0 && (
              <div className="mb-8">
                <h2 className="text-lg font-medium mb-4">İşleniyor</h2>
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                  {pendingImages.map((image) => (
                    <div 
                      key={image.id}
                      className="aspect-[4/5] rounded-xl bg-muted flex items-center justify-center"
                    >
                      <div className="text-center">
                        <Loader2 className="h-8 w-8 animate-spin text-primary mx-auto mb-2" />
                        <p className="text-sm text-muted-foreground">
                          {image.status === 'analyzing' ? 'Analiz ediliyor...' : 'Oluşturuluyor...'}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Completed Images */}
            {completedImages.length > 0 && (
              <div>
                <h2 className="text-lg font-medium mb-4">Tamamlanan ({completedImages.length})</h2>
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                  {completedImages.map((image) => (
                    <div 
                      key={image.id}
                      className="group relative aspect-[4/5] rounded-xl overflow-hidden bg-muted shadow-luxury cursor-pointer"
                      onClick={() => {
                        setSelectedImage(image);
                        setSelectedVariation(0);
                      }}
                    >
                      {image.generated_image_urls?.[0] && (
                        <img 
                          src={image.generated_image_urls[0]} 
                          alt="Generated jewelry"
                          className="w-full h-full object-cover"
                        />
                      )}
                      <div className="absolute inset-0 bg-foreground/0 group-hover:bg-foreground/40 transition-colors flex items-center justify-center opacity-0 group-hover:opacity-100">
                        <Button size="sm" variant="secondary">
                          <Eye className="mr-2 h-4 w-4" />
                          Görüntüle
                        </Button>
                      </div>
                      {image.scenes && (
                        <div className="absolute bottom-0 left-0 right-0 p-3 bg-gradient-to-t from-foreground/60 to-transparent">
                          <p className="text-sm text-background font-medium">{image.scenes.name_tr}</p>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </>
        )}

        {/* Detail Modal */}
        <Dialog open={!!selectedImage} onOpenChange={() => setSelectedImage(null)}>
          <DialogContent className="max-w-4xl">
            <DialogHeader>
              <DialogTitle>
                {selectedImage?.scenes?.name_tr || 'Görsel Detayı'}
              </DialogTitle>
            </DialogHeader>
            
            {selectedImage && (
              <div className="grid md:grid-cols-[1fr,200px] gap-6">
                <div>
                  <div className="aspect-[4/5] rounded-xl overflow-hidden bg-muted mb-4">
                    {selectedImage.generated_image_urls?.[selectedVariation] && (
                      <img 
                        src={selectedImage.generated_image_urls[selectedVariation]} 
                        alt="Generated jewelry"
                        className="w-full h-full object-cover"
                      />
                    )}
                  </div>
                  
                  {/* Thumbnails */}
                  <div className="grid grid-cols-3 gap-2">
                    {selectedImage.generated_image_urls?.map((url, index) => (
                      <button
                        key={index}
                        onClick={() => setSelectedVariation(index)}
                        className={`aspect-[4/5] rounded-lg overflow-hidden ${
                          selectedVariation === index ? 'ring-2 ring-primary' : 'opacity-70'
                        }`}
                      >
                        <img src={url} alt={`Var ${index + 1}`} className="w-full h-full object-cover" />
                      </button>
                    ))}
                  </div>
                </div>

                <div className="space-y-3">
                  <Button 
                    className="w-full"
                    onClick={() => handleDownload(selectedImage.generated_image_urls[selectedVariation], selectedVariation)}
                  >
                    <Download className="mr-2 h-4 w-4" />
                    İndir
                  </Button>
                  <Button 
                    variant="destructive" 
                    className="w-full"
                    onClick={() => deleteMutation.mutate(selectedImage.id)}
                    disabled={deleteMutation.isPending}
                  >
                    <Trash2 className="mr-2 h-4 w-4" />
                    Sil
                  </Button>
                  <p className="text-xs text-muted-foreground text-center">
                    {new Date(selectedImage.created_at).toLocaleDateString('tr-TR', {
                      day: 'numeric',
                      month: 'long',
                      year: 'numeric',
                    })}
                  </p>
                </div>
              </div>
            )}
          </DialogContent>
        </Dialog>
      </div>
    </AppLayout>
  );
}
