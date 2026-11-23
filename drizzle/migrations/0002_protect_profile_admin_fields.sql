-- Protege os campos administrativos de public.profiles
-- (verificação de segurança avançada de 23/11/2026).
--
-- Problema: a política "Users can update their own profile" impedia apenas a
-- troca de role. Um usuário comum podia alterar o próprio company_id (e assim
-- ler outra empresa via "Users can view own company or masters view all") e o
-- próprio active (contornando "postos_update_active_users").
--
-- Solução: trigger BEFORE INSERT/UPDATE que, para chamadas feitas com a role
-- authenticated por quem não é master, bloqueia mudanças em
-- role, active, company_id, email e user_id.
--   - Masters continuam usando a tela Usuários normalmente.
--   - Edge Functions (service_role) e triggers internos (handle_new_user)
--     não são afetados, pois não executam como authenticated.
--   - A tela Configurações só altera full_name, display_name e avatar_url.
--
-- Também restringe a leitura de postos_abastecimento a perfis ativos
-- (antes USING (true)), agora que active não pode mais ser alterado pelo
-- próprio usuário.
--
-- Idempotente.

-- ─── 1. Trigger de proteção de profiles ──────────────────────────────────

CREATE OR REPLACE FUNCTION public.protect_profile_admin_fields()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
BEGIN
  -- Só restringe chamadas diretas do app (role authenticated) de não-masters.
  IF current_user <> 'authenticated' OR public.is_master(auth.uid()) THEN
    RETURN NEW;
  END IF;

  IF TG_OP = 'INSERT' THEN
    IF NEW.role IS DISTINCT FROM 'user'
       OR NEW.company_id IS NOT NULL
       OR NEW.active IS DISTINCT FROM true THEN
      RAISE EXCEPTION 'Sem permissão para definir role, active ou company_id do perfil'
        USING ERRCODE = '42501';
    END IF;
    RETURN NEW;
  END IF;

  IF NEW.role       IS DISTINCT FROM OLD.role
     OR NEW.active     IS DISTINCT FROM OLD.active
     OR NEW.company_id IS DISTINCT FROM OLD.company_id
     OR NEW.email      IS DISTINCT FROM OLD.email
     OR NEW.user_id    IS DISTINCT FROM OLD.user_id THEN
    RAISE EXCEPTION 'Sem permissão para alterar role, active, company_id, email ou user_id do perfil'
      USING ERRCODE = '42501';
  END IF;

  RETURN NEW;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.protect_profile_admin_fields() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS protect_profile_admin_fields ON public.profiles;
CREATE TRIGGER protect_profile_admin_fields
  BEFORE INSERT OR UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.protect_profile_admin_fields();

-- ─── 2. Leitura de postos só para perfis ativos ──────────────────────────

DROP POLICY IF EXISTS "Authenticated can view postos" ON public.postos_abastecimento;
DROP POLICY IF EXISTS "postos_select_authenticated" ON public.postos_abastecimento;
DROP POLICY IF EXISTS "postos_select_active_users" ON public.postos_abastecimento;

CREATE POLICY "postos_select_active_users"
  ON public.postos_abastecimento FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.user_id = auth.uid() AND p.active = true
    )
  );
