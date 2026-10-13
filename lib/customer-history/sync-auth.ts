import { secretEquals } from '@/lib/secret-compare';
export function authorized(req: Request) { return !!process.env.CUSTOMER_SYNC_SECRET && secretEquals(req.headers.get('authorization'), `Bearer ${process.env.CUSTOMER_SYNC_SECRET}`); }
