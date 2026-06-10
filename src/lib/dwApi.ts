// ─────────────────────────────────────────────────────────────────────────────
// dwApi.ts  –  Client para a API de dados financeiros + frota + manutenção
//
// Prioridade de URL:
//   1. VITE_DW_API_URL  (variável de ambiente definida no .env do Lovable)
//   2. Supabase Edge Function (fallback)
// ─────────────────────────────────────────────────────────────────────────────

const SUPABASE_URL      = import.meta.env.VITE_SUPABASE_URL as string;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string;

// ─── URL da API ───────────────────────────────────────────────────────────────
const TUNNEL_URL = "https://textbooks-filme-saves-atmospheric.trycloudflare.com";

const LOCAL_API_URL =
  ((
    import.meta as {
      env?: {
        VITE_DW_API_URL?: string;
      };
    }
  ).env?.VITE_DW_API_URL ?? undefined) ||
  TUNNEL_URL;

// Endpoints
const ENDPOINT_FINANCEIRO = LOCAL_API_URL
  ? `${LOCAL_API_URL}/dw-financeiro`
  : `${SUPABASE_URL}/functions/v1/dw-financeiro`;

const ENDPOINT_FROTA = LOCAL_API_URL
  ? `${LOCAL_API_URL}/dw-frota`
  : `${SUPABASE_URL}/functions/v1/dw-frota`;

const ENDPOINT_MANUTENCAO = LOCAL_API_URL
  ? `${LOCAL_API_URL}/dw-manutencao`
  : `${SUPABASE_URL}/functions/v1/dw-manutencao`;

const ENDPOINT_COMPRAS = LOCAL_API_URL
  ? `${LOCAL_API_URL}/dw-compras`
  : `${SUPABASE_URL}/functions/v1/dw-compras`;

const ENDPOINT_ABASTECIMENTO = LOCAL_API_URL
  ? `${LOCAL_API_URL}/dw-abastecimento`
  : `${SUPABASE_URL}/functions/v1/dw-abastecimento`;

const ENDPOINT_RH = LOCAL_API_URL
  ? `${LOCAL_API_URL}/dw-rh`
  : `${SUPABASE_URL}/functions/v1/dw-rh`;

const ENDPOINT_OPERACIONAL = LOCAL_API_URL
  ? `${LOCAL_API_URL}/dw-operacional`
  : `${SUPABASE_URL}/functions/v1/dw-operacional`;

const ENDPOINT_FATURAMENTO_RESUMO = LOCAL_API_URL
  ? `${LOCAL_API_URL}/dw-faturamento-resumo`
  : `${SUPABASE_URL}/functions/v1/dw-faturamento-resumo`;

const ENDPOINT_FINANCIAMENTO_FROTA = LOCAL_API_URL
  ? `${LOCAL_API_URL}/dw-financiamento-frota`
  : `${SUPABASE_URL}/functions/v1/dw-financiamento-frota`;

const ENDPOINT_BANCOS = LOCAL_API_URL
  ? `${LOCAL_API_URL}/dw-bancos`
  : `${SUPABASE_URL}/functions/v1/dw-bancos`;

const IS_LOCAL = !!LOCAL_API_URL;

// ─── Tipos: Financeiro (mantido) ──────────────────────────────────────────────

export interface FilterOption {
  id: string;
  nome: string;
  empresa?: string;
}

export interface DwFiltersResponse {
  empresas: FilterOption[];
  filiais:  FilterOption[];
}

// ── Conta bancária (/dw-bancos) ─────────────────────────────────────────────
export interface BankAccount {
  cod_conta:      string;
  nome_conta:     string;
  agencia:        string;
  num_conta:      string;
  cod_banco:      string;
  nome_banco:     string;
  tipo_conta:     string;
  filial:         string;
  empresa:        string;
  nome_filial:    string;
  saldo_anterior: number;   // acumulado antes do período
  saldo_atual:    number;   // saldo_anterior + créditos − débitos do período
  entradas_mes:   number;
  saidas_mes:     number;
}

