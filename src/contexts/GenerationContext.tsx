import { createContext, useContext, useState, useCallback, useEffect, useRef, ReactNode } from 'react';
import { fetchApi } from '@/lib/api';
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
        const { data: respData, error } = await fetchApi('processing-jobs', { id: jobId });

        if (error) {
          console.error('Global polling error:', error);
          return;
        }

        const data = respData?.data;

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
            setRecentCompletedJobs(prev => [updated, ...prev].slice(0, 10));
            // Generate.tsx handles navigation and toast — just clear after brief delay
            setTimeout(() => setActiveJob(null), 3000);
          } else if (data.status === 'failed' || data.status === 'cancelled') {
            stopPolling();
            // Generate.tsx handles error toast — no duplicate
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
    }, 15 * 60 * 1000);
  }, [stopPolling]);

  // Check for active jobs on mount (resume tracking if user refreshes)
  useEffect(() => {
    if (!user) return;

    const checkActiveJobs = async () => {
      const { data: respData } = await fetchApi('processing-jobs', { active: 'true' });

      const jobs = respData?.data;
      if (jobs && Array.isArray(jobs) && jobs.length > 0) {
        const job = jobs[0];
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
