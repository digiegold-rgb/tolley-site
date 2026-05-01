/**
 * Resolve & cache the seller's business policies (Payment, Return, Fulfillment).
 *
 * eBay requires every offer to reference these by ID. We pull them from the
 * Sell Account API once and store the IDs on EbayAuth so the worker doesn't
 * round-trip on every listing.
 */

import { prisma } from "@/lib/prisma";
import { ebayFetch } from "./client";

interface PolicyListResponse<T> {
  total?: number;
  [key: string]: unknown;
}

interface PaymentPolicy {
  paymentPolicyId: string;
  name: string;
  marketplaceId: string;
}
interface ReturnPolicy {
  returnPolicyId: string;
  name: string;
  marketplaceId: string;
}
interface FulfillmentPolicy {
  fulfillmentPolicyId: string;
  name: string;
  marketplaceId: string;
}

const MARKETPLACE = "EBAY_US";

async function listPaymentPolicies(): Promise<PaymentPolicy[]> {
  const res = await ebayFetch<PolicyListResponse<PaymentPolicy> & { paymentPolicies?: PaymentPolicy[] }>(
    `/sell/account/v1/payment_policy?marketplace_id=${MARKETPLACE}`
  );
  return res.paymentPolicies ?? [];
}
async function listReturnPolicies(): Promise<ReturnPolicy[]> {
  const res = await ebayFetch<PolicyListResponse<ReturnPolicy> & { returnPolicies?: ReturnPolicy[] }>(
    `/sell/account/v1/return_policy?marketplace_id=${MARKETPLACE}`
  );
  return res.returnPolicies ?? [];
}
async function listFulfillmentPolicies(): Promise<FulfillmentPolicy[]> {
  const res = await ebayFetch<
    PolicyListResponse<FulfillmentPolicy> & { fulfillmentPolicies?: FulfillmentPolicy[] }
  >(`/sell/account/v1/fulfillment_policy?marketplace_id=${MARKETPLACE}`);
  return res.fulfillmentPolicies ?? [];
}

export interface ResolvedPolicies {
  paymentPolicyId: string;
  returnPolicyId: string;
  fulfillmentPolicyId: string;
}

async function createDefaultPaymentPolicy(): Promise<PaymentPolicy> {
  return ebayFetch<PaymentPolicy>("/sell/account/v1/payment_policy", {
    method: "POST",
    body: JSON.stringify({
      name: "Standard Payment",
      description: "Default payment policy (immediate pay, managed payments)",
      marketplaceId: MARKETPLACE,
      categoryTypes: [{ name: "ALL_EXCLUDING_MOTORS_VEHICLES" }],
      immediatePay: true,
    }),
  });
}

async function createDefaultReturnPolicy(): Promise<ReturnPolicy> {
  return ebayFetch<ReturnPolicy>("/sell/account/v1/return_policy", {
    method: "POST",
    body: JSON.stringify({
      name: "30-day Returns",
      description: "Buyer pays return shipping, money-back",
      marketplaceId: MARKETPLACE,
      categoryTypes: [{ name: "ALL_EXCLUDING_MOTORS_VEHICLES" }],
      returnsAccepted: true,
      returnPeriod: { value: 30, unit: "DAY" },
      returnMethod: "MONEY_BACK",
      returnShippingCostPayer: "BUYER",
      refundMethod: "MONEY_BACK",
    }),
  });
}

async function createDefaultFulfillmentPolicy(): Promise<FulfillmentPolicy> {
  return ebayFetch<FulfillmentPolicy>("/sell/account/v1/fulfillment_policy", {
    method: "POST",
    body: JSON.stringify({
      name: "Calculated Domestic",
      description: "USPS Ground Advantage, 1-day handling",
      marketplaceId: MARKETPLACE,
      categoryTypes: [{ name: "ALL_EXCLUDING_MOTORS_VEHICLES" }],
      handlingTime: { value: 1, unit: "DAY" },
      shippingOptions: [
        {
          optionType: "DOMESTIC",
          costType: "CALCULATED",
          shippingServices: [
            {
              sortOrder: 1,
              shippingCarrierCode: "USPS",
              shippingServiceCode: "USPSGroundAdvantage",
              freeShipping: false,
              buyerResponsibleForShipping: false,
              buyerResponsibleForPickup: false,
            },
          ],
        },
      ],
    }),
  });
}

/**
 * Pick the first policy of each kind on the EBAY_US marketplace and cache
 * the IDs on EbayAuth. If any kind is missing, creates a sensible default
 * via the Sell Account API (works after opt-in to SELLING_POLICY_MANAGEMENT).
 */
export async function resolveAndCachePolicies(): Promise<ResolvedPolicies> {
  let [payments, returns, fulfillments] = await Promise.all([
    listPaymentPolicies(),
    listReturnPolicies(),
    listFulfillmentPolicies(),
  ]);

  // Bootstrap any missing kind with a default. POST returns the new policy
  // (sometimes only the ID — refetch the list afterward to be safe).
  const created: string[] = [];
  if (payments.length === 0) { await createDefaultPaymentPolicy(); created.push("payment"); }
  if (returns.length === 0) { await createDefaultReturnPolicy(); created.push("return"); }
  if (fulfillments.length === 0) { await createDefaultFulfillmentPolicy(); created.push("fulfillment"); }

  if (created.length > 0) {
    [payments, returns, fulfillments] = await Promise.all([
      listPaymentPolicies(),
      listReturnPolicies(),
      listFulfillmentPolicies(),
    ]);
  }

  if (payments.length === 0 || returns.length === 0 || fulfillments.length === 0) {
    throw new Error(
      `eBay business policies still missing after bootstrap: payment=${payments.length}, return=${returns.length}, fulfillment=${fulfillments.length}. ` +
        `Created: ${created.join(",") || "none"}. eBay may have rejected the create — check API logs.`
    );
  }

  const resolved: ResolvedPolicies = {
    paymentPolicyId: payments[0].paymentPolicyId,
    returnPolicyId: returns[0].returnPolicyId,
    fulfillmentPolicyId: fulfillments[0].fulfillmentPolicyId,
  };

  // Persist on the (single) EbayAuth row so the worker can read directly.
  const auth = await prisma.ebayAuth.findFirst({ orderBy: { updatedAt: "desc" } });
  if (auth) {
    await prisma.ebayAuth.update({
      where: { id: auth.id },
      data: resolved,
    });
  }

  return resolved;
}

export async function getCachedPolicies(): Promise<ResolvedPolicies | null> {
  const auth = await prisma.ebayAuth.findFirst({ orderBy: { updatedAt: "desc" } });
  if (!auth?.paymentPolicyId || !auth.returnPolicyId || !auth.fulfillmentPolicyId) {
    return null;
  }
  return {
    paymentPolicyId: auth.paymentPolicyId,
    returnPolicyId: auth.returnPolicyId,
    fulfillmentPolicyId: auth.fulfillmentPolicyId,
  };
}
