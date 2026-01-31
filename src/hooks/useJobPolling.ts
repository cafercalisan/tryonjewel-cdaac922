import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';

export type JobStatus = 'pending' | 'analyzing' | 'generating' | 'completed' | 'failed';

export interface ProcessingJob {
  id: string;
  user_id: string;
  status: JobStatus;
  progress: number;
  current_step: string;
  total_images: number;
  completed_images: number;
  image_record_id: string | null;
  result_urls: string[];
  error_message: string | null;
  refunded: boolean;
  credits_used: number;
  created_at: string;
  updated_at: string;
}

interface UseJobPollingOptions {
  pollingInterval?: number;
  onComplete?: (job: ProcessingJob) => void;
  onError?: (job: ProcessingJob) => void;
  onProgress?: (job: ProcessingJob) => void;
}

export function useJobPolling(
  jobId: string | null,
  options: UseJobPollingOptions = {}
) {
  const {
    pollingInterval = 2000,
    onComplete,
    onError,
    onProgress,
  } = options;

  const [job, setJob] = useState<ProcessingJob | null>(null);
  const [isPolling, setIsPolling] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // Use refs to avoid stale closures in callbacks
  const onCompleteRef = useRef(onComplete);
  const onErrorRef = useRef(onError);
  const onProgressRef = useRef(onProgress);
  
  useEffect(() => {
    onCompleteRef.current = onComplete;
    onErrorRef.current = onError;
    onProgressRef.current = onProgress;
  }, [onComplete, onError, onProgress]);

  const fetchJob = useCallback(async () => {
    if (!jobId) return null;
    
    // Use raw query since types might not be updated yet
    const { data, error: fetchError } = await supabase
      .from('processing_jobs')
      .select('*')
      .eq('id', jobId)
      .single();
    
    if (fetchError) {
      console.error('Job fetch error:', fetchError);
      setError(fetchError.message);
      return null;
    }
    
    // Cast to ProcessingJob type
    return data as unknown as ProcessingJob;
  }, [jobId]);

  const stopPolling = useCallback(() => {
    setIsPolling(false);
  }, []);

  // Realtime subscription for instant updates
  useEffect(() => {
    if (!jobId) return;

    const channel = supabase
      .channel(`job-progress-${jobId}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'processing_jobs',
          filter: `id=eq.${jobId}`
        },
        (payload) => {
          const updatedJob = payload.new as unknown as ProcessingJob;
          setJob(updatedJob);
          
          // Trigger callbacks
          onProgressRef.current?.(updatedJob);
          
          if (updatedJob.status === 'completed') {
            onCompleteRef.current?.(updatedJob);
            stopPolling();
          } else if (updatedJob.status === 'failed') {
            onErrorRef.current?.(updatedJob);
            stopPolling();
          }
        }
      )
      .subscribe();

    return () => {
      channel.unsubscribe();
    };
  }, [jobId, stopPolling]);

  // Polling fallback (in case realtime misses updates)
  useEffect(() => {
    if (!jobId || !isPolling) return;

    const poll = async () => {
      const fetchedJob = await fetchJob();
      if (!fetchedJob) return;
      
      setJob(fetchedJob);
      onProgressRef.current?.(fetchedJob);
      
      if (fetchedJob.status === 'completed') {
        onCompleteRef.current?.(fetchedJob);
        stopPolling();
      } else if (fetchedJob.status === 'failed') {
        onErrorRef.current?.(fetchedJob);
        stopPolling();
      }
    };

    const intervalId = setInterval(poll, pollingInterval);
    
    // Initial fetch
    poll();

    return () => clearInterval(intervalId);
  }, [jobId, isPolling, pollingInterval, fetchJob, stopPolling]);

  // Start polling when jobId changes
  useEffect(() => {
    if (jobId) {
      setIsPolling(true);
      setError(null);
      // Initial fetch
      fetchJob().then((fetchedJob) => {
        if (fetchedJob) {
          setJob(fetchedJob);
        }
      });
    } else {
      setJob(null);
      setIsPolling(false);
    }
  }, [jobId, fetchJob]);

  return {
    job,
    isPolling,
    error,
    stopPolling,
    refetch: fetchJob,
  };
}
