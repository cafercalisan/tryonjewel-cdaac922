-- Temporarily bypass the trigger by using a function
-- Create a function that directly updates credits for admin purposes
CREATE OR REPLACE FUNCTION public.admin_set_credits(_user_id uuid, _credits integer)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  _old_credits integer;
BEGIN
  -- Get old credits
  SELECT credits INTO _old_credits FROM profiles WHERE id = _user_id;
  
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'User not found');
  END IF;
  
  -- Direct update bypassing trigger (SECURITY DEFINER runs as owner)
  UPDATE profiles
  SET credits = _credits, updated_at = now()
  WHERE id = _user_id;
  
  RETURN jsonb_build_object('success', true, 'old_credits', _old_credits, 'new_credits', _credits);
END;
$$;