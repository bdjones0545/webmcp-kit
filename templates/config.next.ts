/**
 * Next apps. Copy into `components/webmcp/config.ts`.
 *
 *   NEXT_PUBLIC_WEBMCP_ENABLED=true    register this app's tools
 *   NEXT_PUBLIC_WEBMCP_POLYFILL=true   also serve them to browsers without
 *                                      native WebMCP, at the cost of a lazily
 *                                      loaded chunk
 *
 * Both are read as whole `process.env.X` expressions rather than through a
 * variable, because Next inlines NEXT_PUBLIC_ values by literal substitution at
 * build time and a dynamic lookup would come back undefined in the browser.
 */
import type { WebMcpRuntimeConfig } from "@bdjones/webmcp-kit";

export function webMcpConfig(): WebMcpRuntimeConfig {
  return {
    enabled: process.env.NEXT_PUBLIC_WEBMCP_ENABLED === "true",
    polyfill: process.env.NEXT_PUBLIC_WEBMCP_POLYFILL === "true",
  };
}
