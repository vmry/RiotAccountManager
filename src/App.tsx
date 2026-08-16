import { useCallback, useEffect, useMemo, useState } from "react";
import { AlertCircle, BookOpen, ChevronRight, Clipboard, Download, Edit3, KeyRound, MoreHorizontal, Plus, RefreshCw, Search, Settings, ShieldCheck, Trash2, Upload, UserRound } from "lucide-react";
import { backend } from "./lib/api";
import type { AccountDraft, AccountProfile, AppState } from "./lib/types";
import { AccountModal } from "./components/AccountModal";
import { SettingsModal } from "./components/SettingsModal";
import { HowToModal } from "./components/HowToModal";
import { BackupModal } from "./components/BackupModal";

const emptyState: AppState = { accounts: [], settings: { autoRefreshMinutes: 30 }, hasApiKey: false };
const rankText=(r:AccountProfile["solo"])=>r?`${r.tier} ${r.division}`:"Unranked";
const fmtTime=(value:string|null)=>{if(!value)return "Never"; const d=new Date(value); if(Number.isNaN(d.getTime()))return value; return new Intl.DateTimeFormat(undefined,{dateStyle:"medium",timeStyle:"short"}).format(d)};

export default function App(){
 const [state,setState]=useState<AppState>(emptyState); const [selectedId,setSelectedId]=useState<string|null>(null); const [query,setQuery]=useState(""); const [loading,setLoading]=useState(true); const [refreshing,setRefreshing]=useState(false); const [modal,setModal]=useState<"add"|"edit"|"settings"|"howto"|"import"|"export"|null>(null); const [toast,setToast]=useState<{kind:"ok"|"error";text:string}|null>(null);
 const notify=(text:string,kind:"ok"|"error"="ok")=>{setToast({text,kind});window.setTimeout(()=>setToast(null),3200)};
 const load=useCallback(async()=>{try{const s=await backend.loadState();setState(s);setSelectedId(x=>x&&s.accounts.some(a=>a.id===x)?x:s.accounts[0]?.id??null);}catch(e){notify(String(e),"error")}finally{setLoading(false)}},[]);
 useEffect(()=>{load()},[load]);
 useEffect(()=>{const m=state.settings.autoRefreshMinutes;if(!m||!state.hasApiKey)return;const id=window.setInterval(()=>{backend.refreshAll().then(accounts=>setState(s=>({...s,accounts}))).catch(()=>{})},m*60_000);return()=>clearInterval(id)},[state.settings.autoRefreshMinutes,state.hasApiKey]);
 const selected=state.accounts.find(a=>a.id===selectedId)??null;
 const filtered=useMemo(()=>state.accounts.filter(a=>`${a.displayName} ${a.gameName} ${a.tagLine}`.toLowerCase().includes(query.toLowerCase())),[state.accounts,query]);
 const save=async(d:AccountDraft)=>{try{const a=await backend.saveAccount(d);setState(s=>({...s,accounts:[...s.accounts.filter(x=>x.id!==a.id),a].sort((x,y)=>x.displayName.localeCompare(y.displayName))}));setSelectedId(a.id);notify("Account saved") }catch(e){notify(String(e),"error");throw e}};
 const refresh=async()=>{if(!selected)return;if(!state.hasApiKey){setModal("settings");notify("Add a Riot API key first","error");return;}setRefreshing(true);try{const a=await backend.refreshAccount(selected.id);setState(s=>({...s,accounts:s.accounts.map(x=>x.id===a.id?a:x)}));if(a.lastError){notify(a.lastError,"error")}else{notify("Stats updated")}}catch(e){notify(String(e),"error")}finally{setRefreshing(false)}};
 const copy=async(kind:"username"|"password")=>{if(!selected)return;try{kind==="username"?await backend.copyUsername(selected.id):await backend.copyPassword(selected.id);notify(`${kind==="username"?"Username":"Password"} copied`)}catch(e){notify(String(e),"error")}};
 const del=async()=>{if(!selected||!confirm(`Delete ${selected.displayName}?`))return;try{await backend.deleteAccount(selected.id);const accounts=state.accounts.filter(a=>a.id!==selected.id);setState(s=>({...s,accounts}));setSelectedId(accounts[0]?.id??null);notify("Account deleted")}catch(e){notify(String(e),"error")}};
 if(loading)return <div className="splash"><div className="brand-mark">R</div><p>Loading accounts…</p></div>;
 return <div className="app-shell">
   <aside className="sidebar">
    <div className="brand"><div className="brand-mark small">R</div><div><strong>Riot Account Manager</strong><span>League accounts, simplified.</span></div></div>
    <div className="sidebar-heading"><span>ACCOUNTS</span><button className="icon-button accent" onClick={()=>setModal("add")} title="Add account"><Plus size={18}/></button></div>
    <div className="searchbox"><Search size={16}/><input value={query} onChange={e=>setQuery(e.target.value)} placeholder="Search accounts"/></div>
    <div className="account-list">{filtered.length?filtered.map(a=><button key={a.id} className={`account-item ${a.id===selectedId?"active":""}`} onClick={()=>setSelectedId(a.id)}><div className="avatar">{a.displayName.slice(0,1).toUpperCase()}</div><div className="account-item-copy"><strong>{a.displayName}</strong><span>{a.gameName}#{a.tagLine}</span></div><div className="mini-rank"><span>{a.solo?.tier??"—"}</span><small>{a.solo?`${a.solo.lp} LP`:"Unranked"}</small></div><ChevronRight size={16}/></button>):<div className="sidebar-empty">No accounts found.</div>}</div>
    <div className="sidebar-footer"><button className="nav-button" onClick={()=>setModal("howto")}><BookOpen size={18}/><span>How to use</span></button><button className="nav-button" onClick={()=>setModal("settings")}><Settings size={18}/><span>Settings</span>{!state.hasApiKey&&<span className="dot-alert"/>}</button></div>
   </aside>
   <main className="content">
    {selected? <>
      <header className="page-header"><div><div className="eyebrow">SELECTED ACCOUNT</div><h1>{selected.displayName}</h1><p>{selected.gameName}<span>#</span>{selected.tagLine} · {selected.platform}</p></div><div className="toolbar"><button className="button subtle" onClick={()=>setModal("import")}><Upload size={16}/>Import</button><button className="button subtle" onClick={()=>setModal("export")}><Download size={16}/>Export</button><button className="button primary" onClick={refresh} disabled={refreshing}><RefreshCw size={16} className={refreshing?"spin":""}/>{refreshing?"Refreshing…":"Refresh stats"}</button></div></header>
      {selected.lastError&&<div className="error-banner"><AlertCircle size={18}/><div><strong>Stats could not be updated</strong><span>{selected.lastError}</span></div></div>}
      <section className="stats-grid">
        <div className="stat-card solo"><div className="stat-top"><span>SOLO / DUO</span><span className="status-pill">Ranked</span></div><strong>{rankText(selected.solo)}</strong><div className="stat-bottom"><span>{selected.solo?`${selected.solo.lp} LP`:"— LP"}</span>{selected.solo&&<small>{selected.solo.wins}W · {selected.solo.losses}L</small>}</div></div>
        <div className="stat-card flex"><div className="stat-top"><span>FLEX</span><span className="status-pill muted">Queue</span></div><strong>{rankText(selected.flex)}</strong><div className="stat-bottom"><span>{selected.flex?`${selected.flex.lp} LP`:"— LP"}</span>{selected.flex&&<small>{selected.flex.wins}W · {selected.flex.losses}L</small>}</div></div>
        <div className="stat-card level"><div className="stat-top"><span>ACCOUNT LEVEL</span><span className="status-pill green">League</span></div><strong>{selected.level??"—"}</strong><div className="stat-bottom"><span>{selected.level?"Summoner level":"Not loaded"}</span></div></div>
      </section>
      <section className="panel login-panel"><div className="panel-heading"><div className="panel-icon"><KeyRound size={18}/></div><div><h2>Riot Client login</h2><p>Copy your saved credentials and paste them into Riot Client.</p></div><div className="secure-label"><ShieldCheck size={15}/>Stored locally</div></div><div className="credentials-grid"><div className="credential"><span>USERNAME</span><strong>{selected.loginUsername}</strong><button className="copy-button" onClick={()=>copy("username")}><Clipboard size={16}/>Copy</button></div><div className="credential"><span>PASSWORD</span><strong className="password-dots">••••••••••••</strong><button className="copy-button danger" onClick={()=>copy("password")}><Clipboard size={16}/>Copy</button></div></div></section>
      <section className="panel details-panel"><div className="panel-heading"><div className="panel-icon"><UserRound size={18}/></div><div><h2>Account details</h2><p>Identity and data status.</p></div><button className="more-button" aria-label="More"><MoreHorizontal size={18}/></button></div><div className="details-grid"><div><span>Riot ID</span><strong>{selected.gameName}#{selected.tagLine}</strong></div><div><span>Region</span><strong>{selected.platform}</strong></div><div><span>Last updated</span><strong>{fmtTime(selected.lastUpdated)}</strong></div><div><span>API status</span><strong className={selected.lastError?"text-danger":"text-success"}>{selected.lastError?"Needs attention":"Up to date"}</strong></div></div><div className="panel-actions"><button className="button ghost" onClick={()=>setModal("edit")}><Edit3 size={16}/>Edit account</button><button className="button danger-quiet" onClick={del}><Trash2 size={16}/>Delete</button></div></section>
    </>:<div className="empty-main"><div className="empty-icon"><UserRound size={30}/></div><h1>Add your first account</h1><p>Keep Riot credentials and League rank information in one clean place.</p><button className="button primary" onClick={()=>setModal("add")}><Plus size={17}/>Add account</button><button className="text-button" onClick={()=>setModal("howto")}>Read the setup guide</button></div>}
   </main>
   {modal==="add"&&<AccountModal onClose={()=>setModal(null)} onSave={save}/>} {modal==="edit"&&selected&&<AccountModal account={selected} onClose={()=>setModal(null)} onSave={save}/>} 
   {modal==="settings"&&<SettingsModal hasApiKey={state.hasApiKey} settings={state.settings} onClose={()=>setModal(null)} onSaveKey={async k=>{await backend.saveApiKey(k);setState(s=>({...s,hasApiKey:true}));notify("API key saved")}} onClearKey={async()=>{await backend.clearApiKey();setState(s=>({...s,hasApiKey:false}));notify("API key removed")}} onSaveSettings={async settings=>{await backend.saveSettings(settings);setState(s=>({...s,settings}));notify("Settings saved")}}/>}
   {modal==="howto"&&<HowToModal onClose={()=>setModal(null)} onOpenPortal={async()=>{await backend.openRiotPortal()}}/>}
   {modal==="export"&&<BackupModal mode="export" onClose={()=>setModal(null)} onSubmit={async p=>{const ok=await backend.exportBackup(p);if(ok)notify("Encrypted backup exported")}}/>}
   {modal==="import"&&<BackupModal mode="import" onClose={()=>setModal(null)} onSubmit={async p=>{const s=await backend.importBackup(p);if(s){setState(s);setSelectedId(s.accounts[0]?.id??null);notify("Backup imported")}}}/>} 
   {toast&&<div className={`toast ${toast.kind}`}><span>{toast.text}</span></div>}
 </div>
}
