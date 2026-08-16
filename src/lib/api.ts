import { invoke } from "@tauri-apps/api/core";
import type { AccountDraft, AccountProfile, AppSettings, AppState } from "./types";

export const backend = {
  loadState: () => invoke<AppState>("load_state"),
  saveAccount: (account: AccountDraft) => invoke<AccountProfile>("save_account", { account }),
  deleteAccount: (id: string) => invoke<void>("delete_account", { id }),
  copyUsername: (id: string) => invoke<void>("copy_username", { id }),
  copyPassword: (id: string) => invoke<void>("copy_password", { id }),
  refreshAccount: (id: string) => invoke<AccountProfile>("refresh_account", { id }),
  refreshAll: () => invoke<AccountProfile[]>("refresh_all"),
  saveApiKey: (apiKey: string) => invoke<void>("save_api_key", { apiKey }),
  clearApiKey: () => invoke<void>("clear_api_key"),
  saveSettings: (settings: AppSettings) => invoke<void>("save_settings", { settings }),
  exportBackup: (passphrase: string) => invoke<boolean>("export_backup", { passphrase }),
  importBackup: (passphrase: string) => invoke<AppState | null>("import_backup", { passphrase }),
  openRiotPortal: () => invoke<void>("open_riot_portal"),
};
