import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  LayoutDashboard,
  Users,
  PlusCircle,
  ListTodo,
  Phone,
  MessageCircle,
  ScanLine,
  MapPin,
  Loader2,
} from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useNotifications } from "@/hooks/useNotifications";
import { useRealtimeTables } from "@/lib/realtime/useRealtimeTable";
import { usePresence } from "@/lib/realtime/usePresence";
import { AppShell, type NavItem } from "@/components/AppShell";
import { StatCard } from "@/components/StatCard";
import { StatusBadge, orderStatusTone } from "@/components/StatusBadge";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { maskPhone, formatCurrency, formatDate } from "@/lib/format";

const nav: NavItem[] = [
  { key: "overview", label: "Overview", icon: LayoutDashboard },
  { key: "clients", label: "My Clients", icon: Users },
  { key: "punch", label: "Punch Order", icon: PlusCircle },
  { key: "tasks", label: "My Tasks", icon: ListTodo },
  { key: "map", label: "Field Visits", icon: MapPin },
];

function useMyEmployee() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["my-employee", user?.id],
    queryFn: async () => {
      const { data } = await supabase.from("employees").select("*").eq("profile_id", user!.id).maybeSingle();
      return data;
    },
    enabled: !!user,
  });
}

export function EmployeeDashboard() {
  const [active, setActive] = useState("overview");
  const emp = useMyEmployee();
  const qc = useQueryClient();

  useRealtimeTables([
    { table: "orders", invalidate: [["emp-orders"]] },
    { table: "tasks", invalidate: [["emp-tasks"]] },
    { table: "clients", invalidate: [["emp-clients"]] },
    { table: "employees", invalidate: [["my-employee", emp.data?.profile_id]] },
  ]);
  usePresence();

  const toggleDuty = useMutation({
    mutationFn: async (on: boolean) => {
      const { error } = await supabase
        .from("employees")
        .update({ duty_status: on ? "On" : "Off" } as any)
        .eq("id", emp.data!.id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["my-employee"] }),
  });

  const onDuty = emp.data?.duty_status === "On";

  return (
    <AppShell
      navItems={nav}
      active={active}
      onSelect={setActive}
      headerExtra={
        <div className="flex items-center gap-2 rounded-lg border border-border bg-card px-3 py-1.5">
          <StatusBadge tone={onDuty ? "success" : "muted"}>{onDuty ? "On Duty" : "Off Duty"}</StatusBadge>
          <Switch checked={onDuty} onCheckedChange={(v) => toggleDuty.mutate(v)} disabled={!emp.data} />
        </div>
      }
    >
      {active === "overview" && <Overview />}
      {active === "clients" && <Clients />}
      {active === "punch" && <PunchOrder employeeId={emp.data?.id} orderLimit={Number(emp.data?.order_limit ?? 0)} />}
      {active === "tasks" && <Tasks employeeId={emp.data?.id} />}
      {active === "map" && <FieldMap />}
    </AppShell>
  );
}

function Overview() {
  const { profile } = useAuth();
  const emp = useMyEmployee();
  const clients = useQuery({
    queryKey: ["emp-clients"],
    queryFn: async () => (await supabase.from("clients").select("*")).data ?? [],
  });
  const orders = useQuery({
    queryKey: ["emp-orders"],
    queryFn: async () => (await supabase.from("orders").select("*")).data ?? [],
  });
  const tasks = useQuery({
    queryKey: ["emp-tasks"],
    queryFn: async () => (await supabase.from("tasks").select("*")).data ?? [],
  });
  const openTasks = (tasks.data ?? []).filter((t) => t.status !== "Done").length;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="font-display text-xl font-semibold">Hi {profile?.name?.split(" ")[0]} 👋</h2>
        <p className="text-sm text-muted-foreground">
          Order limit {formatCurrency(emp.data?.order_limit)} · {emp.data?.duty_status === "On" ? "You are on duty" : "You are off duty"}
        </p>
      </div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <StatCard label="My clients" value={(clients.data ?? []).length} icon={Users} tone="primary" />
        <StatCard label="Orders punched" value={(orders.data ?? []).length} icon={PlusCircle} tone="info" />
        <StatCard label="Open tasks" value={openTasks} icon={ListTodo} tone="warning" />
      </div>
    </div>
  );
}

