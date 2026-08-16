import { Check, Clipboard, ExternalLink, KeyRound, Plus, RefreshCw, ShieldCheck } from "lucide-react";
import { Modal } from "./Modal";

type Props = { onClose: () => void; onOpenPortal: () => Promise<void>; };
const steps = [
  { icon: <KeyRound size={18}/>, title: "Create a Riot Developer account", body: "Sign in to the Riot Developer Portal with your Riot account. The portal gives you a temporary Development API key immediately for testing." },
  { icon: <ShieldCheck size={18}/>, title: "Register a Personal Project", body: "For your own private tool, register it as a Personal Project in the Developer Portal. Personal projects do not require Riot's Product Verification process. Describe that the app privately manages your own League accounts and displays rank, LP and level." },
  { icon: <Check size={18}/>, title: "Get your Personal API key", body: "After the Personal Project is registered, use the API key shown for that project. A Development key is temporary and expires regularly, so use the Personal Project key for normal use." },
  { icon: <Plus size={18}/>, title: "Add your accounts", body: "Enter a display name, your Riot login username/password, Riot ID and region. Passwords are stored in Windows Credential Manager and are never written to accounts.json." },
  { icon: <RefreshCw size={18}/>, title: "Refresh League stats", body: "Press Refresh. The app resolves your Riot ID to PUUID and retrieves account level plus Solo/Duo and Flex rank data from Riot's API." },
  { icon: <Clipboard size={18}/>, title: "Sign in without typing credentials", body: "Use Copy username and Copy password, then paste them into Riot Client yourself. The app does not automate or submit the Riot login form." },
];
export function HowToModal({onClose,onOpenPortal}:Props){return <Modal title="How to use Riot Account Manager" subtitle="Setup takes a few minutes." onClose={onClose} wide>
  <div className="howto-list">{steps.map((s,i)=><div className="howto-step" key={s.title}><div className="step-number">{i+1}</div><div className="step-icon">{s.icon}</div><div><h3>{s.title}</h3><p>{s.body}</p></div></div>)}</div>
  <div className="howto-callout"><div><strong>Suggested Personal Project description</strong><p>“Riot Account Manager is a private Windows desktop utility for managing my own League of Legends accounts. It uses Account-v1 to resolve Riot IDs and Summoner-v4 / League-v4 to display account level, Solo/Duo rank, Flex rank and LP. It does not automate gameplay or Riot Client actions.”</p></div></div>
  <div className="modal-actions"><button className="button primary" onClick={onOpenPortal}>Open Riot Developer Portal <ExternalLink size={16}/></button></div>
</Modal>}
