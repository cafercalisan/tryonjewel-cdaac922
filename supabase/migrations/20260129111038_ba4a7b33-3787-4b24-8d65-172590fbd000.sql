-- Allow admins to view all profiles (for admin panel)
CREATE POLICY "Admins can view all profiles"
ON public.profiles
FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin'::app_role));

-- Allow admins to view all images (for analytics)
CREATE POLICY "Admins can view all images"
ON public.images
FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin'::app_role));

-- Allow admins to view all videos (for analytics)
CREATE POLICY "Admins can view all videos"
ON public.videos
FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin'::app_role));