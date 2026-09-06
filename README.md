# @bdjones/webmcp-kit

The WebMCP runtime that nine repositories were each carrying their own copy of.

## Why this exists

A survey on 2026-09-06 found WebMCP tool surfaces in nine projects, in two
shapes.

**Six repos share a mature implementation** — `agentexchange`, `chelcoach`,
`jaspicon`, `trainchat`, `mobile-workforce-console`, and
`stitch_signalytix_athlete_intelligence_platform`. Comparing them file by file:

| File | Verdict |
|---|---|
| `runtime.ts` (~190 lines) | **Logically identical in all six.** The only differences are Prettier line-wrapping and one brace style. |
| `useWebMcp.ts` (37 lines) | **Identical in all six**, modulo a `"use client"` directive on the two Next apps. |
| `config.ts` (22 lines) | Two variants, and the split is real: Vite inlines `import.meta.env.VITE_*`, Next inlines `process.env.NEXT_PUBLIC_*`. |
| `webmcp-runtime.test.ts` (225 lines) | **Identical in all six** apart from the import path. |
| `tools.ts`, `WebMcpBridge.tsx`, `README.md` | Genuinely app-specific. These should stay in the app. |

That is roughly **2,700 duplicated lines**, and it is the kind of duplication
that silently diverges: a fix to the registration path today has to be made in
six places, and nothing tells you when one is missed.

**Three repos reimplemented a weaker subset inline** — `wfa-main`,
`workforce-command-production`, and `signalytix_release1_candidate` each carry a
40–66 line `webmcp-bridge.tsx` that differs from the others only in app name,
route list, and quote style. Compared with the runtime above, those three are
missing:

- the enable/polyfill feature flags (they register unconditionally)
- polyfill loading, so they are dead in any browser without native WebMCP
- `defineReadOnlyTool`, and with it the enforced `readOnlyHint`
- `untrustedContentHint` on results that can carry third-party text
- error wrapping — a throwing tool rejects instead of returning `isError`
- result truncation
- any test coverage at all

## What this package is

The three files that were identical, and nothing else.

```
src/runtime.ts      registerWebMcpTools, defineReadOnlyTool, types
src/useWebMcp.ts    the React hook
src/index.ts        public surface
templates/          the ~8-line config.ts each app still supplies
```

`config.ts` deliberately stays in the app: the flag is substituted by the *app's*
bundler at build time, and a shared package cannot read either `import.meta.env`
or an inlined `process.env.NEXT_PUBLIC_*`. So the hook now takes config as its
third argument — the one API change in this extraction.

```diff
-useWebMcpTools(buildChelCoachTools, snapshot);
+useWebMcpTools(buildChelCoachTools, snapshot, webMcpConfig());
```

## Verification

`npm run typecheck && npm test && npm run build` — 23 tests, all green, under
`strict` + `noUncheckedIndexedAccess` + `exactOptionalPropertyTypes`.

The 18 runtime tests are the existing suite, moved here unchanged. The 5 hook
tests are new, and cover what the hook adds over the runtime: tools built once,
a tool called after a re-render still reading current state, the config
parameter gating registration, and disposal aborting the registration signal.

That last one was mutation-checked — deleting `controller.abort()` from the
disposer turns the suite red, and restoring it turns it green — so the assertion
is known to be capable of failing.

## Migrating an app

**From the six-repo shape** (mechanical, no behaviour change):

1. `npm install @bdjones/webmcp-kit`
2. Delete `src/webmcp/runtime.ts`, `src/webmcp/useWebMcp.ts`, and
   `**/webmcp-runtime.test.ts`.
3. Keep `config.ts`, and point its type import at the package.
4. In `tools.ts` and `WebMcpBridge.tsx`, import from `@bdjones/webmcp-kit`
   instead of `./runtime` / `./useWebMcp`.
5. Pass `webMcpConfig()` as the hook's third argument.
6. Keep `webmcp-tools.test.ts` — those tests are about *your* tools.

**From the three-repo inline shape**, the same steps, plus: rewrite the two
inline tool literals with `defineReadOnlyTool`, add a `config.ts` from
`templates/`, and add the two env flags. These apps gain flag gating, polyfill
support, error handling, truncation, and read-only annotations they do not have
today. Their tools are currently registered unconditionally, so **check the flag
defaults before deploying** — after migration they are off unless set.

## Status

Not yet adopted by any app. This is the proposed shared version: built, typed
and tested on its own, with the migration above still to be done per repo.
