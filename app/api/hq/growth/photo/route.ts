import { prisma } from "@/lib/prisma";
import { validateWdAdmin } from "@/lib/wd-auth";
export async function GET(req: Request) {
  if(!(await validateWdAdmin()).authed) return new Response("Unauthorized",{status:401});
  const p=await prisma.growthInquiryPhoto.findUnique({where:{id:new URL(req.url).searchParams.get("id")||""}});
  if(!p) return new Response("Not found",{status:404});
  return new Response(new Uint8Array(p.image),{headers:{"Content-Type":"image/jpeg","Cache-Control":"private, no-store","X-Content-Type-Options":"nosniff","Content-Disposition":"inline; filename=item.jpg"}});
}