function Clients() {
  const clients = useQuery({
    queryKey: ["emp-clients"],
    queryFn: async () => (await supabase.from("clients").select("*")).data ?? [],
  });
  return (
    <div className="grid gap-4 md:grid-cols-2">
      {(clients.data ?? []).map((c) => (
        <Card key={c.id} className="p-4">
          <div className="flex items-start justify-between">
            <div>
              <div className="font-display font-semibold">{c.company_name}</div>
              <div className="text-sm text-muted-foreground">{c.contact_name}</div>
              <div className="mt-1 font-mono text-sm select-none">{maskPhone(c.phone)}</div>
            </div>
            <StatusBadge tone={c.verified ? "success" : "warning"}>
              {c.verified ? "Verified" : "Pending"}
            </StatusBadge>
          </div>
          <div className="mt-4 flex gap-2">
            <Button size="lg" className="flex-1" onClick={() => toast.info(`Calling ${c.company_name}...`, { description: "UI-only demo — no real call placed." })}>
              <Phone className="h-4 w-4" /> Call
            </Button>
            <Button size="lg" variant="outline" className="flex-1"
              onClick={() => toast.success(`Message queued to ${c.company_name}`, { description: "WhatsApp + in-app (demo) — no real message sent." })}>
              <MessageCircle className="h-4 w-4" /> WhatsApp
            </Button>
          </div>
        </Card>
      ))}
    </div>
  );
}

function PunchOrder({ employeeId, orderLimit }: { employeeId?: string; orderLimit: number }) {
  const qc = useQueryClient();
  const { notify } = useNotifications();
  const clients = useQuery({
    queryKey: ["emp-clients"],
    queryFn: async () => (await supabase.from("clients").select("*")).data ?? [],
  });
  const [clientId, setClientId] = useState("");
  const [itemName, setItemName] = useState("");
  const [qty, setQty] = useState("");
  const [price, setPrice] = useState("");
  const [scanning, setScanning] = useState(false);

  const value = (Number(qty) || 0) * (Number(price) || 0);
  const needsApproval = value > orderLimit;

  const create = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("orders").insert({
        client_id: clientId,
        employee_id: employeeId,
        type: "SO",
        status: "Pending",
        confirmation: "Pending",
        items: [{ name: itemName, qty: Number(qty), price: Number(price) }],
        value,
        needs_admin_approval: needsApproval,
      } as any);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["emp-orders"] });
      notify({
        tone: needsApproval ? "warning" : "success",
        title: needsApproval ? "Order punched — needs admin approval" : "Order punched",
        body: `${itemName} · ${formatCurrency(value)}`,
      });
      setItemName(""); setQty(""); setPrice(""); setClientId("");
    },
    onError: (e: any) => toast.error("Could not create order", { description: e.message }),
  });

  function simulateScan() {
    setScanning(true);
    setTimeout(() => {
      setItemName("Steel Rods 12mm");
      setQty("40");
      setPrice("1250");
      setScanning(false);
      toast.success("Order slip scanned", { description: "Fields auto-filled from extracted text (simulated OCR)." });
    }, 1200);
  }

  return (
    <Card className="max-w-2xl space-y-4 p-6">
      <div>
        <h3 className="font-display font-semibold">Punch new order</h3>
        <p className="text-sm text-muted-foreground">Your order limit: {formatCurrency(orderLimit)}</p>
      </div>

      <label className="flex cursor-pointer items-center justify-center gap-2 rounded-lg border-2 border-dashed border-border py-6 text-sm text-muted-foreground hover:border-primary hover:text-primary">
        {scanning ? <Loader2 className="h-5 w-5 animate-spin" /> : <ScanLine className="h-5 w-5" />}
        {scanning ? "Reading slip..." : "Upload / Scan order slip (simulated OCR)"}
        <input type="file" accept="image/*" className="hidden" onChange={(e) => { if (e.target.files?.length) simulateScan(); }} />
      </label>

      <div className="space-y-1">
        <Label>Client</Label>
        <Select value={clientId} onValueChange={setClientId}>
          <SelectTrigger><SelectValue placeholder="Select client" /></SelectTrigger>
          <SelectContent>
            {(clients.data ?? []).map((c) => (
              <SelectItem key={c.id} value={c.id}>{c.company_name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="space-y-1">
        <Label>Item</Label>
        <Input value={itemName} onChange={(e) => setItemName(e.target.value)} placeholder="e.g. Steel Rods 12mm" />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1">
          <Label>Quantity</Label>
          <Input type="number" value={qty} onChange={(e) => setQty(e.target.value)} />
        </div>
        <div className="space-y-1">
          <Label>Unit price (₹)</Label>
          <Input type="number" value={price} onChange={(e) => setPrice(e.target.value)} />
        </div>
      </div>

      <div className="flex items-center justify-between rounded-lg bg-muted p-3">
        <span className="text-sm text-muted-foreground">Order value</span>
        <span className="font-display text-lg font-semibold">{formatCurrency(value)}</span>
      </div>
      {needsApproval && value > 0 && (
        <StatusBadge tone="warning">Exceeds limit — will be flagged “Needs Admin Approval”</StatusBadge>
      )}

      <Button className="w-full" disabled={!clientId || !itemName || value <= 0 || create.isPending} onClick={() => create.mutate()}>
        {create.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
        Punch order
      </Button>
    </Card>
  );
}

function Tasks({ employeeId }: { employeeId?: string }) {
  const qc = useQueryClient();
  const tasks = useQuery({
    queryKey: ["emp-tasks"],
    queryFn: async () => (await supabase.from("tasks").select("*").order("due_date")).data ?? [],
  });
  const update = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const { error } = await supabase.from("tasks").update({ status } as any).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["emp-tasks"] }),
  });

  const toneFor = (s: string) => (s === "Done" ? "success" : s === "InProgress" ? "info" : "muted");

  return (
    <div className="space-y-3">
      {(tasks.data ?? []).map((t) => (
        <Card key={t.id} className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="font-medium">{t.title}</div>
            <div className="text-sm text-muted-foreground">{t.description}</div>
            <div className="mt-1 text-xs text-muted-foreground">Due {formatDate(t.due_date)}</div>
          </div>
          <div className="flex items-center gap-2">
            <StatusBadge tone={toneFor(t.status) as any}>{t.status}</StatusBadge>
            {t.status !== "InProgress" && t.status !== "Done" && (
              <Button size="sm" variant="outline" onClick={() => update.mutate({ id: t.id, status: "InProgress" })}>Start</Button>
            )}
            {t.status !== "Done" && (
              <Button size="sm" onClick={() => update.mutate({ id: t.id, status: "Done" })}>Mark done</Button>
            )}
          </div>
        </Card>
      ))}
    </div>
  );
}

