import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import {
  ShieldCheck,
  Briefcase,
  Building2,
  Loader2,
  ArrowLeft,
  Smartphone,
  Moon,
  Sun,
  Languages,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useTheme } from "@/hooks/useTheme";
import { useLanguage } from "@/hooks/useLanguage";
import { Button } from "@/components/ui/button";
import {
  InputOTP,
  InputOTPGroup,
  InputOTPSlot,
} from "@/components/ui/input-otp";

export const Route = createFileRoute("/auth")({
  component: AuthPage,
});

type Role = "admin" | "employee" | "client";

const roles: {
  role: Role;
  label: string;
  email: string;
  icon: LucideIcon;
  desc: string;
  phone: string;
}[] = [
  {
    role: "admin",
    label: "Admin",
    email: "admin@demo.trade",
    icon: ShieldCheck,
    desc: "Full control: clients, credit, orders, invoices, reports & audit.",
    phone: "+91 98••••••01",
  },
  {
    role: "employee",
    label: "Employee",
    email: "employee@demo.trade",
    icon: Briefcase,
    desc: "Field view: assigned clients, order punching, tasks & duty status.",
    phone: "+91 98••••••02",
  },
  {
    role: "client",
    label: "Client",
    email: "client@demo.trade",
    icon: Building2,
    desc: "Portal: confirm orders, approve invoices, view ledger & credit.",
    phone: "+91 98••••••10",
  },
];

const PASSWORD = "demo1234";

function AuthPage() {
  const navigate = useNavigate();
  const { session, loading } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const { lang, toggleLang, t } = useLanguage();
  const [selected, setSelected] = useState<(typeof roles)[number] | null>(null);
  const [otp, setOtp] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!loading && session) navigate({ to: "/dashboard", replace: true });
  }, [loading, session, navigate]);

  async function completeLogin(target: (typeof roles)[number]) {
    setSubmitting(true);
    const { error } = await supabase.auth.signInWithPassword({
      email: target.email,
      password: PASSWORD,
    });
    setSubmitting(false);
    if (error) {
      toast.error("Login failed", { description: error.message });
      return;
    }
    toast.success(`Signed in as ${target.label}`);
    navigate({ to: "/dashboard", replace: true });
  }

  return (
    <div className="grid min-h-screen lg:grid-cols-2">
      {/* Theme & language controls */}
      <div className="absolute right-4 top-4 z-10 flex items-center gap-2">
        <Button
          variant="outline"
          size="sm"
          onClick={toggleLang}
          className="gap-1.5"
          aria-label="Change language"
        >
          <Languages className="h-4 w-4" />
          {lang === "en" ? "EN" : "हि"}
        </Button>
        <Button
          variant="outline"
          size="icon"
          onClick={toggleTheme}
          aria-label={theme === "dark" ? t("Light mode") : t("Dark mode")}
        >
          {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
        </Button>
      </div>
      {/* Brand panel */}
      <div className="relative hidden flex-col justify-between bg-sidebar p-10 text-sidebar-foreground lg:flex">
        <div className="flex items-center gap-2">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-sidebar-primary font-display text-lg font-bold text-white">
            T
          </div>
          <div>
            <div className="font-display text-lg font-semibold text-white">TradeLedger</div>
            <div className="text-xs text-sidebar-foreground/70">B2B Trade & Credit Management</div>
          </div>
        </div>
        <div className="space-y-4">
          <h2 className="font-display text-3xl font-semibold leading-tight text-white">
            {t("One platform for orders, credit & collections.")}
          </h2>
          <p className="max-w-md text-sm text-sidebar-foreground/80">
            Manage purchase & sales orders, credit terms, penalties, ledgers and field
            teams — with role-based access for admins, employees and clients.
          </p>
          <ul className="space-y-2 text-sm text-sidebar-foreground/80">
            <li>• Auto-calculated due dates & penalty tracking</li>
            <li>• Credit purse with live used / remaining limits</li>
            <li>• WhatsApp + in-app order & invoice confirmations</li>
          </ul>
        </div>
        <div className="text-xs text-sidebar-foreground/60">
          {t("Demo build · sample data · no real integrations")}
        </div>
      </div>

      {/* Auth panel */}
      <div className="flex items-center justify-center bg-background p-6">
        <div className="w-full max-w-md">
          {!selected ? (
            <>
              <div className="mb-6 text-center lg:text-left">
                <h1 className="font-display text-2xl font-semibold text-foreground">
                  {t("Choose a demo role")}
                </h1>
                <p className="mt-1 text-sm text-muted-foreground">
                  {t("One-click sign in — no credentials needed for the demo.")}
                </p>
              </div>
              <div className="space-y-3">
                {roles.map((r) => {
                  const Icon = r.icon;
                  return (
                    <button
                      key={r.role}
                      disabled={submitting}
                      onClick={() => {
                        setSelected(r);
                        setOtp("");
                      }}
                      className="flex w-full items-center gap-4 rounded-xl border border-border bg-card p-4 text-left transition-all hover:border-primary hover:shadow-sm disabled:opacity-60"
                    >
                      <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-primary/10 text-primary">
                        <Icon className="h-5 w-5" />
                      </div>
                      <div className="min-w-0">
                        <div className="font-display font-semibold text-foreground">
                          {t("Log in as")} {t(r.label)}
                        </div>
                        <div className="text-xs text-muted-foreground">{r.desc}</div>
                      </div>
                    </button>
                  );
                })}
              </div>
            </>
          ) : (
            <div>
              <button
                onClick={() => setSelected(null)}
                className="mb-4 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
              >
                <ArrowLeft className="h-4 w-4" /> {t("Back")}
              </button>
              <div className="mb-6">
                <div className="mb-3 flex h-11 w-11 items-center justify-center rounded-lg bg-primary/10 text-primary">
                  <Smartphone className="h-5 w-5" />
                </div>
                <h1 className="font-display text-2xl font-semibold text-foreground">
                  {t("Verify OTP")}
                </h1>
                <p className="mt-1 text-sm text-muted-foreground">
                  We sent a 4-digit code via <span className="font-medium">WhatsApp + SMS</span> to{" "}
                  <span className="font-medium text-foreground">{selected.phone}</span>.
                  <br />
                  <span className="text-xs">(Demo: any 4 digits work.)</span>
                </p>
              </div>

              <div className="flex justify-center lg:justify-start">
                <InputOTP maxLength={4} value={otp} onChange={setOtp}>
                  <InputOTPGroup>
                    <InputOTPSlot index={0} />
                    <InputOTPSlot index={1} />
                    <InputOTPSlot index={2} />
                    <InputOTPSlot index={3} />
                  </InputOTPGroup>
                </InputOTP>
              </div>

              <Button
                className="mt-6 w-full"
                disabled={otp.length < 4 || submitting}
                onClick={() => completeLogin(selected)}
              >
                {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {t("Verify & continue")}
              </Button>
              <button
                onClick={() => setOtp("1234")}
                className="mt-3 w-full text-center text-xs text-muted-foreground hover:text-foreground"
              >
                {t("Autofill demo code")}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}