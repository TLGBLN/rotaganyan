import fs from "node:fs";
import { db } from "../src/lib/db";
import { parseDamStatBulk } from "../src/lib/dam-stat-parser";

// Kullanım: npx tsx -r dotenv/config scripts/_seed_kisrak_generic.ts <dosya> <irk> <mesafe> <pist>
async function main() {
  const [, , dosya, irk, mesafe, pist] = process.argv;
  if (!dosya || !irk || !mesafe || !pist) {
    console.log("Kullanım: _seed_kisrak_generic.ts <dosya> <irk> <mesafe> <pist>");
    process.exit(1);
  }
  const text = fs.readFileSync(dosya, "utf8");
  const { parsed, hatali } = parseDamStatBulk(text);
  console.log(`Ayrıştırılan: ${parsed.length}, hatalı: ${hatali.length}`);
  if (hatali.length > 0) console.log("Hatalılar:", hatali);

  const filtre = {
    irk, filtreYil: "2026", filtreCins: "Hepsi", filtreSehir: "Hepsi",
    filtreMesafe: mesafe, filtrePist: pist, filtreGrupListed: "Hepsi", filtreYasGrubu: "Hepsi",
  };

  const CONCURRENCY = 15;
  let kaydedilen = 0;
  for (let i = 0; i < parsed.length; i += CONCURRENCY) {
    const chunk = parsed.slice(i, i + CONCURRENCY);
    for (let attempt = 1; attempt <= 3; attempt++) {
      try {
        await Promise.all(
          chunk.map((p) =>
            db.damStat.upsert({
              where: { damStatFiltre: { damName: p.damName, damSireName: p.damSireName, ...filtre } },
              create: { ...p, ...filtre },
              update: { ...p },
            })
          )
        );
        kaydedilen += chunk.length;
        break;
      } catch (e) {
        if (attempt === 3) throw e;
        console.log(`Chunk ${i} başarısız (deneme ${attempt}), tekrar deneniyor...`);
      }
    }
  }
  console.log(`${kaydedilen} kısrak kaydedildi (${irk}, ${mesafe}, ${pist}).`);
}
main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
