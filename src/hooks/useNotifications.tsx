import {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  type ReactNode,
} from "react";
import { toast } from "sonner";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

export interface AppNotification {
  id: string;
  title: string;
  body?: string;
  tone: "info" | "success" | "warning" | "destructive";
  read: boolean;
  at: string;
}

interface NotificationsValue {
  items: AppNotification[];
  unread: number;
  notify: (n: Omit<AppNotification, "id" | "read" | "at">, opts?: { silent?: boolean }) => void;
  markAllRead: () => void;
  clear: () => void;
}

const Ctx = createContext<NotificationsValue | undefined>(undefined);

function toneToast(tone: AppNotification["tone"]) {
  return tone === "success"
    ? toast.success
    : tone === "destructive"
      ? toast.error
      : tone === "warning"
        ? toast.warning
        : toast.info;
}

function rowToItem(r: any): AppNotification {
  return {
    id: r.id,
    title: r.title,
    body: r.body ?? undefined,
    tone: (r.tone ?? "info") as AppNotification["tone"],
    read: !!r.read,
    at: r.created_at,
  };
}

export function NotificationsProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [transient, setTransient] = useState<AppNotification[]>([]);

  const q = useQuery({
    queryKey: ["notifications", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data } = await (supabase as any)
        .from("notifications")
        .select("*")
        .eq("user_id", user!.id)
        .order("created_at", { ascending: false })
        .limit(50);
      return (data ?? []).map(rowToItem);
    },
  });

  // Realtime: new notifications for this user
  useEffect(() => {
    if (!user) return;
    const chan = supabase
      .channel(`notifications:${user.id}`)
      .on(
        "postgres_changes" as any,
        { event: "INSERT", schema: "public", table: "notifications", filter: `user_id=eq.${user.id}` },
        (payload: any) => {
          const item = rowToItem(payload.new);
          qc.setQueryData<AppNotification[]>(["notifications", user.id], (prev) => [
            item,
            ...(prev ?? []),
          ]);
          const description = item.body ? `WhatsApp + in-app · ${item.body}` : "WhatsApp + in-app";
          toneToast(item.tone)(item.title, { description });
        },
      )
      .on(
        "postgres_changes" as any,
        { event: "UPDATE", schema: "public", table: "notifications", filter: `user_id=eq.${user.id}` },
        () => qc.invalidateQueries({ queryKey: ["notifications", user.id] }),
      )
      .subscribe();
    return () => {
      supabase.removeChannel(chan);
    };
  }, [user, qc]);

  const items = [...transient, ...(q.data ?? [])];

  const notify = useCallback<NotificationsValue["notify"]>((n, opts) => {
    const item: AppNotification = {
      ...n,
      id: crypto.randomUUID(),
      read: false,
      at: new Date().toISOString(),
    };
    setTransient((prev) => [item, ...prev].slice(0, 20));
    if (!opts?.silent) {
      const description = n.body ? `WhatsApp + in-app · ${n.body}` : "WhatsApp + in-app";
      toneToast(n.tone)(n.title, { description });
    }
  }, []);

  const markAllRead = useCallback(async () => {
    if (!user) return;
    setTransient((prev) => prev.map((i) => ({ ...i, read: true })));
    await (supabase as any)
      .from("notifications")
      .update({ read: true })
      .eq("user_id", user.id)
      .eq("read", false);
    qc.invalidateQueries({ queryKey: ["notifications", user.id] });
  }, [user, qc]);

  const clear = useCallback(async () => {
    if (!user) return;
    setTransient([]);
    await (supabase as any).from("notifications").delete().eq("user_id", user.id);
    qc.invalidateQueries({ queryKey: ["notifications", user.id] });
  }, [user, qc]);

  const value: NotificationsValue = {
    items,
    unread: items.filter((i) => !i.read).length,
    notify,
    markAllRead,
    clear,
  };

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useNotifications() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useNotifications must be used within NotificationsProvider");
  return ctx;
}