const fs = require("fs");

const html = fs.readFileSync("third-place-table.html", "utf8");

const rows = [...html.matchAll(/<tr>([\s\S]*?)<\/tr>/g)];

const slots = ["1A", "1B", "1D", "1E", "1G", "1I", "1K", "1L"];
const groups = ["A", "B", "C", "D", "E", "F", "G", "H", "I", "J", "K", "L"];

const mapping = {};

rows.forEach((rowMatch) => {
    const row = rowMatch[1];

    const cells = [...row.matchAll(/<t[dh][^>]*>([\s\S]*?)<\/t[dh]>/g)]
        .map(cell => {
            return cell[1]
                .replace(/<[^>]+>/g, "")
                .replace(/\s+/g, "")
                .trim();
        });

    if (cells.length < 21) return;

    const optionNumber = Number(cells[0]);
    if (!optionNumber) return;

    const advancedGroups = cells.slice(1, 13)
        .map((value, index) => value ? groups[index] : "")
        .filter(Boolean)
        .join("");

    const assignments = cells.slice(-8);

    mapping[advancedGroups] = {};

    slots.forEach((slot, index) => {
        mapping[advancedGroups][slot] = assignments[index];
    });
});

const output = `export const thirdPlaceMapping = ${JSON.stringify(mapping, null, 4)};\n`;

fs.writeFileSync("thirdPlaceMapping.js", output);

console.log("Created thirdPlaceMapping.js");
console.log("Combinations:", Object.keys(mapping).length);