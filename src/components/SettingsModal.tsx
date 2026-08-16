import { useState } from "react";
import { KeyRound, ShieldCheck, Trash2 } from "lucide-react";
import type { AppSettings } from "../lib/types";
import { Modal } from "./Modal";

type Props = { hasApiKey: boolean; settings: AppSettings; onClose: () => void; onSaveKey: (key: string) => Promise<void>; onClearKey: () => Promise<void>; onSaveSettings: (s: AppSettings) => Promise<void>; };

export function SettingsModal(props: Props) {
  const [key, setKey] = useState("");
  const [minutes, setMinutes] = useState(props.settings.autoRefreshMinutes);
  return <Modal title="Settings" subtitle="API credentials and refresh behavior" onClose={props.onClose}>
    <div className="settings-section">
      <div className="section-title-row"><div className="section-icon"><KeyRound size={18}/></div><div><h3>Riot API key</h3><p>{props.hasApiKey ? "A key is stored securely on this PC." : "No API key is currently configured."}</p></div></div>
      <label className="field"><span>New API key</span><input type="password" value={key} onChange={(e)=>setKey(e.target.value)} placeholder="RGAPI-…" /></label>
      <div className="inline-actions"><button className="button primary" disabled={!key.trim()} onClick={async()=>{await props.onSaveKey(key.trim()); setKey("");}}>Save API key</button>{props.hasApiKey && <button className="button danger-quiet" onClick={props.onClearKey}><Trash2 size={16}/>Remove key</button>}</div>
    </div>
    <div className="divider"/>
    <div className="settings-section">
      <div className="section-title-row"><div className="section-icon"><ShieldCheck size={18}/></div><div><h3>Automatic refresh</h3><p>Refresh account stats while the app is open.</p></div></div>
      <label className="field"><span>Interval</span><select value={minutes} onChange={(e)=>setMinutes(Number(e.target.value))}><option value={0}>Off</option><option value={15}>Every 15 minutes</option><option value={30}>Every 30 minutes</option><option value={60}>Every hour</option></select></label>
      <div className="modal-actions"><button className="button primary" onClick={async()=>{await props.onSaveSettings({autoRefreshMinutes:minutes}); props.onClose();}}>Save settings</button></div>
    </div>
  </Modal>;
}
