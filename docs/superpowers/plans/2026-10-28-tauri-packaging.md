# Tauri Packaging Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Package DouAi as a Tauri 2 Windows desktop app with version `1.0.0`, bundling the Python configuration API as a sidecar and persisting SQLite data in the user application-data directory.

**Architecture:** Vue/Vite remains the renderer and builds to `dist`. Tauri 2 owns the desktop window and starts a PyInstaller-built `douai-api.exe` sidecar on startup. The sidecar receives `DOUAI_DATA_DIR`, keeps the existing `127.0.0.1:8787` API contract, and is included in an NSIS Windows installer.

**Tech Stack:** Vue 3, Vite 6, Tauri 2, Rust, Python 3, PyInstaller, SQLite, NSIS.

**Spec:** `docs/superpowers/specs/2026-10-28-tauri-packaging-design.md`

## Global Constraints

- Tauri major version: 2.
- Application version: `1.0.0`.
- Initial target: Windows 10/11.
- Keep the existing Vue/Vite frontend and Python API contract.
- Do not rewrite the Python API in Rust.
- Store packaged SQLite data in the Tauri application-data directory.
- Do not add auto-update, code signing, or macOS/Linux bundles in this iteration.

---

### Task 1: Add Tauri 2 shell and package scripts

**Files:**
- Create: `src-tauri/Cargo.toml`
- Create: `src-tauri/build.rs`
- Create: `src-tauri/src/main.rs`
- Create: `src-tauri/tauri.conf.json`
- Create: `src-tauri/capabilities/default.json`
- Create: `src-tauri/icons/.gitkeep`
- Modify: `package.json`
- Modify: `vite.config.ts`

**Interfaces:**
- Consumes: Vite output at `dist`.
- Produces: `pnpm tauri dev` and `pnpm tauri build` commands, Tauri application metadata versioned at `1.0.0`.

- [ ] **Step 1: Add Tauri CLI and API dependencies**

Run:

```powershell
pnpm add -D @tauri-apps/cli@latest
pnpm add @tauri-apps/api@latest
```

Add scripts:

```json
{
  "tauri": "tauri",
  "tauri:dev": "tauri dev",
  "tauri:build": "tauri build"
}
```

- [ ] **Step 2: Scaffold the Rust shell**

Create `src-tauri/Cargo.toml` with package version `1.0.0`, `tauri` 2.x, `tauri-plugin-shell` 2.x, and `tauri-plugin-log` 2.x. Create `build.rs` calling `tauri_build::build()`. Create `src/main.rs` that builds the Tauri application, initializes logging, and registers the shell plugin.

- [ ] **Step 3: Configure the renderer and Windows bundle**

Set `build.frontendDist` to `../dist`, `build.devUrl` to `http://localhost:5173`, `productName` to `DouAi`, `version` to `1.0.0`, and Windows bundle targets to NSIS. Configure `bundle.externalBin` for `binaries/douai-api` and the shell capability required to spawn it.

- [ ] **Step 4: Make Vite development startup Windows-safe**

Remove the Vite plugin that unconditionally spawns `python3 config_server.py`. Keep the `/api` proxy and let `pnpm tauri dev` start the API through the Tauri sidecar path; retain a documented direct `python config_server.py` fallback for browser-only Vite development.

- [ ] **Step 5: Run frontend type-check and build**

Run:

```powershell
pnpm run type-check
pnpm run build-only
```

Expected: both commands exit successfully and produce `dist`.

- [ ] **Step 6: Commit**

```powershell
git add package.json pnpm-lock.yaml vite.config.ts src-tauri
git commit -m "feat: add Tauri 2 desktop shell"
```

### Task 2: Make the Python API sidecar-aware

**Files:**
- Modify: `config_server.py`
- Modify: `tests/test_config_server.py`
- Create: `scripts/build-sidecar.ps1`
- Create: `scripts/requirements-sidecar.txt`

**Interfaces:**
- Consumes: `DOUAI_DATA_DIR` environment variable.
- Produces: `config_server.py` using `<DOUAI_DATA_DIR>/douai.sqlite3` when set, otherwise preserving the project-root database path.

- [ ] **Step 1: Add failing Python tests for data-directory selection**

Add tests that set `DOUAI_DATA_DIR` to a temporary directory, reload the module, assert `DB_PATH` resolves to `tmp/douai.sqlite3`, and assert the default behavior still resolves beside `config_server.py` when the variable is absent.

- [ ] **Step 2: Run the focused tests**

Run:

```powershell
python -m unittest tests.test_config_server -v
```

Expected: the new data-directory test fails before implementation.

- [ ] **Step 3: Implement environment-driven database path**

Replace the module-level database path with:

