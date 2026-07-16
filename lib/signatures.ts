// Hosted email signatures — premium animated signature cards.
// Assets live in public/homes/signature/ and are served from the
// production domain so Gmail/Outlook render the GIFs from a trusted host.

export const SIG_ASSET_BASE = "https://www.tolley.io/homes/signature";

export type SignaturePerson = {
  slug: string;
  name: string;
  title: string;
  company: string;
  brokerage?: string;
  phone: string;
  email: string;
  websiteLabel: string;
  websiteUrl: string;
  links: { label: "web" | "fb" | "ig" | "yt"; url: string; alt: string }[];
  ctaText?: string;
  ctaUrl?: string;
  ctaLabel?: string;
};

export const JARED_SIGNATURE: SignaturePerson = {
  slug: "jared",
  name: "Jared Tolley",
  title: "REALTOR®",
  company: "Your KC Homes LLC",
  brokerage: "United Real Estate Kansas City",
  phone: "913-283-3826",
  email: "jared@yourkchomes.com",
  websiteLabel: "tolley.io/homes",
  websiteUrl: "https://www.tolley.io/homes",
  links: [
    { label: "web", url: "https://www.tolley.io/homes", alt: "Website" },
    { label: "fb", url: "https://facebook.com/yourkchomes", alt: "Facebook" },
    { label: "ig", url: "https://instagram.com/yourkchomes", alt: "Instagram" },
    { label: "yt", url: "https://youtube.com/@yourkchome", alt: "YouTube" },
  ],
  ctaText: "Buying or selling in Kansas City?",
  ctaUrl: "https://www.tolley.io/start",
  ctaLabel: "Start here →",
};

/**
 * Email-client-safe HTML: tables only, inline styles, fixed widths,
 * absolute image URLs with alt text. The only moving parts are two
 * hosted GIFs (logo shimmer + striped headshot). Outlook desktop
 * freezes GIFs on frame 1, which is the fully-assembled card.
 */
export function buildSignatureHtml(p: SignaturePerson): string {
  const B = SIG_ASSET_BASE;
  const iconRow = (link: SignaturePerson["links"][number], last: boolean) =>
    `<tr><td align="center" style="padding:0 0 ${last ? 0 : 10}px 0;"><a href="${link.url}" target="_blank" style="text-decoration:none;"><img src="${B}/icon-${link.label}.png" width="17" height="17" alt="${link.alt}" style="display:block;border:0;width:17px;height:17px;" /></a></td></tr>`;

  const cta =
    p.ctaText && p.ctaUrl
      ? `<table cellpadding="0" cellspacing="0" border="0" role="presentation"><tr><td style="padding:9px 6px 0 6px;font-family:Arial,Helvetica,sans-serif;font-size:12px;color:#7b8794;">${p.ctaText} <a href="${p.ctaUrl}" target="_blank" style="color:#0ea5e9;font-weight:bold;text-decoration:none;">${p.ctaLabel ?? "Start here →"}</a></td></tr></table>`
      : "";

  return `<table cellpadding="0" cellspacing="0" border="0" role="presentation" style="border-collapse:collapse;">
<tr><td>
<table cellpadding="0" cellspacing="0" border="0" role="presentation" width="520" bgcolor="#ffffff" style="border-collapse:separate;width:520px;background-color:#ffffff;border:1px solid #e6eaf0;border-radius:14px;">
<tr>
<td width="48" align="center" valign="middle" style="padding:16px 2px;border-right:1px solid #eef1f5;">
<table cellpadding="0" cellspacing="0" border="0" role="presentation">${p.links.map((l, i) => iconRow(l, i === p.links.length - 1)).join("")}</table>
</td>
<td valign="middle" style="padding:16px 6px 16px 18px;font-family:Arial,Helvetica,sans-serif;">
<table cellpadding="0" cellspacing="0" border="0" role="presentation">
<tr><td style="padding:0 0 8px 0;"><a href="${p.websiteUrl}" target="_blank" style="text-decoration:none;"><img src="${B}/logo.gif" width="170" height="40" alt="${p.company}" style="display:block;border:0;width:170px;height:40px;" /></a></td></tr>
<tr><td style="font-size:19px;font-weight:bold;color:#10233d;padding:0 0 3px 0;">${p.name}&nbsp;<img src="${B}/badge.png" width="15" height="15" alt="Verified" style="border:0;width:15px;height:15px;vertical-align:middle;" /></td></tr>
<tr><td style="font-size:12.5px;color:#5b6b7f;padding:0 0 7px 0;">${p.title} &middot; ${p.company}</td></tr>
${p.brokerage ? `<tr><td style="font-size:11px;color:#93a1b1;padding:0 0 8px 0;">${p.brokerage}</td></tr>` : ""}
<tr><td style="font-size:12.5px;color:#33415c;padding:0 0 2px 0;"><img src="${B}/icon-ph.png" width="12" height="12" alt="" style="border:0;width:12px;height:12px;vertical-align:middle;" />&nbsp;<a href="tel:+1${p.phone.replace(/[^0-9]/g, "")}" style="color:#33415c;text-decoration:none;">${p.phone}</a></td></tr>
<tr><td style="font-size:12.5px;color:#33415c;padding:0 0 2px 0;"><a href="mailto:${p.email}" style="color:#33415c;text-decoration:none;">${p.email}</a></td></tr>
<tr><td style="font-size:12.5px;padding:0;"><a href="${p.websiteUrl}" target="_blank" style="color:#0ea5e9;font-weight:bold;text-decoration:none;">${p.websiteLabel}</a></td></tr>
</table>
</td>
<td width="150" valign="middle" style="padding:10px 14px 10px 4px;">
<a href="${p.websiteUrl}" target="_blank" style="text-decoration:none;"><img src="${B}/headshot-stripes.gif" width="150" height="150" alt="${p.name} — ${p.company}" style="display:block;border:0;width:150px;height:150px;" /></a>
</td>
</tr>
</table>
${cta}
</td></tr>
</table>`;
}
