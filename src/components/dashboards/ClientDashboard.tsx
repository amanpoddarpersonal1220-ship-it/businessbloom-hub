import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  LayoutDashboard,
  ShoppingCart,
  FileText,
  BookOpen,
  Wallet,
  IdCard,
  Check,
  X,
  MessageSquare,
  AlertTriangle,
  Clock,
  CheckCircle2,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useNotifications } from "@/hooks/useNotifications";
import { useRealtimeTables } from "@/lib/realtime/useRealtimeTable";
import { usePresence } from "@/lib/realtime/usePresence";
import { AppShell, type NavItem } from "@/components/AppShell";
import { StatCard } from "@/components/StatCard";
import { StatusBadge, orderStatusTone, invoiceStatusTone, confirmationTone } from "@/components/StatusBadge";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Progress } from "@/components/ui/progress";
import { formatCurrency, formatDate, dueLabel, computePenalty } from "@/lib/format";

const nav: NavItem[] = [
  { key: "overview", label: "Overview", icon: LayoutDashboard },
  { key: "orders", label: "Orders", icon: ShoppingCart },
  { key: "invoices", label: "Invoices", icon: FileText },
  { key: "ledger", label: "Ledger (Hisab)", icon: BookOpen },
  { key: "credit", label: "Credit", icon: Wallet },
  { key: "kyc", label: "KYC", icon: IdCard },
];

export function ClientDashboard() {
  const [active, setActive] = useState("overview");
  useRealtimeTables([
    { table: "orders", invalidate: [["client-orders"]] },
    { table: "invoices", invalidate: [["client-invoices"]] },
    { table: "ledger_entries", invalidate: [["client-ledger"]] },
    { table: "credit_purse", invalidate: [["client-purse"]] },
    { table: "clients", invalidate: [["my-client"]] },
  ]);
  usePresence();
  return (
    <AppShell navItems={nav} active={active} onSelect={setActive}>
      {active === "overview" && <Overview />}
      {active === "orders" && <Orders />}
      {active === "invoices" && <Invoices />}
      {active === "ledger" && <Ledger />}
      {active === "credit" && <Credit />}
      {active === "kyc" && <Kyc />}
    </AppShell>
  );
}

function useClient() {
  return useQuery({
    queryKey: ["my-client"],
    queryFn: async () => {
      const { data } = await supabase.from("clients").select("*").limit(1).maybeSingle();
      return data;
    },
  });
}
function useOrders() {
  return useQuery({
    queryKey: ["client-orders"],
    queryFn: async () => {
      const { data } = await supabase.from("orders").select("*").order("created_at", { ascending: false });
      return data ?? [];
    },
  });
}
function useInvoices() {
  return useQuery({
    queryKey: ["client-invoices"],
    queryFn: async () => {
      const { data } = await supabase.from("invoices").select("*").order("issued_at", { ascending: false });
      return data ?? [];
    },
  });
}

function Overview() {
  const { profile } = useAuth();
  const client = useClient();
  const orders = useOrders();
  const invoices = useInvoices();

  const outstanding = (invoices.data ?? [])
    .filter((i) => i.status !== "Approved" || false)
    .reduce((s, i) => s + Number(i.amount), 0);
  const overdue = (invoices.data ?? []).filter((i) => i.status === "Overdue");
  const pendingOrders = (orders.data ?? []).filter((o) => o.confirmation === "Pending");

  return (
    <div className="space-y-6">
      <div>
        <h2 className="font-display text-xl font-semibold">Welcome, {profile?.name}</h2>
        <p className="text-sm text-muted-foreground">
          {client.data?.company_name} · Credit terms {client.data?.credit_terms} days
        </p>
      </div>

      {overdue.length > 0 && (
        <Card className="flex items-center gap-3 border-destructive/30 bg-destructive/5 p-4">
          <AlertTriangle className="h-5 w-5 text-destructive" />
          <div className="text-sm">
            <span className="font-medium text-destructive">
              {overdue.length} overdue invoice{overdue.length > 1 ? "s" : ""}
            </span>{" "}
            <span className="text-muted-foreground">
              — {formatCurrency(overdue.reduce((s, i) => s + Number(i.amount), 0))} past due.
            </span>
          </div>
        </Card>
      )}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Outstanding" value={formatCurrency(outstanding)} icon={Wallet} tone="warning" />
        <StatCard label="Pending orders" value={pendingOrders.length} icon={Clock} tone="info" />
        <StatCard label="Total orders" value={(orders.data ?? []).length} icon={ShoppingCart} tone="primary" />
        <StatCard label="Credit limit" value={formatCurrency(client.data?.credit_limit)} icon={CheckCircle2} tone="success" />
      </div>

      {pendingOrders.length > 0 && (
        <Card className="p-4">
          <h3 className="mb-3 font-display font-semibold">Orders awaiting your confirmation</h3>
          <OrdersTable orders={pendingOrders} />
        </Card>
      )}
    </div>
  );
}

