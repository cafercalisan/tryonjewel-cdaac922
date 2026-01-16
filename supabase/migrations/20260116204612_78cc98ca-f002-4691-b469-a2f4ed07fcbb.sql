-- Enable realtime for images table to track generation progress
ALTER PUBLICATION supabase_realtime ADD TABLE public.images;