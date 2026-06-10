import { useState, useCallback } from "react";
import {
  Upload,
  Download,
  FileSpreadsheet,
  BadgePercent,
} from "lucide-react";
import { motion } from "framer-motion";
import { Input } from "@/components/ui/input";
import { toast } from "@/hooks/use-toast";
import {
  processarPlatlog,
  gerarPlanilhaPlatlog,
  type PlatlogProcessingResult,
} from "@/lib/processors/platlog";
import { addRecord } from "@/lib/history";
import { SummaryCard, SectionContainer, DataTable } from "@/components/dashboard";
import { ClientPageHeader, UploadZone, AccentButton, ActionPanel } from "@/components/client";

const Platlog = () => {
  const [file, setFile] = useState<File | null>(null);
  const [discountInput, setDiscountInput] = useState("");
  const [result, setResult] = useState<PlatlogProcessingResult | null>(null);
  const [processing, setProcessing] = useState(false);

  const handleFileChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = e.target.files?.[0];
    if (!selected) return;
    if (!/\.(xlsx|xls)$/i.test(selected.name)) {
      toast({ title: "Arquivo inválido", description: "Envie uma planilha .xlsx ou .xls.", variant: "destructive" });
      return;
    }
    setFile(selected);
    setResult(null);
    toast({ title: "Planilha carregada", description: selected.name });
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    const selected = e.dataTransfer.files?.[0];
    if (!selected) return;
    if (!/\.(xlsx|xls)$/i.test(selected.name)) {
      toast({ title: "Arquivo inválido", description: "Envie uma planilha .xlsx ou .xls.", variant: "destructive" });
      return;
    }
    setFile(selected);
    setResult(null);
    toast({ title: "Planilha carregada", description: selected.name });
  }, []);

  const parseDiscountValue = (value: string): number => {
    if (!value.trim()) return 0;
    const cleaned = value.replace(/[R$\s]/g, "").replace(/\./g, "").replace(",", ".");
    const parsed = Number.parseFloat(cleaned);
    return Number.isNaN(parsed) ? 0 : Math.abs(parsed);
  };

  const handleProcess = async () => {
    if (!file) return;
    setProcessing(true);
    try {
      const buffer = await file.arrayBuffer();
      const descontoTotal = parseDiscountValue(discountInput);
      const res = await processarPlatlog({ fileName: file.name, buffer }, descontoTotal);
      setResult(res);
      if (res.totalDocumentos === 0) {
        toast({ title: "Nenhum documento encontrado", description: "Não foi possível extrair dados válidos da planilha da Platlog.", variant: "destructive" });
      } else {
        toast({ title: "Planilha processada com sucesso", description: `${res.totalDocumentos} documento(s) gerado(s).` });
        void addRecord({ cliente: "Platlog", dataProcessamento: new Date().toISOString(), dataVencimento: new Date().toISOString(), dataRecebimento: new Date().toISOString(), quantidadeDocumentos: res.totalDocumentos, valorTotal: res.totalValorFinal, valorInformadoBanco: 0, statusConferencia: "confere", quantidadeErros: 0, payload: { tipo: "platlog", resultado: res } });
      }
    } catch (error) {
      console.error(error);
      toast({ title: "Erro ao processar", description: error instanceof Error ? error.message : "Não foi possível processar a planilha da Platlog.", variant: "destructive" });
    } finally {
      setProcessing(false);
    }
  };

  const handleDownload = () => {
    if (!result) return;
    const buffer = gerarPlanilhaPlatlog(result);
    const blob = new Blob([buffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `baixa_platlog_${new Date().toISOString().slice(0, 10)}.xlsx`;
    a.click();
    URL.revokeObjectURL(url);
    toast({ title: "Arquivo gerado com sucesso", description: a.download });
  };

  const formatBRL = (value: number) =>
    value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

  return (
    <div className="w-full">
      <div className="mx-auto w-full max-w-[1560px] py-2">
        <ClientPageHeader
          badgeIcon={FileSpreadsheet}
          badgeLabel="Cliente Platlog"
          title="Processamento de baixa"
          description="Envie a planilha da Platlog, informe o desconto total recebido por e-mail e gere a planilha final já preparada para a baixa."
          infoCards={[
            { label: "Entrada", value: "Planilha .xlsx ou .xls" },
            { label: "Regra", value: "Desconto aplicado do maior para o menor valor" },
          ]}
        />

        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.04, duration: 0.3 }}
          className="mb-6 grid gap-6 xl:grid-cols-[1.3fr_0.7fr]"
        >
          <UploadZone
            id="platlog-file-input"
            file={file}
            title="Planilha de entrada"
            description="Formatos aceitos: .xlsx e .xls"
            accept=".xlsx,.xls,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel"
            onChange={handleFileChange}
            onDrop={handleDrop}
            icon={Upload}
          />

          <ActionPanel
            icon={BadgePercent}
            title="Desconto total"
            description="Valor informado por e-mail."
            infoText="O desconto será aplicado automaticamente no documento de maior valor. Se ainda houver saldo de desconto, ele continua no próximo maior."
          >
            <div className="space-y-5">
              <div>
                <label className="mb-2 block text-sm font-medium text-foreground/90">
                  Desconto total informado por e-mail
                </label>
                <Input
                  value={discountInput}
                  onChange={(e) => { setDiscountInput(e.target.value); setResult(null); }}
                  placeholder="Ex.: 1.250,50"
                  className="h-12 border-border bg-muted/50"
                />
              </div>

              <AccentButton
                className="w-full"
                disabled={!file || processing}
                onClick={handleProcess}
              >
                {processing ? "Processando planilha..." : "Processar planilha"}
              </AccentButton>
            </div>
          </ActionPanel>
        </motion.div>

        {result && result.totalDocumentos > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3 }}
            className="space-y-6"
          >
            <SectionContainer title="Resumo do processamento">
              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                <SummaryCard label="Total de documentos" value={result.totalDocumentos} index={0} />
                <SummaryCard label="Valor original" value={formatBRL(result.totalValorOriginal)} index={1} />
                <SummaryCard label="Total de descontos" value={formatBRL(result.totalDescontos)} index={2} />
                <SummaryCard label="Valor final" value={formatBRL(result.totalValorFinal)} index={3} />
              </div>
            </SectionContainer>

            <DataTable
              title="Prévia da planilha final"
              badge={`${result.documents.length} documento(s)`}
              columns={[
                { key: "filial", label: "Filial", width: "80px" },
                { key: "serie", label: "Série", width: "80px" },
                { key: "numeroDocumento", label: "Nº Documento", width: "150px", render: (row: any) => <span className="font-mono">{row.numeroDocumento}</span> },
                { key: "tipoDocumento", label: "Tipo", width: "100px" },
                { key: "valorOriginal", label: "Valor original", width: "140px", render: (row: any) => formatBRL(row.valorOriginal) },
                { key: "descontoAplicado", label: "Desconto", width: "140px", render: (row: any) => formatBRL(row.descontoAplicado) },
                { key: "valorFinal", label: "Saldo devedor", width: "140px", className: "font-semibold", render: (row: any) => formatBRL(row.valorFinal) },
              ]}
              data={result.documents}
              keyExtractor={(row: any, i) => `${row.numeroDocumento}_${row.serie}_${i}`}
            />

            {result.descontosAplicados.length > 0 && (
              <DataTable
                title="Documentos que receberam desconto"
                badge={`${result.descontosAplicados.length} desconto(s)`}
                columns={[
                  { key: "documentoAlvo", label: "Documento", width: "150px", render: (row: any) => <span className="font-mono">{row.documentoAlvo}</span> },
                  { key: "serieAlvo", label: "Série", width: "80px" },
                  { key: "tipoDocumentoAlvo", label: "Tipo", width: "100px" },
                  { key: "valorDescontoAplicado", label: "Valor descontado", width: "140px", render: (row: any) => formatBRL(row.valorDescontoAplicado) },
                  { key: "saldoRestante", label: "Saldo restante", width: "140px", className: "font-semibold", render: (row: any) => formatBRL(row.saldoRestante) },
                ]}
                data={result.descontosAplicados}
                keyExtractor={(row: any, i) => `${row.documentoAlvo}_${i}`}
              />
            )}

            <div className="flex justify-start">
              <AccentButton onClick={handleDownload}>
                <Download className="h-4 w-4" />
                Baixar planilha final
              </AccentButton>
            </div>
          </motion.div>
        )}
      </div>
    </div>
  );
};

export default Platlog;
