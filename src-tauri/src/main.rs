#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use std::sync::Mutex;
use tauri::{Emitter, Manager, RunEvent};
use tauri_plugin_shell::{process::CommandChild, ShellExt};

struct SidecarState(Mutex<Option<CommandChild>>);

fn main() {
    tauri::Builder::default()
        .plugin(tauri_plugin_log::Builder::default().build())
        .plugin(tauri_plugin_shell::init())
        .manage(SidecarState(Mutex::new(None)))
        .setup(|app| {
            let data_dir = app.path().app_data_dir()?;
            std::fs::create_dir_all(&data_dir)?;

            let (mut rx, child) = app
                .shell()
                .sidecar("douai-api")?
                .env("DOUAI_DATA_DIR", data_dir.to_string_lossy().to_string())
                .spawn()?;

            let app_handle = app.handle().clone();
            tauri::async_runtime::spawn(async move {
                while let Some(event) = rx.recv().await {
                    log::debug!("douai-api sidecar event: {:?}", event);
                }
                log::debug!("douai-api sidecar event stream closed");
                let _ = app_handle.emit("douai-sidecar-exited", ());
            });

            app.state::<SidecarState>()
                .0
                .lock()
                .expect("sidecar state poisoned")
                .replace(child);
            Ok(())
        })
        .build(tauri::generate_context!())
        .expect("error while building DouAi")
        .run(|app, event| {
            if let RunEvent::Exit = event {
                if let Some(child) = app
                    .state::<SidecarState>()
                    .0
                    .lock()
                    .expect("sidecar state poisoned")
                    .take()
                {
                    let _ = child.kill();
                }
            }
        });
}
