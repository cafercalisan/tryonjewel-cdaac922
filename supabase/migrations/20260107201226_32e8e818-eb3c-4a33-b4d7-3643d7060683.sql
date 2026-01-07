-- Create profiles table
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL,
  email TEXT NOT NULL,
  phone TEXT,
  company TEXT,
  credits INTEGER NOT NULL DEFAULT 10,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS on profiles
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Profiles RLS policies
CREATE POLICY "Users can view their own profile"
  ON public.profiles FOR SELECT
  USING (auth.uid() = id);

CREATE POLICY "Users can update their own profile"
  ON public.profiles FOR UPDATE
  USING (auth.uid() = id);

CREATE POLICY "Users can insert their own profile"
  ON public.profiles FOR INSERT
  WITH CHECK (auth.uid() = id);

-- Create scenes table
CREATE TABLE public.scenes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  name_tr TEXT NOT NULL,
  category TEXT NOT NULL CHECK (category IN ('studio', 'lifestyle')),
  description TEXT NOT NULL,
  description_tr TEXT NOT NULL,
  prompt TEXT NOT NULL,
  preview_image_url TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS on scenes (public read)
ALTER TABLE public.scenes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Scenes are publicly readable"
  ON public.scenes FOR SELECT
  USING (true);

-- Create images table
CREATE TABLE public.images (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  scene_id UUID REFERENCES public.scenes(id) ON DELETE SET NULL,
  original_image_url TEXT NOT NULL,
  generated_image_urls TEXT[] NOT NULL DEFAULT '{}',
  aspect_ratio TEXT NOT NULL DEFAULT '4:5',
  analysis_data JSONB,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'analyzing', 'generating', 'completed', 'failed')),
  error_message TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS on images
ALTER TABLE public.images ENABLE ROW LEVEL SECURITY;

-- Images RLS policies
CREATE POLICY "Users can view their own images"
  ON public.images FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own images"
  ON public.images FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own images"
  ON public.images FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own images"
  ON public.images FOR DELETE
  USING (auth.uid() = user_id);

-- Create function to update timestamps
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Create trigger for automatic timestamp updates on profiles
CREATE TRIGGER update_profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Function to handle new user signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, first_name, last_name, email, phone, company)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data ->> 'first_name', ''),
    COALESCE(NEW.raw_user_meta_data ->> 'last_name', ''),
    COALESCE(NEW.email, ''),
    COALESCE(NEW.raw_user_meta_data ->> 'phone', ''),
    COALESCE(NEW.raw_user_meta_data ->> 'company', '')
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Trigger to create profile on signup
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

-- Create storage bucket for jewelry images
INSERT INTO storage.buckets (id, name, public)
VALUES ('jewelry-images', 'jewelry-images', true);

-- Storage policies for jewelry-images bucket
CREATE POLICY "Users can upload their own jewelry images"
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'jewelry-images' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users can view their own jewelry images"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'jewelry-images' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users can delete their own jewelry images"
  ON storage.objects FOR DELETE
  USING (bucket_id = 'jewelry-images' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Generated images are publicly readable"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'jewelry-images' AND (storage.foldername(name))[2] = 'generated');

-- Insert predefined scenes
INSERT INTO public.scenes (name, name_tr, category, description, description_tr, prompt, sort_order) VALUES
-- Studio scenes
('Black Velvet', 'Siyah Kadife', 'studio', 
 'Deep black velvet backdrop with elegant studio lighting',
 'Derin siyah kadife arka plan, zarif stüdyo aydınlatması',
 'Place the jewelry on deep black velvet fabric. Softbox key light at 45 degrees from the top left. Subtle rim light from behind. High contrast luxury catalog aesthetic. Rich shadows and elegant highlights.',
 1),
 
('White Marble', 'Beyaz Mermer', 'studio',
 'Clean white marble surface with natural daylight feel',
 'Temiz beyaz mermer yüzey, doğal gün ışığı hissi',
 'Place the jewelry on pristine white marble surface with subtle gray veins. Soft diffused daylight from large window. Editorial minimalist style. Clean and pure aesthetic.',
 2),
 
('Champagne Silk', 'Şampanya İpek', 'studio',
 'Luxurious champagne-colored silk with soft lighting',
 'Lüks şampanya rengi ipek, yumuşak aydınlatma',
 'Place the jewelry on elegantly folded champagne-colored silk fabric. Warm soft lighting from the top. Elegant light reflections on the silk. Romantic and luxurious mood.',
 3),
 
('Glass Reflection', 'Cam Yansıma', 'studio',
 'Reflective glass surface with cool studio lighting',
 'Yansıtıcı cam yüzey, serin stüdyo aydınlatması',
 'Place the jewelry on a perfectly clean reflective glass surface. Cool studio lighting. Clean mirror-like reflection below the jewelry. Modern and contemporary aesthetic.',
 4),
 
('Pure E-commerce', 'Saf E-ticaret', 'studio',
 'Seamless light gray background for e-commerce',
 'E-ticaret için kesintisiz açık gri arka plan',
 'Place the jewelry on seamless light gray studio background. Even soft lighting from all angles. Perfectly centered composition. Clean e-commerce product photography style.',
 5),

-- Lifestyle scenes
('Neck Model', 'Boyun Modeli', 'lifestyle',
 'Worn on a model neck, elegant portrait style',
 'Model boynunda, zarif portre tarzı',
 'Show the jewelry worn on an elegant model neck. Face not visible, crop from chin to collarbone. Natural skin texture. Soft editorial lighting from the side. Luxury fashion photography style.',
 6),
 
('Hand Model', 'El Modeli', 'lifestyle',
 'Worn on model hand with elegant pose',
 'Zarif pozda model elinde',
 'Show the jewelry worn on an elegant model hand. Graceful hand pose. Soft natural daylight. Beautiful skin texture. Close-up macro photography style.',
 7),
 
('Luxury Lifestyle', 'Lüks Yaşam', 'lifestyle',
 'Luxury interior setting with artistic blur',
 'Lüks iç mekan ortamı, sanatsal bulanıklık',
 'Place the jewelry in focus in the foreground with a luxurious interior background. Expensive furniture and decor heavily blurred. Golden hour warm lighting. Aspirational luxury lifestyle mood.',
 8);