import { gatherFaz1 } from "@/lib/methodology/veri-toplama";

const faz1 = await gatherFaz1("cms0pbtaf003r04l7j3lbudjt");
const s = faz1?.runners.find((r) => r.ad.includes("SULTANIM NERİMAN"));
console.log(JSON.stringify(s, null, 2));
process.exit(0);
