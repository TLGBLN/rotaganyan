SELECT h.name, r."raceNo", r."classType", COUNT(ru.id) as runners
FROM "RaceDay" rd
JOIN "Hippodrome" h ON h.id = rd."hippodromeId"
JOIN "Race" r ON r."raceDayId" = rd.id
LEFT JOIN "Runner" ru ON ru."raceId" = r.id
WHERE rd.date::date = '2026-07-04'
GROUP BY h.name, r."raceNo", r."classType"
ORDER BY h.name, r."raceNo";
