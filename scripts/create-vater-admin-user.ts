/**
 * scripts/create-vater-admin-user.ts
 *
 * Idempotent: creates (or upserts) a User + CredentialAuth record so the user
 * can sign in via the Email-and-Password provider. Email scope is enforced at
 * the route layer via VATER_ADMIN_ALLOWLIST_EMAILS — this script does not
 * grant any role itself, just provisions the credential.
 *
 * Usage (against prod):
 *   cd ~/tolley-site && npx tsx scripts/create-vater-admin-user.ts \
 *     --email tvater326@gmail.com --password '<plaintext>' --name 'Vater Buddy'
 *
 * The plaintext password is hashed with the same scrypt scheme used by the
 * Credentials authorize() callback (lib/password.ts).
 */

import { hashPassword } from "../lib/password";
import { prisma } from "../lib/prisma";

function getArg(flag: string): string | undefined {
  const idx = process.argv.indexOf(flag);
  if (idx === -1 || idx === process.argv.length - 1) return undefined;
  return process.argv[idx + 1];
}

async function main() {
  const email = (getArg("--email") || "").trim().toLowerCase();
  const password = getArg("--password") || "";
  const name = getArg("--name") || null;

  if (!email || !password) {
    console.error("usage: --email <addr> --password <plaintext> [--name <display>]");
    process.exit(1);
  }

  const existing = await prisma.user.findUnique({
    where: { email },
    include: { credentialAuth: true },
  });

  const passwordHash = await hashPassword(password);

  if (existing) {
    if (existing.credentialAuth) {
      await prisma.credentialAuth.update({
        where: { userId: existing.id },
        data: { passwordHash },
      });
    } else {
      await prisma.credentialAuth.create({
        data: { userId: existing.id, passwordHash },
      });
    }
    if (name && existing.name !== name) {
      await prisma.user.update({
        where: { id: existing.id },
        data: { name },
      });
    }
    console.log(`updated existing user ${email} (id=${existing.id})`);
    return;
  }

  const created = await prisma.user.create({
    data: {
      email,
      name,
      emailVerified: new Date(),
      credentialAuth: {
        create: { passwordHash },
      },
    },
  });

  console.log(`created user ${email} (id=${created.id})`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
