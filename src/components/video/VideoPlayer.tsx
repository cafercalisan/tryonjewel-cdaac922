import { useState, useRef, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Play, Pause, Volume2, VolumeX, Maximize, Download, RotateCcw, AlertCircle } from 'lucide-react';
import { motion } from 'framer-motion';

interface VideoPlayerProps {
  src: string;
  poster?: string;
  className?: string;
  autoPlay?: boolean;
  loop?: boolean;
  onDownload?: () => void;
}

export function VideoPlayer({ 
  src, 
  poster, 
  className = '', 
  autoPlay = false,
  loop = true,
  onDownload 
}: VideoPlayerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isMuted, setIsMuted] = useState(true);
  const [progress, setProgress] = useState(0);
  const [showControls, setShowControls] = useState(true);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [hasError, setHasError] = useState(false);
  const [isLoaded, setIsLoaded] = useState(false);
  const [blobSrc, setBlobSrc] = useState<string | null>(null);

  // Fetch video as blob to bypass CORS restrictions
  useEffect(() => {
    let cancelled = false;
    setHasError(false);
    setIsLoaded(false);
    setBlobSrc(null);

    async function fetchVideo() {
      try {
        const response = await fetch(src);
        if (!response.ok) throw new Error('Failed to fetch video');
        const blob = await response.blob();
        if (cancelled) return;
        const url = URL.createObjectURL(blob);
        setBlobSrc(url);
      } catch (err) {
        console.error('Video fetch error:', err);
        if (!cancelled) setHasError(true);
      }
    }

    fetchVideo();
    return () => {
      cancelled = true;
      if (blobSrc) URL.revokeObjectURL(blobSrc);
    };
  }, [src]);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const handleTimeUpdate = () => {
      const prog = (video.currentTime / video.duration) * 100;
      setProgress(isNaN(prog) ? 0 : prog);
    };

    const handleEnded = () => {
      if (!loop) setIsPlaying(false);
    };

    const handleCanPlay = () => {
      setIsLoaded(true);
      setHasError(false);
      if (autoPlay) {
        video.play().then(() => setIsPlaying(true)).catch(() => {});
      }
    };

    const handleError = () => {
      setHasError(true);
      setIsPlaying(false);
    };

    video.addEventListener('timeupdate', handleTimeUpdate);
    video.addEventListener('ended', handleEnded);
    video.addEventListener('canplay', handleCanPlay);
    video.addEventListener('error', handleError);

    return () => {
      video.removeEventListener('timeupdate', handleTimeUpdate);
      video.removeEventListener('ended', handleEnded);
      video.removeEventListener('canplay', handleCanPlay);
      video.removeEventListener('error', handleError);
    };
  }, [loop, autoPlay, blobSrc]);

  useEffect(() => {
    const video = videoRef.current;
    if (!video || !isLoaded) return;

    if (isPlaying) {
      video.play().catch(() => setIsPlaying(false));
    } else {
      video.pause();
    }
  }, [isPlaying, isLoaded]);

  useEffect(() => {
    if (videoRef.current) {
      videoRef.current.muted = isMuted;
    }
  }, [isMuted]);

  const togglePlay = () => setIsPlaying(!isPlaying);
  const toggleMute = () => setIsMuted(!isMuted);
  
  const handleRestart = () => {
    if (videoRef.current) {
      videoRef.current.currentTime = 0;
      setIsPlaying(true);
    }
  };

  const handleFullscreen = () => {
    if (!containerRef.current) return;
    
    if (!document.fullscreenElement) {
      containerRef.current.requestFullscreen();
      setIsFullscreen(true);
    } else {
      document.exitFullscreen();
      setIsFullscreen(false);
    }
  };

  const handleProgressClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!videoRef.current) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const pos = (e.clientX - rect.left) / rect.width;
    videoRef.current.currentTime = pos * videoRef.current.duration;
  };

  return (
    <div 
      ref={containerRef}
      className={`relative group bg-black rounded-xl overflow-hidden ${className}`}
      onMouseEnter={() => setShowControls(true)}
      onMouseLeave={() => setShowControls(!isPlaying)}
    >
      {blobSrc && (
        <video
          ref={videoRef}
          src={blobSrc}
          poster={poster}
          loop={loop}
          muted={isMuted}
          playsInline
          preload="auto"
          className="w-full h-full object-contain"
          onClick={togglePlay}
        />
      )}

      {/* Loading state */}
      {!isLoaded && !hasError && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/50">
          <div className="flex flex-col items-center gap-2">
            <div className="w-8 h-8 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            <span className="text-xs text-white/70">Video yukleniyor...</span>
          </div>
        </div>
      )}

      {/* Error state */}
      {hasError && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/60">
          <div className="flex flex-col items-center gap-3 text-center px-4">
            <AlertCircle className="h-8 w-8 text-red-400" />
            <p className="text-sm text-white/80">Video oynatılamadı</p>
            {onDownload && (
              <Button size="sm" variant="secondary" onClick={onDownload}>
                <Download className="mr-1 h-3 w-3" />
                Videoyu Indir
              </Button>
            )}
          </div>
        </div>
      )}

      {/* Play Button Overlay - shown when paused and loaded */}
      {!isPlaying && isLoaded && !hasError && (
        <motion.div
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.8 }}
          className="absolute inset-0 flex items-center justify-center bg-black/30"
          onClick={togglePlay}
        >
          <div className="w-20 h-20 rounded-full bg-white/90 flex items-center justify-center cursor-pointer hover:bg-white transition-colors shadow-luxury-lg">
            <Play className="h-8 w-8 text-foreground ml-1" fill="currentColor" />
          </div>
        </motion.div>
      )}

      {/* Controls Bar */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: showControls || !isPlaying ? 1 : 0, y: 0 }}
        className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 via-black/40 to-transparent p-4 pt-12"
      >
        {/* Progress Bar */}
        <div 
          className="w-full h-1 bg-white/30 rounded-full mb-3 cursor-pointer group/progress"
          onClick={handleProgressClick}
        >
          <div 
            className="h-full bg-white rounded-full relative transition-all"
            style={{ width: `${progress}%` }}
          >
            <div className="absolute right-0 top-1/2 -translate-y-1/2 w-3 h-3 bg-white rounded-full opacity-0 group-hover/progress:opacity-100 transition-opacity" />
          </div>
        </div>

        {/* Control Buttons */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Button
              size="icon"
              variant="ghost"
              className="h-8 w-8 text-white hover:bg-white/20"
              onClick={togglePlay}
            >
              {isPlaying ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
            </Button>
            <Button
              size="icon"
              variant="ghost"
              className="h-8 w-8 text-white hover:bg-white/20"
              onClick={handleRestart}
            >
              <RotateCcw className="h-4 w-4" />
            </Button>
            <Button
              size="icon"
              variant="ghost"
              className="h-8 w-8 text-white hover:bg-white/20"
              onClick={toggleMute}
            >
              {isMuted ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
            </Button>
          </div>

          <div className="flex items-center gap-2">
            {onDownload && (
              <Button
                size="icon"
                variant="ghost"
                className="h-8 w-8 text-white hover:bg-white/20"
                onClick={onDownload}
              >
                <Download className="h-4 w-4" />
              </Button>
            )}
            <Button
              size="icon"
              variant="ghost"
              className="h-8 w-8 text-white hover:bg-white/20"
              onClick={handleFullscreen}
            >
              <Maximize className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </motion.div>

      {/* Premium Badge */}
      <div className="absolute top-3 left-3 px-2 py-1 bg-black/50 backdrop-blur-sm rounded-full">
        <span className="text-xs text-white/80 font-medium">Premium Video</span>
      </div>
    </div>
  );
}
