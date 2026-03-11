fn main() {
    tauri_build::try_build(
        tauri_build::Attributes::new().plugin(
            "android-storage",
            tauri_build::InlinedPlugin::new()
                .commands(&[
                    "check_storage_permission",
                    "request_storage_permission",
                    "get_default_vault_path",
                ])
                .default_permission(tauri_build::DefaultPermissionRule::AllowAllCommands),
        ),
    )
    .expect("failed to run tauri-build");
}