export interface BankAccountsResponse {
  data: BankAccount[];
}

export interface DwRow {
  DATA_EMISSAO: string | null;
  DATA_VENCIMENTO: string | null;
  DATA_PAGAMENTO: string | null;
  COD_PARCEIRO: string | null;
  NOME_PARCEIRO: string | null;
  SERIE: string | null;
  DOCUMENTO: string | null;
  PARCELA: string | null;
  TIPO_DOCUMENTO: string | null;
  ORIGEM: "CP" | "CR" | "LB_D" | "LB_C";
  SITUACAO: string | null;
  VLRDOC: number | null;
  VLR_LIQUIDO: number | null;
  VLRJUR: number | null;
  VLRDES: number | null;
  DESADT: number | null;
  VLR_PAGO: number | null;
  VLR_PARCELA: number | null;
  VLR_PAR_RAW: number | null;
  VLR_REC_RAW: number | null;
  FILIAL: string | null;
  EMPRESA: string | null;
  CODCGA: string | null;
  CENTRO_GASTO: string | null;
  CODCUS: string | null;
  CENTRO_CUSTO: string | null;
  SINTETICA: string | null;
  ANALITICA: string | null;
  // ── Campos bancários (LB_D / LB_C) ──────────────────────────
  DATA_LANCAMENTO:   string | null;
  COD_BANCO:         string | null;
  NOME_BANCO:        string | null;
  NUM_CHEQUE:        string | null;
  NUM_AVISO:         string | null;
  DATA_COMPENSACAO:  string | null;
  HISTORICO:         string | null;
  NOME_CONTA:        string | null;
  COD_CONTA:         string | null;
}

export interface DwFetchResponse {
  data: DwRow[];
}

export interface FaturamentoRow {
  FRETE_TOTAL: number;
  DESCRI: string | null;
  PERCENTUAL: number;
}

export interface FaturamentoResponse {
  data: FaturamentoRow[];
}

// ─── Tipos: FROTA ─────────────────────────────────────────────────────────────

export interface FrotaRow {
  codvei: string | number;
  chassi: string | null;
  tipvei: string | null;
  codfro: string | number | null;
  frota: string | null;
  codmcv: string | number | null;
  marca: string | null;
  codmdv: string | number | null;
  modelo: string | null;
  codmun: string | number | null;
  municipio: string | null;
  situacao: "ATIVO" | "BAIXADO" | "INATIVO";
  codcmo: string | number | null;
  classificacao: string | null;
  anofab: number | null;
  anomod: number | null;
  tipcar: string | null;
  numeix: number | null;
  altura: number | null;
  largur: number | null;
  compri: number | null;
  qtdlit: number | null;
  tarakg: number | null;
  lotaca: number | null;
  pesbru: number | null;
  qtdpne: number | null;
  propri: string | null;
  datinc: string | null;
}

export interface FrotaResponse {
  data: FrotaRow[];
}

// ─── Tipos: MANUTENCAO ────────────────────────────────────────────────────────

export interface ManutencaoRow {
  filial: string | null;
  ordem: string | number | null;
  tiposervico: "SERVICOEXTERNO" | "SERVICOINTERNO" | null;
  situacao: "INCONSISTENTE" | "ANDAMENTO" | "CANCELADO" | "CONCLUIDO" | null;
  motorista: string | null;
  conjunto: string | null;
  funcionario: string | null;
  setor: string | null;
  classificacao: string | null;
  codigoprod: string | null;
  tipoprod: "SERVICO" | "PRODUTO" | "PRODUTOGARANTIA" | "PLANOMANUTENCAO" | null;
  produto: string | null;
  subgrupo: string | null;
  qtd: number | null;
  custo: number | null;
  baixa: string | null;
  fornecedor: string | null;
  solicitacao: string | null;
  observacao: string | null;
  veiculo: string | number | null; // CODVEI = chave de cruzamento com frota
  dataordem: string | null;
  valormo: number | null;
  valormo2: number | null;
  valorpc: number | null;
  valorpc2: number | null;
}

