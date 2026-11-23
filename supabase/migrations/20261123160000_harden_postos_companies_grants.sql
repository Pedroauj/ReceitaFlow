-- Endurecimento de segurança (relatório de segurança de 23/11/2026, item 2).
--
-- 1. postos_abastecimento: a política "Authenticated can update postos"
--    (USING true / WITH CHECK true) permitia que qualquer usuário autenticado
--    alterasse qualquer coluna (CNPJ, nome, autor). A edição colaborativa de
--    tags continua liberada para a equipe, mas:
--      - só usuários com perfil ativo podem atualizar;
--      - só as colunas tags e updated_at podem ser alteradas pelo cliente.
--
-- 2. companies: "Authenticated users can view companies" (USING true) deixava
--    qualquer autenticado listar todas as empresas. Agora cada usuário vê só a
--    empresa vinculada ao seu perfil; master continua vendo todas.
--
-- 3. Grants: remove todos os privilégios de anon e os privilégios TRUNCATE,
--    REFERENCES, TRIGGER (e MAINTAIN, no Postgres 17+) de authenticated nas
--    tabelas de dados do app. Nenhuma tela usa esses privilégios.
--
-- Idempotente: pode ser executada mais de uma vez.

-- ─── 1. postos_abastecimento ─────────────────────────────────────────────

DROP POLICY IF EXISTS "Authenticated can update postos" ON public.postos_abastecimento;
DROP POLICY IF EXISTS "postos_update_authenticated" ON public.postos_abastecimento;
DROP POLICY IF EXISTS "postos_update_own_or_master" ON public.postos_abastecimento;
DROP POLICY IF EXISTS "postos_update_active_users" ON public.postos_abastecimento;

CREATE POLICY "postos_update_active_users"
  ON public.postos_abastecimento FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.user_id = auth.uid() AND p.active = true
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.user_id = auth.uid() AND p.active = true
    )
  );

-- Limita o UPDATE às colunas editáveis pela tela (tags). updated_at é enviado
-- pelo app e também ajustado pelo trigger. Inserção de novos postos
-- (upsert com ignoreDuplicates = ON CONFLICT DO NOTHING) não precisa de UPDATE.
REVOKE UPDATE ON TABLE public.postos_abastecimento FROM authenticated, anon, PUBLIC;
REVOKE UPDATE (cnpj, nome, created_by, first_seen, id, tags, updated_at)
  ON public.postos_abastecimento FROM authenticated, anon, PUBLIC;
GRANT UPDATE (tags, updated_at) ON public.postos_abastecimento TO authenticated;

-- ─── 2. companies ────────────────────────────────────────────────────────

DROP POLICY IF EXISTS "Authenticated users can view companies" ON public.companies;
DROP POLICY IF EXISTS "Users can view own company or masters view all" ON public.companies;

CREATE POLICY "Users can view own company or masters view all"
  ON public.companies FOR SELECT
  TO authenticated
  USING (
    public.is_master(auth.uid())
    OR EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.user_id = auth.uid()
        AND p.company_id = companies.id
    )
  );

-- ─── 3. Grants ───────────────────────────────────────────────────────────

REVOKE ALL PRIVILEGES ON TABLE
  public.notas_processadas,
  public.postos_abastecimento,
  public.profiles,
  public.companies,
  public.processing_history
FROM anon;

REVOKE TRUNCATE, REFERENCES, TRIGGER ON TABLE
  public.notas_processadas,
  public.postos_abastecimento,
  public.profiles,
  public.companies,
  public.processing_history
FROM authenticated;

-- MAINTAIN só existe a partir do Postgres 17.
DO $$
BEGIN
  IF current_setting('server_version_num')::int >= 170000 THEN
    EXECUTE 'REVOKE MAINTAIN ON TABLE
      public.notas_processadas,
      public.postos_abastecimento,
      public.profiles,
      public.companies,
      public.processing_history
    FROM authenticated';
  END IF;
END $$;
