-- Create user_models table for storing custom mannequin models
CREATE TABLE public.user_models (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  name TEXT NOT NULL,
  skin_tone TEXT NOT NULL,
  skin_undertone TEXT NOT NULL,
  ethnicity TEXT NOT NULL,
  hair_color TEXT NOT NULL,
  hair_texture TEXT NOT NULL,
  gender TEXT NOT NULL,
  age_range TEXT NOT NULL,
  preview_image_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE public.user_models ENABLE ROW LEVEL SECURITY;

-- Create policies for user access
CREATE POLICY "Users can view their own models" 
ON public.user_models 
FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own models" 
ON public.user_models 
FOR INSERT 
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own models" 
ON public.user_models 
FOR UPDATE 
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own models" 
ON public.user_models 
FOR DELETE 
USING (auth.uid() = user_id);

-- Create trigger for automatic timestamp updates
CREATE TRIGGER update_user_models_updated_at
BEFORE UPDATE ON public.user_models
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();