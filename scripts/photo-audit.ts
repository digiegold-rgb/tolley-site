import { prisma } from "../lib/prisma";

async function main() {
  const baseListed = { status: "listed", listings: { some: { platform: "shop", status: "active" as const } } };
  const total = await prisma.product.count({ where: baseListed });
  const noPhotos = await prisma.product.count({ where: { ...baseListed, imageUrls: { isEmpty: true } } });
  const dist = await prisma.$queryRaw<{ bucket: string; n: bigint }[]>`
    select case when coalesce(array_length("imageUrls",1),0) = 0 then '0'
                when array_length("imageUrls",1) = 1 then '1'
                when array_length("imageUrls",1) between 2 and 4 then '2-4'
                when array_length("imageUrls",1) between 5 and 9 then '5-9'
                else '10+' end as bucket, count(*)::bigint as n
    from "Product" p
    where p.status = 'listed'
      and exists (select 1 from "PlatformListing" l where l."productId" = p.id and l.platform='shop' and l.status='active')
    group by bucket order by bucket`;

  console.log(`LISTED+active products on /shop: ${total}`);
  console.log(`  with photos:     ${total - noPhotos}`);
  console.log(`  with NO photos:  ${noPhotos}  ← these are leaking onto the page`);
  console.log(`Photo-count distribution:`);
  for (const r of dist) console.log(`    ${r.bucket} photos: ${Number(r.n)}`);

  if (noPhotos > 0) {
    console.log(`\nSample of photo-less products (first 10):`);
    const samples = await prisma.product.findMany({
      where: { ...baseListed, imageUrls: { isEmpty: true } },
      select: { id: true, title: true, createdAt: true },
      take: 10,
      orderBy: { createdAt: "desc" },
    });
    for (const s of samples) console.log(`  ${s.id}  ${s.createdAt.toISOString().slice(0, 10)}  ${s.title.slice(0, 60)}`);
  }
}

main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
