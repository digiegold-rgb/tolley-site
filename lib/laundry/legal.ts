import {
  BRAND,
  COMPANY,
  CONSENT_VERSION,
  EMAIL,
  FEE_CENTS,
  money,
  UNIT_NAMES,
  type Prices,
} from "./config";
export const legalPages = {
  "operator-agreement": {
    title: "Operator agreement",
    sections: [
      [
        "Your listing and customers",
        `${BRAND} is operated by ${COMPANY}. Listing is free. You are an independent rental operator, responsible for your equipment, lawful rental terms, screening, delivery, repairs, taxes and customer service. Your customer contracts with and pays you directly. We do not purchase or own your customer relationship.`,
      ],
      [
        "When the booking fee applies",
        `You authorize a one-time ${money(FEE_CENTS)} charge to your saved payment method when you confirm a delivery date agreed with a renter introduced through our managed marketplace. Accepting or declining a request is free. There is no recurring rent commission, territory fee, minimum or listing subscription. A reschedule does not create a second fee. Affiliated Wash & Dry KC bookings have a zero-dollar fee.`,
      ],
      [
        "Cancellation and disputes",
        `Cancel before installation or report a no-show through your dashboard to request a full booking-fee refund. Duplicate requests and service-area errors are also eligible. Submit other disputes within 30 days of the charge with the reason and supporting facts. Refunds go to the original payment method. A delivery already completed is not refundable solely because the renter later stops paying. We review disputed facts and explain our decision; contact ${EMAIL} if you disagree.`,
      ],
      [
        "Attribution and non-circumvention",
        "Existing customers you can document before our introduction and customers acquired independently through your own website are excluded. For 90 days after a marketplace introduction, you must report an initial booked delivery even if arranged by phone or off-platform; moving a booking off-platform does not avoid its fee. This does not restrict unrelated customers, renewals, future rentals or your prices. A customer is charged only once for the same initial booking.",
      ],
      [
        "Coverage, response and privacy",
        "Keep pricing, machine types, rental terms and coverage accurate. Accept or decline new requests within 24 hours. Unaccepted requests expire and the renter may choose another operator. Only the assigned operator can access a signed renter request. Use renter information only to fulfill and service that request, not for unrelated marketing or resale. Listings can be paused for inaccurate information, nonresponse, payment problems or substantiated complaints.",
      ],
      [
        "Card authorization and termination",
        `Stripe stores your card; we retain identifiers only. You authorize the disclosed booking charges when you confirm delivery and can update your card through the dashboard. Stop accepting leads or request removal at any time by contacting ${EMAIL}; existing earned fees remain due. We provide advance notice of material fee changes and obtain acceptance before applying them to new bookings.`,
      ],
      [
        "Affiliation and optional websites",
        "Wash & Dry Rental is our affiliated KC anchor, receives KC referrals without a booking fee, and is identified on its profile. An optional operator website is separately quoted and is not required for listing. No lead volume, delivery availability or search ranking is guaranteed.",
      ],
    ],
  },
  terms: {
    title: "Renter terms",
    sections: [
      [
        "A local operator, clearly identified",
        `${BRAND}, operated by ${COMPANY}, helps you find independent washer and dryer rental providers. Using the directory and submitting a request is free. Your rental agreement is with the operator named on the agreement, who sets prices and provides equipment, delivery, repairs and billing.`,
      ],
      [
        "Requests and signatures",
        "A preferred delivery day is a request, not a confirmed appointment. Before signing, read the operator’s price, fees and terms. Type your own full name only if you intend to sign. We preserve the signed version and provide a downloadable copy through your private request link. If an operator changes, you must review and sign that operator’s agreement before your information is handed over.",
      ],
      [
        "Electronic records",
        `You may choose to receive and sign records electronically using a browser able to display and download text documents. You can save or print the agreement before and after signing. To request a paper copy at no charge, update your contact details, or withdraw electronic consent for future records, contact ${EMAIL}. Withdrawing consent does not undo a prior signature. You can contact the operator directly if you prefer a paper process.`,
      ],
      [
        "Communication and cancellation",
        "Email confirmations concern your request. SMS is optional, message frequency varies, and message/data rates may apply. Reply STOP to stop or HELP for help. You may cancel an unfulfilled request using your private link. Rental cancellation after delivery follows your operator’s agreement. A national listing does not mean service is available in every ZIP.",
      ],
      [
        "Reviews",
        "After a recorded delivery, you can leave one review of that booking. We publish positive and negative reviews. We may remove personal information, threats, spam or content unrelated to the rental, with a recorded moderation reason. An operator cannot remove a review merely because it is unfavorable.",
      ],
    ],
  },
  privacy: {
    title: "Privacy policy",
    sections: [
      [
        "What we collect",
        `${COMPANY} collects the contact details, service address, equipment request, dates, signature and consent records you submit, plus request status, communications and separately recorded campaign, referring-site and self-reported discovery information. Stripe processes operator cards; we do not store card numbers.`,
      ],
      [
        "Why and with whom",
        "We use this information to match requests, record agreements, arrange service, prevent duplicate billing, handle disputes and measure the marketplace. The selected operator receives the signed request needed to serve you. Unassigned requests stay with the marketplace until you select and sign with an operator. Infrastructure, payment, email and SMS providers process data to deliver these services. We do not sell contact lists or share requests simultaneously with competing operators.",
      ],
      [
        "Your choices",
        `Optional SMS consent is separate from your rental signature. Reply STOP to stop texts. Request access, correction, deletion, or a paper agreement at ${EMAIL}. We retain active rental and support records while needed to fulfill service, resolve disputes and satisfy recordkeeping obligations; financial and signed records may need to be retained after a deletion request. Private request links grant access to your record: keep them private.`,
      ],
      [
        "Public information",
        "Operator business information and approved service areas are public. Reviews show a first name and last initial, never your address, phone or email. General site analytics and browser privacy choices follow the Tolley privacy policy at /privacy. ZIP reference data is supplied by GeoNames under CC BY 4.0.",
      ],
    ],
  },
} as const;
export function rentalAgreement(
  op: {
    name: string;
    legalName: string;
    prices: unknown;
    deliveryFeeCents: number;
    rentalTerms: string;
    termsVersion: number;
  },
  unit: string,
) {
  const cents = (op.prices as Prices)[unit as keyof Prices];
  if (!Number.isInteger(cents) || cents! <= 0)
    throw new Error("This machine type is not currently offered.");
  return `${BRAND} — rental agreement\nVersion ${CONSENT_VERSION}; operator revision ${op.termsVersion}\nRental provider: ${op.legalName} (${op.name})\nEquipment: ${UNIT_NAMES[unit]}\nMonthly rent: ${money(cents!)}\nOne-time delivery fee: ${money(op.deliveryFeeCents)}\n\n${op.rentalTerms}\n\nThe preferred day is subject to confirmation. Rent is paid to the provider; no renter payment is collected by the directory. By signing, I accept this operator’s rental terms and consent to receiving this agreement electronically. I can save or print this record, request a free paper copy, or withdraw electronic consent for future records by contacting ${EMAIL}.`;
}
