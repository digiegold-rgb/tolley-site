import "server-only";

import { cookies } from "next/headers";
import { secretEquals } from "../secret-compare";
import { HEAT_COOKIE, heatCookieValue } from "./auth-core";

export { heatCookieOptions, heatIngestAuthorized, heatPinMatches } from "./auth-core";

/** Heat PIN cookie only. A shop/TV session does not unlock this page. */
export async function validateHeatAccess(): Promise<boolean> {
  try {
    const jar = await cookies();
    const token = jar.get(HEAT_COOKIE)?.value;
    if (!token) return false;
    return secretEquals(token, heatCookieValue());
  } catch {
    return false;
  }
}
