import { type NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { stripe, PREMIUM_PRICE_ID } from "@/lib/stripe";

const BASE = process.env.NEXT_PUBLIC_BASE_URL ?? "http://localhost:3000";

export async function POST(req: NextRequest) {
  if (!stripe) {
    return NextResponse.json({ error: "Ödeme sistemi yapılandırılmamış" }, { status: 503 });
  }

  const session = await auth();
  if (!session?.user?.email) {
    return NextResponse.json({ error: "Giriş yapmalısınız" }, { status: 401 });
  }

  if (session.user.plan === "PREMIUM") {
    return NextResponse.json({ error: "Zaten Premium üyesiniz" }, { status: 400 });
  }

  const { priceId } = await req.json().catch(() => ({}));
  const price = priceId ?? PREMIUM_PRICE_ID;

  if (!price) {
    return NextResponse.json({ error: "Fiyat yapılandırılmamış" }, { status: 503 });
  }

  const checkout = await stripe.checkout.sessions.create({
    mode: "subscription",
    payment_method_types: ["card"],
    line_items: [{ price, quantity: 1 }],
    customer_email: session.user.email,
    metadata: { userId: session.user.id ?? "" },
    success_url: `${BASE}/panel/premium-upgrade/basarili?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${BASE}/premium`,
    locale: "tr",
    subscription_data: {
      metadata: { userId: session.user.id ?? "" },
    },
  });

  return NextResponse.json({ url: checkout.url });
}
