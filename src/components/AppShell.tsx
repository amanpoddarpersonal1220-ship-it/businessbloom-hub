import { useState, type ReactNode } from "react";
import {
  Bell,
  LogOut,
  Menu,
  ShieldCheck,
  Briefcase,
  Building2,
  Moon,
  Sun,
  Languages,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuth, type AppRole } from "@/hooks/useAuth";
import { useNotifications } from "@/hooks/useNotifications";
import { useTheme } from "@/hooks/useTheme";
import { useLanguage } from "@/hooks/useLanguage";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";
import { StatusBadge } from "@/components/StatusBadge";
import { formatDate } from "@/lib/format";
import { usePresence } from "@/lib/realtime/usePresence";
import { useRealtimeStatus } from "@/lib/realtime/RealtimeProvider";
import { Radio } from "lucide-react";

export interface NavItem {
  key: string;
  label: string;
  icon: LucideIcon;
}

const roleMeta: Record<AppRole, { label: string; icon: LucideIcon }> = {
  admin: { label: "Administrator", icon: ShieldCheck },
  employee: { label: "Field Employee", icon: Briefcase },
  client: { label: "Client Portal", icon: Building2 },
};

export function AppShell({
  navItems,
  active,
  onSelect,
  headerExtra,
  children,
}: {
  navItems: NavItem[];
  active: string;
  onSelect: (key: string) => void;
  headerExtra?: ReactNode;
  children: ReactNode;
}) {
  const { profile, role, signOut } = useAuth();
  const { t } = useLanguage();
  const [mobileOpen, setMobileOpen] = useState(false);
  const meta = role ? roleMeta[role] : null;
  const RoleIcon = meta?.icon ?? Building2;

  const activeLabel = navItems.find((n) => n.key === active)?.label ?? "";

  return (
    <div className="flex min-h-screen bg-background">
      {/* Sidebar */}
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-40 w-64 flex-col bg-sidebar text-sidebar-foreground transition-transform md:static md:flex md:translate-x-0",
          mobileOpen ? "flex translate-x-0" : "hidden -translate-x-full",
        )}
      >
        <div className="flex items-center gap-2 px-5 py-5 border-b border-sidebar-border">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-sidebar-primary text-sidebar-primary-foreground font-display font-bold">
            T
          </div>
          <div className="leading-tight">
            <div className="font-display font-semibold text-white text-sm">TradeLedger</div>
            <div className="text-[11px] text-sidebar-foreground/70">Credit Management</div>
          </div>
        </div>

        <div className="flex items-center gap-2 px-5 py-3 text-xs text-sidebar-foreground/80">
          <RoleIcon className="h-3.5 w-3.5" />
          {meta ? t(meta.label) : null}
        </div>

        <nav className="flex-1 space-y-1 px-3 py-2">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = item.key === active;
            return (
              <button
                key={item.key}
                onClick={() => {
                  onSelect(item.key);
                  setMobileOpen(false);
                }}
                className={cn(
                  "flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",
                  isActive
                    ? "bg-sidebar-primary text-sidebar-primary-foreground"
                    : "text-sidebar-foreground hover:bg-sidebar-accent hover:text-white",
                )}
              >
                <Icon className="h-4 w-4 shrink-0" />
                {t(item.label)}
              </button>
            );
          })}
        </nav>

        <div className="border-t border-sidebar-border p-3">
          <div className="mb-2 px-2">
            <div className="text-sm font-medium text-white truncate">{profile?.name}</div>
            <div className="text-[11px] text-sidebar-foreground/70 truncate">{profile?.email}</div>
          </div>
          <Button
            variant="ghost"
            size="sm"
            className="w-full justify-start text-sidebar-foreground hover:bg-sidebar-accent hover:text-white"
            onClick={() => signOut()}
          >
            <LogOut className="mr-2 h-4 w-4" /> {t("Sign out")}
          </Button>
        </div>
      </aside>

      {mobileOpen && (
        <div
          className="fixed inset-0 z-30 bg-black/40 md:hidden"
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* Main */}
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-20 flex items-center gap-3 border-b border-border bg-card/80 px-4 py-3 backdrop-blur md:px-6">
          <Button
            variant="ghost"
            size="icon"
            className="md:hidden"
            onClick={() => setMobileOpen(true)}
          >
            <Menu className="h-5 w-5" />
          </Button>
          <h1 className="font-display text-lg font-semibold text-foreground">{t(activeLabel)}</h1>
          <div className="ml-auto flex items-center gap-2">
            {headerExtra}
            <LiveIndicator />
            <LanguageToggle />
            <ThemeToggle />
            <NotificationBell />
          </div>
        </header>

        <main className="flex-1 p-4 md:p-6">{children}</main>
      </div>
    </div>
  );
}

