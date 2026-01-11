import { useState } from 'react';
import { Link } from 'react-router-dom';
import { AppLayout } from '@/components/layout/AppLayout';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Plus, Download, Trash2, Eye, Image as ImageIcon, Loader2, ZoomIn, X, ZoomOut } from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';
import { downloadImageAs4kJpeg } from '@/lib/downloadImage';
import { motion, AnimatePresence } from 'framer-motion';

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
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [lightboxScale, setLightboxScale] = useState(1);

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

  // Only show completed images - hide processing/analyzing states
  const completedImages = images?.filter(i => i.status === 'completed') || [];

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
                      {/* Scene name or Master Package indicator */}
                      <div className="absolute bottom-0 left-0 right-0 p-3 bg-gradient-to-t from-foreground/60 to-transparent">
                        <p className="text-sm text-background font-medium">
                          {image.scenes?.name_tr || (image.generated_image_urls?.length === 3 ? 'Master Paket' : 'Özel Görsel')}
                        </p>
                        {image.generated_image_urls?.length > 1 && (
                          <p className="text-xs text-background/70">{image.generated_image_urls.length} varyasyon</p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </>
        )}

        {/* Detail Modal - Compact */}
        <Dialog open={!!selectedImage} onOpenChange={() => setSelectedImage(null)}>
          <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="text-base">
                {selectedImage?.scenes?.name_tr || 'Görsel Detayı'}
              </DialogTitle>
            </DialogHeader>
            
            {selectedImage && (
              <div className="space-y-4">
                {/* Main Image - Smaller */}
                <div 
                  className="aspect-[4/5] max-h-[50vh] rounded-lg overflow-hidden bg-muted cursor-zoom-in group relative mx-auto"
                  onClick={(e) => {
                    e.stopPropagation();
                    setLightboxOpen(true);
                    setLightboxScale(1);
                  }}
                >
                  {selectedImage.generated_image_urls?.[selectedVariation] && (
                    <img 
                      src={selectedImage.generated_image_urls[selectedVariation]} 
                      alt="Generated jewelry"
                      className="w-full h-full object-contain"
                    />
                  )}
                  <div className="absolute inset-0 bg-foreground/0 group-hover:bg-foreground/20 transition-colors flex items-center justify-center opacity-0 group-hover:opacity-100">
                    <ZoomIn className="h-6 w-6 text-white drop-shadow-lg" />
                  </div>
                </div>
                
                {/* Thumbnails - Horizontal */}
                {selectedImage.generated_image_urls?.length > 1 && (
                  <div className="flex justify-center gap-2">
                    {selectedImage.generated_image_urls.map((url, index) => (
                      <button
                        key={index}
                        onClick={() => setSelectedVariation(index)}
                        className={`w-16 h-20 rounded-md overflow-hidden transition-all ${
                          selectedVariation === index ? 'ring-2 ring-primary scale-105' : 'opacity-60 hover:opacity-100'
                        }`}
                      >
                        <img src={url} alt={`Varyasyon ${index + 1}`} className="w-full h-full object-cover" />
                      </button>
                    ))}
                  </div>
                )}

                {/* Actions - Horizontal */}
                <div className="flex items-center justify-center gap-2 pt-2">
                  <Button 
                    size="sm"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDownload(selectedImage.generated_image_urls[selectedVariation], selectedVariation);
                    }}
                  >
                    <Download className="mr-1.5 h-4 w-4" />
                    İndir
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={(e) => {
                      e.stopPropagation();
                      setLightboxOpen(true);
                      setLightboxScale(1);
                    }}
                  >
                    <ZoomIn className="mr-1.5 h-4 w-4" />
                    Büyüt
                  </Button>
                  <Button 
                    size="sm"
                    variant="destructive" 
                    onClick={(e) => {
                      e.stopPropagation();
                      deleteMutation.mutate(selectedImage.id);
                    }}
                    disabled={deleteMutation.isPending}
                  >
                    <Trash2 className="mr-1.5 h-4 w-4" />
                    Sil
                  </Button>
                </div>

                <p className="text-xs text-muted-foreground text-center">
                  {new Date(selectedImage.created_at).toLocaleDateString('tr-TR', {
                    day: 'numeric',
                    month: 'long',
                    year: 'numeric',
                  })}
                </p>
              </div>
            )}
          </DialogContent>
        </Dialog>

        {/* Fullscreen Lightbox */}
        <AnimatePresence>
          {lightboxOpen && selectedImage?.generated_image_urls?.[selectedVariation] && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-[100] bg-background/95 backdrop-blur-md flex items-center justify-center p-4"
              onClick={() => setLightboxOpen(false)}
            >
              {/* Controls */}
              <div className="absolute top-4 right-4 flex items-center gap-2 z-10">
                <Button
                  size="icon"
                  variant="secondary"
                  onClick={(e) => {
                    e.stopPropagation();
                    setLightboxScale(s => Math.max(0.5, s - 0.25));
                  }}
                >
                  <ZoomOut className="h-4 w-4" />
                </Button>
                <Button
                  size="icon"
                  variant="secondary"
                  onClick={(e) => {
                    e.stopPropagation();
                    setLightboxScale(s => Math.min(3, s + 0.25));
                  }}
                >
                  <ZoomIn className="h-4 w-4" />
                </Button>
                <Button
                  size="icon"
                  variant="secondary"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleDownload(selectedImage.generated_image_urls[selectedVariation], selectedVariation);
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

              {/* Image */}
              <motion.img
                src={selectedImage.generated_image_urls[selectedVariation]}
                alt="Generated jewelry fullscreen"
                initial={{ scale: 0.9 }}
                animate={{ scale: lightboxScale }}
                exit={{ scale: 0.9 }}
                transition={{ type: 'spring', stiffness: 300, damping: 30 }}
                className="max-w-[90vw] max-h-[90vh] object-contain rounded-lg shadow-2xl"
                onClick={(e) => e.stopPropagation()}
                drag
                dragConstraints={{ left: 0, right: 0, top: 0, bottom: 0 }}
              />

              {/* Scale indicator */}
              <div className="absolute bottom-4 left-1/2 -translate-x-1/2 bg-secondary/80 backdrop-blur-sm px-3 py-1.5 rounded-full">
                <span className="text-sm font-medium">{Math.round(lightboxScale * 100)}%</span>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </AppLayout>
  );
}
