import { AppLayout } from '@/components/layout/AppLayout';
import { useGenerationContext } from '@/contexts/GenerationContext';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { Sparkles, Loader2, CheckCircle2, Clock, Plus, Image as ImageIcon, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { motion } from 'framer-motion';
import { ProgressiveImage } from '@/components/ui/progressive-image';
import { getThumbnailUrl } from '@/lib/getSignedImageUrl';

export default function Studio() {
  const { user } = useAuth();
  const { activeJob } = useGenerationContext();

  const { data: recentJobs = [] } = useQuery({
    queryKey: ['recent-jobs', user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('processing_jobs')
        .select('id, status, current_step, progress, completed_images, total_images, result_urls, error_message, created_at, image_record_id')
        .eq('user_id', user!.id)
        .order('created_at', { ascending: false })
        .limit(20);
      if (error) throw error;
      return data;
    },
    enabled: !!user,
    refetchInterval: activeJob ? 3000 : 30000,
  });

  const statusIcon = (status: string) => {
    switch (status) {
      case 'completed': return <CheckCircle2 className="h-4 w-4 text-green-500" />;
      case 'failed': return <AlertCircle className="h-4 w-4 text-red-500" />;
      case 'cancelled': return <AlertCircle className="h-4 w-4 text-yellow-500" />;
      case 'pending':
      case 'generating': return <Loader2 className="h-4 w-4 animate-spin" style={{ color: 'hsl(38, 45%, 55%)' }} />;
      default: return <Clock className="h-4 w-4 text-muted-foreground" />;
    }
  };

  const statusLabel = (status: string) => {
    switch (status) {
      case 'completed': return 'Tamamlandı';
      case 'failed': return 'Hata';
      case 'cancelled': return 'İptal Edildi';
      case 'pending': return 'Kuyrukta';
      case 'generating': return 'Oluşturuluyor';
      default: return status;
    }
  };

  const formatTime = (dateStr: string) => {
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMin = Math.floor(diffMs / 60000);
    if (diffMin < 1) return 'Az önce';
    if (diffMin < 60) return `${diffMin} dk önce`;
    const diffHours = Math.floor(diffMin / 60);
    if (diffHours < 24) return `${diffHours} saat önce`;
    return date.toLocaleDateString('tr-TR', { day: 'numeric', month: 'short' });
  };

  return (
    <AppLayout showFooter={false}>
      <div className="container py-6 md:py-10 max-w-3xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight flex items-center gap-2">
              <Sparkles className="h-6 w-6" style={{ color: 'hsl(38, 45%, 55%)' }} />
              Stüdyo
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              Üretimlerinizi takip edin
            </p>
          </div>
          <Link to="/olustur">
            <Button className="gradient-gold text-white rounded-full gap-2">
              <Plus className="h-4 w-4" />
              Yeni Üretim
            </Button>
          </Link>
        </div>

        {/* Active Generation */}
        {activeJob && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-6 p-4 rounded-2xl border-2"
            style={{ borderColor: 'hsl(38, 45%, 55%)', background: 'rgba(196, 165, 90, 0.05)' }}
          >
            <div className="flex items-center gap-3 mb-3">
              <Loader2 className="h-5 w-5 animate-spin" style={{ color: 'hsl(38, 45%, 55%)' }} />
              <span className="font-semibold">Aktif Üretim</span>
              <span className="ml-auto text-sm font-medium" style={{ color: 'hsl(38, 45%, 55%)' }}>
                {activeJob.progress}%
              </span>
            </div>
            <div className="h-2 bg-muted rounded-full overflow-hidden">
              <motion.div
                className="h-full rounded-full gradient-gold"
                animate={{ width: `${Math.min(activeJob.progress, 95)}%` }}
                transition={{ duration: 0.5 }}
              />
            </div>
            <div className="flex justify-between mt-2 text-xs text-muted-foreground">
              <span>
                {activeJob.currentStep === 'analyzing' ? 'Analiz ediliyor...' :
                 activeJob.currentStep?.startsWith('generating') ? 'Görsel oluşturuluyor...' :
                 activeJob.currentStep === 'saving' ? 'Kaydediliyor...' :
                 'Kuyrukta...'}
              </span>
              <span>{activeJob.completedImages}/{activeJob.totalImages} görsel</span>
            </div>
          </motion.div>
        )}

        {/* Recent Jobs */}
        <div className="space-y-3">
          {recentJobs.length === 0 ? (
            <div className="text-center py-16">
              <ImageIcon className="h-12 w-12 text-muted-foreground/30 mx-auto mb-4" />
              <p className="text-muted-foreground">Henüz üretim yok</p>
              <Link to="/olustur" className="mt-4 inline-block">
                <Button variant="outline" className="rounded-full gap-2">
                  <Plus className="h-4 w-4" />
                  İlk Üretimini Başlat
                </Button>
              </Link>
            </div>
          ) : (
            recentJobs.map((job) => (
              <motion.div
                key={job.id}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="flex items-center gap-4 p-4 rounded-xl border border-border bg-card/50 hover:bg-card/80 transition-colors"
              >
                {/* Thumbnail or placeholder */}
                <div className="w-14 h-14 rounded-lg bg-muted/50 flex items-center justify-center flex-shrink-0 overflow-hidden">
                  {job.status === 'completed' && job.result_urls?.[0] ? (
                    <ProgressiveImage
                      src={job.result_urls[0]}
                      thumbnailSrc={getThumbnailUrl(job.result_urls[0], 56, 56, 50) || undefined}
                      alt=""
                      className="w-full h-full object-cover"
                      containerClassName="w-full h-full"
                    />
                  ) : (
                    <ImageIcon className="h-6 w-6 text-muted-foreground/30" />
                  )}
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    {statusIcon(job.status)}
                    <span className="text-sm font-medium">{statusLabel(job.status)}</span>
                    {(job.status === 'pending' || job.status === 'generating') && (
                      <span className="text-xs" style={{ color: 'hsl(38, 45%, 55%)' }}>{job.progress || 0}%</span>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5 truncate">
                    {job.status === 'completed' ? `${job.completed_images || job.total_images} görsel` :
                     job.status === 'failed' ? (job.error_message || 'Hata oluştu') :
                     job.status === 'cancelled' ? 'İptal edildi' :
                     `${job.completed_images || 0}/${job.total_images || 3} görsel`}
                  </p>
                </div>

                <div className="flex items-center gap-3 flex-shrink-0">
                  <span className="text-xs text-muted-foreground">{formatTime(job.created_at)}</span>
                  {job.status === 'completed' && (
                    <Link to={`/sonuclar?id=${job.image_record_id}`}>
                      <Button variant="ghost" size="sm" className="text-xs rounded-full">
                        Görüntüle
                      </Button>
                    </Link>
                  )}
                </div>
              </motion.div>
            ))
          )}
        </div>
      </div>
    </AppLayout>
  );
}
