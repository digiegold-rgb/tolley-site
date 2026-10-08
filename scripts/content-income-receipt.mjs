// Read-only raw SQL also works with the older local Prisma client used by the
// morning receipt. Unavailable tables/data never become invented zero income.
export async function contentIncomeReceipt(db) {
  try {
    const accounts=await db.$queryRaw`SELECT "paused","startedAt","programStatus","followers","heartbeatAt","earningsError","qualifiedViewsError" FROM "ContentIncomeAccount" WHERE id='facebook-treasure'`;
    const a=accounts[0]; if(!a)return null;
    const [earnings,cash,posts]=await Promise.all([
      db.$queryRaw`SELECT COUNT(*)::int AS days, (SUM("amountMicros")/10000.0)::float8 AS cents FROM "ContentIncomeEarningDay" WHERE "accountId"='facebook-treasure' AND "endTime">=CURRENT_TIMESTAMP-INTERVAL '30 days'`,
      db.$queryRaw`SELECT COUNT(*)::int AS count, SUM(CASE WHEN status='paid' THEN "amountCents" ELSE 0 END)::float8 AS cents FROM "ContentIncomeReceipt" WHERE "accountId"='facebook-treasure'`,
      db.$queryRaw`SELECT COUNT(*) FILTER (WHERE status='posted' AND "publishedAt">=CURRENT_TIMESTAMP-INTERVAL '24 hours')::int AS published, COUNT(*) FILTER (WHERE status IN ('uncertain','failed'))::int AS attention FROM "ContentIncomePost" WHERE "accountId"='facebook-treasure'`,
    ]);
    return {paused:a.paused,started:!!a.startedAt,programStatus:a.programStatus,followers:a.followers,workerAt:a.heartbeatAt,earningsError:a.earningsError,qualifiedViewsError:a.qualifiedViewsError,coverageDays:earnings[0].days,estimatedCents:earnings[0].cents,cashReceipts:cash[0].count,paidCents:cash[0].cents,publishedLast24h:posts[0].published,attention:posts[0].attention};
  }catch{return {unavailable:true};}
}
