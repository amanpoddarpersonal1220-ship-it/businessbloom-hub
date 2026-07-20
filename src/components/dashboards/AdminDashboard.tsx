import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  LayoutDashboard,
  Users,
  Briefcase,
  ShoppingCart,
  FileText,
  Wallet,
  ScrollText,
  AlertTriangle,
  IndianRupee,
  Printer,
  BadgeCheck,
} from "lucide-react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line, PieChart, Pie, Cell,
} from "recharts";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useNotifications } from "@/hooks/useNotifications";
import { useRealtimeTables } from "@/lib/realtime/useRealtimeTable";
import { usePresence } from "@/lib/realtime/usePresence";
import { AppShell, type NavItem } from "@/components/AppShell";
import { StatCard } from "@/components/StatCard";
import { StatusBadge, orderStatusTone, invoiceStatusTone } from "@/components/StatusBadge";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { formatCurrency, formatDate, dueLabel, computePenalty } from "@/lib/format";

const nav: NavItem[] = [
  { key: "overview", label: "Overview", icon: LayoutDashboard },
  { key: "clients", label: "Customers", icon: Users },
  { key: "employees", label: "Employees", icon: Briefcase },
  { key: "orders", label: "Orders", icon: ShoppingCart },
  { key: "invoices", label: "Invoices", icon: FileText },
  { key: "credit", label: "Credit & Penalty", icon: Wallet },
  { key: "reports", label: "Reports", icon: LayoutDashboard },
  { key: "audit", label: "Audit Log", icon: ScrollText },
];

const CHART_COLORS = ["#2563eb", "#0ea5e9", "#16a34a", "#d97706", "#7c3aed"];

function useAll() {
  const clients = useQuery({ queryKey: ["a-clients"], queryFn: async () => (await supabase.from("clients").select("*").order("company_name")).data ?? [] });
  const orders = useQuery({ queryKey: ["a-orders"], queryFn: async () => (await supabase.from("orders").select("*").order("created_at", { ascending: false })).data ?? [] });
  const invoices = useQuery({ queryKey: ["a-invoices"], queryFn: async () => (await supabase.from("invoices").select("*").order("issued_at", { ascending: false })).data ?? [] });
  const employees = useQuery({ queryKey: ["a-employees"], queryFn: async () => (await supabase.from("employees").select("*").order("name")).data ?? [] });
  return { clients, orders, invoices, employees };
}

function useAudit() {
  const { user, profile } = useAuth();
  return useMutation({
    mutationFn: async ({ action, target }: { action: string; target: string }) => {
      await supabase.from("audit_log").insert({ actor_id: user!.id, actor_name: profile?.name, action, target } as any);
    },
  });
}

export function AdminDashboard() {
  const [active, setActive] = useState("overview");
  useRealtimeTables([
    { table: "orders", invalidate: [["a-orders"]] },
    { table: "invoices", invalidate: [["a-invoices"]] },
    { table: "clients", invalidate: [["a-clients"]] },
    { table: "employees", invalidate: [["a-employees"]] },
    { table: "tasks", invalidate: [["a-tasks"]] },
    { table: "audit_log", invalidate: [["a-audit"]] },
  ]);
  usePresence();
  return (
    <AppShell navItems={nav} active={active} onSelect={setActive}>
      {active === "overview" && <Overview />}
      {active === "clients" && <Customers />}
      {active === "employees" && <Employees />}
      {active === "orders" && <Orders />}
      {active === "invoices" && <Invoices />}
      {active === "credit" && <CreditPenalty />}
      {active === "reports" && <Reports />}
      {active === "audit" && <Audit />}
    </AppShell>
  );
}

