import { defineTool } from "@lovable.dev/mcp-js";

export default defineTool({
  name: "about_platform",
  title: "About the platform",
  description:
    "Return an overview of the B2B Trade & Credit Management platform: what it does and who uses it.",
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: () => ({
    content: [
      {
        type: "text",
        text: [
          "TradeLedger is a role-based B2B trade & credit management platform.",
          "It manages purchase/sales orders, invoices, customer ledgers (Hisab),",
          "credit limits and terms, penalties for overdue payments, KYC/GST",
          "verification, and field-team operations.",
          "",
          "Roles:",
          "- Admin: manages clients, credit limits/terms/penalties, orders,",
          "  invoices, employees, and views overdue accounts and reports.",
          "- Employee: works assigned clients, punches orders (with per-employee",
          "  limits), manages tasks, and toggles duty status.",
          "- Client: confirms orders, approves invoices, and views their credit",
          "  timeline, ledger and penalties.",
        ].join("\n"),
      },
    ],
  }),
});