export interface ManutencaoResponse {
  data: ManutencaoRow[];
}

// ─── Tipos: RH ───────────────────────────────────────────────────────────────

export interface RhRow {
  codmot:                 string | number | null;
  motorista:              string | null;
  data_nascimento:        string | null;
  nacionalidade:          string | null;
  estado:                 string | null;
  endereco:               string | null;
  bairro:                 string | null;
  habilitacao:            string | null;
  uf_habilitacao:         string | null;
  categoria_habilitacao:  string | null;
  validade_habilitacao:   string | null;
  numero_rg:              string | null;
  data_emissao_rg:        string | null;
  numero_cpf:             string | null;
  empregado:              string | null;
  codigo_folha:           string | number | null;
  codigo_filial:          string | number | null;
  data_admissao:          string | null;
  data_demissao:          string | null;
  motivo_demissao:        string | null;
  situacao:               string | null;
  funcao:                 string | null;
  tipo_funcionario:       string | null;
  sexo:                   string | null;
}

export interface RhResponse {
  data: RhRow[];
}

// ─── Tipos: OPERACIONAL ───────────────────────────────────────────────────────

export interface OperacionalRow {
  ID:                    number | null;
  CODCLI:                string | number | null;
  CLI_NOMEAB:            string | null;
  CODMOT:                string | number | null;
  motorista:             string | null;
  veiculo:               string | number | null;
  latitude:              number | null;
  longitude:             number | null;
  referencia:            string | null;
  veiculo2:              string | number | null;
  veiculo3:              string | number | null;
  tipo_documento:        string | null;
  codigo_documento:      string | number | null;
  serie_documento:       string | null;
  filial_documento:      string | number | null;
  cod_remetente:         string | number | null;
  remetente:             string | null;
  cod_destinatario:      string | number | null;
  destinatario:          string | null;
  data_saida_original:   string | null;
  data_saida_real:       string | null;
  percentual_completo:   number | null;
  previsao_chegada:      string | null;
  situacao_viagem:       string | null;
  descricao_documento:   string | null;
  descricao_situacao:    string | null;
  descricao_origem:      string | null;
  descricao_destino:     string | null;
  latitude_remetente:    number | null;
  longitude_remetente:   number | null;
  latitude_destinatario: number | null;
  longitude_destinatario:number | null;
  total_itens:           number | null;
  itens_real:            number | null;
  classificacao_veiculo: string | null;
  situacao_veiculo:      string | null;
  em_manutencao:         string | number | null;
}

export interface OperacionalResponse {
  data: OperacionalRow[];
}

// ─── Tipos: ABASTECIMENTO ─────────────────────────────────────────────────────

export interface AbastecimentoRow {
  codaba:            string | number | null;
  motorista:         string | null;
  posto:             string | null;
  estado:            string | null;
  vlrtot:            number | null;
  quanti:            number | null;
  datref:            string | null;
  numdoc:            string | number | null;
  veiculo:           string | number | null;
  marca:             string | null;
  modelo:            string | null;
  linha:             string | number | null;
  media:             number | null;
  ultkmt:            number | null;
  atukmt:            number | null;
  medfab:            number | null;
  odohor:            string | null;
  frota:             string | null;
  codigo_combustivel:string | number | null;
  tipo_combustivel:  string | null;
  nota_fiscal:       string | number | null;
}

export interface AbastecimentoResponse {
  data: AbastecimentoRow[];
}

// ─── Tipos: FATURAMENTO RESUMO ────────────────────────────────────────────────

export interface FaturamentoResumoResponse {
  daily_revenue: {
    reference_date:  string | null;
    revenue_value:   number | null;
    valid:           boolean;
    error:           string | null;
  };
  monthly_revenue: {
    reference_month: string | null;
    revenue_value:   number | null;
    valid:           boolean;
    error:           string | null;
  };
}

// ─── Tipos: COMPRAS ───────────────────────────────────────────────────────────