function OrdersTable({ orders }: { orders: any[] }) {
  const qc = useQueryClient();
  const { notify } = useNotifications();

  const respond = useMutation({
    mutationFn: async ({ id, confirmation }: { id: string; confirmation: string }) => {
      const { error } = await supabase.from("orders").update({ confirmation } as any).eq("id", id);
      if (error) throw error;
    },
    onSuccess: (_d, v) => {
      qc.invalidateQueries({ queryKey: ["client-orders"] });
      const map: Record<string, any> = {
        Accepted: { tone: "success", title: "Order accepted" },
        Declined: { tone: "destructive", title: "Order declined" },
        ChangesRequested: { tone: "warning", title: "Changes requested" },
      };
      notify({ ...map[v.confirmation], body: "The sales team has been notified." });
    },
  });

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Order</TableHead>
          <TableHead>Items</TableHead>
          <TableHead>Value</TableHead>
          <TableHead>Status</TableHead>
          <TableHead className="text-right">Confirmation</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {orders.map((o) => (
          <TableRow key={o.id}>
            <TableCell className="font-medium">{o.order_no}</TableCell>
            <TableCell className="max-w-[200px] truncate text-sm text-muted-foreground">
              {(o.items as any[]).map((it) => it.name).join(", ")}
            </TableCell>
            <TableCell>{formatCurrency(o.value)}</TableCell>
            <TableCell>
              <StatusBadge tone={orderStatusTone(o.status)}>{o.status}</StatusBadge>
            </TableCell>
            <TableCell className="text-right">
              {o.confirmation === "Pending" ? (
                <div className="flex justify-end gap-1">
                  <Button size="sm" variant="outline" className="h-8 border-success/30 text-success hover:bg-success/10"
                    onClick={() => respond.mutate({ id: o.id, confirmation: "Accepted" })}>
                    <Check className="h-3.5 w-3.5" /> Accept
                  </Button>
                  <Button size="sm" variant="outline" className="h-8 border-warning/30 text-warning hover:bg-warning/10"
                    onClick={() => respond.mutate({ id: o.id, confirmation: "ChangesRequested" })}>
                    <MessageSquare className="h-3.5 w-3.5" /> Changes
                  </Button>
                  <Button size="sm" variant="outline" className="h-8 border-destructive/30 text-destructive hover:bg-destructive/10"
                    onClick={() => respond.mutate({ id: o.id, confirmation: "Declined" })}>
                    <X className="h-3.5 w-3.5" /> Decline
                  </Button>
                </div>
              ) : (
                <StatusBadge tone={confirmationTone(o.confirmation)}>{o.confirmation}</StatusBadge>
              )}
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}

function Orders() {
  const orders = useOrders();
  return (
    <Card className="p-4">
      <h3 className="mb-3 font-display font-semibold">All orders</h3>
      <OrdersTable orders={orders.data ?? []} />
    </Card>
  );
}

function Invoices() {
  const invoices = useInvoices();
  const client = useClient();
  const qc = useQueryClient();
  const { notify } = useNotifications();

  const respond = useMutation({
    mutationFn: async ({ id, approval }: { id: string; approval: string }) => {
      const { error } = await supabase.from("invoices").update({ approval } as any).eq("id", id);
      if (error) throw error;
    },
    onSuccess: (_d, v) => {
      qc.invalidateQueries({ queryKey: ["client-invoices"] });
      notify({
        tone: v.approval === "Accepted" ? "success" : "destructive",
        title: v.approval === "Accepted" ? "Invoice approved" : "Invoice declined",
        body: "Accounts team notified.",
      });
    },
  });

  const rate = Number(client.data?.penalty_rate ?? 0);

  return (
    <Card className="p-4">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="font-display font-semibold">Invoices</h3>
        <StatusBadge tone="success">WhatsApp + in-app approvals</StatusBadge>
      </div>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Invoice</TableHead>
            <TableHead>Amount</TableHead>
            <TableHead>Due</TableHead>
            <TableHead>Penalty</TableHead>
            <TableHead>Status</TableHead>
            <TableHead className="text-right">Approval</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {(invoices.data ?? []).map((inv) => {
            const due = dueLabel(inv.due_date);
            const penalty = inv.status !== "Approved" ? computePenalty(Number(inv.amount), inv.due_date, rate) : 0;
            return (
              <TableRow key={inv.id}>
                <TableCell className="font-medium">{inv.invoice_no}</TableCell>
                <TableCell>{formatCurrency(inv.amount)}</TableCell>
                <TableCell>
                  <div>{formatDate(inv.due_date)}</div>
                  <StatusBadge tone={due.tone === "muted" ? "muted" : due.tone}>{due.text}</StatusBadge>
                </TableCell>
                <TableCell className={penalty > 0 ? "text-destructive font-medium" : "text-muted-foreground"}>
                  {penalty > 0 ? formatCurrency(penalty) : "—"}
                </TableCell>
                <TableCell>
                  <StatusBadge tone={invoiceStatusTone(inv.status)}>{inv.status}</StatusBadge>
                </TableCell>
                <TableCell className="text-right">
                  {inv.approval === "Pending" ? (
                    <div className="flex justify-end gap-1">
                      <Button size="sm" variant="outline" className="h-8 border-success/30 text-success hover:bg-success/10"
                        onClick={() => respond.mutate({ id: inv.id, approval: "Accepted" })}>
                        <Check className="h-3.5 w-3.5" /> Approve
                      </Button>
                      <Button size="sm" variant="outline" className="h-8 border-destructive/30 text-destructive hover:bg-destructive/10"
                        onClick={() => respond.mutate({ id: inv.id, approval: "Declined" })}>
                        <X className="h-3.5 w-3.5" /> Decline
                      </Button>
                    </div>
                  ) : (
                    <StatusBadge tone={confirmationTone(inv.approval)}>{inv.approval}</StatusBadge>
                  )}
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </Card>
  );
}

function Ledger() {
  const ledger = useQuery({
    queryKey: ["client-ledger"],
    queryFn: async () => {
      const { data } = await supabase.from("ledger_entries").select("*").order("entry_date", { ascending: true });
      return data ?? [];
    },
  });
  return (
    <Card className="p-4">
      <h3 className="mb-3 font-display font-semibold">Ledger / Hisab</h3>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Date</TableHead>
            <TableHead>Description</TableHead>
            <TableHead>Type</TableHead>
            <TableHead className="text-right">Amount</TableHead>
            <TableHead className="text-right">Balance</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {(ledger.data ?? []).map((e) => (
            <TableRow key={e.id}>
              <TableCell>{formatDate(e.entry_date)}</TableCell>
              <TableCell className="text-sm">{e.description}</TableCell>
              <TableCell>
                <StatusBadge tone={e.type === "payment" ? "success" : e.type === "penalty" ? "destructive" : "info"}>
                  {e.type}
                </StatusBadge>
              </TableCell>
              <TableCell className={`text-right ${e.type === "payment" ? "text-success" : "text-foreground"}`}>
                {e.type === "payment" ? "-" : "+"}
                {formatCurrency(e.amount)}
              </TableCell>
              <TableCell className="text-right font-medium">{formatCurrency(e.running_balance)}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </Card>
  );
}

function Credit() {
  const client = useClient();
  const purse = useQuery({
    queryKey: ["client-purse"],
    queryFn: async () => {
      const { data } = await supabase.from("credit_purse").select("*").limit(1).maybeSingle();
      return data;
    },
  });
  const p = purse.data;
  const limit = Number(p?.credit_limit ?? client.data?.credit_limit ?? 0);
  const used = Number(p?.used ?? 0);
  const pct = limit > 0 ? Math.min(100, (used / limit) * 100) : 0;

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Card className="p-6">
        <h3 className="mb-1 font-display font-semibold">Credit purse</h3>
        <p className="mb-4 text-sm text-muted-foreground">Used vs remaining limit</p>
        <div className="mb-2 flex items-end justify-between">
          <span className="font-display text-2xl font-semibold">{formatCurrency(used)}</span>
          <span className="text-sm text-muted-foreground">of {formatCurrency(limit)}</span>
        </div>
        <Progress value={pct} className="h-3" />
        <div className="mt-3 flex justify-between text-sm">
          <span className="text-muted-foreground">Remaining</span>
          <span className="font-medium text-success">{formatCurrency(p?.remaining ?? limit - used)}</span>
        </div>
      </Card>
      <Card className="space-y-3 p-6">
        <h3 className="font-display font-semibold">Credit terms</h3>
        <Row label="Credit terms" value={`${client.data?.credit_terms} days`} />
        <Row label="Credit limit" value={formatCurrency(client.data?.credit_limit)} />
        <Row label="Penalty rate" value={`${client.data?.penalty_rate}% / month`} />
        <Row label="Account status" value={client.data?.verified ? "Verified" : "Pending"} />
      </Card>
    </div>
  );
}

function Kyc() {
  const client = useClient();
  const c = client.data;
  return (
    <Card className="max-w-2xl space-y-3 p-6">
      <div className="mb-2 flex items-center justify-between">
        <h3 className="font-display font-semibold">KYC details</h3>
        <StatusBadge tone={c?.verified ? "success" : "warning"}>
          {c?.verified ? "Verified" : "Verification pending"}
        </StatusBadge>
      </div>
      <Row label="Company name" value={c?.company_name} />
      <Row label="GST number" value={c?.gst_number} />
      <Row label="PAN" value={c?.pan} />
      <Row label="Contact phone" value={c?.phone} />
      <Row label="Email" value={c?.email} />
      <p className="pt-2 text-xs text-muted-foreground">
        Verification is managed by your account admin. A GST verification API can be
        plugged into this module later.
      </p>
    </Card>
  );
}

function Row({ label, value }: { label: string; value: any }) {
  return (
    <div className="flex items-center justify-between border-b border-border py-2 last:border-0">
      <span className="text-sm text-muted-foreground">{label}</span>
      <span className="text-sm font-medium">{value ?? "—"}</span>
    </div>
  );
}