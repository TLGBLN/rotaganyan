import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { DELTA_HP_GUN_MS, deltaHp, deltaHpGelecegiBoz, deltaHpSinif, deltaHpSonBilinen, deltaHpYonlu, type HpGecmis } from "./delta-hp-aday";
import { SINYAL_KAYDI } from "../sinyal-kaydi";

const G = DELTA_HP_GUN_MS; const T = 100 * G; const g = (gun: number, hp: number | null): HpGecmis => ({ tarih: gun * G, hp });
describe("DELTA_HP aday hesabı", () => {
  it("SINYAL_KAYDI: kullanıcı onaylı beş aile (bu aday modül ayrıca yalnız araştırma amaçlıdır)", () => { expect(SINYAL_KAYDI.length).toBe(5); });
  it("ΔHP = HP_bugün − hemen önceki yarışın HP'si; yükseliş +, düşüş −", () => {
    const l = [g(10, 50), g(40, 54), g(70, 56)]; const o = deltaHp(58, l, T); expect(o.delta).toBe(2); expect(o.hpOnceki).toBe(56); expect(o.hpBugun).toBe(58); expect(o.gunAra).toBe(30); expect(o.nGecmis).toBe(3);
    expect(deltaHp(54, l, T).delta).toBe(-2); expect(deltaHp(56, l, T).delta).toBe(0);
  });
  it("kayıtların sırası önemsiz (tarihe göre en son kayıt alınır)", () => { expect(deltaHp(60, [g(70, 56), g(10, 50), g(40, 54)], T).delta).toBe(4); });
  it("önceki yarışın HP'si yoksa NULL (sessizce eski yarışa geri gitmez); sıfır değil", () => {
    const l = [g(10, 50), g(70, null)]; expect(deltaHp(58, l, T).delta).toBeNull(); expect(deltaHp(58, l, T).hpOnceki).toBeNull(); expect(deltaHp(58, [], T).delta).toBeNull(); expect(deltaHp(null, [g(70, 56)], T).delta).toBeNull(); expect(deltaHp(0, [g(70, 56)], T).delta).toBeNull();
  });
  it("duyarlılık: en son HP'si BİLİNEN yarışa göre fark ve aradaki gün", () => {
    const l = [g(10, 50), g(40, 54), g(70, null)]; const o = deltaHpSonBilinen(58, l, T); expect(o.delta).toBe(4); expect(o.hpOnceki).toBe(54); expect(o.gunAra).toBe(60);
  });
  it("as-of: yarış günü (tarih = t) ve sonrası kullanılmaz", () => {
    const l = [g(70, 56), g(100, 99), g(101, 40)]; expect(deltaHp(58, l, T).delta).toBe(2); expect(deltaHp(58, l, T).nGecmis).toBe(1);
  });
  it("SIZINTI: t ve sonrası bozulunca (aynı gün ve sonrasına sahte kayıtlar dahil) değer BİREBİR aynı", () => {
    const l: HpGecmis[] = []; for (let i = 0; i < 12; i++) l.push(g(3 + i * 7, 40 + ((i * 5) % 17))); l.push(g(100, 61), g(103, 64));
    for (const hp of [null, 45, 60, 72]) { expect(deltaHp(hp, deltaHpGelecegiBoz(l, T, 3), T)).toEqual(deltaHp(hp, l, T)); expect(deltaHpSonBilinen(hp, deltaHpGelecegiBoz(l, T, 3), T)).toEqual(deltaHpSonBilinen(hp, l, T)); }
  });
  it("bağımsız yeniden hesap: düz döngü ile aynı", () => {
    const l: HpGecmis[] = []; for (let i = 0; i < 25; i++) l.push(g(1 + ((i * 11) % 120), i % 6 === 0 ? null : 40 + ((i * 7) % 23)));
    for (const hb of [41, 55, 63]) { let enSon = -1, hp: number | null = null; for (const x of l) if (x.tarih < T && x.tarih > enSon) { enSon = x.tarih; hp = x.hp; } const bek = hp == null ? null : hb - hp; expect(deltaHp(hb, l, T).delta).toBe(bek); }
  });
  it("yönlü ayrıştırma ve sabit raporlama sınıfları", () => {
    expect(deltaHpYonlu(3)).toEqual({ pos: 3, neg: 0 }); expect(deltaHpYonlu(-2)).toEqual({ pos: 0, neg: -2 }); expect(deltaHpYonlu(null)).toEqual({ pos: null, neg: null });
    expect([-5, -3, -2, -1, 0, 1, 2, 3, 6].map(deltaHpSinif)).toEqual([0, 0, 1, 1, 2, 3, 3, 4, 4]); expect(deltaHpSinif(null)).toBeNull();
  });
  it("yapısal: saf dosya (db/ağ/saat/rastgele/sonuç import ETMEZ)", () => {
    const kod = fs.readFileSync(path.join(__dirname, "delta-hp-aday.ts"), "utf8").split("\n").filter((l) => !l.trim().startsWith("//")).join("\n"); expect(/from\s+["']/.test(kod)).toBe(false); expect(/\bDate\b|Math\.random|fetch\(|prisma|\bdb\b|process\.|winner|result|ganyan/.test(kod)).toBe(false);
  });
});
