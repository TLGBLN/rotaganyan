import { type NextRequest, NextResponse } from "next/server";
import { stripe } from "@/lib/stripe";
import { db } from "@/lib/db";
import { sendPremiumConfirmationEmail } from "@/lib/email";
import type Stripe from "stripe";

export const runtime = "nodejs";

// Stripe sends raw body — must disable Next.js body parsing
export const dynamic = "force-dynamic";

async function setPlan(userId: string, plan: "PREMIUM" | "FREE") {
  await db.user.update({ where: { id: userId }, data: { plan } });
}

export async function POST(req: NextRequest) {
  if (!stripe) return NextResponse.json({ received: true });

  const sig = req.headers.get("stripe-signature");
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

  if (!sig || !webhookSecret) {
    return NextResponse.json({ error: "Webhook imzası eksik" }, { status: 400 });
  }

  let event: Stripe.Event;
  try {
    const raw = await req.arrayBuffer();
    event = stripe.webhooks.constructEvent(Buffer.from(raw), sig, webhookSecret);
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 400 });
  }

  switch (event.type) {
    case "checkout.session.completed": {
      const session = event.data.object as Stripe.Checkout.Session;
      const userId = session.metadata?.userId;
      if (userId) {
        await setPlan(userId, "PREMIUM");
        const user = await db.user.findUnique({ where: { id: userId }, select: { email: true, name: true } });
        if (user?.email) {
          sendPremiumConfirmationEmail(user.email, user.name ?? "").catch(() => null);
        }
      }
      break;
    }
    case "customer.subscription.deleted":
    case "customer.subscription.paused": {
      const sub = event.data.object as Stripe.Subscription;
      const userId = sub.metadata?.userId;
      if (userId) await setPlan(userId, "FREE");
      break;
    }
    case "customer.subscription.resumed": {
      const sub = event.data.object as Stripe.Subscription;
      const userId = sub.metadata?.userId;
      if (userId) await setPlan(userId, "PREMIUM");
      break;
    }
    case "invoice.payment_succeeded": {
      const inv = event.data.object as Stripe.Invoice;
      // userId stored on the subscription metadata; retrieve via subscription field
      const subMeta = (inv as unknown as { subscription_details?: { metadata?: { userId?: string } } })
        .subscription_details?.metadata?.userId;
      if (subMeta) await setPlan(subMeta, "PREMIUM");
      break;
    }
    default:
      break;
  }

  return NextResponse.json({ received: true });
}
