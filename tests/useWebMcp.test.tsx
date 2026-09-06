/**
 * The contract the hook adds on top of the runtime.
 *
 * The runtime is covered by `runtime.test.ts`; what is asserted here is the
 * indirection the hook exists for — tools are built once, but a tool called
 * later still reads current state — plus the config parameter that replaced
 * each app's `import ... from "./config"`.
 */
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render } from "@testing-library/react";

import { defineReadOnlyTool, type WebMcpTool, type WebMcpRuntimeConfig } from "../src/runtime";
import { useWebMcpTools } from "../src/useWebMcp";

type RegisterCall = { tool: WebMcpTool; signal: AbortSignal | undefined };

function stubModelContext() {
  const calls: RegisterCall[] = [];
  const unregister = vi.fn();
  Object.defineProperty(globalThis.document, "modelContext", {
    configurable: true,
    writable: true,
    value: {
      registerTool: (tool: WebMcpTool, options?: { signal?: AbortSignal }) => {
        calls.push({ tool, signal: options?.signal });
        return Promise.resolve(unregister);
      },
    },
  });
  return { calls, unregister };
}

const ON: WebMcpRuntimeConfig = { enabled: true, polyfill: false };
const OFF: WebMcpRuntimeConfig = { enabled: false, polyfill: false };

/** Yield past the runtime's internal `await` before asserting on registration. */
const settle = () => new Promise((resolve) => setTimeout(resolve, 0));

function at<T>(items: readonly T[], index: number): T {
  const value = items[index];
  if (value === undefined) throw new Error(`no item at index ${index}`);
  return value;
}

type Snapshot = { count: number };

/** Builds one tool that reports whatever the latest snapshot holds. */
function buildTools(getSnapshot: () => Snapshot): readonly WebMcpTool[] {
  return [
    defineReadOnlyTool({
      name: "read_count",
      description: "Report the current count.",
      read: () => getSnapshot(),
    }),
  ];
}

function Harness({ count, config }: { count: number; config: WebMcpRuntimeConfig }) {
  useWebMcpTools(buildTools, { count }, config);
  return null;
}

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  Reflect.deleteProperty(globalThis.document, "modelContext");
});

describe("useWebMcpTools", () => {
  it("registers the app's tools on mount when the config is enabled", async () => {
    const { calls } = stubModelContext();

    render(<Harness count={1} config={ON} />);
    await settle();

    expect(calls).toHaveLength(1);
    expect(at(calls, 0).tool.name).toBe("read_count");
  });

  it("registers nothing when the config is disabled", async () => {
    const { calls } = stubModelContext();

    render(<Harness count={1} config={OFF} />);
    await settle();

    expect(calls).toHaveLength(0);
  });

  it("builds tools once, no matter how often the snapshot changes", async () => {
    const { calls } = stubModelContext();
    const build = vi.fn(buildTools);

    function Rebuilding({ count }: { count: number }) {
      useWebMcpTools(build, { count }, ON);
      return null;
    }

    const view = render(<Rebuilding count={1} />);
    await settle();
    view.rerender(<Rebuilding count={2} />);
    view.rerender(<Rebuilding count={3} />);
    await settle();

    expect(build).toHaveBeenCalledTimes(1);
    expect(calls).toHaveLength(1);
  });

  it("serves the latest snapshot to a tool called after a re-render", async () => {
    const { calls } = stubModelContext();

    const view = render(<Harness count={1} config={ON} />);
    await settle();

    view.rerender(<Harness count={42} config={ON} />);
    await settle();

    const result = await at(calls, 0).tool.execute({});
    expect(JSON.stringify(result)).toContain("42");
  });

  it("aborts the registration signal on unmount", async () => {
    const { calls } = stubModelContext();

    const view = render(<Harness count={1} config={ON} />);
    await settle();

    const signal = at(calls, 0).signal;
    expect(signal).toBeInstanceOf(AbortSignal);
    expect(signal?.aborted).toBe(false);

    view.unmount();
    await settle();

    // Disposal is the abort: the agent-facing registration is torn down through
    // the same signal it was registered under.
    expect(signal?.aborted).toBe(true);
  });
});
