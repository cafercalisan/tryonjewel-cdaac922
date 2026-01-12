import { AppLayout } from '@/components/layout/AppLayout';
import { Button } from '@/components/ui/button';
import { Video, Download, Trash2, Loader2, RefreshCw, Play, X } from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Link } from 'react-router-dom';
import { toast } from 'sonner';
import { motion, AnimatePresence } from 'framer-motion';
import { useState } from 'react';
import { VideoPlayer } from '@/components/video/VideoPlayer';

interface VideoRecord {
  id: string;
  source_image_url: string;
  video_url: string | null;
  status: string;
  error_message: string | null;
  prompt: string | null;
  duration: number;
  aspect_ratio: string;
  created_at: string;
}

export default function Videos() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [selectedVideo, setSelectedVideo] = useState<VideoRecord | null>(null);

  const { data: videos, isLoading } = useQuery({
    queryKey: ['videos', user?.id],
    queryFn: async () => {
      if (!user) return [];
      
      const { data, error } = await supabase
        .from('videos')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data as VideoRecord[];
    },
    enabled: !!user,
    refetchInterval: (query) => {
      const data = query.state.data;
      // Keep polling if any video is processing
      if (data?.some(v => v.status === 'pending' || v.status === 'generating' || v.status === 'processing')) {
        return 5000;
      }
      return false;
    }
  });

  const deleteMutation = useMutation({
    mutationFn: async (videoId: string) => {
      const { error } = await supabase
        .from('videos')
        .delete()
        .eq('id', videoId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['videos'] });
      toast.success('Video silindi');
    },
    onError: () => {
      toast.error('Silme başarısız');
    }
  });

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'completed':
        return <span className="px-2 py-1 text-xs rounded-full bg-green-500/10 text-green-500">Tamamlandı</span>;
      case 'processing':
      case 'generating':
        return <span className="px-2 py-1 text-xs rounded-full bg-primary/10 text-primary flex items-center gap-1">
          <Loader2 className="h-3 w-3 animate-spin" />
          İşleniyor
        </span>;
      case 'pending':
        return <span className="px-2 py-1 text-xs rounded-full bg-yellow-500/10 text-yellow-600">Beklemede</span>;
      case 'error':
        return <span className="px-2 py-1 text-xs rounded-full bg-red-500/10 text-red-500">Hata</span>;
      default:
        return <span className="px-2 py-1 text-xs rounded-full bg-muted text-muted-foreground">{status}</span>;
    }
  };

  const handleDownload = async (videoUrl: string, videoId: string) => {
    try {
      const response = await fetch(videoUrl);
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `jewelry-video-${videoId}.mp4`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      toast.success('Video indirildi');
    } catch (error) {
      toast.error('İndirme başarısız');
    }
  };

  if (!user) {
    return (
      <AppLayout showFooter={false}>
        <div className="container py-12 text-center">
          <Video className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
          <h1 className="text-2xl font-semibold mb-2">Videolarım</h1>
          <p className="text-muted-foreground mb-6">Videolarınızı görmek için giriş yapın</p>
          <Link to="/giris">
            <Button>Giriş Yap</Button>
          </Link>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout showFooter={false}>
      <div className="container py-8 md:py-12">
        <div className="max-w-6xl mx-auto">
          {/* Header */}
          <div className="flex items-center justify-between mb-8">
            <div>
              <h1 className="text-2xl md:text-3xl font-semibold">Videolarım</h1>
              <p className="text-muted-foreground">
                Oluşturduğunuz premium video animasyonları
              </p>
            </div>
            <Link to="/olustur">
              <Button>
                <RefreshCw className="mr-2 h-4 w-4" />
                Yeni Görsel
              </Button>
            </Link>
          </div>

          {/* Loading */}
          {isLoading && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {[1, 2, 3].map(i => (
                <div key={i} className="aspect-[9/16] bg-muted rounded-xl animate-pulse" />
              ))}
            </div>
          )}

          {/* Empty State */}
          {!isLoading && (!videos || videos.length === 0) && (
            <div className="text-center py-16">
              <Video className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
              <h2 className="text-xl font-medium mb-2">Henüz video yok</h2>
              <p className="text-muted-foreground mb-6">
                Görsellerinizi premium slow-motion videolara dönüştürün
              </p>
              <Link to="/olustur">
                <Button>Görsel Oluştur</Button>
              </Link>
            </div>
          )}

          {/* Videos Grid */}
          {videos && videos.length > 0 && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {videos.map((video, index) => (
                <motion.div
                  key={video.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.1 }}
                  className="bg-card rounded-xl overflow-hidden shadow-luxury group"
                >
                  {/* Video/Image Preview */}
                  <div 
                    className="aspect-[9/16] relative bg-muted cursor-pointer"
                    onClick={() => video.status === 'completed' && video.video_url && setSelectedVideo(video)}
                  >
                    {video.status === 'completed' && video.video_url ? (
                      <>
                        <img 
                          src={video.source_image_url} 
                          alt="Video thumbnail"
                          className="w-full h-full object-cover"
                        />
                        <div className="absolute inset-0 flex items-center justify-center bg-foreground/20 opacity-0 group-hover:opacity-100 transition-opacity">
                          <div className="w-14 h-14 rounded-full bg-background/90 flex items-center justify-center">
                            <Play className="h-6 w-6 text-foreground ml-1" fill="currentColor" />
                          </div>
                        </div>
                      </>
                    ) : (
                      <>
                        <img 
                          src={video.source_image_url} 
                          alt="Source image"
                          className="w-full h-full object-cover opacity-50"
                        />
                        {(video.status === 'processing' || video.status === 'generating' || video.status === 'pending') && (
                          <div className="absolute inset-0 flex items-center justify-center">
                            <div className="bg-background/80 backdrop-blur-sm rounded-lg px-4 py-3 flex items-center gap-2">
                              <Loader2 className="h-5 w-5 animate-spin text-primary" />
                              <span className="text-sm">Video oluşturuluyor...</span>
                            </div>
                          </div>
                        )}
                      </>
                    )}
                  </div>

                  {/* Footer */}
                  <div className="p-4">
                    <div className="flex items-center justify-between mb-3">
                      {getStatusBadge(video.status)}
                      <span className="text-xs text-muted-foreground">
                        {new Date(video.created_at).toLocaleDateString('tr-TR')}
                      </span>
                    </div>

                    <div className="flex gap-2">
                      {video.status === 'completed' && video.video_url && (
                        <Button 
                          size="sm" 
                          className="flex-1"
                          onClick={() => handleDownload(video.video_url!, video.id)}
                        >
                          <Download className="mr-1 h-3 w-3" />
                          İndir
                        </Button>
                      )}
                      <Button 
                        size="sm" 
                        variant="outline"
                        onClick={() => deleteMutation.mutate(video.id)}
                        disabled={deleteMutation.isPending}
                      >
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </div>

                    {video.error_message && (
                      <p className="text-xs text-red-500 mt-2">{video.error_message}</p>
                    )}
                  </div>
                </motion.div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Video Player Modal */}
      <AnimatePresence>
        {selectedVideo && selectedVideo.video_url && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] bg-background/95 backdrop-blur-md flex items-center justify-center p-4"
            onClick={() => setSelectedVideo(null)}
          >
            {/* Close Button */}
            <Button
              size="icon"
              variant="secondary"
              className="absolute top-4 right-4 z-10"
              onClick={() => setSelectedVideo(null)}
            >
              <X className="h-5 w-5" />
            </Button>

            {/* Video Player */}
            <div 
              className="w-full max-w-md"
              onClick={(e) => e.stopPropagation()}
            >
              <VideoPlayer
                src={selectedVideo.video_url}
                poster={selectedVideo.source_image_url}
                autoPlay
                loop
                onDownload={() => handleDownload(selectedVideo.video_url!, selectedVideo.id)}
                className="w-full aspect-[9/16]"
              />
              
              <div className="mt-4 text-center">
                <p className="text-sm text-muted-foreground">
                  {new Date(selectedVideo.created_at).toLocaleDateString('tr-TR', {
                    day: 'numeric',
                    month: 'long',
                    year: 'numeric'
                  })}
                </p>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </AppLayout>
  );
}
