const fs = require("fs");

const rows = JSON.parse(fs.readFileSync(process.argv[2], "utf8"));
const races = new Map();

for (const r of rows) {
  if (!races.has(r.raceId)) races.set(r.raceId, []);
  races.get(r.raceId).push(r);
}

let badWinnerRace = 0;
let badSizeRace = 0;
let duplicateRunnerRace = 0;
let top3MissingRaces = 0;
const badWinner = [];

for (const [raceId, rs] of races) {
  const wins = rs.filter(r => r.win === 1).length;

  if (wins !== 1) {
    badWinnerRace++;
    badWinner.push({ raceId, runnerCount: rs.length, wins });
  }

  if (rs.length < 2) badSizeRace++;

  if (new Set(rs.map(r => r.no)).size !== rs.length) {
    duplicateRunnerRace++;
  }

  if (rs.some(r => r.top3Observed === false)) {
    top3MissingRaces++;
  }
}

console.log({
  satir: rows.length,
  kosu: races.size,
  badWinnerRace,
  badSizeRace,
  duplicateRunnerRace,
  top3MissingRaces
});

if (badWinner.length) {
  console.log("BAD_WINNER_SAMPLE");
  console.log(badWinner.slice(0,20));
}