function Overview() {
  const { clients, orders, invoices } = useAll();
  const outstanding = (invoices.data ?? []).filter((i) => i.status !== "Approved").reduce((s, i) => s + Number(i.amount), 0);
  const overdue = (invoices.data ?? []).filter((i) => i.status === "Overdue");
  const flagged = (orders.data ?? []).filter((o) => o.needs_admin_approval && o.status === "Pending");

  const salesByClient = (clients.data ?? []).map((c) => ({
    name: c.company_name.split(" ")[0],
    value: (orders.data ?? []).filter((o) => o.client_id === c.id).reduce((s, o) => s + Number(o.value), 0),
  }));

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Outstanding dues" value={formatCurrency(outstanding)} icon={IndianRupee} tone="warning" />
        <StatCard label="Overdue invoices" value={overdue.length} icon={AlertTriangle} tone="destructive" />
        <StatCard label="Total orders" value={(orders.data ?? []).length} icon={ShoppingCart} tone="primary" />
        <StatCard label="Customers" value={(clients.data ?? []).length} icon={Users} tone="info" />
      </div>

      {flagged.length > 0 && (
        <Card className="flex items-center gap-3 border-warning/30 bg-warning/5 p-4">
          <AlertTriangle className="h-5 w-5 text-warning" />
          <span className="text-sm">
            <span className="font-medium">{flagged.length} order(s)</span> flagged “Needs Admin Approval”. Review in the Orders tab.
          </span>
        </Card>
      )}

      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="p-4">
          <h3 className="mb-4 font-display font-semibold">Sales by customer</h3>
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={salesByClient}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis dataKey="name" fontSize={12} />
              <YAxis fontSize={12} tickFormatter={(v) => `${v / 1000}k`} />
              <Tooltip formatter={(v: any) => formatCurrency(v)} />
              <Bar dataKey="value" fill="#2563eb" radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </Card>
        <Card className="p-4">
          <h3 className="mb-4 font-display font-semibold">Order volume trend</h3>
          <ResponsiveContainer width="100%" height={260}>
            <LineChart data={orderTrend(orders.data ?? [])}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis dataKey="label" fontSize={12} />
              <YAxis fontSize={12} allowDecimals={false} />
              <Tooltip />
              <Line type="monotone" dataKey="count" stroke="#0ea5e9" strokeWidth={2} />
            </LineChart>
          </ResponsiveContainer>
        </Card>
      </div>
    </div>
  );
}

function orderTrend(orders: any[]) {
  const buckets: Record<string, number> = {};
  for (let i = 5; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i * 10);
    buckets[d.toLocaleDateString("en-IN", { day: "2-digit", month: "short" })] = 0;
  }
  const keys = Object.keys(buckets);
  orders.forEach((o) => {
    const idx = Math.min(keys.length - 1, Math.floor((Date.now() - new Date(o.created_at).getTime()) / (10 * 86400000)));
    const key = keys[keys.length - 1 - idx];
    if (key) buckets[key] += 1;
  });
  return keys.map((label) => ({ label, count: buckets[label] }));
}

