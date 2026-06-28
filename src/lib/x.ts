import { TwitterApi } from "twitter-api-v2";

const client =
  process.env.X_API_KEY &&
  process.env.X_API_SECRET &&
  process.env.X_ACCESS_TOKEN &&
  process.env.X_ACCESS_SECRET
    ? new TwitterApi({
        appKey: process.env.X_API_KEY,
        appSecret: process.env.X_API_SECRET,
        accessToken: process.env.X_ACCESS_TOKEN,
        accessSecret: process.env.X_ACCESS_SECRET,
      })
    : null;

export const X_CONFIGURED = !!client;

const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL ?? "http://localhost:3000";

export async function tweetArticlePublished(title: string, path: string) {
  if (!client) {
    console.warn("[x] X_API_KEY not set — skipping tweet");
    return;
  }

  const url = `${BASE_URL}${path}`;
  const maxTitleLength = 280 - url.length - 4; // " — " + boşluk
  const text = `${title.slice(0, maxTitleLength)} — ${url}`;

  try {
    await client.v2.tweet(text);
  } catch (err) {
    console.error("[x] Tweet gönderilemedi:", err);
  }
}

/** Verilen metni doğrudan bağlı X hesabından (ROTAGANYAN) paylaşır. */
export async function postTweet(text: string): Promise<{ ok: boolean; error?: string }> {
  if (!client) {
    return { ok: false, error: "X hesabı bağlı değil (X_API_KEY/SECRET eksik)" };
  }
  try {
    await client.v2.tweet(text.slice(0, 280));
    return { ok: true };
  } catch (err) {
    console.error("[x] Tweet gönderilemedi:", err);
    return { ok: false, error: err instanceof Error ? err.message : "Bilinmeyen hata" };
  }
}
