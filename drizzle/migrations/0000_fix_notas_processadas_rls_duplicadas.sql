-- Corrige políticas RLS duplicadas em public.notas_processadas.
--
-- A tabela recebeu políticas de duas migrações com nomes diferentes
-- (20260523140000_notas_processadas.sql e 20260523163635_*.sql). As correções
-- de 20260529000001 e 20260609000001 removeram apenas os nomes de uma delas,
-- então as políticas abertas da outra continuavam valendo. Como políticas
-- permissivas são combinadas com OR, isso anulava as correções:
--   - "Authenticated can update notas"          USING (true) / WITH CHECK (true)
--   - "Authenticated can delete expired notas"  qualquer usuário apagava notas de outros
--
-- Regra final (decisão de produto: histórico compartilhado pela equipe):
--   SELECT  qualquer usuário autenticado vê notas não expiradas
--   INSERT  apenas registrando a si mesmo como uploaded_by
--   UPDATE  apenas quem importou a nota ou um master
--   DELETE  apenas notas expiradas, de quem importou ou de um master
--
-- Remove todas as variantes conhecidas antes de recriar, para ser idempotente
-- independentemente de quais migrações anteriores foram aplicadas no banco.

-- SELECT
DROP POLICY IF EXISTS "Authenticated can view non-expired notas" ON public.notas_processadas;
DROP POLICY IF EXISTS "notas_select_authenticated" ON public.notas_processadas;
DROP POLICY IF EXISTS "notas_select_own_or_master" ON public.notas_processadas;
DROP POLICY IF EXISTS "notas_select_team" ON public.notas_processadas;

CREATE POLICY "notas_select_team"
  ON public.notas_processadas FOR SELECT
  TO authenticated
  USING (expires_at > NOW());

-- INSERT
DROP POLICY IF EXISTS "Authenticated can insert own notas" ON public.notas_processadas;
DROP POLICY IF EXISTS "notas_insert_authenticated" ON public.notas_processadas;
DROP POLICY IF EXISTS "notas_insert_own" ON public.notas_processadas;

CREATE POLICY "notas_insert_own"
  ON public.notas_processadas FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = uploaded_by);

-- UPDATE
DROP POLICY IF EXISTS "Authenticated can update notas" ON public.notas_processadas;
DROP POLICY IF EXISTS "notas_update_authenticated" ON public.notas_processadas;
DROP POLICY IF EXISTS "notas_update_own" ON public.notas_processadas;
DROP POLICY IF EXISTS "notas_update_own_or_master" ON public.notas_processadas;

CREATE POLICY "notas_update_own_or_master"
  ON public.notas_processadas FOR UPDATE
  TO authenticated
  USING (
    auth.uid() = uploaded_by
    OR public.is_master(auth.uid())
  )
  WITH CHECK (
    auth.uid() = uploaded_by
    OR public.is_master(auth.uid())
  );

-- DELETE
DROP POLICY IF EXISTS "Authenticated can delete expired notas" ON public.notas_processadas;
DROP POLICY IF EXISTS "notas_delete_expired" ON public.notas_processadas;
DROP POLICY IF EXISTS "notas_delete_expired_own_or_master" ON public.notas_processadas;

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
