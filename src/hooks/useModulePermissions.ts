import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

interface ModulePermission {
  module_key: string;
  can_view: boolean;
  can_edit: boolean;
}

export function useModulePermissions() {
  const { user } = useAuth();
  const [permissions, setPermissions] = useState<ModulePermission[]>([]);
  const [isMaster, setIsMaster] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) {
      setLoading(false);
      return;
    }

    const load = async () => {
      try {
        const [{ data: profile }, { data: perms }] = await Promise.all([
          supabase.from("profiles").select("role").eq("user_id", user.id).single(),
          supabase.from("user_module_permissions").select("module_key, can_view, can_edit").eq("user_id", user.id),
        ]);

        const master = profile?.role === "master";
        setIsMaster(master);
        setPermissions(perms || []);
      } catch {
        setPermissions([]);
      } finally {
        setLoading(false);
      }
    };

    load();
  }, [user]);

  const canView = (moduleKey: string): boolean => {
    if (isMaster) return true;
    const perm = permissions.find((p) => p.module_key === moduleKey);
    // If no permission record exists, deny access by default
    return perm?.can_view ?? false;
  };

  const canEdit = (moduleKey: string): boolean => {
    if (isMaster) return true;
    const perm = permissions.find((p) => p.module_key === moduleKey);
    return perm?.can_edit ?? false;
  };

  return { canView, canEdit, isMaster, loading };
}