export interface ComprasRow {
  sub_grupo: string | null;
  codsgp: string | number | null;
  tiponf: string | null;
  serie: string | null;
  data_compra: string | null;
  pedido: string | number | null;
  nota_fiscal: string | number | null;
  situac: string | null;
  codcus: string | number | null;
  centro_custo: string | null;
  codgpp: string | number | null;
  grupo: string | null;
  codprod: string | number | null;
  produto: string | null;
  quantidade: number | null;
  valor_un: number | null;
  codclifor: string | number | null;
  fornecedor: string | null;
}

export interface ComprasResponse {
  data: ComprasRow[];
}


// ─── Helper interno ───────────────────────────────────────────────────────────

async function callEdge<T>(
  endpoint: string,
  body: Record<string, unknown>
): Promise<T> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };

  if (IS_LOCAL) {
    const apiKey = (
      import.meta as { env?: { VITE_DW_API_SECRET?: string } }
    ).env?.VITE_DW_API_SECRET;
    if (apiKey) headers["x-api-key"] = apiKey;
  } else {
    headers["Authorization"] = `Bearer ${SUPABASE_ANON_KEY}`;
    headers["apikey"] = SUPABASE_ANON_KEY;
  }

  const res = await fetch(endpoint, {
    method: "POST",
    headers,
    body: JSON.stringify(body),
  });

  const json = await res.json().catch(() => ({ error: `HTTP ${res.status}` }));

  if (!res.ok || json?.error) {
    throw new Error(json?.error ?? `Erro HTTP ${res.status}`);
  }

  return json as T;
}

// ─── Cache em memória (TTL) ───────────────────────────────────────────────────
// Cacheia respostas de fetch enquanto o usuário navega entre telas.
// Padrão: 5 minutos. Após esse tempo a próxima chamada refaz o request.
// TTL por tipo de dado:
// - Dados financeiros/operacionais mudam com frequência → 2 min
// - Dados de frota/RH são mais estáticos → 10 min
// - Filtros (filiais/empresas) raramente mudam → 30 min
const TTL_FINANCEIRO = 2 * 60 * 1000;   // faturamento, contas, compras
const TTL_OPERACIONAL = 2 * 60 * 1000;   // snapshot em tempo real
const TTL_FROTA = 10 * 60 * 1000;   // frota, manutenção, abastecimento
const TTL_RH = 10 * 60 * 1000;   // RH
const TTL_FILTROS = 30 * 60 * 1000;   // filiais, empresas
const DEFAULT_TTL_MS = TTL_FINANCEIRO;   // fallback

interface CacheEntry<T> {
  expiresAt: number;
  value: Promise<T>;
}

const memoryCache = new Map<string, CacheEntry<unknown>>();

async function cached<T>(
  key: string,
  loader: () => Promise<T>,
  ttlMs: number = DEFAULT_TTL_MS,
): Promise<T> {
  const now = Date.now();
  const hit = memoryCache.get(key) as CacheEntry<T> | undefined;
  if (hit && hit.expiresAt > now) {
    return hit.value;
  }
  const promise = loader().catch((err) => {
    // Em caso de erro, invalida para permitir nova tentativa imediata
    memoryCache.delete(key);
    throw err;
  });
  memoryCache.set(key, { expiresAt: now + ttlMs, value: promise });
  return promise;
}

/** Invalida todo o cache em memória (use após uma ação que altera dados). */
export function clearDwCache(prefix?: string): void {
  if (!prefix) {
    memoryCache.clear();
    return;
  }
  for (const key of memoryCache.keys()) {
    if (key.startsWith(prefix)) memoryCache.delete(key);
  }
}

// ─── Exports públicos: FINANCEIRO ─────────────────────────────────────────────

export async function loadDwFilters(): Promise<DwFiltersResponse> {
  return cached("financeiro:filters", () =>
    callEdge<DwFiltersResponse>(ENDPOINT_FINANCEIRO, { action: "filters" }),
  );
}

