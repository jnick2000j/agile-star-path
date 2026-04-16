
-- Create a SECURITY DEFINER function that creates an org for a newly signed-up user
-- This is called after email confirmation when the user first logs in
CREATE OR REPLACE FUNCTION public.create_org_for_new_user(_org_name text)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _user_id uuid;
  _org_id uuid;
  _slug text;
  _plan_id uuid;
BEGIN
  _user_id := auth.uid();
  
  IF _user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  -- Check if user already has an organization
  IF EXISTS (SELECT 1 FROM user_organization_access WHERE user_id = _user_id) THEN
    -- Return existing org id
    SELECT organization_id INTO _org_id FROM user_organization_access WHERE user_id = _user_id LIMIT 1;
    RETURN _org_id;
  END IF;

  -- Generate a slug from the org name
  _slug := lower(regexp_replace(trim(_org_name), '[^a-zA-Z0-9]+', '-', 'g'));
  _slug := trim(both '-' from _slug);
  
  -- Ensure slug uniqueness
  IF EXISTS (SELECT 1 FROM organizations WHERE slug = _slug) THEN
    _slug := _slug || '-' || substr(gen_random_uuid()::text, 1, 8);
  END IF;

  -- Create the organization
  INSERT INTO organizations (name, slug, created_by)
  VALUES (_org_name, _slug, _user_id)
  RETURNING id INTO _org_id;

  -- Give the user admin access to the org
  INSERT INTO user_organization_access (user_id, organization_id, access_level)
  VALUES (_user_id, _org_id, 'admin');

  -- Set this as the user's default organization
  UPDATE profiles SET default_organization_id = _org_id WHERE user_id = _user_id;

  -- Assign the free plan if subscription_plans exist
  SELECT id INTO _plan_id FROM subscription_plans WHERE name ILIKE '%free%' LIMIT 1;
  IF _plan_id IS NOT NULL THEN
    INSERT INTO organization_subscriptions (organization_id, plan_id, status)
    VALUES (_org_id, _plan_id, 'active');
  END IF;

  RETURN _org_id;
END;
$$;
