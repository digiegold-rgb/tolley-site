import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { chromium } from "playwright";
import { encode } from "next-auth/jwt";
import { prisma } from "../../lib/prisma";
import { signMfaProof, enrollmentKey } from "../../lib/auth/mfa-proof";
if (!process.env.DATABASE_URL?.includes("127.0.0.1:55465/tolley_laundry_test"))
  throw new Error("Isolated laundry database required");
process.env.AUTH_SECRET = "laundry-test-secret-only";
const base = "http://127.0.0.1:3065";
async function main() {
  const browser = await chromium.launch({
    headless: true,
    args: ["--no-sandbox"],
  });
  try {
    const op = await prisma.laundryOperator.findFirstOrThrow({
      where: { legalName: "Access Test LLC" },
      orderBy: { createdAt: "desc" },
    });
    for (const admin of [false, true]) {
      const user = admin
        ? await prisma.user.findUniqueOrThrow({
            where: { email: "laundry-admin@example.invalid" },
          })
        : await prisma.user.findUniqueOrThrow({ where: { id: op.ownerId } });
      const sid = randomUUID();
      const jwt = await encode({
        secret: process.env.AUTH_SECRET,
        salt: "authjs.session-token",
        token: {
          sub: user.id,
          email: user.email,
          name: user.name,
          authSessionId: sid,
          sv: user.sessionVersion,
          svAt: Math.floor(Date.now() / 1000),
        },
      });
      const context = await browser.newContext({
        viewport: { width: 1280, height: 900 },
      });
      await context.addCookies([
        { name: "authjs.session-token", value: jwt, url: base },
      ]);
      if (admin) {
        const mfa = await prisma.userMfa.findUniqueOrThrow({
          where: { userId: user.id },
        });
        await context.addCookies([
          {
            name: "tolley_mfa",
            value: signMfaProof(user.id, sid, enrollmentKey(mfa)),
            url: base,
          },
        ]);
      }
      const page = await context.newPage();
      const errors: string[] = [];
      page.on("pageerror", (e) => errors.push(e.message));
      await page.goto(base + "/laundry/dashboard", {
        waitUntil: "networkidle",
      });
      await page
        .getByRole("heading", { name: "Your operator workspace." })
        .waitFor();
      await page
        .getByRole("button", { name: "Operators", exact: true })
        .click();
      await page.getByRole("heading", { name: op.name, exact: true }).waitFor();
      assert.equal(
        await page.getByRole("button", { name: "Cities", exact: true }).count(),
        admin ? 1 : 0,
      );
      if (admin) {
        await page.getByRole("button", { name: "Cities", exact: true }).click();
        await page
          .getByRole("heading", { name: "Market performance" })
          .waitFor();
        await page.screenshot({
          path: "/tmp/laundry-owner-dashboard.png",
          fullPage: true,
        });
      } else {
        await page.screenshot({
          path: "/tmp/laundry-operator-dashboard.png",
          fullPage: true,
        });
        await page.getByRole("button", { name: "Leads", exact: true }).click();
        await page
          .getByRole("heading", { name: "Access Renter · set" })
          .waitFor();
      }
      assert.deepEqual(errors, []);
      await context.close();
    }
    console.log(
      "PASS authenticated operator/owner dashboards render, show assigned leads and scope city/admin controls correctly.",
    );
  } finally {
    await browser.close();
    await prisma.$disconnect();
  }
}
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
