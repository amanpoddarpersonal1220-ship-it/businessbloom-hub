import { cn } from "@/lib/utils";

type Tone = "info" | "success" | "warning" | "destructive" | "muted" | "primary";

const toneClasses: Record<Tone, string> = {
  info: "bg-info/10 text-info border-info/20",
  success: "bg-success/10 text-success border-success/20",
  warning: "bg-warning/10 text-warning border-warning/20",
  destructive: "bg-destructive/10 text-destructive border-destructive/20",
  muted: "bg-muted text-muted-foreground border-border",
  primary: "bg-primary/10 text-primary border-primary/20",
};

export function StatusBadge({
  children,
  tone = "muted",
  className,
}: {
  children: React.ReactNode;
  tone?: Tone;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs font-medium whitespace-nowrap",
        toneClasses[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}

export function orderStatusTone(status: string): Tone {
  switch (status) {
    case "Paid":
      return "success";
    case "Invoiced":
      return "info";
    case "Confirmed":
      return "primary";
    default:
      return "warning";
  }
}

export function invoiceStatusTone(status: string): Tone {
  switch (status) {
    case "Approved":
      return "success";
    case "Overdue":
      return "destructive";
    case "Declined":
      return "destructive";
    default:
      return "info";
  }
}

export function confirmationTone(status: string): Tone {
  switch (status) {
    case "Accepted":
      return "success";
    case "Declined":
      return "destructive";
    case "ChangesRequested":
      return "warning";
    default:
      return "muted";
  }
}