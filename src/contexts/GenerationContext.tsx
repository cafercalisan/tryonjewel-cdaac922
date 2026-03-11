import { createContext, useContext, useState, useCallback, useEffect, useRef, ReactNode } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';

interface ActiveJob {
  jobId: string;
  imageId: string;
  status: string;
  currentStep: string | null;
  progress: number;
  completedImages: number;
  totalImages: number;
  resultUrls: string[] | null;
  selectedScenes: string[];
}

interface GenerationContextType {
  activeJob: ActiveJob | null;
  startTracking: (jobId: string, imageId: string, selectedScenes?: string[]) => void;
  stopTracking: () => void;
  recentCompletedJobs: ActiveJob[];
}

const GenerationContext = createContext<GenerationContextType>({
  activeJob: null,
  startTracking: () => {},
  stopTracking: () => {},
  recentCompletedJobs: [],
});

export function useGenerationContext() {
  return useContext(GenerationContext);
}

export function GenerationProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [activeJob, setActiveJob] = useState<ActiveJob | null>(null);
  const [recentCompletedJobs, setRecentCompletedJobs] = useState<ActiveJob[]>([]);
  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const pollingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const stopPolling = useCallback(() => {
    if (pollingRef.current) {
      clearInterval(pollingRef.current);
      pollingRef.current = null;
    }
    if (pollingTimeoutRef.current) {
      clearTimeout(pollingTimeoutRef.current);
      pollingTimeoutRef.current = null;
    }
  }, []);

  const stopTracking = useCallback(() => {
    stopPolling();
    setActiveJob(null);
  }, [stopPolling]);

  const startTracking = useCallback((jobId: string, imageId: string, selectedScenes: string[] = []) => {
    stopPolling();

    const job: ActiveJob = {
      jobId,
      imageId,
      status: 'pending',
      currentStep: 'pending',
      progress: 0,
      completedImages: 0,
      totalImages: 3,
      resultUrls: null,
      selectedScenes,
    };
    setActiveJob(job);

    pollingRef.current = setInterval(async () => {
      try {
        const { data, error } = await supabase
          .from('processing_jobs')
          .select('status, result_urls, error_message, current_step, progress, completed_images, total_images')
          .eq('id', jobId)
          .single();

        if (error) {
          console.error('Global polling error:', error);
          return;
        }

        if (data) {
          const updated: ActiveJob = {
            jobId,
            imageId,
            status: data.status,
            currentStep: data.current_step,
            progress: data.progress || 0,
            completedImages: data.completed_images || 0,
            totalImages: data.total_images || 3,
            resultUrls: data.result_urls,
            selectedScenes,
          };
          setActiveJob(updated);

          if (data.status === 'completed') {
            stopPolling();
            toast.success('Üretiminiz tamamlandı!', {
              action: {
                label: 'Sonuçları Gör',
                onClick: () => {
                  window.location.href = `/sonuclar?id=${imageId}`;
                },
              },
            });
            setRecentCompletedJobs(prev => [updated, ...prev].slice(0, 10));
            setTimeout(() => setActiveJob(null), 3000);
          } else if (data.status === 'failed' || data.status === 'cancelled') {
            stopPolling();
            if (data.status === 'failed') {
              toast.error(data.error_message || 'Üretim sırasında bir hata oluştu.');
            }
            setActiveJob(null);
          }
        }
      } catch (err) {
        console.error('Global polling exception:', err);
      }
    }, 2000);

    // 5-minute timeout safety
    pollingTimeoutRef.current = setTimeout(() => {
      stopPolling();
      toast.error('Üretim zaman aşımına uğradı.');
      setActiveJob(null);
    }, 5 * 60 * 1000);
  }, [stopPolling]);

  // Check for active jobs on mount (resume tracking if user refreshes)
  useEffect(() => {
    if (!user) return;

    const checkActiveJobs = async () => {
      const { data } = await supabase
        .from('processing_jobs')
        .select('id, image_record_id, status, current_step, progress, completed_images, total_images, result_urls')
        .eq('user_id', user.id)
        .in('status', ['pending', 'generating'])
        .order('created_at', { ascending: false })
        .limit(1);

      if (data && data.length > 0) {
        const job = data[0];
        startTracking(job.id, job.image_record_id, []);
      }
    };

    checkActiveJobs();
  }, [user, startTracking]);

  // Cleanup on unmount
  useEffect(() => {
    return () => stopPolling();
  }, [stopPolling]);

  return (
    <GenerationContext.Provider value={{ activeJob, startTracking, stopTracking, recentCompletedJobs }}>
      {children}
    </GenerationContext.Provider>
  );
}
