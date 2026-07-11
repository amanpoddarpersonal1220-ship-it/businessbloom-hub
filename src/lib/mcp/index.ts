import { defineMcp } from "@lovable.dev/mcp-js";
import aboutPlatform from "./tools/about-platform";
import listFeatures from "./tools/list-features";

export default defineMcp({
  name: "tradeledger-mcp",
  title: "TradeLedger MCP",
  version: "0.1.0",
  instructions:
    "Public tools describing the TradeLedger B2B trade & credit management platform. Use `about_platform` for an overview and `list_features` to see features for a given role.",
  tools: [aboutPlatform, listFeatures],
});