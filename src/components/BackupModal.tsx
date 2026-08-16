import { useState } from "react";
import { Download, Upload } from "lucide-react";
import { Modal } from "./Modal";

type Props={mode:"import"|"export";onClose:()=>void;onSubmit:(passphrase:string)=>Promise<void>};
export function BackupModal({mode,onClose,onSubmit}:Props){const [pass,setPass]=useState("");const [busy,setBusy]=useState(false);return <Modal title={mode==="export"?"Export encrypted backup":"Import encrypted backup"} subtitle={mode==="export"?"Accounts, passwords and settings are protected with your passphrase.":"Choose a .ramx backup and enter its passphrase."} onClose={onClose}>
<form className="form-stack" onSubmit={async e=>{e.preventDefault();if(pass.length<8)return;setBusy(true);try{await onSubmit(pass);onClose();}finally{setBusy(false)}}}>
<div className="backup-hero">{mode==="export"?<Download size={28}/>:<Upload size={28}/>}<div><strong>{mode==="export"?"Portable and encrypted":"Merge with current accounts"}</strong><p>{mode==="export"?"Use a passphrase you can remember. It cannot be recovered.":"Imported accounts replace matching IDs and add new accounts."}</p></div></div>
<label className="field"><span>Backup passphrase</span><input type="password" value={pass} onChange={e=>setPass(e.target.value)} placeholder="At least 8 characters"/></label>
<div className="modal-actions"><button type="button" className="button ghost" onClick={onClose}>Cancel</button><button className="button primary" disabled={pass.length<8||busy}>{busy?"Working…":mode==="export"?"Export backup":"Import backup"}</button></div>
</form></Modal>}
