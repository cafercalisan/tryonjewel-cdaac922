-- Fix STORAGE_EXPOSURE: Make jewelry-images bucket private
UPDATE storage.buckets SET public = false WHERE id = 'jewelry-images';

-- Fix CREDIT RACE CONDITION: Create atomic credit deduction function
-- This function uses SELECT FOR UPDATE to lock the row and prevent race conditions
CREATE OR REPLACE FUNCTION public.deduct_credits(
  _user_id uuid,
  _amount integer
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _current_credits integer;
  _new_credits integer;
BEGIN
  -- Lock row and get current credits atomically
  SELECT credits INTO _current_credits
  FROM profiles
  WHERE id = _user_id
  FOR UPDATE;
  
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'User not found');
  END IF;
  
  IF _current_credits < _amount THEN
    RETURN jsonb_build_object('success', false, 'error', 'Insufficient credits', 'current_credits', _current_credits);
  END IF;
  
  _new_credits := _current_credits - _amount;
  
  UPDATE profiles
  SET credits = _new_credits, updated_at = now()
  WHERE id = _user_id;
  
  RETURN jsonb_build_object('success', true, 'remaining_credits', _new_credits);
END;
$$;

-- Create refund function for failed generations
CREATE OR REPLACE FUNCTION public.refund_credits(
  _user_id uuid,
  _amount integer
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _new_credits integer;
BEGIN
  UPDATE profiles
  SET credits = credits + _amount, updated_at = now()
  WHERE id = _user_id
  RETURNING credits INTO _new_credits;
  
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'User not found');
  END IF;
  
  RETURN jsonb_build_object('success', true, 'new_credits', _new_credits);
END;
$$;

-- Add CHECK constraint to prevent negative credits
ALTER TABLE profiles ADD CONSTRAINT credits_non_negative CHECK (credits >= 0);