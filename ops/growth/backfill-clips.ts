import {readdir,readFile,stat} from "node:fs/promises";
import {homedir} from "node:os";
import {prisma} from "../../lib/prisma";
const root=`${homedir()}/.local/state/tolley-stream-clips`;
async function main() {
try{
 for(const entry of await readdir(root,{withFileTypes:true})) {
  if(!entry.isDirectory() || !/^\d{4}-\d{2}-\d{2}_\d{2}-\d{2}-\d{2}$/.test(entry.name))continue;
  const path=`${root}/${entry.name}/candidates.json`;
  try {const candidates=JSON.parse(await readFile(path,"utf8"));if(!Array.isArray(candidates))continue;
   const transcript=JSON.parse(await readFile(`${root}/${entry.name}/transcript.json`,"utf8"));
   const noSpeech=!Array.isArray(transcript.segments) || transcript.segments.length===0;
   const evidence=await stat(path),id=`clip-recording-${entry.name}.mp4`;
   await prisma.growthActivity.upsert({where:{id},create:{id,kind:"clips",status:noSpeech?"no_speech":candidates.length?"processed":"no_candidates",title:`Recording ${entry.name}.mp4`,detail:`${noSpeech?"No speech segments detected; check the microphone/audio feed. ":""}${candidates.length} candidate moments selected. Backfilled from the worker's local candidate file; this does not establish a publication.`,createdAt:evidence.mtime,metadata:{backfilledAt:new Date().toISOString()}},update:{}});
  }catch{ /* Missing evidence is left as a gap. Never inspect transcript content. */ }
 }
}finally{await prisma.$disconnect();}

}
main().catch(()=>{console.error("Backfill failed");process.exitCode=1;});