function Customers() {
  const qc = useQueryClient();
  const audit = useAudit();
  const { clients } = useAll();

  const toggleVerify = useMutation({
    mutationFn: async ({ id, verified, name }: { id: string; verified: boolean; name: string }) => {
      const { error } = await supabase.from("clients").update({ verified } as any).eq("id", id);
      if (error) throw error;
      await supabase.from("gst_verification").update({ status: verified ? "verified" : "unverified", checked_at: verified ? new Date().toISOString() : null } as any).eq("client_id", id);
      await audit.mutateAsync({ action: verified ? "Marked KYC verified" : "Revoked KYC verification", target: name });
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["a-clients"] }); toast.success("KYC status updated"); },
  });

  return (
    <Card className="p-4">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="font-display font-semibold">Customers</h3>
        <ClientDialog />
      </div>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Company</TableHead>
            <TableHead>GST</TableHead>
            <TableHead>Terms</TableHead>
            <TableHead>Credit limit</TableHead>
            <TableHead>Penalty</TableHead>
            <TableHead>KYC verified</TableHead>
            <TableHead className="text-right">Edit</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {(clients.data ?? []).map((c) => (
            <TableRow key={c.id}>
              <TableCell className="font-medium">{c.company_name}</TableCell>
              <TableCell className="font-mono text-xs">{c.gst_number}</TableCell>
              <TableCell>{c.credit_terms}d</TableCell>
              <TableCell>{formatCurrency(c.credit_limit)}</TableCell>
              <TableCell>{c.penalty_rate}%</TableCell>
              <TableCell>
                <Switch checked={c.verified} onCheckedChange={(v) => toggleVerify.mutate({ id: c.id, verified: v, name: c.company_name })} />
              </TableCell>
              <TableCell className="text-right"><ClientDialog client={c} /></TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </Card>
  );
}

function ClientDialog({ client }: { client?: any }) {
  const qc = useQueryClient();
  const audit = useAudit();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    company_name: client?.company_name ?? "",
    contact_name: client?.contact_name ?? "",
    phone: client?.phone ?? "",
    email: client?.email ?? "",
    gst_number: client?.gst_number ?? "",
    pan: client?.pan ?? "",
    credit_limit: String(client?.credit_limit ?? 500000),
    credit_terms: String(client?.credit_terms ?? 30),
    penalty_rate: String(client?.penalty_rate ?? 1.5),
  });

  const save = useMutation({
    mutationFn: async () => {
      const payload = {
        ...form,
        credit_limit: Number(form.credit_limit),
        credit_terms: Number(form.credit_terms),
        penalty_rate: Number(form.penalty_rate),
      };
      if (client) {
        const { error } = await supabase.from("clients").update(payload as any).eq("id", client.id);
        if (error) throw error;
        if (Number(form.credit_limit) !== Number(client.credit_limit)) {
          await audit.mutateAsync({ action: `Updated credit limit to ${formatCurrency(Number(form.credit_limit))}`, target: form.company_name });
          await supabase.from("credit_purse").update({ credit_limit: Number(form.credit_limit), remaining: Number(form.credit_limit) - Number((await supabase.from("credit_purse").select("used").eq("client_id", client.id).maybeSingle()).data?.used ?? 0) } as any).eq("client_id", client.id);
        }
      } else {
        const { data, error } = await supabase.from("clients").insert(payload as any).select("id").single();
        if (error) throw error;
        await supabase.from("credit_purse").insert({ client_id: data.id, credit_limit: Number(form.credit_limit), used: 0, remaining: Number(form.credit_limit) } as any);
        await audit.mutateAsync({ action: "Created customer", target: form.company_name });
      }
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["a-clients"] }); setOpen(false); toast.success(client ? "Customer updated" : "Customer created"); },
    onError: (e: any) => toast.error("Save failed", { description: e.message }),
  });

  const set = (k: string) => (e: any) => setForm((f) => ({ ...f, [k]: e.target.value }));

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant={client ? "outline" : "default"}>{client ? "Edit" : "Add customer"}</Button>
      </DialogTrigger>
      <DialogContent className="max-h-[85vh] overflow-y-auto">
        <DialogHeader><DialogTitle>{client ? "Edit customer" : "New customer"}</DialogTitle></DialogHeader>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Company name" v={form.company_name} on={set("company_name")} full />
          <Field label="Contact name" v={form.contact_name} on={set("contact_name")} />
          <Field label="Phone" v={form.phone} on={set("phone")} />
          <Field label="Email" v={form.email} on={set("email")} />
          <Field label="GST number" v={form.gst_number} on={set("gst_number")} />
          <Field label="PAN" v={form.pan} on={set("pan")} />
          <Field label="Credit limit" v={form.credit_limit} on={set("credit_limit")} type="number" />
          <div className="space-y-1">
            <Label>Credit terms</Label>
            <Select value={form.credit_terms} onValueChange={(v) => setForm((f) => ({ ...f, credit_terms: v }))}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {["30", "45", "60"].map((d) => <SelectItem key={d} value={d}>{d} days</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <Field label="Penalty rate (%/mo)" v={form.penalty_rate} on={set("penalty_rate")} type="number" />
        </div>
        <DialogFooter>
          <Button onClick={() => save.mutate()} disabled={!form.company_name || save.isPending}>Save</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function Field({ label, v, on, type = "text", full }: { label: string; v: string; on: any; type?: string; full?: boolean }) {
  return (
    <div className={`space-y-1 ${full ? "col-span-2" : ""}`}>
      <Label>{label}</Label>
      <Input type={type} value={v} onChange={on} />
    </div>
  );
}

function Orders() {
  const qc = useQueryClient();
  const { orders, clients } = useAll();
  const clientName = (id: string) => (clients.data ?? []).find((c) => c.id === id)?.company_name ?? "—";

  const setStatus = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const patch: any = { status };
      if (status === "Confirmed") patch.needs_admin_approval = false;
      const { error } = await supabase.from("orders").update(patch).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["a-orders"] }); toast.success("Order updated"); },
  });

  const pipeline = ["Pending", "Confirmed", "Invoiced", "Paid"];

  return (
    <Card className="p-4">
      <h3 className="mb-3 font-display font-semibold">Order pipeline</h3>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Order</TableHead>
            <TableHead>Customer</TableHead>
            <TableHead>Type</TableHead>
            <TableHead>Value</TableHead>
            <TableHead>Flag</TableHead>
            <TableHead>Status</TableHead>
            <TableHead className="text-right">Advance</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {(orders.data ?? []).map((o) => {
            const idx = pipeline.indexOf(o.status);
            const next = pipeline[idx + 1];
            return (
              <TableRow key={o.id}>
                <TableCell className="font-medium">{o.order_no}</TableCell>
                <TableCell>{clientName(o.client_id)}</TableCell>
                <TableCell>{o.type}</TableCell>
                <TableCell>{formatCurrency(o.value)}</TableCell>
                <TableCell>{o.needs_admin_approval && o.status === "Pending" ? <StatusBadge tone="warning">Needs approval</StatusBadge> : "—"}</TableCell>
                <TableCell><StatusBadge tone={orderStatusTone(o.status)}>{o.status}</StatusBadge></TableCell>
                <TableCell className="text-right">
                  {next ? (
                    <Button size="sm" variant="outline" onClick={() => setStatus.mutate({ id: o.id, status: next })}>
                      → {next}
                    </Button>
                  ) : <StatusBadge tone="success">Done</StatusBadge>}
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </Card>
  );
}

function Invoices() {
  const qc = useQueryClient();
  const audit = useAudit();
  const { notify } = useNotifications();
  const { invoices, clients } = useAll();
  const clientName = (id: string) => (clients.data ?? []).find((c) => c.id === id)?.company_name ?? "—";

  const setStatus = useMutation({
    mutationFn: async ({ id, status, no, name }: any) => {
      const { error } = await supabase.from("invoices").update({ status } as any).eq("id", id);
      if (error) throw error;
      if (status === "Approved") await audit.mutateAsync({ action: `Approved invoice ${no}`, target: name });
    },
    onSuccess: (_d, v: any) => { qc.invalidateQueries({ queryKey: ["a-invoices"] }); toast.success("Invoice updated"); },
  });

  return (
    <Card className="p-4">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="font-display font-semibold">Invoices</h3>
        <StatusBadge tone="success">WhatsApp + in-app delivery</StatusBadge>
      </div>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Invoice</TableHead>
            <TableHead>Customer</TableHead>
            <TableHead>Amount</TableHead>
            <TableHead>Due</TableHead>
            <TableHead>Status</TableHead>
            <TableHead className="text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {(invoices.data ?? []).map((inv) => {
            const due = dueLabel(inv.due_date);
            return (
              <TableRow key={inv.id}>
                <TableCell className="font-medium">{inv.invoice_no}</TableCell>
                <TableCell>{clientName(inv.client_id)}</TableCell>
                <TableCell>{formatCurrency(inv.amount)}</TableCell>
                <TableCell><div>{formatDate(inv.due_date)}</div><StatusBadge tone={due.tone === "muted" ? "muted" : due.tone}>{due.text}</StatusBadge></TableCell>
                <TableCell><StatusBadge tone={invoiceStatusTone(inv.status)}>{inv.status}</StatusBadge></TableCell>
                <TableCell className="text-right">
                  <div className="flex justify-end gap-1">
                    <Button size="sm" variant="outline" onClick={() => notify({ tone: "info", title: `Invoice ${inv.invoice_no} sent`, body: `${clientName(inv.client_id)} notified.` })}>Send</Button>
                    {inv.status !== "Approved" && (
                      <Button size="sm" onClick={() => setStatus.mutate({ id: inv.id, status: "Approved", no: inv.invoice_no, name: clientName(inv.client_id) })}>Approve</Button>
                    )}
                  </div>
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </Card>
  );
}

function CreditPenalty() {
  const { clients, invoices } = useAll();
  const purses = useQuery({ queryKey: ["a-purses"], queryFn: async () => (await supabase.from("credit_purse").select("*")).data ?? [] });
  const overdue = (invoices.data ?? []).filter((i) => i.status === "Overdue");
  const clientById = (id: string) => (clients.data ?? []).find((c) => c.id === id);

  return (
    <div className="space-y-6">
      <Card className="p-4">
        <h3 className="mb-3 font-display font-semibold">Overdue accounts & penalties</h3>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Invoice</TableHead>
              <TableHead>Customer</TableHead>
              <TableHead>Amount</TableHead>
              <TableHead>Due date</TableHead>
              <TableHead className="text-right">Penalty accrued</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {overdue.length === 0 && <TableRow><TableCell colSpan={5} className="text-center text-sm text-muted-foreground">No overdue accounts 🎉</TableCell></TableRow>}
            {overdue.map((inv) => {
              const c = clientById(inv.client_id);
              return (
                <TableRow key={inv.id}>
                  <TableCell className="font-medium">{inv.invoice_no}</TableCell>
                  <TableCell>{c?.company_name}</TableCell>
                  <TableCell>{formatCurrency(inv.amount)}</TableCell>
                  <TableCell>{formatDate(inv.due_date)}</TableCell>
                  <TableCell className="text-right font-medium text-destructive">
                    {formatCurrency(computePenalty(Number(inv.amount), inv.due_date, Number(c?.penalty_rate ?? 0)))}
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </Card>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {(purses.data ?? []).map((p) => {
          const c = clientById(p.client_id);
          const pct = Number(p.credit_limit) > 0 ? (Number(p.used) / Number(p.credit_limit)) * 100 : 0;
          return (
            <Card key={p.id} className="p-4">
              <div className="font-display font-semibold">{c?.company_name}</div>
              <div className="mt-2 mb-1 flex justify-between text-sm">
                <span className="text-muted-foreground">Used</span>
                <span className="font-medium">{formatCurrency(p.used)}</span>
              </div>
              <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
                <div className={`h-full rounded-full ${pct > 80 ? "bg-destructive" : pct > 50 ? "bg-warning" : "bg-success"}`} style={{ width: `${Math.min(100, pct)}%` }} />
              </div>
              <div className="mt-2 flex justify-between text-xs text-muted-foreground">
                <span>Remaining {formatCurrency(p.remaining)}</span>
                <span>Limit {formatCurrency(p.credit_limit)}</span>
              </div>
            </Card>
          );
        })}
      </div>
    </div>
  );
}

function Employees() {
  const { employees, orders } = useAll();
  const tasksData = useQuery({ queryKey: ["a-tasks"], queryFn: async () => (await supabase.from("tasks").select("*")).data ?? [] });
  return (
    <Card className="p-4">
      <h3 className="mb-3 font-display font-semibold">Employees</h3>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Name</TableHead>
            <TableHead>Order limit</TableHead>
            <TableHead>Duty</TableHead>
            <TableHead>Orders punched</TableHead>
            <TableHead>Tasks done</TableHead>
            <TableHead className="text-right">Payslip</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {(employees.data ?? []).map((e) => {
            const punched = (orders.data ?? []).filter((o) => o.employee_id === e.id).length;
            const done = (tasksData.data ?? []).filter((t) => t.employee_id === e.id && t.status === "Done").length;
            return (
              <TableRow key={e.id}>
                <TableCell className="font-medium">{e.name}</TableCell>
                <TableCell>{formatCurrency(e.order_limit)}</TableCell>
                <TableCell><StatusBadge tone={e.duty_status === "On" ? "success" : "muted"}>{e.duty_status}</StatusBadge></TableCell>
                <TableCell>{punched}</TableCell>
                <TableCell>{done}</TableCell>
                <TableCell className="text-right"><PayslipDialog emp={e} /></TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </Card>
  );
}

function PayslipDialog({ emp }: { emp: any }) {
  const gross = Number(emp.base_salary) + Number(emp.hra) + Number(emp.allowances);
  const pf = Math.round(Number(emp.base_salary) * 0.12);
  const net = gross - pf;
  const month = new Date().toLocaleDateString("en-IN", { month: "long", year: "numeric" });
  return (
    <Dialog>
      <DialogTrigger asChild><Button size="sm" variant="outline"><Printer className="h-3.5 w-3.5" /> Payslip</Button></DialogTrigger>
      <DialogContent>
        <DialogHeader><DialogTitle>Payslip — {month}</DialogTitle></DialogHeader>
        <div id="payslip" className="space-y-2 rounded-lg border border-border p-4 text-sm">
          <div className="mb-2 flex items-center justify-between border-b border-border pb-2">
            <div>
              <div className="font-display font-semibold">TradeLedger Pvt Ltd</div>
              <div className="text-xs text-muted-foreground">Salary slip · {month}</div>
            </div>
            <BadgeCheck className="h-6 w-6 text-primary" />
          </div>
          <PayRow label="Employee" value={emp.name} />
          <PayRow label="Basic salary" value={formatCurrency(emp.base_salary)} />
          <PayRow label="HRA" value={formatCurrency(emp.hra)} />
          <PayRow label="Allowances" value={formatCurrency(emp.allowances)} />
          <PayRow label="Gross" value={formatCurrency(gross)} bold />
          <PayRow label="PF deduction" value={`- ${formatCurrency(pf)}`} />
          <PayRow label="Net pay" value={formatCurrency(net)} bold />
        </div>
        <DialogFooter>
          <Button onClick={() => window.print()}><Printer className="mr-2 h-4 w-4" /> Print / Save PDF</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
function PayRow({ label, value, bold }: { label: string; value: string; bold?: boolean }) {
  return (
    <div className={`flex justify-between ${bold ? "font-semibold" : ""}`}>
      <span className={bold ? "" : "text-muted-foreground"}>{label}</span><span>{value}</span>
    </div>
  );
}

function Reports() {
  const { orders, invoices, clients } = useAll();
  const outstandingByClient = (clients.data ?? []).map((c, i) => ({
    name: c.company_name.split(" ")[0],
    value: (invoices.data ?? []).filter((inv) => inv.client_id === c.id && inv.status !== "Approved").reduce((s, inv) => s + Number(inv.amount), 0),
  })).filter((d) => d.value > 0);

  const statusDist = ["Pending", "Confirmed", "Invoiced", "Paid"].map((s) => ({
    name: s, value: (orders.data ?? []).filter((o) => o.status === s).length,
  }));

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Card className="p-4">
        <h3 className="mb-4 font-display font-semibold">Outstanding dues by customer</h3>
        <ResponsiveContainer width="100%" height={280}>
          <BarChart data={outstandingByClient} layout="vertical">
            <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
            <XAxis type="number" fontSize={12} tickFormatter={(v) => `${v / 1000}k`} />
            <YAxis type="category" dataKey="name" fontSize={12} width={70} />
            <Tooltip formatter={(v: any) => formatCurrency(v)} />
            <Bar dataKey="value" fill="#d97706" radius={[0, 6, 6, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </Card>
      <Card className="p-4">
        <h3 className="mb-4 font-display font-semibold">Orders by pipeline stage</h3>
        <ResponsiveContainer width="100%" height={280}>
          <PieChart>
            <Pie data={statusDist} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={90} label>
              {statusDist.map((_, i) => <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />)}
            </Pie>
            <Tooltip />
          </PieChart>
        </ResponsiveContainer>
      </Card>
    </div>
  );
}

function Audit() {
  const audit = useQuery({ queryKey: ["a-audit"], queryFn: async () => (await supabase.from("audit_log").select("*").order("created_at", { ascending: false })).data ?? [] });
  return (
    <Card className="p-4">
      <h3 className="mb-3 font-display font-semibold">Audit log</h3>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>When</TableHead>
            <TableHead>Actor</TableHead>
            <TableHead>Action</TableHead>
            <TableHead>Target</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {(audit.data ?? []).map((a) => (
            <TableRow key={a.id}>
              <TableCell className="text-sm text-muted-foreground">{formatDate(a.created_at)}</TableCell>
              <TableCell>{a.actor_name}</TableCell>
              <TableCell>{a.action}</TableCell>
              <TableCell>{a.target}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </Card>
  );
}