export async function fetchDwData(params: {
  dataInicio: string;
  dataFim: string;
  filial?: string | null;
  empresa?: string | null;
}): Promise<DwFetchResponse> {
  const key = `financeiro:fetch:${JSON.stringify(params)}`;
  return cached(key, () =>
    callEdge<DwFetchResponse>(ENDPOINT_FINANCEIRO, { action: "fetch", ...params }),
  );
}

export async function fetchFaturamento(params: {
  dataInicio: string;
  dataFim: string;
  filial?: string | null;
  empresa?: string | null;
}): Promise<FaturamentoResponse> {
  const key = `financeiro:faturamento:${JSON.stringify(params)}`;
  return cached(key, () =>
    callEdge<FaturamentoResponse>(ENDPOINT_FINANCEIRO, { action: "faturamento", ...params }),
  );
}

// ─── Exports públicos: FROTA ──────────────────────────────────────────────────

/**
 * Busca o cadastro completo de veículos da frota.
 * Por padrão retorna todos. Use `situacao` para filtrar no servidor.
 */
export async function fetchFrota(params?: {
  situacao?: "ATIVO" | "BAIXADO" | "INATIVO";
}): Promise<FrotaResponse> {
  const key = `frota:${JSON.stringify(params ?? {})}`;
  return cached(key, () => callEdge<FrotaResponse>(ENDPOINT_FROTA, params ?? {}), TTL_FROTA);
}

// ─── Exports públicos: MANUTENCAO ─────────────────────────────────────────────

/**
 * Busca as ordens de manutenção do período.
 * Defaults no servidor: dataInicio = 2024-01-01, dataFim = hoje.
 */
export async function fetchManutencao(params?: {
  dataInicio?: string;
  dataFim?: string;
  filial?: string | null;
}): Promise<ManutencaoResponse> {
  const key = `manutencao:${JSON.stringify(params ?? {})}`;
  return cached(key, () => callEdge<ManutencaoResponse>(ENDPOINT_MANUTENCAO, params ?? {}), TTL_FROTA);
}

// ─── Exports públicos: COMPRAS ────────────────────────────────────────────────

export async function fetchCompras(params?: {
  dataInicio?: string;
  dataFim?: string;
}): Promise<ComprasResponse> {
  const key = `compras:${JSON.stringify(params ?? {})}`;
  return cached(key, () => callEdge<ComprasResponse>(ENDPOINT_COMPRAS, params ?? {}));
}

// ─── Exports públicos: ABASTECIMENTO ─────────────────────────────────────────

export async function fetchAbastecimento(params?: {
  dataInicio?: string;
  dataFim?: string;
}): Promise<AbastecimentoResponse> {
  const key = `abastecimento:${JSON.stringify(params ?? {})}`;
  return cached(key, () => callEdge<AbastecimentoResponse>(ENDPOINT_ABASTECIMENTO, params ?? {}), TTL_FROTA);
}

// ─── Exports públicos: RH ─────────────────────────────────────────────────────

/**
 * Busca todos os colaboradores da RODMOT.
 * Passe situacao: null para retornar ATIVO e INATIVO (necessário para turnover).
 */
export async function fetchRh(params?: {
  situacao?: string | null;
}): Promise<RhResponse> {
  const key = `rh:${JSON.stringify(params ?? {})}`;
  return cached(key, () => callEdge<RhResponse>(ENDPOINT_RH, params ?? {}), TTL_RH);
}

// ─── Exports públicos: OPERACIONAL ────────────────────────────────────────────

/**
 * Busca o estado atual de todos os veículos monitorados (VRMON_VEICULO).
 * Sem filtro de período — retorna o snapshot em tempo real.
 */
export async function fetchOperacional(): Promise<OperacionalResponse> {
  return cached("operacional:all", () =>
    callEdge<OperacionalResponse>(ENDPOINT_OPERACIONAL, {}),
    TTL_OPERACIONAL,
  );
}

// ─── Exports públicos: FATURAMENTO RESUMO ────────────────────────────────────

