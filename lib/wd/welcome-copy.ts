/**
 * Pure W/D paid-signup welcome copy. No Prisma / Twilio / Stripe I/O.
 */

import {
  WD_PRICE_BUNDLE,
  WD_PRICE_WASHER,
  WD_SITE_URL,
  WD_SMS_PHONE,
  WD_STRIPE_PORTAL_URL,
} from "@/lib/wd";

export const WD_WELCOME_STRIPE_META = "wd_welcome_sent";
export const WD_WELCOME_SUBJECT = "Welcome to Tolley Washer & Dryer Rental — you're all set";

export function wdWelcomeFirstName(name?: string | null): string {
  const first = (name || "").trim().split(/\s+/)[0];
  return first || "there";
}

/** Map Stripe/DB monthly amount to the $42 or $58 plan shown in copy. */
export function wdWelcomePlanAmount(monthly: number | null | undefined): number {
  if (monthly == null || Number.isNaN(monthly)) return WD_PRICE_BUNDLE;
  const rounded = Math.round(monthly);
  if (rounded === WD_PRICE_WASHER) return WD_PRICE_WASHER;
  if (rounded === WD_PRICE_BUNDLE) return WD_PRICE_BUNDLE;
  if (Math.abs(monthly - WD_PRICE_WASHER) <= Math.abs(monthly - WD_PRICE_BUNDLE)) {
    return WD_PRICE_WASHER;
  }
  return WD_PRICE_BUNDLE;
}

export function wdWelcomeSmsBody(opts: { name?: string | null; amount: number }): string {
  const first = wdWelcomeFirstName(opts.name);
  return (
    `Hi ${first}, it's Jared with Tolley Washer & Dryer Rental — payment went through, you're all set!\n\n` +
    `Your $${opts.amount}/mo rental is active. No install or delivery fee, and maintenance is included.\n\n` +
    `Save this number: ${WD_SMS_PHONE}\n` +
    `${WD_SITE_URL}\n` +
    `Manage / update card: ${WD_STRIPE_PORTAL_URL}\n\n` +
    `We'll text about 20 minutes out when we're on the way to install.\n\n` +
    `Thanks for joining!`
  );
}

export function wdWelcomeEmailBody(opts: { name?: string | null; amount: number }): string {
  const first = wdWelcomeFirstName(opts.name);
  return (
    `Hi ${first},\n\n` +
    `Payment went through — you're all set. Your $${opts.amount}/mo washer & dryer rental is active. ` +
    `There's no install or delivery fee, and maintenance is included.\n\n` +
    `Save our number ${WD_SMS_PHONE} and keep ${WD_SITE_URL} handy. ` +
    `Manage or update your card anytime:\n${WD_STRIPE_PORTAL_URL}\n\n` +
    `We'll text about 20 minutes out when we're on the way to install.\n\n` +
    `Thanks for renting with us,\nJared — Your KC Homes`
  );
}

export function wdWelcomeEmailParagraphs(opts: { name?: string | null; amount: number }): string[] {
  return wdWelcomeEmailBody(opts).split("\n\n");
}
