import { useLocation, useNavigate } from "react-router-dom";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  Building2,
  Fuel,
  FileSearch,
  History,
  Landmark,
  LayoutDashboard,
  LogOut,
  Settings,
  Shield,
  X,
  BarChart3,
} from "lucide-react";
import { getRecords } from "@/lib/history";
import { useAuth } from "@/contexts/AuthContext";
import { useModulePermissions } from "@/hooks/useModulePermissions";

interface NavItem {
  title: string;
  icon: React.ComponentType<{ className?: string }>;
  path: string;
  showBadge?: boolean;
  masterOnly?: boolean;
  moduleKey?: string;
}

const navSections: { label: string; items: NavItem[] }[] = [
  {
    label: "Visão geral",
    items: [
      { title: "Dashboard", icon: LayoutDashboard, path: "/dashboard", moduleKey: "dashboard" },
      { title: "Histórico", icon: History, path: "/historico", showBadge: true, moduleKey: "historico" },
    ],
  },
  {
    label: "Fiscal",
    items: [
      { title: "NF-e / NFS-e", icon: FileSearch, path: "/conciliacao", moduleKey: "conciliacao" },
      { title: "Contas a Pagar", icon: Landmark, path: "/contas-a-pagar", moduleKey: "contas-a-pagar" },
    ],
  },
  {
    label: "Frota",
    items: [
      { title: "Abastecimento", icon: Fuel, path: "/abastecimento", moduleKey: "abastecimento" },
      { title: "Médias de Abastecimento", icon: BarChart3, path: "/medias-abastecimento", moduleKey: "medias-abastecimento" },
    ],
  },
  {
    label: "Sistema",
    items: [
      { title: "Clientes", icon: Building2, path: "/clientes", moduleKey: "clientes" },
      { title: "Usuários", icon: Shield, path: "/usuarios", masterOnly: true },
      { title: "Configurações", icon: Settings, path: "/configuracoes", moduleKey: "configuracoes" },
    ],
  },
];

interface DashboardSidebarProps {
  open: boolean;
  onClose: () => void;
}

