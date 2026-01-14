-- 1. Enable leaked password protection (already handled by auth config)

-- 2. Protect credits field from direct user manipulation
-- Create a trigger that prevents users from directly modifying their credits
CREATE OR REPLACE FUNCTION public.protect_credits_field()
RETURNS TRIGGER AS $$
BEGIN
  -- If credits are being modified and it's not coming from our RPC functions (service role)
  -- Check if the credits value is being changed
  IF OLD.credits IS DISTINCT FROM NEW.credits THEN
    -- Only allow service role (via RPC functions) to modify credits
    -- Regular users should not be able to change their credits directly
    IF current_setting('role', true) != 'service_role' THEN
      NEW.credits := OLD.credits; -- Revert any credit changes
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Drop existing trigger if exists
DROP TRIGGER IF EXISTS protect_credits_update ON public.profiles;

-- Create trigger to protect credits
CREATE TRIGGER protect_credits_update
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.protect_credits_field();

-- 3. Add comment to document the protection
COMMENT ON TRIGGER protect_credits_update ON public.profiles IS 'Prevents direct user modification of credits field - only RPC functions can modify credits';