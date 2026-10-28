# DouAi Tauri Packaging Design

## Goal

Package DouAi as a Tauri 2 desktop application with version `1.0.0`, initially
targeting Windows 10/11. The existing Vue/Vite UI remains the frontend and the
existing Python SQLite configuration API is shipped as a bundled sidecar so
end users do not need to install Python.

## Architecture

- Tauri 2 provides the native shell, window lifecycle, and Windows bundling.
- Vite continues to build the Vue application into `dist`.
- `config_server.py` is compiled to `douai-api.exe` with PyInstaller.
- Tauri starts the sidecar on application startup and terminates it when the
  application exits.
- The frontend continues to call the API through `http://127.0.0.1:8787`.
- Development keeps the existing Vite and Python workflows, but removes the
  Windows-incompatible hard-coded `python3` startup dependency.

## Configuration and Data

- Tauri metadata and package version are set to `1.0.0`.
- The Tauri development URL is `http://localhost:5173`.
- The production frontend directory is `../dist` relative to `src-tauri`.
- The sidecar executable is declared through Tauri's external binary bundle
  configuration.
- SQLite data is stored in the Tauri application data directory rather than
  beside the installed executable. The API receives the resolved database path
  through an environment variable.
- Existing development behavior remains compatible with the project-root
  `douai.sqlite3` unless an explicit data directory is supplied.

## Windows Bundle

- Build a Windows sidecar executable for the active target triple.
- Produce an NSIS installer as the primary artifact. MSI generation may remain
  enabled when supported by the local toolchain.
- Include the application icon and standard uninstall metadata.
- Do not add auto-update, code signing, or cross-platform installers in this
  iteration.

## Error Handling

- If the sidecar cannot start, Tauri logs the error and presents a useful
  startup failure instead of silently leaving the UI without persistence.
- If the configured API port is already occupied, the sidecar reports the
  existing failure and the application remains diagnosable through logs.
- Shutdown must be idempotent so closing the window does not leave a Python
  process running.

## Verification

1. Run existing TypeScript, frontend build, and Python tests.
2. Build the PyInstaller sidecar and verify it can initialize/read the SQLite
   database from a writable application-data path.
3. Run `tauri build` for Windows and verify the generated installer contains
   the sidecar.
4. Install the bundle, launch the app, load `/api/config`, update a setting,
   restart the app, and confirm persistence.

## Out of Scope

- Rewriting the Python API in Rust.
- macOS/Linux packaging.
- Automatic updates, signing certificates, and release publishing.
