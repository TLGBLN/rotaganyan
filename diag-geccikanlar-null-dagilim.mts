import { db } from "./src/lib/db";
async function main() {
  // gecCikanlar null/dolu dagiliminin TARIHE gore nasil degistigini kontrol et.
  // Eger eski tarihlerde TAMAMEN null, yeni tarihlerde kismen dolu ise bu bir "veri
  // yakalama X tarihinde basladi" (gap) deseni - semadaki "null=TJK'nin kendi temiz-start
  // isaretlemesi" yorumunu COKER.
  const rows = await db.$queryRaw<{ ay: string; toplam: bigint; dolu: bigint }[]>`
    SELECT TO_CHAR(rd.date, 'YYYY-MM') as ay, COUNT(*) as toplam,
      COUNT(*) FILTER (WHERE r."gecCikanlar" IS NOT NULL) as dolu
    FROM "Result" r
    JOIN "Race" ra ON ra.id = r."raceId"
    JOIN "RaceDay" rd ON rd.id = ra."raceDayId"
    GROUP BY ay ORDER BY ay
  `;
  for (const row of rows) {
    const pct = Number(row.dolu) / Number(row.toplam) * 100;
    console.log(`${row.ay}: toplam=${row.toplam} dolu=${row.dolu} (%${pct.toFixed(1)})`);
  }
}
main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
