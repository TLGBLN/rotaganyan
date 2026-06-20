import Stripe from "stripe";

export { PAYMENTS_ENABLED } from "@/lib/payments";

// Stripe client — null when STRIPE_SECRET_KEY is not set (local dev / free-only mode)
export const stripe = process.env.STRIPE_SECRET_KEY
  ? new Stripe(process.env.STRIPE_SECRET_KEY, { apiVersion: "2026-05-27.dahlia" })
  : null;

export const PREMIUM_PRICE_ID = process.env.STRIPE_PREMIUM_PRICE_ID ?? "";
