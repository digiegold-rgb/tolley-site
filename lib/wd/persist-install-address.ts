/**
 * Copy a W/D Checkout install address onto the Stripe customer, the rental
 * record, and the welcome lead. Safe to call twice for the same session.
 */

import { Prisma } from "@prisma/client";
import type Stripe from "stripe";

import { prisma } from "@/lib/prisma";
import { getStripeClient } from "@/lib/stripe";
import {
  resolveWdInstallAddress,
  wdInstallCustomerUpdate,
  wdWelcomeRequestKey,
  type WdCheckoutAddressSource,
  type WdInstallAddress,
} from "@/lib/wd/install-address";

function sessionCustomerId(session: Stripe.Checkout.Session): string | null {
  const customer = session.customer;
  if (!customer) return null;
  if (typeof customer === "string") return customer;
  if ("deleted" in customer && customer.deleted) return null;
  return customer.id;
}

function sessionSubscriptionId(session: Stripe.Checkout.Session): string | null {
  const sub = session.subscription;
  if (!sub) return null;
  return typeof sub === "string" ? sub : sub.id;
}

function missingCustomer(err: unknown): boolean {
  return Boolean(err && typeof err === "object" && "code" in err && (err as { code?: unknown }).code === "resource_missing");
}

async function writeClientAddress(custId: string, subId: string | null, formatted: string): Promise<void> {
  if (subId) {
    const updated = await prisma.wdClient.updateMany({
      where: { stripeSubscriptionId: subId },
      data: { address: formatted },
    });
    if (updated.count > 0) return;
  }
  const latest = await prisma.wdClient.findFirst({
    where: { stripeCustomerId: custId },
    orderBy: { createdAt: "desc" },
    select: { id: true },
  });
  if (!latest) return;
  await prisma.wdClient.update({ where: { id: latest.id }, data: { address: formatted } });
}

async function rememberOnLead(custId: string, resolved: WdInstallAddress): Promise<void> {
  const lead = await prisma.leadAction.findUnique({
    where: { requestKey: wdWelcomeRequestKey(custId) },
    select: { id: true, structured: true },
  });
  if (!lead) return;
  const current = lead.structured && typeof lead.structured === "object" && !Array.isArray(lead.structured)
    ? { ...(lead.structured as Record<string, Prisma.JsonValue>) }
    : {};
  if (current.installAddress === resolved.formatted && current.installAddressSource === resolved.source) return;
  current.installAddress = resolved.formatted;
  current.installAddressSource = resolved.source;
  await prisma.leadAction.update({
    where: { id: lead.id },
    data: { structured: current as Prisma.InputJsonValue },
  });
}

/** Persist shipping (or billing, when shipping is absent) for a completed W/D checkout. */
export async function copyWdInstallAddress(session: Stripe.Checkout.Session): Promise<WdInstallAddress | null> {
  const resolved = resolveWdInstallAddress(session as WdCheckoutAddressSource);
  if (!resolved) return null;
  const custId = sessionCustomerId(session);
  if (!custId) return resolved;

  const stripe = getStripeClient();
  const update = wdInstallCustomerUpdate(resolved);
  try {
    await stripe.customers.update(custId, {
      shipping: update.shipping,
      metadata: update.metadata,
    });
  } catch (err) {
    if (!missingCustomer(err)) throw err;
    return resolved;
  }

  await writeClientAddress(custId, sessionSubscriptionId(session), resolved.formatted);
  await rememberOnLead(custId, resolved);
  return resolved;
}
