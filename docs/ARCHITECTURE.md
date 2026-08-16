# Architecture

- `src/`: React + TypeScript UI
- `src-tauri/`: Rust/Tauri desktop backend
- `src-tauri/src/lib.rs`: local storage, credential storage, clipboard, Riot API and encrypted backups
- `.github/workflows/`: Windows build and release automation

The frontend never receives stored passwords. Password copy operations happen directly in Rust and write to the OS clipboard only after an explicit user action.
