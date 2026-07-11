import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";

const FEATURES: Record<string, string[]> = {
  admin: [
    "Client CRUD with KYC/GST verification toggle",
    "Set credit limits, credit terms (30/45/60), and penalty rates",
    "Order pipeline management (Pending -> Confirmed -> Invoiced -> Paid)",
    "Invoice status tracking and overdue accounts view",
    "Credit purse widget and audit log",
  ],
  employee: [
    "Assigned client list with masked phone numbers",
    "Order punch form with per-employee order limits",
    "Task list (mark In Progress / Done)",
    "Duty On/Off toggle",
    "WhatsApp + in-app notifications (simulated)",
  ],
  client: [
    "Order confirmation (Accept / Decline / Request Changes)",
    "Invoice approval",
    "Credit timeline with auto due dates and due/overdue banners",
    "Ledger / Hisab table and penalty display",
    "KYC read-only view",
  ],
};

export default defineTool({
  name: "list_features",
  title: "List features by role",
  description:
    "List the platform features available to a given role (admin, employee, or client).",
  inputSchema: {
    role: z
      .enum(["admin", "employee", "client"])
      .describe("The role whose features to list."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: ({ role }) => ({
    content: [{ type: "text", text: FEATURES[role].map((f) => `- ${f}`).join("\n") }],
    structuredContent: { role, features: FEATURES[role] },
  }),
});