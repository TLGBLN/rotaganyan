"use server";

import { db } from "@/lib/db";
import type { NotificationType } from "@prisma/client";

export async function broadcastNotification(opts: {
  type: NotificationType;
  title: string;
  body?: string;
  link?: string;
  planFilter?: "FREE" | "PREMIUM" | "ALL";
}) {
  const { type, title, body, link, planFilter = "ALL" } = opts;

  const users = await db.user.findMany({
    where: planFilter === "ALL" ? {} : { plan: planFilter },
    select: { id: true },
  });

  if (users.length === 0) return;

  await db.notification.createMany({
    data: users.map((u) => ({
      userId: u.id,
      type,
      title,
      body,
      link,
    })),
  });
}

export async function notifyAdminsNewUser(userId: string) {
  const newUser = await db.user.findUnique({
    where: { id: userId },
    select: { name: true, email: true },
  });
  if (!newUser) return;

  const admins = await db.user.findMany({
    where: { role: "ADMIN" },
    select: { id: true },
  });
  if (admins.length === 0) return;

  await db.notification.createMany({
    data: admins.map((a) => ({
      userId: a.id,
      type: "SYSTEM" as const,
      title: "Yeni kullanıcı kaydı",
      body: `${newUser.name} (${newUser.email}) kayıt oldu.`,
      link: "/admin/kullanicilar",
    })),
  });
}

export async function notifyNewPrediction(predictionId: string) {
  const pred = await db.prediction.findUnique({
    where: { id: predictionId },
    include: {
      race: { include: { raceDay: { include: { hippodrome: true } } } },
    },
  });

  if (!pred) return;

  const { race } = pred;
  const hippodromeLabel = race.raceDay.hippodrome.name;
  const dateStr = new Date(race.raceDay.date).toLocaleDateString("tr-TR", {
    day: "numeric",
    month: "long",
  });

  await broadcastNotification({
    type: "NEW_PREDICTION",
    title: `Yeni analiz: ${hippodromeLabel} ${race.raceNo}. Koşu`,
    body: `${dateStr} ${hippodromeLabel} ${race.raceNo}. koşu analizi yayımlandı.${pred.isBanko ? " ★ Banko!" : ""}`,
    link: `/kosular/${new Date(race.raceDay.date).toISOString().split("T")[0]}/${race.raceDay.hippodrome.slug}/${race.raceNo}`,
  });
}
