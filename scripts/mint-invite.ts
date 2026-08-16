/**
 * scripts/mint-invite.ts — mint one (or N) Jelly Studio beta invite codes and
 * print the signup links. Optionally lock the code to an email.
 *   npx tsx scripts/mint-invite.ts --email someone@example.com
 *   npx tsx scripts/mint-invite.ts --count 5 --note "wave 2"
 *   npx tsx scripts/mint-invite.ts --send --email someone@example.com   (mints + EMAILS the link,
 *       closes the open invite-request Must Complete item; needs EMAIL_SERVER_* in env)
 */
import { mintInvites, inviteLink, formatInviteCode } from "../lib/vater/beta-invites";
import { sendInviteLinkEmail } from "../lib/vater/animate-email";
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
  const email = arg("email");
  if (process.argv.includes("--send") && email && rows[0]) {
    await sendInviteLinkEmail(email, inviteLink(rows[0].code), formatInviteCode(rows[0].code));
    await prisma.mustCompleteItem.updateMany({
      where: { source: "animate-invite-request", status: "open", title: `Invite request — ${email.toLowerCase()}` },
      data: { status: "done", completedAt: new Date() },
    });
    console.log(`emailed invite to ${email}`);
  }
}
main().finally(() => prisma.$disconnect());
