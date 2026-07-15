import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";

const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL ?? "https://rotaganyan.com";

async function getRaceSummary(raceId: string) {
  const race = await db.race.findUnique({
    where: { id: raceId },
    select: {
      raceNo: true,
      raceDay: { select: { date: true, hippodrome: { select: { name: true } } } },
      result: { select: { winnerNo: true } },
      runners: { select: { no: true, name: true } },
    },
  });
  if (!race || race.result?.winnerNo == null) return null;
  const winner = race.runners.find((r) => r.no === race.result!.winnerNo);
  return { race, winnerName: winner?.name ?? null };
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ raceId: string }>;
}): Promise<Metadata> {
  const { raceId } = await params;
  const summary = await getRaceSummary(raceId);
  if (!summary) return {};

  const { race, winnerName } = summary;
  const title = `${winnerName ?? "Kazanan"} — ${race.raceDay.hippodrome.name} ${race.raceNo}. Koşu | ROTAGANYAN`;
  const description = "Rotaganyan'ın bu koşu için analiz sonucu.";
  const imageUrl = `${BASE_URL}/api/og/sonuc/${raceId}`;

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      images: [{ url: imageUrl, width: 1200, height: 630 }],
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: [imageUrl],
    },
  };
}

export default async function SonucSharePage({
  params,
}: {
  params: Promise<{ raceId: string }>;
}) {
  const { raceId } = await params;
  const summary = await getRaceSummary(raceId);
  if (!summary) notFound();

  return (
    <main className="mx-auto max-w-2xl px-4 py-10">
      <Image
        src={`/api/og/sonuc/${raceId}`}
        alt={`${summary.winnerName ?? "Kazanan"} — ${summary.race.raceDay.hippodrome.name} ${summary.race.raceNo}. Koşu`}
        width={1200}
        height={630}
        className="w-full rounded-lg border"
        unoptimized
        priority
      />
      <div className="mt-6 text-center">
        <Link href="/program" className="text-sm font-semibold text-brand hover:underline">
          {"Rotaganyan Yarış Programı'na dön"}
        </Link>
      </div>
    </main>
  );
}
