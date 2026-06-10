import { useState, useCallback } from "react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { motion } from "framer-motion";
import {
  Upload,
  CalendarIcon,
  Download,
  CheckCircle2,
  XCircle,
  FileCheck,
  FileSpreadsheet,
} from "lucide-react";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

import { toast } from "@/hooks/use-toast";
import {
  processarMartinBrower,
  gerarPlanilhaFinal,
} from "@/lib/processors/martin-brower";

import type { ProcessingResult } from "@/lib/processors/types";
import { addRecord } from "@/lib/history";

import {
  SummaryCard,
  HighlightCard,
  SectionContainer,
  DataTable,
  StatusCard,
} from "@/components/dashboard";
import { ClientPageHeader, UploadZone, AccentButton, ActionPanel } from "@/components/client";

const MartinBrower = () => {
  const [file, setFile] = useState<File | null>(null);
  const [dataRecebimento, setDataRecebimento] = useState<Date>();
  const [dataVencimento, setDataVencimento] = useState<Date>();
  const [valorBanco, setValorBanco] = useState("");
  const [result, setResult] = useState<ProcessingResult | null>(null);
  const [processing, setProcessing] = useState(false);

  const valorBancoNum = parseFloat(valorBanco.replace(",", ".")) || 0;
  const canProcess =
    file && dataRecebimento && dataVencimento && valorBancoNum > 0;

  const handleFileChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    setFile(f);
    setResult(null);
    toast({ title: "Planilha carregada", description: f.name });
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    const f = e.dataTransfer.files[0];
    if (f && /\.xlsx?$/i.test(f.name)) {
      setFile(f);
      setResult(null);
      toast({ title: "Planilha carregada", description: f.name });
    }
  }, []);

  const handleProcess = async () => {
    if (!file || !dataRecebimento || !dataVencimento) return;
    setProcessing(true);
    try {
      const buffer = await file.arrayBuffer();
      const res = processarMartinBrower(buffer, dataVencimento);
      setResult(res);
      if (res.totalLinhasLidas > 0) {
        const statusConf =
          Math.abs(res.totalValorBruto - valorBancoNum) < 0.01
            ? "confere"
            : "diverge";
        void addRecord({
          cliente: "Martin Brower",
          dataProcessamento: new Date().toISOString(),
          dataVencimento: dataVencimento.toISOString(),
          dataRecebimento: dataRecebimento.toISOString(),
          quantidadeDocumentos: res.totalDocumentos,
          valorTotal: res.totalValorBruto,
          valorInformadoBanco: valorBancoNum,
          statusConferencia: statusConf,
          quantidadeErros: res.totalLinhasComErro,
          payload: { tipo: "martin-brower", resultado: res },
        });
      }
      if (res.totalLinhasValidas === 0) {
        toast({ title: "Nenhuma linha válida", description: "Nenhum documento encontrado.", variant: "destructive" });
      }
    } catch (err) {
      toast({ title: "Erro ao processar", variant: "destructive" });
    } finally {
      setProcessing(false);
    }
  };

  const handleDownload = () => {
    if (!result || !dataRecebimento) return;
    const buffer = gerarPlanilhaFinal(result.documents, dataRecebimento);
    const blob = new Blob([buffer]);
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `baixa_${format(dataRecebimento, "yyyy-MM-dd")}.xlsx`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const formatBRL = (v: number) =>
    v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

  return (
    <div className="w-full">
      <div className="mx-auto max-w-[1560px] py-2">
        <ClientPageHeader
          badgeIcon={FileSpreadsheet}
          badgeLabel="Cliente Martin Brower"
          title="Baixa por aviso bancário"
          description="Envie a planilha de avisos bancários, informe as datas e o valor do banco. O sistema processa, valida e gera a planilha final de baixa."
          infoCards={[
            { label: "Entrada", value: "Planilha de avisos (.xlsx)" },
            { label: "Saída", value: "Planilha de baixa com conferência" },
          ]}
        />

        {/* Upload + Parameters */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.04, duration: 0.3 }}
          className="mb-6 grid gap-6 xl:grid-cols-[1.3fr_0.7fr]"
        >
          <UploadZone
            id="mb-file-input"
            file={file}
            title="Planilha de entrada"
            description="Formatos aceitos: .xlsx e .xls"
            accept=".xlsx,.xls"
            onChange={handleFileChange}
            onDrop={handleDrop}
            icon={Upload}
          />

          <ActionPanel
            icon={CalendarIcon}
            title="Parâmetros"
            description="Datas e valor do banco para conferência."
          >
            <div className="grid gap-5">
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Data Recebimento</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className={cn(
                        "w-full justify-start text-left font-normal border-border bg-muted/50",
                        !dataRecebimento && "text-muted-foreground"
                      )}
                    >
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {dataRecebimento
                        ? format(dataRecebimento, "dd/MM/yyyy", { locale: ptBR })
                        : "Selecione"}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar mode="single" selected={dataRecebimento} onSelect={setDataRecebimento} locale={ptBR} />
                  </PopoverContent>
                </Popover>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Data Vencimento</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className={cn(
                        "w-full justify-start text-left font-normal border-border bg-muted/50",
                        !dataVencimento && "text-muted-foreground"
                      )}
                    >
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {dataVencimento
                        ? format(dataVencimento, "dd/MM/yyyy", { locale: ptBR })
                        : "Selecione"}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar mode="single" selected={dataVencimento} onSelect={setDataVencimento} locale={ptBR} />
                  </PopoverContent>
                </Popover>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Valor Banco</Label>
                <Input
                  placeholder="0,00"
                  value={valorBanco}
                  onChange={(e) => setValorBanco(e.target.value)}
                  className="border-border bg-muted/50"
                />
              </div>

              <AccentButton
                onClick={handleProcess}
                disabled={!canProcess || processing}
              >
                {processing ? "Processando..." : "Processar"}
              </AccentButton>
            </div>
          </ActionPanel>
        </motion.div>

        {/* Results */}
        {result && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4 }}
            className="space-y-5"
          >
            <SectionContainer title="Conferência">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <HighlightCard label="Total Planilha" value={formatBRL(result.totalValorBruto)} color="neutral" />
                <HighlightCard label="Valor Banco" value={formatBRL(valorBancoNum)} color="neutral" />
                <HighlightCard
                  label="Diferença"
                  value={formatBRL(Math.abs(result.totalValorBruto - valorBancoNum))}
                  color={Math.abs(result.totalValorBruto - valorBancoNum) < 0.01 ? "emerald" : "red"}
                />
              </div>
              <div className="mt-4">
                <StatusCard
                  title={Math.abs(result.totalValorBruto - valorBancoNum) < 0.01 ? "Confere" : "Diverge"}
                  description="Status da conferência com valor bancário"
                  icon={Math.abs(result.totalValorBruto - valorBancoNum) < 0.01 ? CheckCircle2 : XCircle}
                  variant={Math.abs(result.totalValorBruto - valorBancoNum) < 0.01 ? "success" : "error"}
                />
              </div>
            </SectionContainer>

            <SectionContainer title="Auditoria do Processamento">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <SummaryCard label="Linhas lidas" value={String(result.totalLinhasLidas)} index={0} />
                <SummaryCard label="Filtradas por data" value={String(result.totalLinhasFiltradasData)} index={1} />
                <SummaryCard label="Pgto. vazio (mantidas)" value={String(result.totalLinhasPagamentoVazio)} index={2} />
                <SummaryCard label="Removidas por pgto." value={String(result.totalLinhasRemovidasPagamento)} index={3} />
                <SummaryCard label="Documentos válidos" value={String(result.totalLinhasValidas)} index={4} />
                <SummaryCard label="Com erro" value={String(result.totalLinhasComErro)} index={5} />
                <SummaryCard label="Ignoradas (subtotal)" value={String(result.totalLinhasIgnoradas)} index={6} />
                <SummaryCard label="Total documentos" value={String(result.totalDocumentos)} index={7} />
              </div>
            </SectionContainer>

            {result.preview.length > 0 && (
              <SectionContainer title="Preview de Validação" subtitle="Primeiras 20 linhas processadas">
                <DataTable
                  columns={[
                    { key: "row", label: "Linha" },
                    { key: "dataVcto", label: "Data Vcto." },
                    { key: "dataPagamento", label: "Data Pagamento" },
                    { key: "faturaOriginal", label: "Nº Fatura" },
                    { key: "serie", label: "Série" },
                    { key: "numeroDocumento", label: "Nº Documento" },
                    { key: "valorBrutoConvertido", label: "Valor Bruto", render: (row) => row.valorBrutoConvertido != null ? formatBRL(row.valorBrutoConvertido) : "—" },
                    { key: "status", label: "Status", render: (row) => {
                      const s = row.status;
                      const color = s === "válida" ? "text-emerald-400" : s === "erro" ? "text-red-400" : "text-amber-400";
                      return <span className={color}>{s}</span>;
                    }},
                  ]}
                  data={result.preview}
                  keyExtractor={(row, i) => `preview-${row.row}-${i}`}
                />
              </SectionContainer>
            )}

            {result.errors.length > 0 && (
              <SectionContainer title="Erros encontrados">
                <DataTable
                  columns={[
                    { key: "row", label: "Linha" },
                    { key: "fatura", label: "Nº Fatura" },
                    { key: "motivo", label: "Motivo" },
                  ]}
                  data={result.errors}
                  keyExtractor={(row, i) => `err-${row.row}-${i}`}
                />
              </SectionContainer>
            )}

            {result.totalDocumentos > 0 && (
              <div className="flex justify-end">
                <AccentButton onClick={handleDownload}>
                  <Download className="h-4 w-4" />
                  Baixar planilha final
                </AccentButton>
              </div>
            )}
          </motion.div>
        )}
      </div>
    </div>
  );
};

export default MartinBrower;
