import { useEffect, useRef, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useQueryClient } from '@tanstack/react-query';

interface Video {
  id: string;
  status: string;
  operation_id?: string | null;
}

export function useVideoStatusPolling(videos: Video[] | undefined, userId: string | undefined) {
  const queryClient = useQueryClient();
  const pollingRef = useRef<Map<string, NodeJS.Timeout>>(new Map());
  const isPollingRef = useRef<Set<string>>(new Set());

  const checkVideoStatus = useCallback(async (videoId: string) => {
    if (isPollingRef.current.has(videoId)) {
      return; // Already polling this video
    }

    isPollingRef.current.add(videoId);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        console.log('No session, stopping poll for', videoId);
        isPollingRef.current.delete(videoId);
        return;
      }

      console.log('Checking status for video:', videoId);

      const { data, error } = await supabase.functions.invoke('check-video-status', {
        body: { videoId }
      });

      if (error) {
        console.error('Error checking video status:', error);
        isPollingRef.current.delete(videoId);
        return;
      }

      console.log('Video status response:', data);

      // Invalidate query to refresh the list
      queryClient.invalidateQueries({ queryKey: ['videos', userId] });

      // If video is still processing, continue polling
      if (data?.status === 'processing' || data?.status === 'generating') {
        // Schedule next poll in 8 seconds
        const timeoutId = setTimeout(() => {
          isPollingRef.current.delete(videoId);
          checkVideoStatus(videoId);
        }, 8000);
        
        pollingRef.current.set(videoId, timeoutId);
      } else {
        // Video completed or errored, stop polling
        isPollingRef.current.delete(videoId);
        pollingRef.current.delete(videoId);
      }
    } catch (err) {
      console.error('Polling error:', err);
      isPollingRef.current.delete(videoId);
    }
  }, [queryClient, userId]);

  useEffect(() => {
    if (!videos || !userId) return;

    // Find videos that are processing and have operation_id
    const processingVideos = videos.filter(
      v => (v.status === 'processing' || v.status === 'generating') && v.operation_id
    );

    // Start polling for each processing video
    processingVideos.forEach(video => {
      if (!pollingRef.current.has(video.id) && !isPollingRef.current.has(video.id)) {
        // Start initial poll after 3 seconds
        const timeoutId = setTimeout(() => {
          checkVideoStatus(video.id);
        }, 3000);
        pollingRef.current.set(video.id, timeoutId);
      }
    });

    // Cleanup function
    return () => {
      pollingRef.current.forEach((timeoutId) => {
        clearTimeout(timeoutId);
      });
      pollingRef.current.clear();
      isPollingRef.current.clear();
    };
  }, [videos, userId, checkVideoStatus]);

  // Expose manual check function
  const manualCheck = useCallback((videoId: string) => {
    isPollingRef.current.delete(videoId);
    checkVideoStatus(videoId);
  }, [checkVideoStatus]);

  return { manualCheck };
}
