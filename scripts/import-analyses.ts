/**
 * npx tsx scripts/import-analyses.ts analyses.json
 */
import { readFileSync } from "fs";
import { resolve } from "path";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { startOfDay } from "date-fns";
import type { Surface, Breed, Confidence, PedigreeRating } from "@prisma/client";

interface AnalysisItem {
  id?: number; tarih: string; hipo: string; yaris: string;
  sinif: string; pist: string; mes: string; yg?: string; kacak?: string;
  t1: string; t2?: string; t3?: string; t4?: string; t5?: string; t6?: string;
  guven?: string; notlar?: string; sonuc?: string; gercek?: string;
  g2?: string; g3?: string; g4?: string; g5?: string;
  hata?: string; hatanot?: string; cikan?: string;
  mscores?: Record<string, { puan?: number; detay?: string[] }>;
  ped?: Record<string, string>;
}

// helpers
const sl = (s: string) => s.toLowerCase()
  .replace(/ı/g,"i").replace(/İ/g,"i").replace(/ğ/g,"g").replace(/Ğ/g,"g")
  .replace(/ü/g,"u").replace(/Ü/g,"u").replace(/ş/g,"s").replace(/Ş/g,"s")
  .replace(/ö/g,"o").replace(/Ö/g,"o").replace(/ç/g,"c").replace(/Ç/g,"c")
  .replace(/\s+/g,"-").replace(/[^a-z0-9-]/g,"");

const surf = (p: string): Surface => (({Kum:"KUM",Cim:"CIM",Sentetik:"SENTETIK"})[p]??"CIM") as Surface;
const breed = (yg="",y=""): Breed => (`${yg} ${y}`.toLowerCase().includes("arap")?"ARAP":"INGILIZ") as Breed;
const cls = (s: string, y: string) => s.startsWith("Sartli-") ? `Şartlı ${s.slice(7)}` : s === "Grup" ? (`G${y.match(/\bG(\d)\b/)?.[1]??""}` || "Grup") : s;
const rno = (y: string) => +(y.match(/\((\d+)[.\s]?Ko[şs]u/i)?.[1]??"1");
const rtime = (y: string) => y.match(/(\d{1,2}[.:]\d{2})\)/)?.[1]?.replace(".",":")||null;
const conf = (g=""): Confidence => (g==="Yuksek"?"YUKSEK":g==="Dusuk"?"DUSUK":"ORTA") as Confidence;
const ped = (v=""): PedigreeRating => (({CokYuksek:"COK_YUKSEK",Yuksek:"YUKSEK",Guclu:"GUCLU",Orta:"ORTA",Dusuk:"DUSUK",Zayif:"ZAYIF"})[v]??"BILINMIYOR") as PedigreeRating;
const coup = (n="") => ({
  narrow: n.match(/(?:^|\n)Dar:\s*([^\n]+)/im)?.[1]?.trim()??null,
  normal: n.match(/(?:^|\n)Normal:\s*([^\n]+)/im)?.[1]?.trim()??null,
  wide:   n.match(/(?:^|\n)Geni[şs]:\s*([^\n]+)/im)?.[1]?.trim()??null,
});
const bnk = (n="") => { const l=n.match(/(?:^|\n)BANKO:\s*([^\n]+)/im)?.[1]?.trim()??""; return (!l||l.toUpperCase().includes("YOK"))?{isBanko:false,note:null}:{isBanko:true,note:l}; };
const lbl = (raw: string) => { const m=raw.match(/^(\d+)\s+(.+)$/); return m?{no:+m[1],name:m[2].trim()}:null; };

