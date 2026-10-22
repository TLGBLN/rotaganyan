import { db } from "./src/lib/db";
async function main() {
  const races = await db.race.findMany({
    where: { id: { in: [
      "cmvg7su87000308jpe65z4rod","cmvg7sx5h000n08jp758qhqlp","cmvg7t0bd001708jpc6izctlv","cmvg7t2wu001o08jprukqesuf","cmvg7t5sn002708jpq7fsg52k","cmvg7t7it002j08jpslswccio",
      "cmvg7thkn004008jp0owphx4m","cmvg7tl0i004n08jpyhjut4q3","cmvg7to6b005208jp0k9w3l7b","cmvg7tqgv005f08jpju1csgvx","cmvg7ttm8006008jp1ksekl1s","cmvg7txcb006p08jpdl7zajak","cmvg7u1xi007l08jp3alpi27f","cmvg7u531008608jp1vytvu35","cmvg7u7di008l08jpzfnhiigy","cmvg7uais009608jplkzy6icc"
    ] } },
    select: { id: true, raceNo: true, time: true, result: { select: { id: true } }, raceDay: { select: { hippodrome: { select: { name: true } } } } },
  });
  const now = new Date();
  console.log("Simdi:", now.toISOString());
  races
    .map(r => ({ ...r, sonuclandi: r.result != null }))
    .sort((a,b) => (a.time ?? "").localeCompare(b.time ?? ""))
    .forEach(r => console.log(`${r.raceDay.hippodrome.name} K${r.raceNo} saat=${r.time} sonuclandi=${r.sonuclandi}`));
}
main().then(()=>process.exit(0)).catch(e=>{console.error(e);process.exit(1);});
