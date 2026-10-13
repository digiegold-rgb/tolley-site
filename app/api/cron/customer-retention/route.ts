import { secretEquals } from '@/lib/secret-compare';
import { retainCustomerHistory } from '@/lib/customer-history/retention';
export const maxDuration = 300;
export async function GET(req: Request) {
  if (!process.env.CRON_SECRET || !secretEquals(req.headers.get('authorization'), `Bearer ${process.env.CRON_SECRET}`)) return Response.json({ error: 'Unauthorized' }, { status: 401 });
  return Response.json({ ok: true, ...await retainCustomerHistory() });
}
