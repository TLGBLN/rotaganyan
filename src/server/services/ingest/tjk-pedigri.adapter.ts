/**
 * TJK Pedigri scraper — 3 kuşaklık (14 atalı) tam soy ağacı, tjkAtId ile.
 * URL format: /TR/YarisSever/Query/Pedigri/Pedigri?Atkodu={tjkAtId}
 * (AtKosuBilgileri sayfasının kendi "Pedigri" sekmesinin AJAX kaynağı — küçük, sade bir
 * rowspan tablosu, her zaman 8 satır/14 hücre: 2 ebeveyn + 4 büyükebeveyn + 8 üçüncü kuşak.)
 */

import { request } from "undici";
import * as cheerio from "cheerio";
import type { PedigreeAncestor, PedigreeTree } from "@/lib/pedigree-tree-types";
export type { PedigreeAncestor, PedigreeTree } from "@/lib/pedigree-tree-types";

const BASE = "https://www.tjk.org";
const HEADERS = {
  "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/124.0 Safari/537.36",
  "Accept-Language": "tr-TR,tr;q=0.9,en;q=0.8",
  Referer: "https://www.tjk.org/",
};

// Satır sırası TJK'nın kendi tablosunda SABİT — her zaman sire dalı üstte (4 satır), dam
// dalı altta (4 satır); her dalın kendi içinde de sabit sıra. col0/col1 yalnız "yeni" olduğu
// satırda dolu (rowspan4/rowspan2), col2 her satırda dolu (rowspan yok).
const ROW_FIELD_MAP: { col0?: keyof PedigreeTree; col1?: keyof PedigreeTree; col2: keyof PedigreeTree }[] = [
  { col0: "sire", col1: "sireSire", col2: "sireSireSire" },
  { col2: "sireSireDam" },
  { col1: "sireDam", col2: "sireDamSire" },
  { col2: "sireDamDam" },
  { col0: "dam", col1: "damSire", col2: "damSireSire" },
  { col2: "damSireDam" },
  { col1: "damDam", col2: "damDamSire" },
  { col2: "damDamDam" },
];

function parseAncestorCell(raw: string): PedigreeAncestor {
  let t = raw.replace(/\s+/g, " ").trim();
  if (!t) return null;
  let year: number | null = null;
  const yearMatch = t.match(/\((\d{4})\)\s*$/);
  if (yearMatch) {
    year = parseInt(yearMatch[1], 10);
    t = t.slice(0, yearMatch.index).trim();
  }
  let note: string | null = null;
  const noteMatch = t.match(/\s([a-zçğıöşü])\s+([a-zçğıöşü])\s*$/i);
  if (noteMatch) {
    note = `${noteMatch[1]} ${noteMatch[2]}`.toLowerCase();
    t = t.slice(0, noteMatch.index).trim();
  }
  if (!t) return null;
  return { name: t, year, note };
}

export async function fetchPedigreeTree(atKodu: number): Promise<PedigreeTree | null> {
  const url = `${BASE}/TR/YarisSever/Query/Pedigri/Pedigri?Atkodu=${atKodu}`;
  let html: string;
  try {
    const { statusCode, body } = await request(url, { headers: HEADERS });
    if (statusCode !== 200) return null;
    html = await body.text();
  } catch {
    return null;
  }

  const $ = cheerio.load(html);
  const rows = $("#pedigri tbody tr").toArray();
  if (rows.length === 0) return null;

  const tree: Partial<PedigreeTree> = {};
  rows.forEach((row, i) => {
    const map = ROW_FIELD_MAP[i];
    if (!map) return;
    const cells = $(row).find("td").toArray().map((td) => $(td).text());
    const fields = [map.col0, map.col1, map.col2].filter((f): f is keyof PedigreeTree => f != null);
    fields.forEach((field, idx) => {
      if (cells[idx] != null) tree[field] = parseAncestorCell(cells[idx]);
    });
  });

  // En azından sire/dam bilinmiyorsa gerçek bir pedigri sayılmaz (boş/hatalı yanıt olabilir).
  if (!tree.sire && !tree.dam) return null;

  return {
    sire: tree.sire ?? null, dam: tree.dam ?? null,
    sireSire: tree.sireSire ?? null, sireDam: tree.sireDam ?? null,
    damSire: tree.damSire ?? null, damDam: tree.damDam ?? null,
    sireSireSire: tree.sireSireSire ?? null, sireSireDam: tree.sireSireDam ?? null,
    sireDamSire: tree.sireDamSire ?? null, sireDamDam: tree.sireDamDam ?? null,
    damSireSire: tree.damSireSire ?? null, damSireDam: tree.damSireDam ?? null,
    damDamSire: tree.damDamSire ?? null, damDamDam: tree.damDamDam ?? null,
  };
}

/** Dünden itibaren (dün + bugün + sonrası) yarışan/yarışacak, henüz önbelleklenmemiş atların soy ağacını sırayla çeker (kalıcı önbellek — bir kez çekilen at bir daha çekilmez). */
export async function syncMissingPedigreeTrees(limit = 120): Promise<{ ok: number; fail: number; remaining: number }> {
  const { db } = await import("@/lib/db");
  const fromDate = new Date();
  fromDate.setUTCHours(0, 0, 0, 0);
  fromDate.setUTCDate(fromDate.getUTCDate() - 1);

  const candidates = await db.runner.findMany({
    where: { tjkAtId: { not: null }, race: { raceDay: { date: { gte: fromDate } } } },
    select: { tjkAtId: true },
    distinct: ["tjkAtId"],
  });
  const candidateIds = candidates.map((c) => c.tjkAtId!).filter((id) => id != null);
  if (candidateIds.length === 0) return { ok: 0, fail: 0, remaining: 0 };

  const existing = await db.horsePedigree.findMany({
    where: { tjkAtId: { in: candidateIds } },
    select: { tjkAtId: true },
  });
  const existingIds = new Set(existing.map((h) => h.tjkAtId));
  const missing = candidateIds.filter((id) => !existingIds.has(id));

  let ok = 0;
  let fail = 0;
  for (const atKodu of missing.slice(0, limit)) {
    try {
      const tree = await fetchPedigreeTree(atKodu);
      if (tree) {
        await db.horsePedigree.upsert({
          where: { tjkAtId: atKodu },
          create: { tjkAtId: atKodu, treeJson: tree },
          update: { treeJson: tree },
        });
        ok++;
      } else {
        fail++;
      }
    } catch {
      fail++;
    }
    await new Promise((r) => setTimeout(r, 350));
  }
  return { ok, fail, remaining: Math.max(0, missing.length - limit) };
}