```python
DATA_DIR = Path(os.environ["DOUAI_DATA_DIR"]).expanduser() if os.environ.get("DOUAI_DATA_DIR") else Path(__file__).parent
DATA_DIR.mkdir(parents=True, exist_ok=True)
DB_PATH = DATA_DIR / "douai.sqlite3"
```

Keep all existing API routes and schema migrations unchanged.

- [ ] **Step 4: Add the PyInstaller build script**

Create `scripts/build-sidecar.ps1` that:

1. Creates or reuses `.venv-sidecar`.
2. Installs `pyinstaller` and the requirements file.
3. Builds `config_server.py` as a one-file, windowless executable named `douai-api`.
4. Copies the output to `src-tauri/binaries/douai-api-x86_64-pc-windows-msvc.exe`.

- [ ] **Step 5: Run Python tests**

Run:

```powershell
python -m unittest discover -s tests -p "test*.py" -v
```

Expected: all Python tests pass.

- [ ] **Step 6: Commit**

```powershell
git add config_server.py tests/test_config_server.py scripts
git commit -m "feat: support packaged API data directory"
```

### Task 3: Start and stop the sidecar from Tauri

**Files:**
- Modify: `src-tauri/src/main.rs`
- Modify: `src-tauri/capabilities/default.json`
- Modify: `src/services/configApi.ts`
- Create: `src-tauri/src/sidecar.rs`

**Interfaces:**
- Consumes: Tauri app handle, shell sidecar command, application data directory.
- Produces: sidecar process lifecycle that exposes `http://127.0.0.1:8787` before the renderer loads.

- [ ] **Step 1: Add a Rust lifecycle test seam**

Define a small `SidecarState` wrapper with an idempotent `stop()` method and unit-test that calling `stop()` twice does not panic or attempt a second kill.

- [ ] **Step 2: Implement sidecar startup**

Resolve the app data directory with Tauri's path API, set `DOUAI_DATA_DIR` on the sidecar command, spawn `douai-api`, retain the child handle in managed state, and wait briefly for `/api/config` to become healthy before allowing the window to be used.

- [ ] **Step 3: Implement idempotent shutdown**

Register a window close or app exit hook that kills the retained child process once and clears the managed state. Log spawn, health-check, and shutdown failures.

- [ ] **Step 4: Keep the frontend API URL stable**

Ensure `src/services/configApi.ts` continues to use `/api` in dev and `http://127.0.0.1:8787` when running in the packaged Tauri window.

- [ ] **Step 5: Run Rust checks**

Run:

```powershell
cargo fmt --manifest-path src-tauri/Cargo.toml -- --check
cargo test --manifest-path src-tauri/Cargo.toml
```

Expected: formatting and unit tests pass.

- [ ] **Step 6: Commit**

```powershell
git add src-tauri src/services/configApi.ts
git commit -m "feat: manage Python API sidecar lifecycle"
```

### Task 4: Build and verify the Windows installer

**Files:**
- Modify: `.gitignore`
- Modify: `README.md`
- Create: `src-tauri/icons/icon.ico`

**Interfaces:**
- Consumes: Tauri shell, sidecar executable, Vite production build.
- Produces: Windows NSIS installer for DouAi `1.0.0`.

- [ ] **Step 1: Build the sidecar**

Run:

```powershell
pwsh -File scripts/build-sidecar.ps1
```

Expected: `src-tauri/binaries/douai-api-x86_64-pc-windows-msvc.exe` exists.

- [ ] **Step 2: Build the Tauri bundle**

Run:

```powershell
pnpm run tauri:build
```

Expected: a Windows NSIS installer is produced under `src-tauri/target/release/bundle/nsis` with version `1.0.0`.

- [ ] **Step 3: Install and exercise persistence**

Install the generated package, launch DouAi, request `/api/config`, change one setting, close and reopen the app, and confirm the setting persists in the application-data database.

- [ ] **Step 4: Update documentation and ignores**

Document the Windows prerequisites and commands in `README.md`. Ignore `src-tauri/target`, sidecar virtual environments, and generated installer artifacts while keeping the sidecar source/build script tracked.

- [ ] **Step 5: Run the complete verification suite**

Run:

```powershell
pnpm test
pnpm run type-check
pnpm run build-only
python -m unittest discover -s tests -p "test*.py"
```

- [ ] **Step 6: Commit**

```powershell
git add .gitignore README.md src-tauri
git commit -m "build: produce DouAi 1.0.0 Windows installer"
```

## Self-Review

- The goal, architecture, version, Windows scope, sidecar, data directory,
  lifecycle, and verification requirements from the design spec each map to a
  task above.
- No step depends on an undefined API; the sidecar receives only the documented
  `DOUAI_DATA_DIR` environment variable and keeps port `8787`.
- Generated build output and local sidecar environments are explicitly ignored.
