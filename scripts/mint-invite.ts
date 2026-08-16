/**
 * scripts/mint-invite.ts — mint one (or N) Jelly Studio beta invite codes and
 * print the signup links. Optionally lock the code to an email.
 *   npx tsx scripts/mint-invite.ts --email someone@example.com
 *   npx tsx scripts/mint-invite.ts --count 5 --note "wave 2"
 */
import { mintInvites, inviteLink } from "../lib/vater/beta-invites";
import { prisma } from "../lib/prisma";

function arg(name: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? process.argv[i + 1] : undefined;
}
async function main() {
  const rows = await mintInvites({
    count: Number(arg("count") ?? 1),
    maxUses: 1,
    email: arg("email") ?? null,
    note: arg("note") ?? `minted ${new Date().toISOString().slice(0, 10)} via mint-invite.ts`,
    createdBy: "digiegold@gmail.com",
  });
  for (const r of rows) console.log(r.code, inviteLink(r.code));
}
main().finally(() => prisma.$disconnect());
