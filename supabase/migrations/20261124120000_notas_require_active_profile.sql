-- Exige perfil ativo para acessar public.notas_processadas
-- (análise avançada de segurança de 23/11/2026).
--
-- Problema: notas_select_team só verificava a validade da nota
-- (expires_at > now()). Um usuário desativado com sessão ainda válida
-- continuava lendo as notas da equipe, inclusive o XML completo.
--
-- Solução: todas as operações em notas_processadas passam a exigir que o
-- perfil de quem chama esteja ativo. O campo active já não pode ser alterado
-- pelo próprio usuário (trigger protect_profile_admin_fields).
-- As demais regras não mudam:
--   SELECT  equipe vê notas não expiradas
--   INSERT  só como uploaded_by de si mesmo
--   UPDATE  só quem importou ou master
--   DELETE  só expiradas, de quem importou ou master
--
-- Idempotente.

-- SELECT
DROP POLICY IF EXISTS "notas_select_team" ON public.notas_processadas;
DROP POLICY IF EXISTS "notas_select_active_team" ON public.notas_processadas;
CREATE POLICY "notas_select_active_team"
  ON public.notas_processadas FOR SELECT
  TO authenticated
  USING (
    expires_at > NOW()
    AND EXISTS (SELECT 1 FROM public.profiles p WHERE p.user_id = auth.uid() AND p.active = true)
  );

-- INSERT
DROP POLICY IF EXISTS "notas_insert_own" ON public.notas_processadas;
DROP POLICY IF EXISTS "notas_insert_own_active" ON public.notas_processadas;
CREATE POLICY "notas_insert_own_active"
  ON public.notas_processadas FOR INSERT
  TO authenticated
  WITH CHECK (
    auth.uid() = uploaded_by
    AND EXISTS (SELECT 1 FROM public.profiles p WHERE p.user_id = auth.uid() AND p.active = true)
  );

-- UPDATE
DROP POLICY IF EXISTS "notas_update_own_or_master" ON public.notas_processadas;
DROP POLICY IF EXISTS "notas_update_own_or_master_active" ON public.notas_processadas;
CREATE POLICY "notas_update_own_or_master_active"
  ON public.notas_processadas FOR UPDATE
  TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.profiles p WHERE p.user_id = auth.uid() AND p.active = true)
    AND (auth.uid() = uploaded_by OR public.is_master(auth.uid()))
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.profiles p WHERE p.user_id = auth.uid() AND p.active = true)
    AND (auth.uid() = uploaded_by OR public.is_master(auth.uid()))
  );

-- DELETE
DROP POLICY IF EXISTS "notas_delete_expired_own_or_master" ON public.notas_processadas;
DROP POLICY IF EXISTS "notas_delete_expired_own_or_master_active" ON public.notas_processadas;
CREATE POLICY "notas_delete_expired_own_or_master_active"
  ON public.notas_processadas FOR DELETE
  TO authenticated
  USING (
    expires_at < NOW()
    AND EXISTS (SELECT 1 FROM public.profiles p WHERE p.user_id = auth.uid() AND p.active = true)
    AND (auth.uid() = uploaded_by OR public.is_master(auth.uid()))
  );
