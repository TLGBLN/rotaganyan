import { db } from "./src/lib/db";

async function main() {
  const toplam = await db.runner.count({ where: { scratched: false } });
  const equipmentDolu = await db.runner.count({ where: { scratched: false, equipment: { not: null } } });
  const eklenenDolu = await db.runner.count({ where: { scratched: false, equipmentAdded: { not: null } } });
  const cikarilanDolu = await db.runner.count({ where: { scratched: false, equipmentRemoved: { not: null } } });

  console.log(`Toplam runner (çekilen hariç): ${toplam}`);
  console.log(`equipment dolu: ${equipmentDolu} (%${((equipmentDolu / toplam) * 100).toFixed(1)})`);
  console.log(`equipmentAdded dolu: ${eklenenDolu} (%${((eklenenDolu / toplam) * 100).toFixed(1)})`);
  console.log(`equipmentRemoved dolu: ${cikarilanDolu} (%${((cikarilanDolu / toplam) * 100).toFixed(1)})`);

  const ornekEklenen = await db.runner.findMany({
    where: { scratched: false, equipmentAdded: { not: null } },
    take: 10,
    select: { name: true, equipment: true, equipmentAdded: true, equipmentRemoved: true },
  });
  console.log("\nÖrnek equipmentAdded değerleri:");
  for (const r of ornekEklenen) console.log(`  ${r.name}: equipment="${r.equipment}" eklenen="${r.equipmentAdded}" cikarilan="${r.equipmentRemoved}"`);

  const ornekTumEquipment = await db.runner.findMany({
    where: { scratched: false, equipment: { not: null } },
    take: 10,
    select: { name: true, equipment: true },
    distinct: ["equipment"],
  });
  console.log("\nEquipment alanının aldığı örnek değerler (distinct):");
  for (const r of ornekTumEquipment) console.log(`  "${r.equipment}"`);

  process.exit(0);
}

main();
