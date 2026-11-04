import { NextResponse } from 'next/server';
import { readWdActivity } from '@/lib/wd-activity/store';
export const dynamic = 'force-dynamic';
export async function GET() {
  try { return NextResponse.json(await readWdActivity(), { headers: { 'Cache-Control': 'public, max-age=0, s-maxage=60' } }); }
  catch { return NextResponse.json({ error: 'Rental activity could not be loaded. Please retry.' }, { status: 503, headers: { 'Cache-Control': 'no-store' } }); }
}
