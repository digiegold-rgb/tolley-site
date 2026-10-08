import { writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { readSavedResult, readVideo } from "../lib/shop-video/cloud";
async function main(){
  const [id,out]=process.argv.slice(2);
  if(!/^[a-zA-Z0-9_-]{10,80}$/.test(id||"") || !out?.startsWith("/") || !out.endsWith(".mp4"))throw new Error("Use a cloud job ID and absolute .mp4 output path");
  const r=await readSavedResult(id);
  if(r?.status!=="ready" || !r.size || r.size>4*1024*1024)throw new Error("No verified ready output");
  const bytes=await readVideo(id,0,r.size-1);
  if(createHash("sha256").update(bytes).digest("hex")!==r.sha256)throw new Error("Output checksum mismatch");
  await writeFile(out,bytes,{flag:"wx"});
  console.log(JSON.stringify({out,size:bytes.length,duration:r.duration,providerEstimateCents:r.providerEstimateCents}));
}
main().catch(e=>{console.error(e instanceof Error?e.message:"Download failed");process.exitCode=1;});
