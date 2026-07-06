import {
  createContext,
  useContext,
  useState,
  useCallback,
  type ReactNode,
} from "react";
import { toast } from "sonner";

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

const seed: AppNotification[] = [
  {
    id: "n1",
    title: "Invoice INV-2001 overdue",
    body: "Bharat Steel Co — ₹2,40,000 overdue by 5 days.",
    tone: "destructive",
    read: false,
    at: new Date(Date.now() - 3600_000).toISOString(),
  },
  {
    id: "n2",
    title: "New order awaiting confirmation",
    body: "ORD-1001 for Acme Traders Pvt Ltd.",
    tone: "info",
    read: false,
    at: new Date(Date.now() - 7200_000).toISOString(),
  },
];

export function NotificationsProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<AppNotification[]>(seed);

  const notify = useCallback<NotificationsValue["notify"]>((n, opts) => {
    const item: AppNotification = {
      ...n,
      id: crypto.randomUUID(),
      read: false,
      at: new Date().toISOString(),
    };
    setItems((prev) => [item, ...prev]);
    if (!opts?.silent) {
      const description = n.body ? `WhatsApp + in-app · ${n.body}` : "WhatsApp + in-app";
      const fn =
        n.tone === "success"
          ? toast.success
          : n.tone === "destructive"
            ? toast.error
            : n.tone === "warning"
              ? toast.warning
              : toast.info;
      fn(n.title, { description });
    }
  }, []);

  const value: NotificationsValue = {
    items,
    unread: items.filter((i) => !i.read).length,
    notify,
    markAllRead: () => setItems((prev) => prev.map((i) => ({ ...i, read: true }))),
    clear: () => setItems([]),
  };

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useNotifications() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useNotifications must be used within NotificationsProvider");
  return ctx;
}