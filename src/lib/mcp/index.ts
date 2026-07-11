import { auth, defineMcp } from "@lovable.dev/mcp-js";
import aboutPlatform from "./tools/about-platform";
import listFeatures from "./tools/list-features";

// The OAuth issuer must be the direct Supabase host. VITE_SUPABASE_PROJECT_ID is
// inlined by Vite as a literal at build time and survives publish unchanged.
const projectRef = import.meta.env.VITE_SUPABASE_PROJECT_ID ?? "project-ref-unset";

export default defineMcp({
  name: "tradeledger-mcp",
  title: "TradeLedger MCP",
  version: "0.1.0",
  instructions:
    "Public tools describing the TradeLedger B2B trade & credit management platform. Use `about_platform` for an overview and `list_features` to see features for a given role.",
  auth: auth.oauth.issuer({
    issuer: `https://${projectRef}.supabase.co/auth/v1`,
    acceptedAudiences: "authenticated",
  }),
  tools: [aboutPlatform, listFeatures],
});