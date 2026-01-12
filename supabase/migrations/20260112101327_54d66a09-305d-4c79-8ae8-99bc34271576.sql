-- Create videos table for storing generated video animations
CREATE TABLE public.videos (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  source_image_url TEXT NOT NULL,
  video_url TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  error_message TEXT,
  prompt TEXT,
  duration INTEGER DEFAULT 5,
  aspect_ratio TEXT DEFAULT '4:5',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE public.videos ENABLE ROW LEVEL SECURITY;

-- Create policies for user access
CREATE POLICY "Users can view their own videos" 
ON public.videos 
FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own videos" 
ON public.videos 
FOR INSERT 
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own videos" 
ON public.videos 
FOR UPDATE 
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own videos" 
ON public.videos 
FOR DELETE 
USING (auth.uid() = user_id);

-- Create trigger for automatic timestamp updates
CREATE TRIGGER update_videos_updated_at
BEFORE UPDATE ON public.videos
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();