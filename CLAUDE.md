# CLAUDE.md

Personal fork of [coderaiser/cloudcmd](https://github.com/coderaiser/cloudcmd). Not intended for upstream PRs — the goal is to keep the fork's own features working on top of upstream updates. Deployed to an OpenMediaVault server via docker compose building `docker/Dockerfile.local` from this repo's `master`.

## Fork-specific changes (keep these working across upstream merges)

### 1. Per-panel paths in the URL (the main feature)

A bookmarked URL restores each panel to its own directory: `/fs/<left>?right=<encodeURIComponent(right)>`, with a localStorage (`panels-path` key) fallback when `?right=` is absent. Documented in HELP.md § "Panel paths in the URL".

Divergence points — these are where upstream merge conflicts will land:

- `server/route.js` — `getRightPath()` + `readRightDir()` (fail-soft: any invalid right path → right panel mirrors left; a right path that is a file must `stream.destroy?.()` to avoid an fd leak). `buildIndex()` takes `{left, right}` and builds two panel strings; `indexProcessing()` takes `{panelLeft, panelRight}` instead of upstream's single `panel` stamped into both sides. If upstream touches these functions, preserve the two-panel signatures.
- `client/dom/current-file.js` — `getPanelsState()`, `buildPanelsUrl()`, `syncPanelsHistory({replace})` (writes localStorage + history in one place, dedupes against the current URL). `setCurrentFile()`'s history block calls `syncPanelsHistory` instead of pushing a bare path.
- `client/dom/index.js` — `setHistory(data, title, url, {replace})` gained the `replace` option.
- `client/client.js` — `baseInit()` captures `savedPanels` and `hadRightParam` **before** the boot `setCurrentFile` (which replaceState-normalizes the URL and overwrites the storage key — reading later silently breaks the restore; this was a real bug). `restorePanels()` restores left only on root visits (URL stays authoritative for `/fs/<path>`), restores right passively via `changeDir(..., {panel, noCurrent: true, history: false})`. `createFileTable()` calls `syncPanelsHistory({replace: true})` on the `noCurrent` path.
- `client/listeners/index.js` — popstate handles `{left, right}` state objects (with a legacy string branch).
- History state is `{left, right}`; upstream's is a path string.

Tests that pin the behavior: 6 "right panel" tests in `server/route.spec.js`, NAV-07/08/09 in `test-e2e/client/app/navigation.spec.js`.

### 2. Windows build fixes (needed on the dev machine)

- `.rspack/js.js`: `rootDir` uses `fileURLToPath(...)` (upstream's `URL.pathname` yields `/C:/...` → broken `C:\C:\` paths), and the loader regexes use `[\\/]` separators (upstream's `/`-only regexes silently route `sw/sw.js` through the wrong loader and break the aleman CSS rule on Windows). If upstream edits this file, re-apply both.

### 3. Docker self-build

- `docker/Dockerfile.local` + `docker/Dockerfile.local.dockerignore`: multi-stage image that builds `dist/` inside (the stock `docker/Dockerfile` expects `dist/` pre-built in the context; `dist` is gitignored, so building from a git URL with the stock file produces a broken image). The ignore override is required because the root `.dockerignore` excludes `client/`, which the builder stage needs.

## Syncing with upstream

Upstream is very active (~10 commits/week, roughly weekly releases). Sync on demand — at minimum when upstream ships security fixes.

```sh
git remote add upstream https://github.com/coderaiser/cloudcmd.git  # once
git fetch upstream
git merge upstream/master   # merge, not rebase — master is deployed
```

Conflicts, when they happen, will be in the files listed above. After resolving:

1. `npx tape server/route.spec.js` — the 6 "right panel" tests must pass (pre-existing Windows-only failure: "read: root" expects `/`-separated paths).
2. Rebuild bundles and smoke-test both panels load distinct dirs (see Verification below).
3. Push `master`, then rebuild the container on OMV: `docker compose build --no-cache && docker compose up -d`.

## Building and testing on Windows (this dev machine)

- `npm run build` fails (cmd can't parse `NODE_ENV=x` prefixes). Use Git Bash:
  `npx rimraf dist && NODE_ENV=production npx rspack build --config rspack.config.js --mode production`
  (and the same with `development` / `dist-dev`).
- Targeted tests: `npx tape server/route.spec.js`. Client specs need the supertape env:
  `SUPERTAPE_TIMEOUT=7000 NODE_OPTIONS="--localstorage-file $TMP/cloudcmd-localstorage --enable-source-maps --import @supertape/loader-css" npx tape client/dom/*.spec.js`
- Full `npm test` crashes on Windows (several specs use `URL.pathname` → `C:\C:\` paths). Pre-existing; run targeted specs instead.
- E2E: any test doing client-side navigation (NAV-01..04, NAV-07, NAV-09) fails on Windows because restafary 404s on absolute Windows roots (pre-existing dependency issue; fine on Linux/Docker). Verify manually against a relative root instead.
- `cloudcmd.depStore()` reset is a no-op (`server/depstore.js` ignores falsy values) — stubs leak between tests in `route.spec.js`; restore the real `win32` module explicitly (see `requestRightPanel` helper).

## Verification (manual smoke test)

```sh
node bin/cloudcmd.js --port 8000 --no-auth --no-open --root test
```

- `/fs/?right=%2Ffixture` → left `/`, right `/fixture/` (distinct panels server-side).
- Navigate either panel → URL always carries both paths.
- Revisit `/` → last layout restored from localStorage.
- Back/forward restores both panels; Tab no longer rewrites the URL.
