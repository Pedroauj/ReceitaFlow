import { useNavigate } from "react-router-dom";
import { Construction, ArrowLeft } from "lucide-react";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import SectionContainer from "@/components/dashboard/SectionContainer";

interface ClientePlaceholderProps {
  clientName: string;
}

const ClientePlaceholder = ({ clientName }: ClientePlaceholderProps) => {
  const navigate = useNavigate();

  return (
    <div className="space-y-5">
      <motion.div
        initial={{ opacity: 0, y: -6 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.25 }}
        className="flex items-center gap-3"
      >
        <button
          onClick={() => navigate("/dashboard")}
          className="h-8 w-8 rounded-xl flex items-center justify-center border border-border bg-muted text-muted-foreground transition-colors hover:bg-violet-500/10 hover:text-violet-400 hover:border-violet-500/20"
        >
          <ArrowLeft className="h-4 w-4" />
        </button>
        <div>
          <h1 className="text-xl font-semibold text-foreground tracking-tight">
            {clientName}
          </h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            Conversor de planilha financeira
          </p>
        </div>
      </motion.div>

      <SectionContainer delay={0.1}>
        <div className="flex flex-col items-center text-center py-8 max-w-lg mx-auto">
          <div className="h-14 w-14 rounded-xl flex items-center justify-center mb-5 bg-violet-500/10">
            <Construction className="h-7 w-7 text-violet-400" />
          </div>
          <h2 className="text-lg font-semibold text-foreground mb-2">
            Em desenvolvimento
          </h2>
          <p className="text-sm text-muted-foreground">
            Conversor em desenvolvimento. As regras deste cliente serão configuradas posteriormente.
          </p>
          <Button
            className="mt-6 bg-violet-500 text-violet-400-foreground text-xs h-9 px-5 rounded-xl border-0"
            onClick={() => navigate("/dashboard")}
          >
            Voltar ao dashboard
          </Button>
        </div>
      </SectionContainer>
    </div>
  );
};

export default ClientePlaceholder;