function FieldMap() {
  const pins = [
    { name: "Acme Traders Pvt Ltd", time: "10:15 AM", x: "28%", y: "40%" },
    { name: "Bharat Steel Co", time: "12:30 PM", x: "58%", y: "62%" },
    { name: "Konkan Foods", time: "3:45 PM", x: "72%", y: "30%" },
  ];
  return (
    <Card className="p-4">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="font-display font-semibold">Today’s field visits</h3>
        <StatusBadge tone="info">Demo map · sample pins</StatusBadge>
      </div>
      <div className="relative h-80 w-full overflow-hidden rounded-lg border border-border bg-[linear-gradient(135deg,#e0f2fe,#eef2f7)]">
        <div className="absolute inset-0 opacity-40 [background-image:linear-gradient(#cbd5e1_1px,transparent_1px),linear-gradient(90deg,#cbd5e1_1px,transparent_1px)] [background-size:40px_40px]" />
        {pins.map((p) => (
          <div key={p.name} className="absolute -translate-x-1/2 -translate-y-full" style={{ left: p.x, top: p.y }}>
            <div className="flex flex-col items-center">
              <div className="rounded-md bg-card px-2 py-1 text-xs font-medium shadow-sm">{p.name}<span className="ml-1 text-muted-foreground">{p.time}</span></div>
              <MapPin className="h-6 w-6 text-primary drop-shadow" fill="currentColor" />
            </div>
          </div>
        ))}
      </div>
      <p className="mt-3 text-xs text-muted-foreground">
        Static demo map with sample visit pins — real background GPS tracking is out of scope for this demo.
      </p>
    </Card>
  );
}