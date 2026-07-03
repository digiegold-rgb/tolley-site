import { NextResponse } from "next/server";
import { getStripeClient } from "@/lib/stripe";
import { validateShopAdmin } from "@/lib/shop-auth";

// GET — fetch recent pool checkout sessions from Stripe
export async function GET() {
  const isAdmin = await validateShopAdmin();
  if (!isAdmin) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const stripe = getStripeClient();

    // Get recent checkout sessions for pools
    const sessions = await stripe.checkout.sessions.list({
      limit: 50,
      expand: ["data.line_items"],
    });

    const poolOrders = sessions.data
      .filter((s) => s.metadata?.source === "pools")
      .map((s) => ({
        id: s.id,
        amount: s.amount_total || 0,
        status: s.payment_status === "paid" ? "paid" : s.status || "unknown",
        customerEmail: s.customer_details?.email || null,
        customerName: s.customer_details?.name || null,
        items: (s.line_items?.data || []).map((li) => ({
          name: li.description || "Unknown",
          quantity: li.quantity || 1,
          price: li.amount_total || 0,
        })),
        createdAt: new Date(s.created * 1000).toISOString(),
      }));

    return NextResponse.json({ orders: poolOrders });
  } catch (err) {
    console.error("[pools/orders]", err);
    return NextResponse.json({ orders: [] });
  }
}