const DashboardSidebar = ({ open, onClose }: DashboardSidebarProps) => {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, signOut } = useAuth();
  const { canView, isMaster } = useModulePermissions();
  const [historyCount, setHistoryCount] = useState(0);

  useEffect(() => {
    getRecords().then((records) => setHistoryCount(records.length));
  }, []);

  const [profileData, setProfileData] = useState<{
    avatar_url: string | null;
    display_name: string | null;
    full_name: string | null;
  } | null>(null);

  useEffect(() => {
    if (!user) return;

    supabase
      .from("profiles")
      .select("avatar_url, display_name, full_name")
      .eq("user_id", user.id)
      .single()
      .then(({ data }) => {
        if (data) setProfileData(data);
      });
  }, [user]);

  useEffect(() => {
    onClose();
  }, [location.pathname, onClose]);

  const isActive = (path: string) => {
    if (path === "/dashboard") return location.pathname === "/dashboard";
    return location.pathname.startsWith(path);
  };

  const handleLogout = async () => {
    await signOut();
    navigate("/login", { replace: true });
  };

  const handleNavigate = (path: string) => {
    navigate(path);
  };

  const displayName =
    profileData?.display_name ||
    profileData?.full_name ||
    user?.user_metadata?.full_name ||
    user?.email ||
    "Usuário";

  const initials = displayName
    .split(" ")
    .map((n: string) => n[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  const avatarUrl = profileData?.avatar_url || null;

  const sidebarContent = (
    <div className="flex h-full flex-col px-3 py-4">
      <div className="mb-2 flex items-center justify-end md:hidden">
        <button
          onClick={onClose}
          className="flex h-8 w-8 items-center justify-center rounded-xl border border-transparent text-muted-foreground transition-all duration-200 hover:translate-y-0 hover:border-white/8 hover:bg-white/[0.045] hover:text-foreground active:translate-y-0 active:scale-[0.98]"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      <nav className="mac-scroll flex-1 space-y-5 overflow-y-auto pr-1">
        {navSections.map((section) => {
          const visibleItems = section.items.filter((item) => {
            if (item.masterOnly && !isMaster) return false;
            if (item.moduleKey && !canView(item.moduleKey)) return false;
            return true;
          });

          if (visibleItems.length === 0) return null;

          return (
            <div key={section.label}>
              <p className="mb-2 px-3 text-[10px] font-semibold uppercase tracking-[0.18em] text-white/32">
                {section.label}
              </p>

              <div className="space-y-1.5">
                {visibleItems.map((item) => {
                  const active = isActive(item.path);

                  return (
                    <button
                      key={item.path}
                      type="button"
                      onClick={() => handleNavigate(item.path)}
                      className={[
                        "group relative flex w-full items-center gap-3 overflow-hidden rounded-2xl border px-4 py-3 text-[13px] font-medium transition-all duration-200",
                        "hover:translate-y-0 active:translate-y-0 active:scale-[0.995]",
                        active
                          ? "border-white/[0.11] bg-white/[0.07] text-white shadow-[0_10px_30px_rgba(0,0,0,0.20),inset_0_1px_0_rgba(255,255,255,0.06)]"
                          : "border-transparent bg-transparent text-white/58 hover:border-white/[0.05] hover:bg-white/[0.04] hover:text-white/90",
                      ].join(" ")}
                    >
                      <span
                        className={[
                          "pointer-events-none absolute inset-y-[8px] left-0 w-[3px] rounded-r-full transition-all duration-200",
                          active
                            ? "bg-primary opacity-100 shadow-[0_0_14px_rgba(250,199,117,0.35)]"
                            : "bg-primary opacity-0 group-hover:opacity-45",
                        ].join(" ")}
                      />

                      <span
                        className={[
                          "pointer-events-none absolute inset-0 rounded-2xl transition-opacity duration-200",
                          active ? "opacity-100" : "opacity-0 group-hover:opacity-100",
                        ].join(" ")}
                        style={{
                          background:
                            "linear-gradient(180deg, rgba(255,255,255,0.045) 0%, rgba(255,255,255,0.015) 40%, rgba(255,255,255,0) 100%)",
                        }}
                      />

                      <item.icon
                        className={`relative z-[1] h-4 w-4 shrink-0 transition-all duration-200 ${
                          active ? "text-primary" : "text-white/50 group-hover:text-white/75"
                        }`}
                      />

                      <span className="relative z-[1] flex-1 text-left tracking-[-0.01em]">
                        {item.title}
                      </span>

                      {item.showBadge && historyCount > 0 && (
                        <span className="relative z-[1] rounded-lg border border-primary/15 bg-primary/12 px-1.5 py-0.5 text-[11px] font-semibold text-primary shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]">
                          {historyCount}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          );
        })}
      </nav>

      <div className="mt-4 border-t border-white/8 pt-4">
        <div className="flex items-center gap-2.5 rounded-2xl border border-white/[0.05] bg-white/[0.025] px-2.5 py-2 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-primary/12 bg-primary/12 text-[11px] font-semibold text-primary shadow-[inset_0_1px_0_rgba(255,255,255,0.05)]">
            {avatarUrl ? (
              <img src={avatarUrl} alt="Avatar" className="h-full w-full object-cover" />
            ) : (
              initials
            )}
          </div>

          <div className="min-w-0 flex-1">
            <p className="truncate text-[12px] font-semibold tracking-[-0.01em] text-white">
              {displayName}
            </p>
            <p className="truncate text-[11px] text-white/40">Sessão ativa</p>
          </div>

          <button
            type="button"
            onClick={handleLogout}
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl border border-transparent text-white/55 transition-all duration-200 hover:translate-y-0 hover:border-white/8 hover:bg-white/[0.05] hover:text-white active:translate-y-0 active:scale-[0.98]"
            title="Sair"
          >
            <LogOut className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>
    </div>
  );

  return (
    <>
      <aside className="fixed left-4 top-[68px] bottom-4 z-50 hidden w-[240px] md:flex">
        <div
          className="sidebar-shell w-full rounded-[24px] border border-white/[0.07] shadow-[0_24px_60px_rgba(0,0,0,0.26),inset_0_1px_0_rgba(255,255,255,0.05)]"
          style={{
            background:
              "linear-gradient(180deg, rgba(19,20,24,0.62) 0%, rgba(15,16,20,0.48) 100%)",
            backdropFilter: "blur(18px) saturate(1.2)",
            WebkitBackdropFilter: "blur(18px) saturate(1.2)",
          }}
        >
          {sidebarContent}
        </div>
      </aside>

      {open && (
        <div className="fixed inset-0 z-50 md:hidden">
          <div
            className="absolute inset-0 bg-black/60 backdrop-blur-sm animate-in fade-in-0 duration-200"
            onClick={onClose}
          />
          <aside className="absolute left-4 top-4 bottom-4 w-[280px]">
            <div
              className="sidebar-shell h-full rounded-[24px] border border-white/[0.08] shadow-[0_24px_60px_rgba(0,0,0,0.28),inset_0_1px_0_rgba(255,255,255,0.05)] animate-in slide-in-from-left duration-200 fade-in-0"
              style={{
                background:
                  "linear-gradient(180deg, rgba(19,20,24,0.78) 0%, rgba(15,16,20,0.62) 100%)",
                backdropFilter: "blur(18px) saturate(1.22)",
                WebkitBackdropFilter: "blur(18px) saturate(1.22)",
              }}
            >
              {sidebarContent}
            </div>
          </aside>
        </div>
      )}
    </>
  );
};

export default DashboardSidebar;