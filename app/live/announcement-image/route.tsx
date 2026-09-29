import { ImageResponse } from "next/og";
import sharp from "sharp";
export const runtime = "nodejs";
export async function GET() {
  const card=new ImageResponse(<div style={{display:"flex",flexDirection:"column",justifyContent:"space-between",width:"100%",height:"100%",padding:80,background:"#f5f1e7",color:"#17251c",fontFamily:"sans-serif"}}><div style={{display:"flex",fontSize:32}}>TREASURE HAULS · WHATNOT</div><div style={{display:"flex",flexDirection:"column",fontSize:108,fontWeight:800}}><span>Come for</span><span>the show.</span><span style={{color:"#c3451f"}}>Stay for</span><span style={{color:"#c3451f"}}>the steals.</span></div><div style={{display:"flex",fontSize:32}}>Jared + Ruthann · tolley.io/live</div></div>,{width:1080,height:1080});
  const image=await sharp(Buffer.from(await card.arrayBuffer())).jpeg({quality:90}).toBuffer();
  return new Response(new Uint8Array(image),{headers:{"Content-Type":"image/jpeg","Cache-Control":"public, max-age=86400"}});
}
