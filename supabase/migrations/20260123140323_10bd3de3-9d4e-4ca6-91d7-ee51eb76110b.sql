-- Add CHECK constraints for profiles table field lengths
ALTER TABLE public.profiles 
ADD CONSTRAINT profiles_first_name_length CHECK (length(first_name) <= 50);

ALTER TABLE public.profiles 
ADD CONSTRAINT profiles_last_name_length CHECK (length(last_name) <= 50);

ALTER TABLE public.profiles 
ADD CONSTRAINT profiles_phone_length CHECK (phone IS NULL OR length(phone) <= 20);

ALTER TABLE public.profiles 
ADD CONSTRAINT profiles_company_length CHECK (company IS NULL OR length(company) <= 100);

ALTER TABLE public.profiles 
ADD CONSTRAINT profiles_email_length CHECK (length(email) <= 255);

-- Add admin-only write policies for scenes table to prevent unauthorized modifications
CREATE POLICY "Only admins can insert scenes" 
ON public.scenes 
FOR INSERT 
TO authenticated
WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Only admins can update scenes" 
ON public.scenes 
FOR UPDATE 
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Only admins can delete scenes" 
ON public.scenes 
FOR DELETE 
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));