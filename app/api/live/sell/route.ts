import { NextResponse } from "next/server";
import sharp from "sharp";
import { prisma } from "@/lib/prisma";
import { rateLimitByIp } from "@/lib/rate-limit";
import { normalizeAttribution } from "@/lib/discovery-attribution";
export const runtime = "nodejs";
export async function POST(req: Request) {
  const limited = await rateLimitByIp(req,"live:sell",5,3600); if(limited) return limited;
  if (Number(req.headers.get("content-length")) > 4000000) return NextResponse.json({error:"Photos are too large."},{status:413});
  try {
    const f=await req.formData(); const text=(k:string,n:number)=>String(f.get(k)||"").trim().slice(0,n);
    const name=text("name",120),contact=text("contact",200),location=text("location",150),details=text("details",2000);
    if(!name || !contact || !location || !details) return NextResponse.json({error:"Enter your name, contact, location, and item details."},{status:400});
    const photos=f.getAll("photos").filter(p=>p instanceof File && p.size) as File[];
    if(photos.length>3 || photos.reduce((n,p)=>n+p.size,0)>3000000) return NextResponse.json({error:"Use up to 3 photos totaling less than 3 MB."},{status:400});
    const images: Buffer[]=[];
    for(const photo of photos) { if(!["image/jpeg","image/png","image/webp"].includes(photo.type)) throw Error("image"); images.push(await sharp(Buffer.from(await photo.arrayBuffer()),{limitInputPixels:20000000}).rotate().resize(1200,1200,{fit:"inside",withoutEnlargement:true}).jpeg({quality:75}).toBuffer()); }
    const attribution=normalizeAttribution(JSON.parse(text("attribution",4000)||"null"));
    const lead=await prisma.$transaction(async tx=>{
      const row=await tx.growthLead.create({data:{name,offer:"live",source:"seller-inquiry",stage:"replied",...(contact.includes("@")?{email:contact}:{phone:contact}),address:location,notes:details,attribution}});
      const links=[];
      for(const image of images) {const p=await tx.growthInquiryPhoto.create({data:{leadId:row.id,image}}); links.push(`/api/hq/growth/photo?id=${p.id}`);}
      if(links.length) await tx.growthLead.update({where:{id:row.id},data:{notes:details+"\n\nPrivate item photos:\n"+links.join("\n")}});
      return row;
    });
    return NextResponse.json({ok:true,leadId:lead.id});
  } catch { return NextResponse.json({error:"Could not save the inquiry. Check the photo formats or call us."},{status:400}); }
}
