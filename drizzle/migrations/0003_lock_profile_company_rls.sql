-- Lock down public.profiles self-update and self-insert RLS policies so non-master users
-- cannot set or modify company_id, role, active, or email (defense-in-depth alongside
-- the protect_profile_admin_fields trigger).

DROP POLICY IF EXISTS "Users can update their own profile" ON public.profiles;
CREATE POLICY "Users can update their own profile"
  ON public.profiles
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (
    auth.uid() = user_id
    AND EXISTS (
      SELECT 1
      FROM public.profiles p
      WHERE p.user_id = auth.uid()
        AND p.id = profiles.id
        AND p.role IS NOT DISTINCT FROM profiles.role
        AND p.company_id IS NOT DISTINCT FROM profiles.company_id
        AND p.active IS NOT DISTINCT FROM profiles.active
        AND p.email IS NOT DISTINCT FROM profiles.email
    )
  );

DROP POLICY IF EXISTS "Authenticated users can insert their own profile" ON public.profiles;
CREATE POLICY "Authenticated users can insert their own profile"
  ON public.profiles
  FOR INSERT
  TO authenticated
  WITH CHECK (
    auth.uid() = user_id
    AND role = 'user'
    AND company_id IS NULL
    AND active = true
  );

DROP POLICY IF EXISTS "Users can view own company or masters view all" ON public.companies;
CREATE POLICY "Users can view own company or masters view all"
  ON public.companies
  FOR SELECT
  TO authenticated
  USING (
    public.is_master(auth.uid())
    OR EXISTS (
      SELECT 1
      FROM public.profiles p
      WHERE p.user_id = auth.uid()
        AND p.active = true
        AND p.company_id = companies.id
    )
  );