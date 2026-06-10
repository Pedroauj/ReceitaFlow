-- Histórico de processamentos de planilhas por cliente (Danone, Natura, etc.).
-- Privado por usuário: cada um vê apenas os próprios processamentos.
-- O campo payload guarda o resultado completo do processamento (JSONB),
-- permitindo reabrir o detalhe e re-exportar a planilha a partir do histórico.

CREATE TABLE IF NOT EXISTS public.processing_history (
  id                     uuid        DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id                uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  cliente                text        NOT NULL,
  data_processamento     timestamptz NOT NULL DEFAULT now(),
  data_vencimento        timestamptz,
  data_recebimento       timestamptz,
  quantidade_documentos  integer     NOT NULL DEFAULT 0,
  valor_total            numeric     NOT NULL DEFAULT 0,
  valor_informado_banco  numeric     NOT NULL DEFAULT 0,
  status_conferencia     text        NOT NULL DEFAULT 'confere'
                         CHECK (status_conferencia IN ('confere', 'diverge')),
  quantidade_erros       integer     NOT NULL DEFAULT 0,
  payload                jsonb
);

CREATE INDEX processing_history_user_idx ON public.processing_history (user_id, data_processamento DESC);

ALTER TABLE public.processing_history ENABLE ROW LEVEL SECURITY;

-- Cada usuário enxerga apenas o próprio histórico
CREATE POLICY "history_select_own"
  ON public.processing_history FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "history_insert_own"
  ON public.processing_history FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "history_delete_own"
  ON public.processing_history FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);
