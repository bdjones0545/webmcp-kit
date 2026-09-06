# @bdjones/webmcp-kit

A small shared runtime for publishing a web app's own functionality to AI agents
as [WebMCP](https://github.com/webmachinelearning/webmcp) tools.

## What it is

Nine applications had each grown their own copy of the same three files. The
copies were identical apart from formatting and import paths — around 2,700
duplicated lines, of the kind that silently diverges, because a fix to the
registration path has to be made in every copy and nothing tells you when one is
missed. This package is the identical part, and nothing else.

```
src/runtime.ts      registerWebMcpTools, defineReadOnlyTool, types
src/useWebMcp.ts    the React hook
src/index.ts        public surface
templates/          the ~8-line config.ts each app still supplies
```

Three properties the runtime is responsible for:

1. **Off by default.** Nothing registers unless the app passes `enabled: true`.
2. **Zero cost on the default path.** The `@mcp-b/global` polyfill is only ever
   reached through a dynamic `import()`, so it lands in its own chunk that
   unflagged builds never fetch.
3. **Never breaks the page.** A browser without WebMCP, a blocked chunk, or a
   throwing tool is logged and swallowed rather than taking the app down.

## Read-only by construction

`defineReadOnlyTool` is the only tool constructor, and it hard-codes
`readOnlyHint: true`. A tool that mutates state cannot be expressed through it.
That is deliberate: a registered tool runs with whatever authority the current
session already has, so exposing write paths to an agent is a separate decision
from exposing reads, and should not be reachable by accident.

It also wraps every read — a throwing tool becomes a tool error the agent can
report, not an unhandled rejection, and an oversized result is truncated with a
note rather than flooding the caller.

## Why `config.ts` stays in the app

The feature flag is substituted by the *app's own bundler* — `import.meta.env.VITE_*`
under Vite, `process.env.NEXT_PUBLIC_*` under Next, both by literal substitution
at build time. A shared package cannot read either one. So the hook takes config
as its third argument, and each app keeps the eight lines in `templates/`:

```ts
useWebMcpTools(buildMyTools, snapshot, webMcpConfig());
```

## Installing

```
npm install github:bdjones0545/webmcp-kit
pnpm add github:bdjones0545/webmcp-kit
```

`dist/` is **committed**, so installing runs no lifecycle script. That matters
for consumers whose package manager restricts install-time scripts — a package
that had to build itself would either be blocked there or force a hole in that
policy. CI runs `verify:dist`, which rebuilds and fails if the committed output
has drifted from `src/`; the guard was mutation-checked by editing a source file
and confirming it goes red.

## Verification

`npm run typecheck && npm test && npm run build` — 23 tests, green, under
`strict` + `noUncheckedIndexedAccess` + `exactOptionalPropertyTypes`.

18 tests cover the runtime: that a tool built here is always read-only, that
nothing registers while the flag is off, that one broken tool never takes the
others down with it, that a throwing tool becomes a tool error, and that
disposal actually unregisters.

5 cover what the hook adds over the runtime: tools built once, a tool called
after a re-render still reading current state, the config parameter gating
registration, and disposal aborting the registration signal. That last one was
mutation-checked — deleting `controller.abort()` from the disposer turns the
suite red — so the assertion is known to be capable of failing.

## Adopting it

1. `npm install github:bdjones0545/webmcp-kit`
2. Delete the local `runtime.ts`, `useWebMcp.ts` and the runtime test.
3. Keep `config.ts`, and point its type import at the package.
4. Import `defineReadOnlyTool` / `useWebMcpTools` from the package.
5. Pass `webMcpConfig()` as the hook's third argument.
6. Keep the tool tests — those are about *your* tools.

Adopting it makes registration flag-gated. An app that previously registered
unconditionally will register nothing until the two environment flags are set.

## License

UNLICENSED — published for installation by its own projects, not for general use.
