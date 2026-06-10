CREATE TABLE public.processing_history (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  cliente text NOT NULL,
  data_processamento timestamptz NOT NULL DEFAULT now(),
  data_vencimento text,
  data_recebimento text,
  quantidade_documentos integer NOT NULL DEFAULT 0,
  valor_total numeric NOT NULL DEFAULT 0,
  valor_informado_banco numeric NOT NULL DEFAULT 0,
  status_conferencia text NOT NULL,
  quantidade_erros integer NOT NULL DEFAULT 0,
  payload jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.processing_history TO authenticated;
GRANT ALL ON public.processing_history TO service_role;

ALTER TABLE public.processing_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own history" ON public.processing_history
  FOR SELECT TO authenticated USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own history" ON public.processing_history
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own history" ON public.processing_history
  FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own history" ON public.processing_history
  FOR DELETE TO authenticated USING (auth.uid() = user_id);

CREATE OR REPLACE FUNCTION public.update_processing_history_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER update_processing_history_updated_at
BEFORE UPDATE ON public.processing_history
FOR EACH ROW EXECUTE FUNCTION public.update_processing_history_updated_at();