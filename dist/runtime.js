/** Largest tool result we will hand an agent, in characters. */
const MAX_RESULT_CHARS = 16_000;
let polyfillLoad = null;
function nativeModelContext() {
    if (typeof document === "undefined")
        return null;
    const candidate = document.modelContext;
    return typeof candidate?.registerTool === "function" ? candidate : null;
}
/**
 * Resolve a usable ModelContext, loading the polyfill if allowed. Returns null
 * when WebMCP is unavailable, which is the normal case in most browsers.
 */
async function resolveModelContext(polyfill) {
    const native = nativeModelContext();
    if (native)
        return native;
    if (!polyfill)
        return null;
    // `@mcp-b/global` installs itself on `document.modelContext` as an import
    // side effect, and no-ops when a native implementation is already present.
    polyfillLoad ??= import("@mcp-b/global").then(() => undefined);
    await polyfillLoad;
    return nativeModelContext();
}
/**
 * Register a set of tools for as long as the returned disposer is uncalled.
 *
 * Synchronous by design so it can be returned directly from a React effect;
 * the async registration it kicks off checks the abort signal before every
 * step, so a disposer called during the in-flight window still wins.
 */
export function registerWebMcpTools(tools, config) {
    const controller = new AbortController();
    if (config.enabled && tools.length > 0) {
        void (async () => {
            try {
                const modelContext = await resolveModelContext(config.polyfill);
                if (!modelContext || controller.signal.aborted)
                    return;
                // Register concurrently and independently. Sequential awaits would let
                // one slow tool delay every tool after it, and one rejection would drop
                // the remainder of the set silently.
                const results = await Promise.allSettled(tools.map((tool) => modelContext.registerTool(tool, { signal: controller.signal })));
                results.forEach((result, index) => {
                    if (result.status === "rejected") {
                        console.warn(`[webmcp] tool "${tools[index]?.name}" failed to register`, result.reason);
                    }
                });
            }
            catch (error) {
                console.warn("[webmcp] tool registration failed", error);
            }
        })();
    }
    return () => {
        controller.abort();
    };
}
function toText(value) {
    if (typeof value === "string")
        return value;
    try {
        return JSON.stringify(value, null, 2) ?? String(value);
    }
    catch {
        return String(value);
    }
}
function truncate(text) {
    if (text.length <= MAX_RESULT_CHARS)
        return text;
    return `${text.slice(0, MAX_RESULT_CHARS)}\n\n[truncated: ${text.length - MAX_RESULT_CHARS} more characters. Narrow the query to see the rest.]`;
}
/**
 * Build a read-only tool.
 *
 * This is the only tool constructor the app uses, and it hard-codes
 * `readOnlyHint: true`. A tool that mutates state cannot be expressed through
 * it, which is deliberate: exposing write paths to an agent is a separate
 * decision from exposing reads, and should not be reachable by accident.
 */
export function defineReadOnlyTool(spec) {
    return {
        name: spec.name,
        // Spread rather than assign: under exactOptionalPropertyTypes an explicit
        // `title: undefined` is not the same as an absent title.
        ...(spec.title !== undefined && { title: spec.title }),
        description: spec.description,
        inputSchema: spec.inputSchema ?? { type: "object", properties: {} },
        annotations: {
            readOnlyHint: true,
            untrustedContentHint: spec.untrustedContent ?? false,
        },
        async execute(input) {
            try {
                const result = await spec.read((input ?? {}));
                return { content: [{ type: "text", text: truncate(toText(result)) }] };
            }
            catch (error) {
                // Surface the failure to the agent rather than rejecting, so a bad
                // argument reads as a recoverable tool error instead of a dead tool.
                return {
                    content: [
                        {
                            type: "text",
                            text: `Tool "${spec.name}" failed: ${error instanceof Error ? error.message : String(error)}`,
                        },
                    ],
                    isError: true,
                };
            }
        },
    };
}
//# sourceMappingURL=runtime.js.map