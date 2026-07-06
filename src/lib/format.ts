export function formatCurrency(value: number | null | undefined): string {
  const n = Number(value ?? 0);
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(n);
}

export function formatDate(d: string | Date | null | undefined): string {
  if (!d) return "—";
  const date = typeof d === "string" ? new Date(d) : d;
  return date.toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

/** Days until (positive) or since (negative) the given date. */
export function daysUntil(d: string | Date): number {
  const date = typeof d === "string" ? new Date(d) : d;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const target = new Date(date);
  target.setHours(0, 0, 0, 0);
  return Math.round((target.getTime() - today.getTime()) / 86400000);
}

export function dueLabel(dueDate: string | Date): { text: string; tone: "success" | "warning" | "destructive" | "muted" } {
  const days = daysUntil(dueDate);
  if (days < 0) return { text: `Overdue by ${Math.abs(days)}d`, tone: "destructive" };
  if (days === 0) return { text: "Due today", tone: "warning" };
  if (days <= 3) return { text: `Due in ${days}d`, tone: "warning" };
  return { text: `Due in ${days}d`, tone: "muted" };
}

/** Penalty accrued on an overdue amount using a per-annum-ish demo rate (% per month). */
export function computePenalty(amount: number, dueDate: string | Date, monthlyRatePct: number): number {
  const overdueDays = -daysUntil(dueDate);
  if (overdueDays <= 0) return 0;
  const months = overdueDays / 30;
  return Math.round(amount * (monthlyRatePct / 100) * months);
}

/** Mask an Indian phone number for UI display: +91 98••••••10 */
export function maskPhone(phone: string | null | undefined): string {
  if (!phone) return "+91 ••••••••••";
  const digits = phone.replace(/\D/g, "").slice(-10);
  if (digits.length < 10) return "+91 ••••••••••";
  return `+91 ${digits.slice(0, 2)}••••••${digits.slice(-2)}`;
}