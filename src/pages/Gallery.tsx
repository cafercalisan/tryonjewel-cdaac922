import { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { AppLayout } from '@/components/layout/AppLayout';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Plus, Download, Trash2, Eye, Image as ImageIcon, Loader2, ZoomIn, X, ZoomOut, Video, ChevronLeft, ChevronRight, ArrowLeftRight } from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';
import { downloadImageAs4kJpeg } from '@/lib/downloadImage';
import { motion, AnimatePresence } from 'framer-motion';
import { VideoGenerateButton } from '@/components/video/VideoGenerateButton';
import { getSignedImageUrl } from '@/lib/getSignedImageUrl';
import { BeforeAfterComparison } from '@/components/gallery/BeforeAfterComparison';
import { ImageNavigator } from '@/components/gallery/ImageNavigator';

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
  const [lightboxKey, setLightboxKey] = useState(0);
  const [lightboxScale, setLightboxScale] = useState(1);
  const [signedUrls, setSignedUrls] = useState<Record<string, string[]>>({});
  const [signedOriginalUrls, setSignedOriginalUrls] = useState<Record<string, string>>({});
  const [showComparison, setShowComparison] = useState(false);
  const [selectedImageIndex, setSelectedImageIndex] = useState(0);

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

  // Load signed URLs for images
  useEffect(() => {
    if (!images || images.length === 0) return;
    
    const loadSignedUrls = async () => {
      const urlMap: Record<string, string[]> = {};
      const originalUrlMap: Record<string, string> = {};
      
      await Promise.all(
        images.map(async (image) => {
          // Sign generated images
          if (image.generated_image_urls && image.generated_image_urls.length > 0) {
            const signedImageUrls = await Promise.all(
              image.generated_image_urls.map(url => getSignedImageUrl(url))
            );
            urlMap[image.id] = signedImageUrls.filter(Boolean) as string[];
          }
          
          // Sign original image
          if (image.original_image_url) {
            const signedOriginal = await getSignedImageUrl(image.original_image_url);
            if (signedOriginal) {
              originalUrlMap[image.id] = signedOriginal;
            }
          }
        })
      );
      
      setSignedUrls(urlMap);
      setSignedOriginalUrls(originalUrlMap);
    };
    
    loadSignedUrls();
  }, [images]);

  // Keyboard navigation for gallery
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!selectedImage || lightboxOpen) return;
      
      const urls = getImageUrls(selectedImage);
      if (e.key === 'ArrowLeft') {
        e.preventDefault();
        setSelectedVariation(prev => prev > 0 ? prev - 1 : urls.length - 1);
      } else if (e.key === 'ArrowRight') {
        e.preventDefault();
        setSelectedVariation(prev => prev < urls.length - 1 ? prev + 1 : 0);
      } else if (e.key === 'Escape') {
        setSelectedImage(null);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedImage, lightboxOpen]);

  // Gallery-level keyboard navigation
  useEffect(() => {
    const handleGalleryKeyDown = (e: KeyboardEvent) => {
      if (selectedImage || !completedImages.length) return;
      
      if (e.key === 'ArrowLeft') {
        e.preventDefault();
        setSelectedImageIndex(prev => prev > 0 ? prev - 1 : completedImages.length - 1);
      } else if (e.key === 'ArrowRight') {
        e.preventDefault();
        setSelectedImageIndex(prev => prev < completedImages.length - 1 ? prev + 1 : 0);
      } else if (e.key === 'Enter') {
        const img = completedImages[selectedImageIndex];
        if (img) {
          setSelectedImage(img);
          setSelectedVariation(0);
        }
      }
    };

    window.addEventListener('keydown', handleGalleryKeyDown);
    return () => window.removeEventListener('keydown', handleGalleryKeyDown);
  }, [selectedImage, selectedImageIndex]);

  // Helper to get image URLs for an image record
  const getImageUrls = useCallback((image: ImageRecord): string[] => {
    if (signedUrls[image.id] && signedUrls[image.id].length > 0) {
      return signedUrls[image.id];
    }
    return image.generated_image_urls || [];
  }, [signedUrls]);

  // Helper to get original image URL
  const getOriginalUrl = useCallback((image: ImageRecord): string => {
    return signedOriginalUrls[image.id] || image.original_image_url || '';
  }, [signedOriginalUrls]);

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

  // Only show completed images
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
          <div className="flex items-center gap-2">
            {completedImages.length > 1 && (
              <ImageNavigator
                currentIndex={selectedImageIndex}
                totalImages={completedImages.length}
                onNavigate={setSelectedImageIndex}
                showArrows={false}
              />
            )}
            <Link to="/olustur">
              <Button>
                <Plus className="mr-2 h-4 w-4" />
                Yeni Oluştur
              </Button>
            </Link>
          </div>
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
                  {completedImages.map((image, index) => (
                    <div 
                      key={image.id}
                      className={`group relative aspect-[4/5] rounded-xl overflow-hidden bg-muted shadow-luxury cursor-pointer transition-all ${
                        selectedImageIndex === index ? 'ring-2 ring-primary ring-offset-2' : ''
                      }`}
                      onClick={() => {
                        setSelectedImage(image);
                        setSelectedVariation(0);
                        setLightboxOpen(false);
                        setLightboxScale(1);
                        setLightboxKey(prev => prev + 1);
                        setShowComparison(false);
                        setSelectedImageIndex(index);
                      }}
                    >
                      {getImageUrls(image)?.[0] && (
                        <img 
                          src={getImageUrls(image)[0]} 
                          alt="Generated jewelry"
                          className="w-full h-full object-cover"
                          onError={(e) => {
                            (e.target as HTMLImageElement).style.display = 'none';
                          }}
                        />
                      )}
                      <div className="absolute inset-0 bg-foreground/0 group-hover:bg-foreground/40 transition-colors flex items-center justify-center opacity-0 group-hover:opacity-100">
                        <Button size="sm" variant="secondary">
                          <Eye className="mr-2 h-4 w-4" />
                          Görüntüle
                        </Button>
                      </div>
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
                
                {/* Keyboard hint */}
                <p className="text-xs text-muted-foreground text-center mt-4">
                  💡 Görseller arasında gezinmek için ← → ok tuşlarını kullanın
                </p>
              </div>
            )}
          </>
        )}

        {/* Detail Modal with Before/After */}
        <Dialog open={!!selectedImage} onOpenChange={() => setSelectedImage(null)}>
          <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="text-base flex items-center justify-between">
                <span>{selectedImage?.scenes?.name_tr || 'Görsel Detayı'}</span>
                {selectedImage && getOriginalUrl(selectedImage) && (
                  <Button
                    size="sm"
                    variant={showComparison ? 'default' : 'outline'}
                    onClick={() => setShowComparison(!showComparison)}
                    className="text-xs"
                  >
                    <ArrowLeftRight className="mr-1.5 h-3.5 w-3.5" />
                    {showComparison ? 'Karşılaştırmayı Kapat' : 'Önce/Sonra'}
                  </Button>
                )}
              </DialogTitle>
              <DialogDescription>
                Görsellerinizi büyütebilir, karşılaştırabilir ve indirebilirsiniz. Ok tuşları ile gezinin.
              </DialogDescription>
            </DialogHeader>
            
            {selectedImage && (
              <div className="space-y-4">
                {/* Comparison Mode or Normal View */}
                {showComparison && getOriginalUrl(selectedImage) ? (
                  <BeforeAfterComparison
                    beforeImage={getOriginalUrl(selectedImage)}
                    afterImage={getImageUrls(selectedImage)[selectedVariation] || ''}
                    beforeLabel="Orijinal"
                    afterLabel="Sonuç"
                    className="aspect-[4/5] max-h-[55vh]"
                  />
                ) : (
                  <div 
                    className="aspect-[4/5] max-h-[55vh] rounded-lg overflow-hidden bg-muted cursor-zoom-in group relative mx-auto"
                    onClick={(e) => {
                      e.stopPropagation();
                      setLightboxOpen(true);
                      setLightboxScale(1);
                    }}
                  >
                    {getImageUrls(selectedImage)?.[selectedVariation] && (
                      <img 
                        src={getImageUrls(selectedImage)[selectedVariation]} 
                        alt="Generated jewelry"
                        className="w-full h-full object-contain"
                      />
                    )}
                    <div className="absolute inset-0 bg-foreground/0 group-hover:bg-foreground/20 transition-colors flex items-center justify-center opacity-0 group-hover:opacity-100">
                      <ZoomIn className="h-6 w-6 text-white drop-shadow-lg" />
                    </div>
                    
                    {/* Navigation arrows on image */}
                    {getImageUrls(selectedImage).length > 1 && (
                      <>
                        <Button
                          size="icon"
                          variant="secondary"
                          className="absolute left-2 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-opacity h-8 w-8"
                          onClick={(e) => {
                            e.stopPropagation();
                            const urls = getImageUrls(selectedImage);
                            setSelectedVariation(prev => prev > 0 ? prev - 1 : urls.length - 1);
                          }}
                        >
                          <ChevronLeft className="h-4 w-4" />
                        </Button>
                        <Button
                          size="icon"
                          variant="secondary"
                          className="absolute right-2 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-opacity h-8 w-8"
                          onClick={(e) => {
                            e.stopPropagation();
                            const urls = getImageUrls(selectedImage);
                            setSelectedVariation(prev => prev < urls.length - 1 ? prev + 1 : 0);
                          }}
                        >
                          <ChevronRight className="h-4 w-4" />
                        </Button>
                      </>
                    )}
                  </div>
                )}
                
                {/* Thumbnails with Original */}
                {(getImageUrls(selectedImage)?.length > 1 || getOriginalUrl(selectedImage)) && (
                  <div className="flex justify-center gap-2 flex-wrap">
                    {/* Original thumbnail */}
                    {getOriginalUrl(selectedImage) && (
                      <div className="relative">
                        <button
                          onClick={() => setShowComparison(true)}
                          className={`w-16 h-20 rounded-md overflow-hidden transition-all border-2 ${
                            showComparison ? 'border-primary scale-105' : 'border-muted opacity-60 hover:opacity-100'
                          }`}
                        >
                          <img 
                            src={getOriginalUrl(selectedImage)} 
                            alt="Orijinal" 
                            className="w-full h-full object-cover" 
                          />
                        </button>
                        <span className="absolute -bottom-4 left-1/2 -translate-x-1/2 text-[10px] text-muted-foreground">
                          Orijinal
                        </span>
                      </div>
                    )}
                    
                    {/* Generated thumbnails */}
                    {getImageUrls(selectedImage).map((url, index) => (
                      <div key={index} className="relative">
                        <button
                          onClick={() => {
                            setSelectedVariation(index);
                            setShowComparison(false);
                          }}
                          className={`w-16 h-20 rounded-md overflow-hidden transition-all ${
                            selectedVariation === index && !showComparison 
                              ? 'ring-2 ring-primary scale-105' 
                              : 'opacity-60 hover:opacity-100'
                          }`}
                        >
                          <img src={url} alt={`Varyasyon ${index + 1}`} className="w-full h-full object-cover" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}

                {/* Actions */}
                <div className="flex items-center justify-center gap-2 pt-2 flex-wrap">
                  <Button 
                    size="sm"
                    onClick={(e) => {
                      e.stopPropagation();
                      const urls = getImageUrls(selectedImage);
                      if (urls[selectedVariation]) {
                        handleDownload(urls[selectedVariation], selectedVariation);
                      }
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
                  <VideoGenerateButton 
                    imageUrl={getImageUrls(selectedImage)[selectedVariation] || ''}
                    variant="outline"
                    size="sm"
                  />
                  
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
                  })} • ← → tuşları ile gezinin
                </p>
              </div>
            )}
          </DialogContent>
        </Dialog>

        {/* Fullscreen Lightbox with Navigation */}
        <AnimatePresence mode="wait">
          {lightboxOpen && selectedImage && getImageUrls(selectedImage)?.[selectedVariation] && (
            <motion.div
              key={`lightbox-${lightboxKey}-${selectedVariation}`}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-[100] bg-background/95 backdrop-blur-md flex items-center justify-center p-4"
              onClick={() => {
                setLightboxOpen(false);
                setLightboxScale(1);
              }}
            >
              {/* Navigation arrows */}
              {getImageUrls(selectedImage).length > 1 && (
                <>
                  <Button
                    size="icon"
                    variant="secondary"
                    className="absolute left-4 top-1/2 -translate-y-1/2 z-10"
                    onClick={(e) => {
                      e.stopPropagation();
                      const urls = getImageUrls(selectedImage);
                      setSelectedVariation(prev => prev > 0 ? prev - 1 : urls.length - 1);
                    }}
                  >
                    <ChevronLeft className="h-5 w-5" />
                  </Button>
                  <Button
                    size="icon"
                    variant="secondary"
                    className="absolute right-4 top-1/2 -translate-y-1/2 z-10"
                    onClick={(e) => {
                      e.stopPropagation();
                      const urls = getImageUrls(selectedImage);
                      setSelectedVariation(prev => prev < urls.length - 1 ? prev + 1 : 0);
                    }}
                  >
                    <ChevronRight className="h-5 w-5" />
                  </Button>
                </>
              )}

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
                    const urls = getImageUrls(selectedImage);
                    if (urls[selectedVariation]) {
                      handleDownload(urls[selectedVariation], selectedVariation);
                    }
                  }}
                >
                  <Download className="h-4 w-4" />
                </Button>
                <Button
                  size="icon"
                  variant="secondary"
                  onClick={() => {
                    setLightboxOpen(false);
                    setLightboxScale(1);
                  }}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>

              {/* Image */}
              <motion.img
                src={getImageUrls(selectedImage)[selectedVariation]}
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

              {/* Scale and variation indicator */}
              <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex items-center gap-4">
                <div className="bg-secondary/80 backdrop-blur-sm px-3 py-1.5 rounded-full">
                  <span className="text-sm font-medium">{Math.round(lightboxScale * 100)}%</span>
                </div>
                {getImageUrls(selectedImage).length > 1 && (
                  <div className="bg-secondary/80 backdrop-blur-sm px-3 py-1.5 rounded-full">
                    <span className="text-sm font-medium">
                      {selectedVariation + 1} / {getImageUrls(selectedImage).length}
                    </span>
                  </div>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </AppLayout>
  );
}