function ThemeToggle() {
  const { theme, toggleTheme } = useTheme();
  const { t } = useLanguage();
  return (
    <Button
      variant="outline"
      size="icon"
      onClick={toggleTheme}
      aria-label={theme === "dark" ? t("Light mode") : t("Dark mode")}
      title={theme === "dark" ? t("Light mode") : t("Dark mode")}
    >
      {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
    </Button>
  );
}

function LiveIndicator() {
  const { online } = usePresence();
  const status = useRealtimeStatus();
  const dotClass =
    status === "connected" ? "bg-success animate-pulse" : status === "connecting" ? "bg-warning" : "bg-destructive";
  return (
    <div
      className="hidden items-center gap-1.5 rounded-full border border-border bg-card px-2.5 py-1 text-xs font-medium sm:flex"
      title={`${online.length} online · ${status}`}
    >
      <span className={cn("h-2 w-2 rounded-full", dotClass)} />
      <Radio className="h-3 w-3 text-muted-foreground" />
      <span className="tabular-nums">{online.length}</span>
    </div>
  );
}

function LanguageToggle() {
  const { lang, toggleLang } = useLanguage();
  return (
    <Button
      variant="outline"
      size="sm"
      onClick={toggleLang}
      className="gap-1.5"
      aria-label="Change language"
      title="Change language"
    >
      <Languages className="h-4 w-4" />
      {lang === "en" ? "EN" : "हि"}
    </Button>
  );
}

function NotificationBell() {
  const { items, unread, markAllRead } = useNotifications();
  const { t } = useLanguage();
  return (
    <Popover onOpenChange={(o) => o && markAllRead()}>
      <PopoverTrigger asChild>
        <Button variant="outline" size="icon" className="relative">
          <Bell className="h-4 w-4" />
          {unread > 0 && (
            <span className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-destructive px-1 text-[10px] font-semibold text-destructive-foreground">
              {unread}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80 p-0">
        <div className="flex items-center justify-between border-b border-border px-4 py-2.5">
          <span className="text-sm font-semibold">{t("Notifications")}</span>
          <StatusBadge tone="success">{t("WhatsApp + in-app")}</StatusBadge>
        </div>
        <ScrollArea className="max-h-80">
          {items.length === 0 ? (
            <div className="px-4 py-8 text-center text-sm text-muted-foreground">
              {t("No notifications")}
            </div>
          ) : (
            <ul className="divide-y divide-border">
              {items.map((n) => (
                <li key={n.id} className="px-4 py-3">
                  <div className="flex items-start gap-2">
                    <span
                      className={cn(
                        "mt-1.5 h-2 w-2 shrink-0 rounded-full",
                        n.tone === "destructive" && "bg-destructive",
                        n.tone === "success" && "bg-success",
                        n.tone === "warning" && "bg-warning",
                        n.tone === "info" && "bg-info",
                      )}
                    />
                    <div className="min-w-0">
                      <div className="text-sm font-medium leading-snug">{n.title}</div>
                      {n.body && (
                        <div className="text-xs text-muted-foreground">{n.body}</div>
                      )}
                      <div className="mt-1 text-[10px] text-muted-foreground">
                        {formatDate(n.at)}
                      </div>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </ScrollArea>
      </PopoverContent>
    </Popover>
  );
}