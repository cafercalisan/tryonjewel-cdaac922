-- Update default credits for new users from 10 to 100
ALTER TABLE public.profiles ALTER COLUMN credits SET DEFAULT 100;