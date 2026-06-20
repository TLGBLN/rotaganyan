import { PrismaClient } from "@prisma/client";
const p = new PrismaClient({ datasources: { db: { url: process.env.DATABASE_URL } } });
const predictions = await p.prediction.count();
const races = await p.race.count();
const hippodromes = await p.hippodrome.findMany({ select: { name: true } });
console.log("predictions:", predictions, "| races:", races);
console.log("hippodromes:", hippodromes.map(h => h.name).join(", ") || "(yok)");
await p.$disconnect();
