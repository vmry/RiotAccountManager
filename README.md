# Riot Account Manager

A small Windows desktop app for managing multiple League of Legends accounts in one clean place.

Built with **Tauri 2 + React + TypeScript + Rust**.

## Features

- Modern desktop UI with searchable account sidebar
- Solo/Duo rank, LP, wins/losses
- Flex rank, LP, wins/losses
- League account level
- Manual and optional automatic Riot API refresh
- Copy login username
- Copy password with automatic clipboard clearing after 30 seconds
- Passwords and Riot API key stored in the operating system credential store
- Encrypted `.ramx` import/export backup
- Built-in setup guide for obtaining a Riot Personal API key
- Windows NSIS and MSI builds via GitHub Actions

## Riot API setup

1. Sign in at the Riot Developer Portal.
2. For quick testing you can use the Development API key shown in the portal. Development keys expire regularly.
3. For private ongoing use, register a **Personal Project**. Riot documents Personal API keys for projects intended for the developer or a small private community, and Personal Projects can be registered without the Product Verification process.
4. Put the resulting `RGAPI-...` key into **Settings → Riot API key**.

Suggested Personal Project description:

> Riot Account Manager is a private Windows desktop utility for managing my own League of Legends accounts. It uses Account-v1 to resolve Riot IDs and Summoner-v4 / League-v4 to display account level, Solo/Duo rank, Flex rank and LP. It does not automate gameplay or Riot Client actions.

## Security model

`accounts.json` stores only non-secret account metadata and cached League stats. Login passwords and the Riot API key are stored through the operating system credential store. Portable backups are encrypted with AES-256-GCM using a passphrase-derived key.

The application does **not** automate the Riot Client login form. It only lets you explicitly copy username/password to the clipboard.

## Development on Windows

Tauri requires the Microsoft C++ Build Tools, WebView2, Rust and Node.js.

```powershell
npm install
npm run tauri dev
```

Build installers:

```powershell
npm run tauri build
```

The installers are created under `src-tauri\target\release\bundle\`.

## Release

Push a version tag such as:

```powershell
git tag v1.0.0
git push origin v1.0.0
```

The release workflow builds the Windows installers and attaches them to the GitHub Release automatically.

## Disclaimer

Riot Account Manager is an independent community project and is not endorsed or sponsored by Riot Games. League of Legends and Riot Games are trademarks or registered trademarks of Riot Games, Inc.
