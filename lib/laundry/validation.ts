import { z } from "zod";
import { zipPlace } from "./geo";
export const zipSchema = z
  .string()
  .regex(/^\d{5}$/)
  .refine((z) => !!zipPlace(z), "Enter a recognized US ZIP code.");
const phone = z
  .string()
  .transform((v) => v.replace(/\D/g, ""))
  .refine((v) => /^(1)?[2-9]\d{9}$/.test(v), "Enter a US phone number.")
  .transform((v) => `+${v.length === 10 ? "1" : ""}${v}`);
export const dateSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .refine((v) => {
    const d = new Date(v + "T12:00:00Z");
    return (
      !Number.isNaN(d.getTime()) &&
      d.toISOString().slice(0, 10) === v &&
      d.getTime() >= Date.now() - 86400000 &&
      d.getTime() < Date.now() + 180 * 86400000
    );
  }, "Choose a valid date within the next six months.");
export const leadSchema = z.object({
  requestKey: z.string().uuid(),
  operatorId: z.string().max(100).nullable(),
  name: z.string().trim().min(2).max(120),
  phone,
  email: z.email().max(254),
  address: z.string().trim().min(5).max(300),
  zip: zipSchema,
  unit: z.enum(["washer", "dryer", "set", "stackable"]),
  preferredDate: dateSchema,
  notes: z.string().trim().max(2000).default(""),
  smsConsent: z.boolean(),
  termsAccepted: z.literal(true),
  signedName: z.string().trim().max(120).default(""),
  agreementHash: z.string().max(64).default(""),
  attribution: z.unknown().optional(),
  website: z.string().max(0).optional(),
});
export const operatorSchema = z
  .object({
    name: z.string().trim().min(2).max(100),
    legalName: z.string().trim().min(2).max(160),
    phone,
    address: z.string().trim().min(5).max(300),
    zip: zipSchema,
    zips: z.array(zipSchema).max(1000).default([]),
    radiusMiles: z.number().int().min(0).max(200),
    description: z.string().trim().min(20).max(2000),
    prices: z
      .object({
        washer: z.number().int().min(100).max(100000).optional(),
        dryer: z.number().int().min(100).max(100000).optional(),
        set: z.number().int().min(100).max(100000).optional(),
        stackable: z.number().int().min(100).max(100000).optional(),
      })
      .refine(
        (v) => Object.keys(v).length > 0,
        "Add at least one rental price.",
      ),
    deliveryFeeCents: z.number().int().min(0).max(100000),
    rentalTerms: z.string().trim().min(40).max(15000),
    termsAccepted: z.literal(true),
    websiteRequested: z.boolean().default(false),
  })
  .refine(
    (v) => v.zips.length > 0 || v.radiusMiles > 0,
    "Specify service ZIPs or a radius.",
  );
export class LaundryError extends Error {
  constructor(
    message: string,
    public status = 400,
  ) {
    super(message);
  }
}
export function requireThat(
  value: unknown,
  message: string,
  status = 400,
): asserts value {
  if (!value) throw new LaundryError(message, status);
}
