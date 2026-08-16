import { useMemo, useState } from "react";
import type { AccountDraft, AccountProfile } from "../lib/types";
import { Modal } from "./Modal";

const platforms = [
  ["EUW", "EUW1"], ["EUNE", "EUN1"], ["NA", "NA1"], ["KR", "KR"], ["JP", "JP1"],
  ["BR", "BR1"], ["LAN", "LA1"], ["LAS", "LA2"], ["OCE", "OC1"], ["TR", "TR1"],
  ["RU", "RU"], ["PH", "PH2"], ["SG", "SG2"], ["TH", "TH2"], ["TW", "TW2"], ["VN", "VN2"],
];

type Props = {
  account?: AccountProfile;
  onClose: () => void;
  onSave: (draft: AccountDraft) => Promise<void>;
};

export function AccountModal({ account, onClose, onSave }: Props) {
  const initial = useMemo<AccountDraft>(() => ({
    id: account?.id,
    displayName: account?.displayName ?? "",
    loginUsername: account?.loginUsername ?? "",
    password: "",
    gameName: account?.gameName ?? "",
    tagLine: account?.tagLine ?? "",
    platform: account?.platform ?? "EUW1",
  }), [account]);
  const [form, setForm] = useState(initial);
  const [saving, setSaving] = useState(false);
  const set = (key: keyof AccountDraft, value: string) => setForm((f) => ({ ...f, [key]: value }));
  const valid = form.displayName.trim() && form.loginUsername.trim() && form.gameName.trim() && form.tagLine.trim();

  return (
    <Modal title={account ? "Edit account" : "Add account"} subtitle="Login credentials stay on this PC. Riot ID is used only for stats." onClose={onClose}>
      <form className="form-stack" onSubmit={async (e) => {
        e.preventDefault(); if (!valid || saving) return; setSaving(true);
        try { await onSave(form); onClose(); } finally { setSaving(false); }
      }}>
        <label className="field"><span>Display name</span><input value={form.displayName} onChange={(e) => set("displayName", e.target.value)} placeholder="Main account" autoFocus /></label>
        <label className="field"><span>Login username</span><input value={form.loginUsername} onChange={(e) => set("loginUsername", e.target.value)} placeholder="Riot login username" /></label>
        <label className="field"><span>{account ? "New password (optional)" : "Password"}</span><input type="password" value={form.password} onChange={(e) => set("password", e.target.value)} placeholder={account ? "Leave blank to keep current password" : "Stored securely in Windows Credential Manager"} /></label>
        <div className="field-row">
          <label className="field grow"><span>Riot ID — game name</span><input value={form.gameName} onChange={(e) => set("gameName", e.target.value)} placeholder="Arcane Enjoyer" /></label>
          <label className="field tag-field"><span>Tag</span><input value={form.tagLine} onChange={(e) => set("tagLine", e.target.value.replace(/^#/, ""))} placeholder="EUW" /></label>
        </div>
        <label className="field"><span>Region</span><select value={form.platform} onChange={(e) => set("platform", e.target.value)}>{platforms.map(([name, value]) => <option key={value} value={value}>{name}</option>)}</select></label>
        <div className="modal-actions"><button type="button" className="button ghost" onClick={onClose}>Cancel</button><button className="button primary" disabled={!valid || saving}>{saving ? "Saving…" : "Save account"}</button></div>
      </form>
    </Modal>
  );
}
