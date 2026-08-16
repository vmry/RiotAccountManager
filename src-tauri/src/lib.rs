use aes_gcm::{aead::{Aead, KeyInit}, Aes256Gcm, Nonce};
use argon2::Argon2;
use arboard::Clipboard;
use base64::{engine::general_purpose::STANDARD as B64, Engine as _};
use chrono::Utc;
use directories::ProjectDirs;
use keyring::Entry;
use rand::{rngs::OsRng, RngCore};
use serde::{Deserialize, Serialize};
use std::{collections::HashMap, fs, path::PathBuf, thread, time::Duration};
use uuid::Uuid;

const SERVICE: &str = "RiotAccountManager";
const API_KEY_USER: &str = "riot-api-key";

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct QueueRank {
    tier: String,
    division: String,
    lp: i32,
    wins: i32,
    losses: i32,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct AccountProfile {
    id: String,
    display_name: String,
    login_username: String,
    game_name: String,
    tag_line: String,
    platform: String,
    level: Option<i64>,
    solo: Option<QueueRank>,
    flex: Option<QueueRank>,
    last_updated: Option<String>,
    last_error: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct AccountDraft {
    id: Option<String>,
    display_name: String,
    login_username: String,
    password: String,
    game_name: String,
    tag_line: String,
    platform: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct AppSettings {
    auto_refresh_minutes: u32,
}
impl Default for AppSettings {
    fn default() -> Self { Self { auto_refresh_minutes: 30 } }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct AppState {
    accounts: Vec<AccountProfile>,
    settings: AppSettings,
    has_api_key: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
#[serde(rename_all = "camelCase")]
struct StoredData {
    accounts: Vec<AccountProfile>,
    settings: AppSettings,
}

#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct BackupPayload {
    version: u32,
    accounts: Vec<AccountProfile>,
    settings: AppSettings,
    passwords: HashMap<String, String>,
    api_key: Option<String>,
}

#[derive(Debug, Serialize, Deserialize)]
struct EncryptedEnvelope {
    version: u32,
    salt: String,
    nonce: String,
    ciphertext: String,
}

#[derive(Debug, Deserialize)]
struct RiotAccountResponse { puuid: String }
#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct SummonerResponse { summoner_level: i64 }
#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct LeagueEntry {
    queue_type: String,
    tier: String,
    rank: String,
    league_points: i32,
    wins: i32,
    losses: i32,
}

fn data_path() -> Result<PathBuf, String> {
    let dirs = ProjectDirs::from("org", "vmry", "RiotAccountManager")
        .ok_or_else(|| "Could not determine the application data directory.".to_string())?;
    fs::create_dir_all(dirs.data_local_dir()).map_err(|e| e.to_string())?;
    Ok(dirs.data_local_dir().join("accounts.json"))
}

fn load_data() -> Result<StoredData, String> {
    let path = data_path()?;
    if !path.exists() { return Ok(StoredData { accounts: vec![], settings: AppSettings::default() }); }
    let raw = fs::read_to_string(path).map_err(|e| e.to_string())?;
    serde_json::from_str(&raw).map_err(|e| format!("Could not read local account data: {e}"))
}

fn save_data(data: &StoredData) -> Result<(), String> {
    let path = data_path()?;
    let tmp = path.with_extension("json.tmp");
    let raw = serde_json::to_vec_pretty(data).map_err(|e| e.to_string())?;
    fs::write(&tmp, raw).map_err(|e| e.to_string())?;
    if path.exists() { let _ = fs::remove_file(&path); }
    fs::rename(tmp, path).map_err(|e| e.to_string())
}

fn secret_entry(user: &str) -> Result<Entry, String> {
    Entry::new(SERVICE, user).map_err(|e| format!("Windows Credential Manager error: {e}"))
}
fn get_secret(user: &str) -> Result<Option<String>, String> {
    match secret_entry(user)?.get_password() {
        Ok(v) => Ok(Some(v)),
        Err(keyring::Error::NoEntry) => Ok(None),
        Err(e) => Err(format!("Windows Credential Manager error: {e}")),
    }
}
fn set_secret(user: &str, value: &str) -> Result<(), String> {
    secret_entry(user)?.set_password(value).map_err(|e| format!("Windows Credential Manager error: {e}"))
}
fn delete_secret(user: &str) -> Result<(), String> {
    match secret_entry(user)?.delete_credential() {
        Ok(_) | Err(keyring::Error::NoEntry) => Ok(()),
        Err(e) => Err(format!("Windows Credential Manager error: {e}")),
    }
}
fn password_key(id: &str) -> String { format!("account:{id}") }

#[tauri::command]
fn load_state() -> Result<AppState, String> {
    let data = load_data()?;
    Ok(AppState { has_api_key: get_secret(API_KEY_USER)?.is_some(), accounts: data.accounts, settings: data.settings })
}

#[tauri::command]
fn save_account(account: AccountDraft) -> Result<AccountProfile, String> {
    if account.display_name.trim().is_empty() || account.login_username.trim().is_empty() || account.game_name.trim().is_empty() || account.tag_line.trim().is_empty() {
        return Err("Display name, login username and Riot ID are required.".into());
    }
    let mut data = load_data()?;
    let id = account.id.clone().unwrap_or_else(|| Uuid::new_v4().to_string());
    let existing = data.accounts.iter().find(|x| x.id == id).cloned();
    let profile = AccountProfile {
        id: id.clone(),
        display_name: account.display_name.trim().to_string(),
        login_username: account.login_username.trim().to_string(),
        game_name: account.game_name.trim().to_string(),
        tag_line: account.tag_line.trim().trim_start_matches('#').to_string(),
        platform: account.platform.trim().to_uppercase(),
        level: existing.as_ref().and_then(|x| x.level),
        solo: existing.as_ref().and_then(|x| x.solo.clone()),
        flex: existing.as_ref().and_then(|x| x.flex.clone()),
        last_updated: existing.as_ref().and_then(|x| x.last_updated.clone()),
        last_error: existing.as_ref().and_then(|x| x.last_error.clone()),
    };
    if !account.password.is_empty() { set_secret(&password_key(&id), &account.password)?; }
    if let Some(slot) = data.accounts.iter_mut().find(|x| x.id == id) { *slot = profile.clone(); } else { data.accounts.push(profile.clone()); }
    data.accounts.sort_by_key(|a| a.display_name.to_lowercase());
    save_data(&data)?;
    Ok(profile)
}

#[tauri::command]
fn delete_account(id: String) -> Result<(), String> {
    let mut data = load_data()?;
    data.accounts.retain(|a| a.id != id);
    save_data(&data)?;
    delete_secret(&password_key(&id))?;
    Ok(())
}

fn copy_with_timeout(text: String, clear_after: Option<Duration>) -> Result<(), String> {
    Clipboard::new().and_then(|mut c| c.set_text(text.clone())).map_err(|e| format!("Clipboard error: {e}"))?;
    if let Some(delay) = clear_after {
        thread::spawn(move || {
            thread::sleep(delay);
            if let Ok(mut clipboard) = Clipboard::new() {
                if clipboard.get_text().ok().as_deref() == Some(text.as_str()) { let _ = clipboard.set_text(String::new()); }
            }
        });
    }
    Ok(())
}

#[tauri::command]
fn copy_username(id: String) -> Result<(), String> {
    let data = load_data()?;
    let account = data.accounts.iter().find(|a| a.id == id).ok_or("Account not found.")?;
    copy_with_timeout(account.login_username.clone(), None)
}

#[tauri::command]
fn copy_password(id: String) -> Result<(), String> {
    let password = get_secret(&password_key(&id))?.ok_or("No password is stored for this account.")?;
    copy_with_timeout(password, Some(Duration::from_secs(30)))
}

#[tauri::command]
fn save_api_key(api_key: String) -> Result<(), String> {
    if !api_key.starts_with("RGAPI-") { return Err("This does not look like a Riot API key (expected RGAPI-…).".into()); }
    set_secret(API_KEY_USER, api_key.trim())
}

#[tauri::command]
fn clear_api_key() -> Result<(), String> { delete_secret(API_KEY_USER) }

#[tauri::command]
fn save_settings(settings: AppSettings) -> Result<(), String> {
    let mut data = load_data()?;
    data.settings = settings;
    save_data(&data)
}

fn routing_for(platform: &str) -> &'static str {
    match platform.to_uppercase().as_str() {
        "EUW1" | "EUN1" | "TR1" | "RU" => "europe",
        "NA1" | "BR1" | "LA1" | "LA2" | "OC1" => "americas",
        _ => "asia",
    }
}

async fn riot_get<T: for<'de> Deserialize<'de>>(client: &reqwest::Client, url: &str, api_key: &str) -> Result<T, String> {
    let response = client.get(url).header("X-Riot-Token", api_key).send().await.map_err(|e| format!("Could not reach Riot API: {e}"))?;
    let status = response.status();
    if !status.is_success() {
        let detail = match status.as_u16() {
            401 | 403 => "Riot rejected the API key. It may be invalid or expired.",
            404 => "Riot could not find this account. Check Riot ID, tag and region.",
            429 => "Riot API rate limit reached. Wait a moment and try again.",
            _ => "Riot API returned an error.",
        };
        return Err(format!("{detail} (HTTP {})", status.as_u16()));
    }
    response.json::<T>().await.map_err(|e| format!("Riot API returned unexpected data: {e}"))
}

async fn refresh_profile(mut profile: AccountProfile, api_key: &str) -> AccountProfile {
    let client = reqwest::Client::new();
    let route = routing_for(&profile.platform);
    let game = urlencoding::encode(&profile.game_name);
    let tag = urlencoding::encode(&profile.tag_line);
    let result: Result<(), String> = async {
        let account_url = format!("https://{route}.api.riotgames.com/riot/account/v1/accounts/by-riot-id/{game}/{tag}");
        let account: RiotAccountResponse = riot_get(&client, &account_url, api_key).await?;
        let summoner_url = format!("https://{}.api.riotgames.com/lol/summoner/v4/summoners/by-puuid/{}", profile.platform.to_lowercase(), urlencoding::encode(&account.puuid));
        let league_url = format!("https://{}.api.riotgames.com/lol/league/v4/entries/by-puuid/{}", profile.platform.to_lowercase(), urlencoding::encode(&account.puuid));
        let summoner: SummonerResponse = riot_get(&client, &summoner_url, api_key).await?;
        let entries: Vec<LeagueEntry> = riot_get(&client, &league_url, api_key).await?;
        profile.level = Some(summoner.summoner_level);
        profile.solo = entries.iter().find(|x| x.queue_type == "RANKED_SOLO_5x5").map(|x| QueueRank { tier:x.tier.to_lowercase(), division:x.rank.clone(), lp:x.league_points, wins:x.wins, losses:x.losses });
        profile.flex = entries.iter().find(|x| x.queue_type == "RANKED_FLEX_SR").map(|x| QueueRank { tier:x.tier.to_lowercase(), division:x.rank.clone(), lp:x.league_points, wins:x.wins, losses:x.losses });
        Ok(())
    }.await;
    profile.last_updated = Some(Utc::now().to_rfc3339());
    profile.last_error = result.err();
    profile
}

#[tauri::command]
async fn refresh_account(id: String) -> Result<AccountProfile, String> {
    let api_key = get_secret(API_KEY_USER)?.ok_or("No Riot API key is configured. Open Settings first.")?;
    let mut data = load_data()?;
    let source = data.accounts.iter().find(|a| a.id == id).cloned().ok_or("Account not found.")?;
    let updated = refresh_profile(source, &api_key).await;
    if let Some(slot) = data.accounts.iter_mut().find(|a| a.id == updated.id) { *slot = updated.clone(); }
    save_data(&data)?;
    Ok(updated)
}

#[tauri::command]
async fn refresh_all() -> Result<Vec<AccountProfile>, String> {
    let api_key = get_secret(API_KEY_USER)?.ok_or("No Riot API key is configured.")?;
    let mut data = load_data()?;
    let mut refreshed = Vec::with_capacity(data.accounts.len());
    for account in data.accounts.clone() { refreshed.push(refresh_profile(account, &api_key).await); }
    data.accounts = refreshed.clone();
    save_data(&data)?;
    Ok(refreshed)
}

fn derive_key(passphrase: &str, salt: &[u8]) -> Result<[u8; 32], String> {
    let mut key = [0u8; 32];
    Argon2::default().hash_password_into(passphrase.as_bytes(), salt, &mut key).map_err(|e| format!("Could not derive backup key: {e}"))?;
    Ok(key)
}

#[tauri::command]
fn export_backup(passphrase: String) -> Result<bool, String> {
    if passphrase.len() < 8 { return Err("Use a backup passphrase with at least 8 characters.".into()); }
    let data = load_data()?;
    let mut passwords = HashMap::new();
    for account in &data.accounts { if let Some(p) = get_secret(&password_key(&account.id))? { passwords.insert(account.id.clone(), p); } }
    let payload = BackupPayload { version:1, accounts:data.accounts, settings:data.settings, passwords, api_key:get_secret(API_KEY_USER)? };
    let plaintext = serde_json::to_vec(&payload).map_err(|e| e.to_string())?;
    let mut salt = [0u8;16]; let mut nonce = [0u8;12]; OsRng.fill_bytes(&mut salt); OsRng.fill_bytes(&mut nonce);
    let key = derive_key(&passphrase, &salt)?;
    let cipher = Aes256Gcm::new_from_slice(&key).map_err(|e| e.to_string())?;
    let ciphertext = cipher.encrypt(Nonce::from_slice(&nonce), plaintext.as_ref()).map_err(|_| "Backup encryption failed.".to_string())?;
    let envelope = EncryptedEnvelope { version:1, salt:B64.encode(salt), nonce:B64.encode(nonce), ciphertext:B64.encode(ciphertext) };
    let Some(mut path) = rfd::FileDialog::new().add_filter("Riot Account Manager backup", &["ramx"]).set_file_name("RiotAccountManager-backup.ramx").save_file() else { return Ok(false); };
    if path.extension().is_none() { path.set_extension("ramx"); }
    fs::write(path, serde_json::to_vec_pretty(&envelope).map_err(|e| e.to_string())?).map_err(|e| format!("Could not save backup: {e}"))?;
    Ok(true)
}

#[tauri::command]
fn import_backup(passphrase: String) -> Result<Option<AppState>, String> {
    let Some(path) = rfd::FileDialog::new().add_filter("Riot Account Manager backup", &["ramx"]).pick_file() else { return Ok(None); };
    let envelope: EncryptedEnvelope = serde_json::from_slice(&fs::read(path).map_err(|e| format!("Could not read backup: {e}"))?).map_err(|_| "This is not a valid .ramx backup.".to_string())?;
    let salt = B64.decode(envelope.salt).map_err(|_| "Backup salt is invalid.".to_string())?;
    let nonce = B64.decode(envelope.nonce).map_err(|_| "Backup nonce is invalid.".to_string())?;
    if nonce.len()!=12 { return Err("Backup nonce is invalid.".into()); }
    let ciphertext = B64.decode(envelope.ciphertext).map_err(|_| "Backup data is invalid.".to_string())?;
    let key = derive_key(&passphrase, &salt)?;
    let cipher = Aes256Gcm::new_from_slice(&key).map_err(|e| e.to_string())?;
    let plaintext = cipher.decrypt(Nonce::from_slice(&nonce), ciphertext.as_ref()).map_err(|_| "Wrong passphrase or damaged backup.".to_string())?;
    let payload: BackupPayload = serde_json::from_slice(&plaintext).map_err(|_| "Backup contents are invalid.".to_string())?;
    let mut current = load_data()?;
    for account in payload.accounts {
        if let Some(slot) = current.accounts.iter_mut().find(|a| a.id == account.id) { *slot = account; } else { current.accounts.push(account); }
    }
    current.settings = payload.settings;
    current.accounts.sort_by_key(|a| a.display_name.to_lowercase());
    save_data(&current)?;
    for (id,password) in payload.passwords { set_secret(&password_key(&id), &password)?; }
    if let Some(api_key) = payload.api_key { set_secret(API_KEY_USER, &api_key)?; }
    Ok(Some(AppState { accounts:current.accounts, settings:current.settings, has_api_key:get_secret(API_KEY_USER)?.is_some() }))
}

#[tauri::command]
fn open_riot_portal() -> Result<(), String> {
    open::that("https://developer.riotgames.com/").map_err(|e| format!("Could not open Riot Developer Portal: {e}"))
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .invoke_handler(tauri::generate_handler![load_state, save_account, delete_account, copy_username, copy_password, refresh_account, refresh_all, save_api_key, clear_api_key, save_settings, export_backup, import_backup, open_riot_portal])
        .run(tauri::generate_context!())
        .expect("error while running Riot Account Manager");
}
