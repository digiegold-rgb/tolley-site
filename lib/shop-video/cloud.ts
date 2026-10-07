import "server-only";
import { WORKER_APP } from "./core";

export function cloudConfigured() {
  return Boolean(process.env.MODAL_TOKEN_ID && process.env.MODAL_TOKEN_SECRET);
}
async function client() {
  if (!cloudConfigured()) throw new Error("Modal operator credentials are not configured");
  const { ModalClient } = await import("modal");
  return new ModalClient({tokenId:process.env.MODAL_TOKEN_ID!,tokenSecret:process.env.MODAL_TOKEN_SECRET!,environment:process.env.MODAL_ENVIRONMENT || undefined});
}
export async function workerHealth() {
  const c = await client();
  const fn = await c.functions.fromName(WORKER_APP,"health");
  return await fn.remote([],{}) as {ready:boolean;fal:boolean;falBillingIssue?:boolean;version:string};
}
export async function connectedTikTokAccounts() {
  if (!process.env.ZERNIO_API_KEY) return [];
  const r = await fetch("https://zernio.com/api/v1/accounts",{headers:{Authorization:`Bearer ${process.env.ZERNIO_API_KEY}`},cache:"no-store",signal:AbortSignal.timeout(12000)});
  if (!r.ok) throw new Error("Could not verify connected TikTok accounts");
  const data = await r.json();
  return (data.accounts || []).filter((a: {platform:string;isActive?:boolean}) => a.platform === "tiktok" && a.isActive === true)
    .map((a: {_id:string;username:string;displayName?:string}) => ({externalAccountId:a._id,username:a.username,displayName:a.displayName||a.username}));
}
export type WorkerResult = {
  status:"ready"|"failed"|"held";
  error?:string;
  size?:number;
  sha256?:string;
  duration?:number;
  width?:number;
  height?:number;
  providerEstimateCents?:number;
  actualCostCents?:number;
  receipts?:{model:string;request_id:string;estimatedCents:number}[];
};
export async function spawnRender(payload: Record<string,unknown>) {
  const c = await client();
  const fn = await c.functions.fromName(WORKER_APP,payload.provider==="modal"?"render_modal":"render");
  const call = await fn.spawn([],{payload});
  return call.functionCallId;
}
export async function pollRender(callId:string): Promise<WorkerResult | null> {
  const c = await client();
  const call = await c.functionCalls.fromId(callId);
  try { return await call.get({timeoutMs:1000}) as WorkerResult; }
  catch (e) { if (e instanceof Error && e.name === "FunctionTimeoutError") return null; throw e; }
}
export async function readVideo(id:string,start:number,end:number) {
  const c = await client();
  const fn = await c.functions.fromName(WORKER_APP,"read_output");
  const result = await fn.remote([],{job_id:id,start,end}) as string;
  return Buffer.from(result,"base64");
}
export async function readSavedResult(id:string): Promise<WorkerResult|null> {
  const c=await client();
  const fn=await c.functions.fromName(WORKER_APP,"read_result");
  return await fn.remote([],{job_id:id}) as WorkerResult|null;
}