async function importOne(db: PrismaClient, item: AnalysisItem, adminId: string) {
  const date = startOfDay(new Date(item.tarih));

  const hipo = await db.hippodrome.upsert({ where:{name:item.hipo}, create:{name:item.hipo,slug:sl(item.hipo)}, update:{} });
  const rd = await db.raceDay.upsert({ where:{date_hippodromeId:{date,hippodromeId:hipo.id}}, create:{date,hippodromeId:hipo.id}, update:{} });

  const no = rno(item.yaris);
  const race = await db.race.upsert({
    where:{raceDayId_raceNo:{raceDayId:rd.id,raceNo:no}},
    create:{raceDayId:rd.id,raceNo:no,classType:cls(item.sinif,item.yaris),breed:breed(item.yg,item.yaris),surface:surf(item.pist),distance:+item.mes||1400,time:rtime(item.yaris)},
    update:{classType:cls(item.sinif,item.yaris)},
  });

  const picks = (["t1","t2","t3","t4","t5","t6"] as const)
    .map((f,i)=>{const raw=item[f];if(!raw)return null;const p=lbl(raw);if(!p)return null;
      const s=item.mscores?.[`t${i+1}`];const pe=item.ped?.[`t${i+1}`]??"";
      return{rank:i+1,no:p.no,name:p.name,runnerLabel:raw.trim(),score:s?.puan??null,details:s?.detay??[],pedigreeRating:ped(pe)};})
    .filter(Boolean) as {rank:number;no:number;name:string;runnerLabel:string;score:number|null;details:object;pedigreeRating:PedigreeRating}[];

  const rids: Record<number,string> = {};
  for (const pk of picks) {
    const r = await db.runner.upsert({ where:{raceId_no:{raceId:race.id,no:pk.no}}, create:{raceId:race.id,no:pk.no,name:pk.name}, update:{} });
    rids[pk.no] = r.id;
  }

  const {narrow,normal,wide} = coup(item.notlar);
  const {isBanko,note} = bnk(item.notlar);

  const pred = await db.prediction.upsert({
    where:{raceId:race.id},
    create:{raceId:race.id,authorId:adminId,confidence:conf(item.guven),notes:item.notlar??"",tempo:item.kacak||null,couponNarrow:narrow,couponNormal:normal,couponWide:wide,isBanko,bankoNote:note,published:true,publishedAt:date},
    update:{confidence:conf(item.guven),notes:item.notlar??"",tempo:item.kacak||null,couponNarrow:narrow,couponNormal:normal,couponWide:wide,isBanko,bankoNote:note,published:true,publishedAt:date},
  });

  await db.pick.deleteMany({where:{predictionId:pred.id}});
  for (const pk of picks) {
    await db.pick.create({data:{predictionId:pred.id,rank:pk.rank,runnerId:rids[pk.no]??null,runnerLabel:pk.runnerLabel,score:pk.score,details:pk.details,pedigreeRating:pk.pedigreeRating}});
  }

  if (item.sonuc && item.gercek) {
    const w = item.gercek.match(/^(\d+)/)?.[1];
    await db.result.upsert({
      where:{raceId:race.id},
      create:{raceId:race.id,actualOrder:[item.gercek,item.g2,item.g3,item.g4,item.g5].filter((x): x is string => Boolean(x)),winnerNo:w?+w:null,hitTop1:item.sonuc==="Kazandi",hitInCoupon:item.sonuc==="Kazandi"||item.sonuc==="Kismen",errorTag:item.hata==="Evet"?"HATA":null,errorNote:item.hatanot||null,cikan:item.cikan||null},
      update:{actualOrder:[item.gercek,item.g2,item.g3,item.g4,item.g5].filter((x): x is string => Boolean(x)),winnerNo:w?+w:null,hitTop1:item.sonuc==="Kazandi",hitInCoupon:item.sonuc==="Kazandi"||item.sonuc==="Kismen",errorTag:item.hata==="Evet"?"HATA":null,errorNote:item.hatanot||null,cikan:item.cikan||null},
    });
  }

  return pred.id;
}

async function main() {
  // .env yükle — PrismaClient'tan ÖNCE
  const envPath = resolve(process.cwd(), ".env");
  for (const line of readFileSync(envPath, "utf-8").split("\n")) {
    const m = line.match(/^([A-Z_][A-Z0-9_]*)="?([^"]*)"?\s*$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2];
  }

  // Artık DB bağlanabilir
  const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
  const db = new PrismaClient({ adapter });

  const file = process.argv[2];
  if (!file) {
    console.error("Kullanım: npx tsx scripts/import-analyses.ts analyses.json");
    process.exit(1);
  }

  const items: AnalysisItem[] = JSON.parse(readFileSync(file, "utf-8"));
  const admin = await db.user.findFirst({ where:{role:"ADMIN"}, select:{id:true,email:true} });
  if (!admin) { console.error("Admin kullanıcı bulunamadı"); process.exit(1); }

  console.log(`Admin: ${admin.email} | ${items.length} analiz import ediliyor…\n`);
  let ok=0, fail=0;
  for (const item of items) {
    const label = `[${item.id??'?'}] ${item.tarih} ${item.hipo} — ${rno(item.yaris)}. Koşu`;
    try { await importOne(db, item, admin.id); console.log(`✓ ${label}`); ok++; }
    catch(e) { console.error(`✗ ${label}\n  ${e}`); fail++; }
  }
  console.log(`\nTamamlandı: ${ok} başarılı, ${fail} hatalı`);
  await db.$disconnect();
}

main().catch(e=>{ console.error(e); process.exit(1); });
