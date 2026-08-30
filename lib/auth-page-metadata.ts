import type { Metadata } from "next";
import { productForPath } from "@/lib/vater/product";

/** Document titles for /login and /signup. Animate ads land here; never
 *  inherit the root "t-agent | Real Estate Unlocked" title. */
export function authPageMetadata(
  callbackUrl: string,
  kind: "login" | "signup",
): Metadata {
  const product = productForPath(callbackUrl);
  const action = kind === "login" ? "Sign in" : "Create account";
  if (product === "realestate") {
    return { title: `${action} | Listing Studio · Tolley.io` };
  }
  if (product === "jelly") {
    return { title: `${action} | Jelly Studio · Tolley.io` };
  }
  return { title: `${action} | Tolley.io` };
}
