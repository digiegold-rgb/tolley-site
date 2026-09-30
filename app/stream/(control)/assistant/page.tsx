import Link from "next/link";
import { redirect } from "next/navigation";
import { validateWdAdmin } from "@/lib/wd-auth";
import "../guide/guide.css";

export default async function Assistants() {
  if (!(await validateWdAdmin()).authed) redirect("/login?callbackUrl=/stream/assistant");
  return <main className="stream-guide"><nav><Link href="/stream">← Stream controls</Link><Link href="/stream/guide">Streaming guide</Link></nav><article>
    <h1>Your Whatnot show assistants</h1>
    <p>Choose the assistant for tonight. Both start paused; connecting an assistant does not start your broadcast.</p>
    <h2>Classic — the greetings you already use</h2>
    <p>Welcomes viewers, sends personal thank-you messages and occasional announcements, and uses answers you have verified for the show.</p>
    <p><Link href="/api/stream/whatnot-bot/admin">Open Classic Show Assistant →</Link></p>
    <h2>Inventory V2 — add product questions</h2>
    <p>Includes greetings and looks up named products in your Tolley catalog, including imported Facebook listings and drafts. It can use a saved Tolley lineup after you confirm that lineup belongs to the connected show.</p>
    <p><Link href="/api/stream/whatnot-bot-v2/admin">Open Inventory Assistant V2 →</Link></p>
    <ol><li>Open V2 and try <strong>Preview answer</strong>. Previews never post messages.</li><li>Pause Classic. Paste the current Whatnot show link into V2 and click <strong>Connect show</strong>.</li><li>Optionally confirm the saved lineup for this show. Otherwise answers are limited to the broader catalog.</li><li>Review V2 settings, then click <strong>Start Inventory V2</strong> when you want it to respond. Click <strong>Pause V2 sending</strong> to stop responses.</li></ol>
    <p>V2 spaces public messages at least 60 seconds apart, limits them to 40 per hour, and waits five minutes before replying publicly to the same viewer again. Only one assistant can send at a time. Recipient cooldowns and opt-outs carry between versions.</p>
    <h2>What it knows</h2>
    <p>It uses saved product names, recorded condition and verified descriptions. A listed product is a catalog record; a draft is a possible item for you to check. Sold records take precedence. It does not promise that backstock is in tonight’s show.</p>
    <p>The catalog refreshes every minute. V2 stops inventory answers if that snapshot is more than three minutes old. It never loads your purchase costs or minimum prices, and sends viewers to the current Whatnot listing or host for auction pricing.</p>
    <p>It can follow a viewer’s recent named-product question. It cannot see what you are holding, listen to the show, or automatically import tonight’s Whatnot auction list. Unclear questions, missing details, compatibility and working-condition checks stay with you.</p>
    <p>To return to the familiar assistant, pause V2 and open Classic. Neither button changes your cameras, OBS or live broadcast.</p>
  </article></main>;
}
