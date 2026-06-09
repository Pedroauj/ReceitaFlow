-- Fix remaining RLS issues flagged by Supabase Security Advisor.
--
-- 1. notas_processadas SELECT: was open to all authenticated users, exposing
--    other users' fiscal data (CNPJ, NF numbers, XML, license plates).
--    Now restricted to own records + master.
--
-- 2. notas_processadas DELETE: any user could delete any expired nota.
--    Restricted to own records + master.
--
-- 3. postos_abastecimento UPDATE: USING(true)/WITH CHECK(true) allowed any
--    user to overwrite any station record.
--    Restricted to creator or master.

-- ─── notas_processadas ────────────────────────────────────────────────────

DROP POLICY IF EXISTS "notas_select_authenticated" ON public.notas_processadas;
CREATE POLICY "notas_select_own_or_master"
  ON public.notas_processadas FOR SELECT
  TO authenticated
  USING (
    expires_at > NOW()
    AND (
      auth.uid() = uploaded_by
      OR public.is_master(auth.uid())
    )
  );

-- DELETE: only the uploader or a master user may remove their own expired rows
DROP POLICY IF EXISTS "notas_delete_expired" ON public.notas_processadas;
CREATE POLICY "notas_delete_expired_own_or_master"
  ON public.notas_processadas FOR DELETE
  TO authenticated
  USING (
    expires_at < NOW()
    AND (
      auth.uid() = uploaded_by
      OR public.is_master(auth.uid())
    )
  );

-- ─── postos_abastecimento ────────────────────────────────────────────────

-- UPDATE: restrict to the station creator or a master user.
-- Stations are shared reference data, but only the original importer
-- (or a master) should be able to overwrite a record.
DROP POLICY IF EXISTS "postos_update_authenticated" ON public.postos_abastecimento;
DROP POLICY IF EXISTS "Authenticated can update postos"  ON public.postos_abastecimento;

CREATE POLICY "postos_update_own_or_master"
  ON public.postos_abastecimento FOR UPDATE
  TO authenticated
  USING (
    auth.uid() = created_by
    OR public.is_master(auth.uid())
  )
  WITH CHECK (
    auth.uid() = created_by
    OR public.is_master(auth.uid())
  );
