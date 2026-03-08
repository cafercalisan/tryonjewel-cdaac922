import { useState, useEffect, useCallback, useRef } from 'react';
import { Link } from 'react-router-dom';
import { AppLayout } from '@/components/layout/AppLayout';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Separator } from '@/components/ui/separator';
import { Plus, Download, Trash2, Eye, Image as ImageIcon, ZoomIn, X, ZoomOut, ChevronLeft, ChevronRight, ArrowLeftRight, Pencil, Check } from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';
import { downloadImageAs4kJpeg } from '@/lib/downloadImage';
import { motion, AnimatePresence } from 'framer-motion';
import { VideoGenerateButton } from '@/components/video/VideoGenerateButton';
import { ProgressiveImage } from '@/components/ui/progressive-image';
import { getPublicImageUrl, getThumbnailUrl } from '@/lib/getSignedImageUrl';
import { BeforeAfterComparison } from '@/components/gallery/BeforeAfterComparison';
import { useIsMobile } from '@/hooks/use-mobile';

interface ImageRecord {
  id: string;
  original_image_url: string;
  generated_image_urls: string[];
  status: string;
  created_at: string;
  name: string | null;
  scenes: {
    name_tr: string;
  } | null;
}

export default function Gallery() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const isMobile = useIsMobile();
  const [selectedImage, setSelectedImage] = useState<ImageRecord | null>(null);
  const [selectedVariation, setSelectedVariation] = useState(0);
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [lightboxKey, setLightboxKey] = useState(0);
  const [lightboxScale, setLightboxScale] = useState(1);
  const [signedUrls, setSignedUrls] = useState<Record<string, string[]>>({});
  const [signedOriginalUrls, setSignedOriginalUrls] = useState<Record<string, string>>({});
  const [thumbUrls, setThumbUrls] = useState<Record<string, string[]>>({});
  const [showComparison, setShowComparison] = useState(false);
  const [selectedImageIndex, setSelectedImageIndex] = useState(0);
  const [editingName, setEditingName] = useState(false);
  const [nameValue, setNameValue] = useState('');
  const nameInputRef = useRef<HTMLInputElement>(null);

  const { data: images, isLoading } = useQuery({
    queryKey: ['images', user?.id],
    queryFn: async (): Promise<ImageRecord[]> => {
      const { data, error } = await supabase
        .from('images')
        .select('id, original_image_url, generated_image_urls, status, created_at, name, scenes(name_tr)')
        .eq('user_id', user!.id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data as ImageRecord[];
    },
    enabled: !!user,
  });

  // Convert stored URLs to public URLs + thumbnail URLs (synchronous, zero API calls)
  useEffect(() => {
    if (!images || images.length === 0) return;

    const urlMap: Record<string, string[]> = {};
    const originalUrlMap: Record<string, string> = {};
    const thumbMap: Record<string, string[]> = {};

    for (const image of images) {
      if (image.generated_image_urls?.length > 0) {
        urlMap[image.id] = image.generated_image_urls
          .map(url => getPublicImageUrl(url))
          .filter(Boolean) as string[];
        thumbMap[image.id] = image.generated_image_urls
          .map(url => getThumbnailUrl(url, 400, 500, 60))
          .filter(Boolean) as string[];
      }
      if (image.original_image_url) {
        const pub = getPublicImageUrl(image.original_image_url);
        if (pub) originalUrlMap[image.id] = pub;
      }
    }

    setSignedUrls(urlMap);
    setSignedOriginalUrls(originalUrlMap);
    setThumbUrls(thumbMap);
  }, [images]);

  // Lock body scroll when mobile detail is open
  useEffect(() => {
    if (isMobile && selectedImage) {
      document.body.style.overflow = 'hidden';
      return () => { document.body.style.overflow = ''; };
    }
  }, [isMobile, selectedImage]);

  // Keyboard navigation for gallery
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!selectedImage || lightboxOpen || editingName) return;

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
  }, [selectedImage, lightboxOpen, editingName]);

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

  // Focus name input when editing starts
  useEffect(() => {
    if (editingName && nameInputRef.current) {
      nameInputRef.current.focus();
      nameInputRef.current.select();
    }
  }, [editingName]);

  const getImageUrls = useCallback((image: ImageRecord): string[] => {
    if (signedUrls[image.id] && signedUrls[image.id].length > 0) {
      return signedUrls[image.id];
    }
    return image.generated_image_urls || [];
  }, [signedUrls]);

  const getOriginalUrl = useCallback((image: ImageRecord): string => {
    return signedOriginalUrls[image.id] || image.original_image_url || '';
  }, [signedOriginalUrls]);

  const getThumbUrls = useCallback((image: ImageRecord): string[] => {
    return thumbUrls[image.id] || [];
  }, [thumbUrls]);

  const getDisplayName = (image: ImageRecord): string => {
    return image.name || image.scenes?.name_tr || 'Adsiz Gorsel';
  };

  const deleteMutation = useMutation({
    mutationFn: async (imageId: string) => {
      const { error } = await supabase.from('images').delete().eq('id', imageId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['images', user?.id] });
      toast.success('Gorsel silindi');
      setSelectedImage(null);
    },
    onError: () => {
      toast.error('Gorsel silinirken hata olustu');
    },
  });

  const renameMutation = useMutation({
    mutationFn: async ({ imageId, name }: { imageId: string; name: string }) => {
      const { error } = await supabase.from('images').update({ name: name.trim() || null }).eq('id', imageId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['images', user?.id] });
      toast.success('Gorsel adi guncellendi');
    },
    onError: () => {
      toast.error('Gorsel adi guncellenirken hata olustu');
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

  const handleSaveName = () => {
    if (!selectedImage) return;
    const trimmed = nameValue.trim();
    const currentName = selectedImage.name || '';
    if (trimmed !== currentName) {
      renameMutation.mutate({ imageId: selectedImage.id, name: trimmed });
      setSelectedImage({ ...selectedImage, name: trimmed || null });
    }
    setEditingName(false);
  };

  const handleStartEditing = () => {
    if (!selectedImage) return;
    setNameValue(selectedImage.name || '');
    setEditingName(true);
  };

  const openDetail = (image: ImageRecord, index: number) => {
    setSelectedImage(image);
    setSelectedVariation(0);
    setLightboxOpen(false);
    setLightboxScale(1);
    setLightboxKey(prev => prev + 1);
    setShowComparison(false);
    setSelectedImageIndex(index);
    setEditingName(false);
  };

  const closeDetail = () => {
    setSelectedImage(null);
    setEditingName(false);
  };

  const completedImages = images?.filter(i => i.status === 'completed') || [];

  // ─── Shared detail content (used in both mobile overlay & desktop dialog) ───

  const renderEditableName = () => (
    editingName ? (
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flex: 1 }}>
        <Input
          ref={nameInputRef}
          value={nameValue}
          onChange={(e) => setNameValue(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') handleSaveName();
            if (e.key === 'Escape') setEditingName(false);
          }}
          onBlur={handleSaveName}
          className="h-7 text-base font-semibold"
          placeholder="Gorsel adi girin..."
        />
        <Button size="icon" variant="ghost" className="h-7 w-7 shrink-0" onClick={handleSaveName}>
          <Check className="h-3.5 w-3.5" />
        </Button>
      </div>
    ) : (
      <button
        onClick={handleStartEditing}
        style={{ display: 'flex', alignItems: 'center', gap: 6, textAlign: 'left' }}
        className="hover:text-primary transition-colors"
      >
        <span className="text-base font-semibold">{selectedImage ? getDisplayName(selectedImage) : ''}</span>
        <Pencil className="h-3.5 w-3.5 text-muted-foreground" />
      </button>
    )
  );

  const renderImageArea = (minH: string) => {
    if (!selectedImage) return null;
    return showComparison && getOriginalUrl(selectedImage) ? (
      <BeforeAfterComparison
        beforeImage={getOriginalUrl(selectedImage)}
        afterImage={getImageUrls(selectedImage)[selectedVariation] || ''}
        beforeLabel="Orijinal"
        afterLabel="Sonuc"
        className="w-full rounded-lg"
        style={{ maxHeight: minH }}
      />
    ) : (
      <div
        style={{ width: '100%', minHeight: minH, position: 'relative', borderRadius: 8, overflow: 'hidden', background: 'var(--muted)' }}
        onClick={(e) => { e.stopPropagation(); setLightboxOpen(true); setLightboxScale(1); }}
      >
        {getImageUrls(selectedImage)?.[selectedVariation] ? (
          <ProgressiveImage
            src={getImageUrls(selectedImage)[selectedVariation]}
            alt="Generated jewelry"
            className="w-full h-full object-contain"
            containerClassName="w-full h-full"
            eager
          />
        ) : (
          <div style={{ width: '100%', height: minH, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <ImageIcon className="h-12 w-12 text-muted-foreground" />
          </div>
        )}
        {/* Nav arrows */}
        {getImageUrls(selectedImage).length > 1 && (
          <>
            <Button
              size="icon" variant="secondary"
              style={{ position: 'absolute', left: 8, top: '50%', transform: 'translateY(-50%)', opacity: 0.8 }}
              className="h-8 w-8"
              onClick={(e) => { e.stopPropagation(); const u = getImageUrls(selectedImage); setSelectedVariation(p => p > 0 ? p - 1 : u.length - 1); }}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button
              size="icon" variant="secondary"
              style={{ position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)', opacity: 0.8 }}
              className="h-8 w-8"
              onClick={(e) => { e.stopPropagation(); const u = getImageUrls(selectedImage); setSelectedVariation(p => p < u.length - 1 ? p + 1 : 0); }}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </>
        )}
      </div>
    );
  };

  const renderThumbnails = () => {
    if (!selectedImage) return null;
    const urls = getImageUrls(selectedImage);
    if (urls.length <= 1 && !getOriginalUrl(selectedImage)) return null;
    return (
      <div>
        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2">Varyasyonlar</p>
        <div style={{ display: 'flex', gap: 8, overflowX: 'auto', paddingBottom: 4 }}>
          {getOriginalUrl(selectedImage) && (
            <div style={{ flexShrink: 0 }}>
              <button
                onClick={() => setShowComparison(true)}
                style={{ width: 56, height: 70, borderRadius: 6, overflow: 'hidden', border: showComparison ? '2px solid var(--primary)' : '2px solid var(--muted)', opacity: showComparison ? 1 : 0.6 }}
              >
                <img src={getOriginalUrl(selectedImage)} alt="Orijinal" style={{ width: '100%', height: '100%', objectFit: 'cover' }} loading="lazy" decoding="async" />
              </button>
              <span style={{ display: 'block', textAlign: 'center', fontSize: 9 }} className="text-muted-foreground mt-0.5">Orijinal</span>
            </div>
          )}
          {urls.map((url, index) => (
            <div key={index} style={{ flexShrink: 0 }}>
              <button
                onClick={() => { setSelectedVariation(index); setShowComparison(false); }}
                style={{ width: 56, height: 70, borderRadius: 6, overflow: 'hidden', outline: selectedVariation === index && !showComparison ? '2px solid var(--primary)' : 'none', opacity: selectedVariation === index && !showComparison ? 1 : 0.6 }}
              >
                <img src={url} alt={`Varyasyon ${index + 1}`} style={{ width: '100%', height: '100%', objectFit: 'cover' }} loading="lazy" decoding="async" />
              </button>
            </div>
          ))}
        </div>
      </div>
    );
  };

  const renderActions = (gridCols: number) => {
    if (!selectedImage) return null;
    return (
      <div>
        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2">Aksiyonlar</p>
        <div style={{ display: 'grid', gridTemplateColumns: `repeat(${gridCols}, 1fr)`, gap: 8 }}>
          <Button className="w-full justify-start" size="sm" onClick={(e) => { e.stopPropagation(); const u = getImageUrls(selectedImage); if (u[selectedVariation]) handleDownload(u[selectedVariation], selectedVariation); }}>
            <Download className="mr-2 h-4 w-4" />Indir (4K)
          </Button>
          <Button className="w-full justify-start" size="sm" variant="outline" onClick={(e) => { e.stopPropagation(); setLightboxOpen(true); setLightboxScale(1); }}>
            <ZoomIn className="mr-2 h-4 w-4" />Buyut
          </Button>
          <VideoGenerateButton imageUrl={getImageUrls(selectedImage)[selectedVariation] || ''} variant="outline" size="sm" className="w-full justify-start" />
          {getOriginalUrl(selectedImage) && (
            <Button className="w-full justify-start" size="sm" variant={showComparison ? 'default' : 'outline'} onClick={() => setShowComparison(!showComparison)}>
              <ArrowLeftRight className="mr-2 h-4 w-4" />{showComparison ? 'Kapat' : 'Once/Sonra'}
            </Button>
          )}
          <Button
            className="w-full justify-start"
            style={gridCols > 1 ? { gridColumn: `span ${gridCols}` } : undefined}
            size="sm" variant="destructive"
            onClick={(e) => { e.stopPropagation(); deleteMutation.mutate(selectedImage.id); }}
            disabled={deleteMutation.isPending}
          >
            <Trash2 className="mr-2 h-4 w-4" />Gorseli Sil
          </Button>
        </div>
      </div>
    );
  };

  // ─── Render ───

  return (
    <AppLayout>
      <div className="container py-8 md:py-12 animate-fade-in overflow-x-hidden">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-8">
          <div className="min-w-0">
            <h1 className="text-2xl md:text-3xl font-semibold mb-1">Gorsellerim</h1>
            <p className="text-muted-foreground text-sm">Tum olusturdugunuz gorselleri buradan yonetin</p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <Link to="/olustur">
              <Button size="sm" className="w-full sm:w-auto"><Plus className="mr-2 h-4 w-4" />Yeni Olustur</Button>
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
            <h3 className="text-xl font-semibold mb-2">Henuz gorsel yok</h3>
            <p className="text-muted-foreground mb-6">Ilk mucevher gorselinizi olusturun</p>
            <Link to="/olustur">
              <Button size="lg"><Plus className="mr-2 h-5 w-5" />Ilk Gorselimi Olustur</Button>
            </Link>
          </div>
        ) : (
          <>
            {completedImages.length > 0 && (
              <div>
                <h2 className="text-lg font-medium mb-4">Tamamlanan ({completedImages.length})</h2>
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                  {completedImages.map((image, index) => (
                    <div
                      key={image.id}
                      className={`group relative aspect-[4/5] rounded-xl overflow-hidden bg-muted shadow-luxury cursor-pointer transition-all ${selectedImageIndex === index ? 'ring-2 ring-primary ring-offset-2' : ''}`}
                      onClick={() => openDetail(image, index)}
                    >
                      {getImageUrls(image)?.[0] ? (
                        <ProgressiveImage
                          src={getImageUrls(image)[0]}
                          thumbnailSrc={getThumbUrls(image)?.[0]}
                          alt="Generated jewelry"
                          className="w-full h-full object-cover"
                          containerClassName="w-full h-full"
                        />
                      ) : (
                        <div className="w-full h-full bg-muted flex items-center justify-center">
                          <ImageIcon className="h-8 w-8 text-muted-foreground" />
                        </div>
                      )}
                      <div className="absolute inset-0 bg-foreground/0 group-hover:bg-foreground/40 transition-colors flex items-center justify-center opacity-0 group-hover:opacity-100">
                        <Button size="sm" variant="secondary"><Eye className="mr-2 h-4 w-4" />Goruntule</Button>
                      </div>
                      <div className="absolute bottom-0 left-0 right-0 p-3 bg-gradient-to-t from-foreground/60 to-transparent">
                        <p className="text-sm text-background font-medium truncate">
                          {image.name || image.scenes?.name_tr || (image.generated_image_urls?.length === 3 ? 'Master Paket' : 'Ozel Gorsel')}
                        </p>
                        {image.generated_image_urls?.length > 1 && (
                          <p className="text-xs text-background/70">{image.generated_image_urls.length} varyasyon</p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
                <p className="text-xs text-muted-foreground text-center mt-4">Gorseller arasinda gezinmek icin ok tuslarini kullanin</p>
              </div>
            )}
          </>
        )}

        {/* ═══ MOBILE: Full-screen native overlay (NO Radix Dialog) ═══ */}
        {isMobile && selectedImage && (
          <div
            style={{
              position: 'fixed',
              inset: 0,
              zIndex: 50,
              background: 'hsl(var(--background))',
              display: 'flex',
              flexDirection: 'column',
              overflow: 'hidden',
            }}
          >
            {/* Top bar */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px', flexShrink: 0 }}>
              {renderEditableName()}
              <Button size="icon" variant="ghost" className="h-8 w-8 shrink-0 ml-2" onClick={closeDetail}>
                <X className="h-4 w-4" />
              </Button>
            </div>

            {/* Scrollable content */}
            <div style={{ flex: 1, overflowY: 'auto', WebkitOverflowScrolling: 'touch', padding: '0 12px 24px' }}>
              {/* Image */}
              {renderImageArea('55vh')}

              {/* Variation indicator */}
              {getImageUrls(selectedImage).length > 1 && (
                <p style={{ textAlign: 'center', fontSize: 13, marginTop: 8 }} className="text-muted-foreground">
                  {selectedVariation + 1} / {getImageUrls(selectedImage).length}
                </p>
              )}

              {/* Metadata row */}
              <div style={{ display: 'flex', gap: 16, marginTop: 16, fontSize: 14 }}>
                <p className="text-muted-foreground">
                  <span className="font-medium text-foreground">Sahne:</span> {selectedImage.scenes?.name_tr || 'Ozel'}
                </p>
                <p className="text-muted-foreground">
                  <span className="font-medium text-foreground">Tarih:</span>{' '}
                  {new Date(selectedImage.created_at).toLocaleDateString('tr-TR', { day: 'numeric', month: 'long', year: 'numeric' })}
                </p>
              </div>

              {/* Thumbnails */}
              <div style={{ marginTop: 16 }}>{renderThumbnails()}</div>

              {/* Separator */}
              <Separator className="my-4" />

              {/* Actions: 2-col grid */}
              {renderActions(2)}
            </div>
          </div>
        )}

        {/* ═══ DESKTOP: Radix Dialog (horizontal split panel) ═══ */}
        {!isMobile && (
          <Dialog open={!!selectedImage} onOpenChange={(open) => { if (!open) closeDetail(); }}>
            <DialogContent className="max-w-5xl h-[85vh] p-0 overflow-hidden" style={{ display: 'flex', flexDirection: 'column' }}>
              {selectedImage && (
                <>
                  <DialogHeader className="px-6 pt-5 pb-3 pr-12 shrink-0">
                    <DialogTitle className="text-base flex items-center gap-2">
                      {renderEditableName()}
                    </DialogTitle>
                    <DialogDescription className="sr-only">Gorsel detayi ve aksiyonlar</DialogDescription>
                  </DialogHeader>

                  <div style={{ display: 'flex', flexDirection: 'row', flex: 1, minHeight: 0, overflow: 'hidden' }}>
                    {/* Left: Image */}
                    <div style={{ flex: 1, minWidth: 0, padding: '0 16px 16px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
                      {renderImageArea('100%')}
                    </div>

                    {/* Right: Sidebar */}
                    <div style={{ width: 280, flexShrink: 0, borderLeft: '1px solid hsl(var(--border))', padding: 16, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 16 }}>
                      <div className="space-y-1.5">
                        <p className="text-sm text-muted-foreground"><span className="font-medium text-foreground">Sahne:</span> {selectedImage.scenes?.name_tr || 'Ozel'}</p>
                        <p className="text-sm text-muted-foreground">
                          <span className="font-medium text-foreground">Tarih:</span>{' '}
                          {new Date(selectedImage.created_at).toLocaleDateString('tr-TR', { day: 'numeric', month: 'long', year: 'numeric' })}
                        </p>
                      </div>

                      {renderThumbnails()}
                      <Separator />
                      {renderActions(1)}
                    </div>
                  </div>
                </>
              )}
            </DialogContent>
          </Dialog>
        )}

        {/* Fullscreen Lightbox with Navigation */}
        <AnimatePresence mode="wait">
          {lightboxOpen && selectedImage && getImageUrls(selectedImage)?.[selectedVariation] && (
            <motion.div
              key={`lightbox-${lightboxKey}-${selectedVariation}`}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-[100] bg-background/95 backdrop-blur-md flex items-center justify-center p-4 touch-manipulation"
              onClick={() => { setLightboxOpen(false); setLightboxScale(1); }}
            >
              {getImageUrls(selectedImage).length > 1 && (
                <>
                  <Button size="icon" variant="secondary" className="absolute left-2 sm:left-4 top-1/2 -translate-y-1/2 z-10 h-10 w-10"
                    onClick={(e) => { e.stopPropagation(); const u = getImageUrls(selectedImage); setSelectedVariation(p => p > 0 ? p - 1 : u.length - 1); }}>
                    <ChevronLeft className="h-5 w-5" />
                  </Button>
                  <Button size="icon" variant="secondary" className="absolute right-2 sm:right-4 top-1/2 -translate-y-1/2 z-10 h-10 w-10"
                    onClick={(e) => { e.stopPropagation(); const u = getImageUrls(selectedImage); setSelectedVariation(p => p < u.length - 1 ? p + 1 : 0); }}>
                    <ChevronRight className="h-5 w-5" />
                  </Button>
                </>
              )}

              <div className="absolute top-4 left-4 right-4 flex items-center justify-between z-10">
                <div className="bg-secondary/80 backdrop-blur-sm px-3 py-1.5 rounded-full">
                  <span className="text-sm font-medium">{Math.round(lightboxScale * 100)}%</span>
                </div>
                <div className="flex items-center gap-2">
                  <Button size="icon" variant="secondary" className="h-9 w-9 sm:h-10 sm:w-10" onClick={(e) => { e.stopPropagation(); setLightboxScale(s => Math.max(0.5, s - 0.25)); }}>
                    <ZoomOut className="h-4 w-4" />
                  </Button>
                  <Button size="icon" variant="secondary" className="h-9 w-9 sm:h-10 sm:w-10" onClick={(e) => { e.stopPropagation(); setLightboxScale(s => Math.min(3, s + 0.25)); }}>
                    <ZoomIn className="h-4 w-4" />
                  </Button>
                  <Button size="icon" variant="secondary" className="h-9 w-9 sm:h-10 sm:w-10" onClick={(e) => { e.stopPropagation(); const u = getImageUrls(selectedImage); if (u[selectedVariation]) handleDownload(u[selectedVariation], selectedVariation); }}>
                    <Download className="h-4 w-4" />
                  </Button>
                  <Button size="icon" variant="secondary" className="h-9 w-9 sm:h-10 sm:w-10" onClick={() => { setLightboxOpen(false); setLightboxScale(1); }}>
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              </div>

              <motion.img
                src={getImageUrls(selectedImage)[selectedVariation]}
                alt="Generated jewelry fullscreen"
                initial={{ scale: 0.9 }}
                animate={{ scale: lightboxScale }}
                exit={{ scale: 0.9 }}
                transition={{ type: 'spring', stiffness: 300, damping: 30 }}
                className="max-w-[90vw] max-h-[80vh] object-contain rounded-lg shadow-2xl pinch-zoom-enabled"
                onClick={(e) => e.stopPropagation()}
                onError={(e) => { (e.target as HTMLImageElement).style.opacity = '0'; }}
                drag
                dragConstraints={{ left: -200, right: 200, top: -200, bottom: 200 }}
                dragElastic={0.1}
              />

              {getImageUrls(selectedImage).length > 1 && (
                <div className="absolute bottom-4 left-1/2 -translate-x-1/2 bg-secondary/80 backdrop-blur-sm px-3 py-1.5 rounded-full">
                  <span className="text-sm font-medium">{selectedVariation + 1} / {getImageUrls(selectedImage).length}</span>
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </AppLayout>
  );
}
