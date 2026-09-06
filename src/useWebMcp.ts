import { useEffect, useRef } from "react";

import { registerWebMcpTools, type WebMcpRuntimeConfig, type WebMcpTool } from "./runtime.js";

/**
 * Register a set of WebMCP tools for the lifetime of the calling component.
 *
 * Tools are built exactly once, on mount, and read their data through the
 * `getSnapshot` callback they are handed, which always returns the most recent
 * snapshot passed to this hook. That indirection is the point: registration
 * does not churn every time application state changes, but a tool invoked at
 * any moment still sees current data.
 *
 * Everything happens in effects — nothing is built or read during render.
 *
 * `config` is a parameter rather than an import because the flag that drives it
 * is substituted at build time by the *app's* bundler — `import.meta.env.VITE_*`
 * under Vite, `process.env.NEXT_PUBLIC_*` under Next. A shared package cannot
 * read either one; see `templates/` for the eight lines each app supplies.
 */
export function useWebMcpTools<TSnapshot>(
  buildTools: (getSnapshot: () => TSnapshot) => readonly WebMcpTool[],
  snapshot: TSnapshot,
  config: WebMcpRuntimeConfig,
): void {
  const snapshotRef = useRef(snapshot);
  const buildRef = useRef(buildTools);
  const configRef = useRef(config);
  const toolsRef = useRef<readonly WebMcpTool[] | null>(null);

  useEffect(() => {
    snapshotRef.current = snapshot;
  }, [snapshot]);

  useEffect(() => {
    buildRef.current = buildTools;
  }, [buildTools]);

  useEffect(() => {
    configRef.current = config;
  }, [config]);

  useEffect(() => {
    toolsRef.current ??= buildRef.current(() => snapshotRef.current);
    return registerWebMcpTools(toolsRef.current, configRef.current);
  }, []);
}
