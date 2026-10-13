import { prisma } from '@/lib/prisma';
import { validateWdAdmin } from '@/lib/wd-auth';
import { decryptMedia } from '@/lib/customer-history/media';
import sharp from 'sharp';
export const runtime = 'nodejs';
export async function GET(req: Request, ctx: { params: Promise<{ id: string }> }) {
  if (!(await validateWdAdmin()).authed) return Response.json({ error: 'Unauthorized' }, { status: 401 });
  const { id } = await ctx.params;
  const row = await prisma.hqCustomerAttachment.findUnique({ where: { id }, include: { event: { include: { customer: true } } } });
  if (!row || row.event.customer.deletedAt) return Response.json({ error: 'Not found' }, { status: 404 });
  let bytes = decryptMedia(row.encrypted), mime = row.mime;
  if (new URL(req.url).searchParams.has('preview') && row.encryptedPreview) { bytes = decryptMedia(row.encryptedPreview); mime = 'image/jpeg'; }
  else if (new URL(req.url).searchParams.has('preview') && row.mime.startsWith('image/')) {
    try { bytes = await sharp(bytes, { limitInputPixels: 40000000 }).resize({ width: 900, height: 900, fit: 'inside', withoutEnlargement: true }).jpeg({ quality: 80 }).toBuffer(); mime = 'image/jpeg'; } catch { return Response.json({ error: 'Preview unavailable; download original' }, { status: 422 }); }
  }
  return new Response(new Uint8Array(bytes), { headers: { 'Content-Type': mime, 'Content-Disposition': `${new URL(req.url).searchParams.has('preview') ? 'inline' : 'attachment'}; filename="${row.name.replace(/[^a-zA-Z0-9._-]/g, '_')}"`, 'Cache-Control': 'private, no-store', 'X-Content-Type-Options': 'nosniff', 'Content-Security-Policy': "default-src 'none'" } });
}