export async function fetchFaturamentoResumo(): Promise<FaturamentoResumoResponse> {
  return cached("faturamento:resumo", () =>
    callEdge<FaturamentoResumoResponse>(ENDPOINT_FATURAMENTO_RESUMO, {}),
    TTL_FINANCEIRO,
  );
}

// ─── Tipos: FINANCIAMENTO FROTA ───────────────────────────────────────────────

export interface FinanciamentoFrotaRow {
  data_referencia:   string | null;  // D.DATREF
  data_vencimento:   string | null;  // I.DATVEN — usado para filtro de período client-side
  contrato:          string | number | null;
  nota:              string | number | null;
  valor_aquisicao:   number | null;
  valor_contrato:    number | null;
  parcela_atual:     number | null;
  total_parcelas:    number | null;
  tipo:              string | null;
  filial:            string | null;
  banco:             string | null;
  veiculo:           string | null;
  frota:             string | null;
  anomod:            number | null;
  anofab:            number | null;
  chassi:            string | null;
  situacao:          string | null;
  valor_parcela:     number | null;
  valor_parcela_base:number | null;  // I.VLRPAR
  juros:             number | null;
  valor_desconto:    number | null;
  vlrliq:            number | null;
  valor_pago:        number | null;
}

export interface FinanciamentoFrotaResponse {
  data: FinanciamentoFrotaRow[];
}

// ─── Exports públicos: FINANCIAMENTO FROTA ───────────────────────────────────

export async function fetchFinanciamentoFrota(params?: {
  dataInicio?: string | null;
  dataFim?:    string | null;
  filial?:     string | null;
  banco?:      string | null;
  situacao?:   string | null;
}): Promise<FinanciamentoFrotaResponse> {
  const key = `financiamento-frota:${JSON.stringify(params ?? {})}`;
  return cached(key, () =>
    callEdge<FinanciamentoFrotaResponse>(ENDPOINT_FINANCIAMENTO_FROTA, params ?? {}),
    TTL_FROTA,
  );
}

// ─── Exports públicos: BANCOS ───────────────────────────────────────────────

export async function fetchBankAccounts(params?: {
  filial?:      string | null;
  empresa?:     string | null;
  dataInicio?:  string | null;
  dataFim?:     string | null;
}): Promise<BankAccountsResponse> {
  const key = `bancos:${JSON.stringify(params ?? {})}`;
  return cached(key, () =>
    callEdge<BankAccountsResponse>(ENDPOINT_BANCOS, params ?? {}),
    60 * 2, // 2 min cache
  );
}

// ── Extrato bancário por conta (/dw-bancos-extrato) ──────────────────────────
const ENDPOINT_BANCOS_EXTRATO = LOCAL_API_URL
  ? `${LOCAL_API_URL}/dw-bancos-extrato`
  : `${SUPABASE_URL}/functions/v1/dw-bancos-extrato`;

export interface BancoExtratoRow {
  COD_CONTA:         string;
  FILIAL:            number;
  DOCUMENTO:         string | null;
  TIPO_DOCUMENTO:    string | null;
  DEBCRE:            'C' | 'D';
  VLRDOC:            number;
  DATA_LANCAMENTO:   string | null;
  DATA_COMPENSACAO:  string | null;
  HISTORICO:         string;
  CENTRO_CUSTO:      string;
  ANALITICA:         string;
  ORIGEM:            'LB_C' | 'LB_D';
  SITUACAO:          string;
}

export async function fetchBancoExtrato(params: {
  codcta:      string;
  codfil?:     number | null;
  filial?:     string | null;
  empresa?:    string | null;
  dataInicio?: string | null;
  dataFim?:    string | null;
}): Promise<{ data: BancoExtratoRow[]; total: number }> {
  // sem cache — carrega sempre que conta/período mudar
  return callEdge<{ data: BancoExtratoRow[]; total: number }>(
    ENDPOINT_BANCOS_EXTRATO, params
  );
}
