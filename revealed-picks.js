import { initializeApp } from "https://www.gstatic.com/firebasejs/12.2.1/firebase-app.js";

import {
    getFirestore,
    collection,
    getDocs,
    doc,
    getDoc
} from "https://www.gstatic.com/firebasejs/12.2.1/firebase-firestore.js";

import { teams } from "./teams.js";
import { calculateGroupStandings } from "./tournament.js";
import { groups } from "./groups.js";
import { matches } from "./matches.js";
import {
    calculatePoints,
    calculateBonusPoints,
    getMatchNumber,
    getRealWinner,
    isKnockoutMatch
} from "./scoring.js";

const urlParams =
    new URLSearchParams(window.location.search);

const currentGroup =
    urlParams.get("group")?.toUpperCase();

const selectedPlayer =
    urlParams.get("player");

const groupQuery =
    currentGroup
        ? `?group=${currentGroup}`
        : "";

const firebaseConfig = {
    apiKey: "AIzaSyDShN1-nrnMrVu_60Owg3rxoxHvNAqi0iM",
    authDomain: "quinielamundial2026-bdb50.firebaseapp.com",
    projectId: "quinielamundial2026-bdb50",
    storageBucket: "quinielamundial2026-bdb50.firebasestorage.app",
    messagingSenderId: "280551838703",
    appId: "1:280551838703:web:afd9e065feffb9d47c1c1a"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

const navbar = document.getElementById("navbar");
const playerSelect = document.getElementById("playerSelect");
const predictionsContainer = document.getElementById("predictionsContainer");

function loadNavbar() {
    const groupQuery =
        currentGroup
            ? `?group=${currentGroup}`
            : "";

    navbar.innerHTML = `
        <a href="leaderboard.html${groupQuery}">
            🏆 Leaderboard
        </a>
    `;
}

loadNavbar();

async function checkPoolStatus() {
    const settingsDoc = await getDoc(doc(db, "settings", "app"));

    if (!settingsDoc.exists()) {
        window.location.href = `leaderboard.html${groupQuery}`;
        return;
    }

    const settings = settingsDoc.data();

    if (settings.poolClosed === false) {
        window.location.href = `leaderboard.html${groupQuery}`;
    }
}

async function loadPlayers() {
    const querySnapshot =
        await getDocs(collection(db, "predictions"));

    querySnapshot.forEach((doc) => {
        const data = doc.data();

        const playerGroup =
            (data.groupCode || "DEFAULT").toUpperCase();

        if (currentGroup && playerGroup !== currentGroup) {
            return;
        }

        const option = document.createElement("option");

        option.value = data.playerName;
        option.textContent = data.playerName;

        playerSelect.appendChild(option);
    });

    if (selectedPlayer) {
        playerSelect.value = selectedPlayer;

        if (playerSelect.value === selectedPlayer) {
            await showPredictions();
        }
    }
}

async function loadMatches() {
    const snapshot =
        await getDocs(collection(db, "matches"));

    const matches = [];

    snapshot.forEach((doc) => {
        matches.push(doc.data());
    });

    matches.sort((a, b) => {
        return a.matchId.localeCompare(b.matchId);
    });

    return matches;
}

async function showPredictions() {
    const playerName = playerSelect.value;

    if (!playerName) {
        predictionsContainer.innerHTML = "";
        return;
    }

    const playerDoc =
        await getDoc(doc(db, "predictions", playerName));

    if (!playerDoc.exists()) {
        predictionsContainer.innerHTML = "";
        return;
    }

    const data = playerDoc.data();
    console.log(data.resolvedKnockout);
    const matches = await loadMatches();
    const bonusBreakdown = calculateBonusPoints(matches, data);

    const revealedMatches = [
        ...matches.filter((match) => match.phase === "GROUP_STAGE"),
        ...(data.resolvedKnockout || [])
    ];
    const knockoutPredictions = data.knockoutPredictions || {};
    const knockoutWinners = data.knockoutWinners || {};
    ///

    let matchPoints = 0;

    matches.forEach((match) => {
        if (match.finished !== true) {
            return;
        }

        if (isKnockoutMatch(match)) {
            const prediction =
                data.knockoutPredictions?.[match.matchId];

            const predictedResolvedMatch =
                data.resolvedKnockout?.find((predictedMatch) => {
                    return predictedMatch.matchId === match.matchId;
                });

            const correctMatchup =
                predictedResolvedMatch &&
                predictedResolvedMatch.homeTeam === match.homeTeam &&
                predictedResolvedMatch.awayTeam === match.awayTeam;

            if (!prediction || !correctMatchup) {
                return;
            }

            const matchNumber =
                getMatchNumber(match.matchId);

            matchPoints += calculatePoints(
                match.homeGoals,
                match.awayGoals,
                Number(prediction.homeGoals ?? prediction.home),
                Number(prediction.awayGoals ?? prediction.away),
                getRealWinner(match),
                data.knockoutWinners?.[`W${matchNumber}`]
            );

            return;
        }

        const prediction =
            data.predictions?.[match.matchId];

        if (!prediction) {
            return;
        }

        matchPoints += calculatePoints(
            match.homeGoals,
            match.awayGoals,
            prediction.homeGoals,
            prediction.awayGoals
        );
    });

    const totalScore =
        matchPoints + bonusBreakdown.total;

    ///
    predictionsContainer.innerHTML = `
    <div class="player-card">
        👤 ${data.playerName}
    </div>

   <div class="points-summary-card">
   <div class="score-total-card">
    <h2>🏆 Total Score</h2>

    <div class="total-points">
        ${totalScore}
    </div>

    <div class="score-grid">
        <div>🎯 Match Points <strong>${matchPoints}</strong></div>
        <div>🏆 Group Bonus <strong>${bonusBreakdown.groupBonus.points}</strong></div>
        <div>⚽ Matchup Bonus <strong>${bonusBreakdown.matchupBonus.total}</strong></div>
        <div>🚀 Progression Bonus <strong>${bonusBreakdown.progressionBonus.total}</strong></div>
        <div>👑 Champion Bonus <strong>${bonusBreakdown.championBonus.total}</strong></div>
    </div>
</div>
    <h2>📋 Score Breakdown</h2>

    <p>
        <strong>Total Bonus:</strong>
        ${bonusBreakdown.total}
    </p>

    <details class="bonus-details">
        <summary>
            🏆 Group Bonus: ${bonusBreakdown.groupBonus.points}
        </summary>

        <h4>Round of 32 Qualifiers</h4>

        <div class="bonus-list">
            ${bonusBreakdown.groupBonus.qualifiers.map((item) => {
        const teamInfo = teams[item.team];

        return `
                    <div class="bonus-item ${item.correct ? "bonus-correct" : "bonus-wrong"}">
                        <span>
                            ${item.correct ? "✅" : "❌"}
                            ${teamInfo?.flag || ""}
                            ${teamInfo?.shortName || item.team}
                        </span>

                        <strong>+${item.points}</strong>
                    </div>
                `;
    }).join("")}
        </div>

        <h4>Exact Group Positions</h4>

        ${renderPositionsByGroup(
        bonusBreakdown.groupBonus.positions
    )}
    </details>

    <p>
        <details class="bonus-details">
    <summary>
        ⚽ Matchup Bonus: ${bonusBreakdown.matchupBonus.total}
    </summary>

    <div class="bonus-formula-list">
    <div class="bonus-formula-row">
        <span>Round of 32</span>
        <strong>${bonusBreakdown.matchupBonus.round32} × 2pts = ${bonusBreakdown.matchupBonus.round32 * 2}</strong>
    </div>

    <div class="bonus-formula-row">
        <span>Round of 16</span>
        <strong>${bonusBreakdown.matchupBonus.round16} × 3pts = ${bonusBreakdown.matchupBonus.round16 * 3}</strong>
    </div>

    <div class="bonus-formula-row">
        <span>Quarterfinals</span>
        <strong>${bonusBreakdown.matchupBonus.quarterfinals} × 5pts = ${bonusBreakdown.matchupBonus.quarterfinals * 5}</strong>
    </div>

    <div class="bonus-formula-row">
        <span>Semifinals</span>
        <strong>${bonusBreakdown.matchupBonus.semifinals} × 7pts = ${bonusBreakdown.matchupBonus.semifinals * 7}</strong>
    </div>

    <div class="bonus-formula-row">
        <span>Final</span>
        <strong>${bonusBreakdown.matchupBonus.final} × 10pts = ${bonusBreakdown.matchupBonus.final * 10}</strong>
    </div>
</div>
</details>
    </p>

    <p>
        <details class="bonus-details">
    <summary>
        🚀 Progression Bonus: ${bonusBreakdown.progressionBonus.total}
    </summary>

    <div class="bonus-formula-list">
    <div class="bonus-formula-row">
        <span>Round of 16 Teams</span>
        <strong>${bonusBreakdown.progressionBonus.round16} × 3pts = ${bonusBreakdown.progressionBonus.round16 * 3}</strong>
    </div>

    <div class="bonus-formula-row">
        <span>Quarterfinalists</span>
        <strong>${bonusBreakdown.progressionBonus.quarterfinals} × 5pts = ${bonusBreakdown.progressionBonus.quarterfinals * 5}</strong>
    </div>

    <div class="bonus-formula-row">
        <span>Semifinalists</span>
        <strong>${bonusBreakdown.progressionBonus.semifinals} × 8pts = ${bonusBreakdown.progressionBonus.semifinals * 8}</strong>
    </div>

    <div class="bonus-formula-row">
        <span>Finalists</span>
        <strong>${bonusBreakdown.progressionBonus.finalists} × 12pts = ${bonusBreakdown.progressionBonus.finalists * 12}</strong>
    </div>
</div>
</details>
    </p>

    <p>
<details class="bonus-details">
    <summary>
        👑 Champion Bonus:
        ${bonusBreakdown.championBonus.total}
    </summary>

    <div class="bonus-item ${bonusBreakdown.championBonus.pending
            ? "bonus-pending"
            : bonusBreakdown.championBonus.correct
                ? "bonus-correct"
                : "bonus-wrong"
        }">

        <span>
            ${bonusBreakdown.championBonus.pending
            ? "⏳ Pending"
            : bonusBreakdown.championBonus.correct
                ? "✅ Champion predicted correctly"
                : "❌ Champion prediction"
        }
        </span>

        <strong>
            ${bonusBreakdown.championBonus.pending
            ? ""
            : `+${bonusBreakdown.championBonus.total}`
        }
        </strong>

    </div>

</details>
    </p>
</div>
`;

    renderProjectedStandings(matches, data.predictions);

    renderPhase("Group Stage", "GROUP_STAGE", revealedMatches, data, knockoutPredictions, matches);
    renderPhase("Round of 32", "ROUND_OF_32", revealedMatches, data, knockoutPredictions, matches);
    renderPhase("Round of 16", "ROUND_OF_16", revealedMatches, data, knockoutPredictions, matches);
    renderPhase("Quarterfinals", "QUARTERFINAL", revealedMatches, data, knockoutPredictions, matches);
    renderPhase("Semifinals", "SEMIFINAL", revealedMatches, data, knockoutPredictions, matches);
    renderPhase("Third Place Match", "THIRD_PLACE", revealedMatches, data, knockoutPredictions, matches);
    renderPhase("Final", "FINAL", revealedMatches, data, knockoutPredictions, matches);

    renderFinalResults(knockoutWinners);
}

///

function getMatchupBonusValue(phase) {
    if (phase === "ROUND_OF_32") return 2;
    if (phase === "ROUND_OF_16") return 3;
    if (phase === "QUARTERFINAL") return 4;
    if (phase === "SEMIFINAL") return 5;
    if (phase === "FINAL") return 6;

    return 0;
}

function renderMatchPoints(match, prediction, data, realMatches) {
    const realMatch =
        realMatches.find((real) => real.matchId === match.matchId);

    if (!realMatch || realMatch.finished !== true) {
        return `
            <div class="match-points pending-points">
                ⏳ Pending
            </div>
        `;
    }

    if (match.phase === "GROUP_STAGE") {
        const points = calculatePoints(
            realMatch.homeGoals,
            realMatch.awayGoals,
            prediction.homeGoals,
            prediction.awayGoals
        );

        let label = "❌ Incorrect";

        if (points === 5) {
            label = "✅ Exact Score";
        } else if (points === 3) {
            label = "✅ Correct Result";
        }

        return `
            <div class="match-points ${points > 0 ? "points-earned" : "points-zero"}">
                <span>${label}</span>
                <strong>+${points} pts</strong>
            </div>
        `;
    }

    const correctMatchup =
        match.homeTeam === realMatch.homeTeam &&
        match.awayTeam === realMatch.awayTeam;

    if (!correctMatchup) {
        return `
            <div class="match-points points-zero">
                <span>❌ Wrong Matchup</span>
                <strong>+0 pts</strong>
            </div>
        `;
    }

    const matchNumber =
        getMatchNumber(match.matchId);

    const predictedWinner =
        data.knockoutWinners?.[`W${matchNumber}`];

    const realWinner =
        getRealWinner(realMatch);

    const scorePoints = calculatePoints(
        realMatch.homeGoals,
        realMatch.awayGoals,
        Number(prediction.homeGoals ?? prediction.home),
        Number(prediction.awayGoals ?? prediction.away),
        realWinner,
        predictedWinner
    );

    const matchupBonus =
        getMatchupBonusValue(match.phase);

    const total =
        scorePoints + matchupBonus;

    let scoreLabel = "❌ Incorrect Result";

    if (scorePoints === 5) {
        scoreLabel = "✅ Exact Score";
    } else if (scorePoints === 3) {
        scoreLabel = "✅ Correct Winner";
    }

    return `
        <div class="match-points ${total > 0 ? "points-earned" : "points-zero"}">
            <div>
                ✅ Correct Matchup +${matchupBonus}
            </div>

            <div>
                ${scoreLabel} +${scorePoints}
            </div>

            <strong>Total: +${total} pts</strong>
        </div>
    `;
}
///

function getOrdinal(position) {
    if (position === 1) return "1st";
    if (position === 2) return "2nd";
    if (position === 3) return "3rd";

    return `${position}th`;
}

function renderPositionsByGroup(positions) {
    const positionsByGroup = {};

    positions.forEach((item) => {
        if (!positionsByGroup[item.group]) {
            positionsByGroup[item.group] = [];
        }

        positionsByGroup[item.group].push(item);
    });

    return Object.keys(positionsByGroup).map((group) => {
        return `
            <details class="group-bonus-details">
                <summary>Group ${group}</summary>

                <div class="bonus-list">
                    ${positionsByGroup[group].map((item) => {
            const teamInfo = teams[item.team];

            return `
                            <div class="bonus-item ${item.correct ? "bonus-correct" : "bonus-wrong"}">
                                <span>
                                    ${item.correct ? "✅" : "❌"}
                                    ${teamInfo?.flag || ""}
                                    ${teamInfo?.shortName || item.team}
                                    · ${getOrdinal(item.position)}
                                </span>

                                <strong>+${item.points}</strong>
                            </div>
                        `;
        }).join("")}
                </div>
            </details>
        `;
    }).join("");
}

///
function renderPhase(title, phase, matches, data, knockoutPredictions, realMatches) {
    const phaseMatches =
        matches.filter((match) => match.phase === phase);

    if (phaseMatches.length === 0) {
        return;
    }

    const section = document.createElement("details");
    section.open = false;

    section.classList.add("revealed-phase");
    section.innerHTML = `<summary>${title}</summary>`;
    phaseMatches.forEach((match) => {
        const prediction =
            data.predictions?.[match.matchId] ||
            knockoutPredictions[match.matchId];

        if (!prediction) {
            return;
        }

        const homeTeam = teams[match.homeTeam];
        const awayTeam = teams[match.awayTeam];

        if (!homeTeam || !awayTeam) {
            return;
        }

        const div = document.createElement("div");
        div.classList.add("match-card");

        div.innerHTML = `
            ${match.date ? `
                <p class="match-date">
                    ${match.date}
                </p>
                ` : ""}

                <div class="match-score-row">
                <span class="team-name">
                    ${homeTeam.flag} ${homeTeam.shortName}
                </span>

                <strong>
                    ${prediction.homeGoals ?? prediction.home}
                    -
                    ${prediction.awayGoals ?? prediction.away}
                </strong>

                <span class="team-name">
                    ${awayTeam.flag} ${awayTeam.shortName}
                </span>
            </div>

            <p>${homeTeam.name} vs ${awayTeam.name}</p>
            ${renderMatchPoints(match, prediction, data, realMatches)}
        `;

        section.appendChild(div);
    });

    predictionsContainer.appendChild(section);
}

function renderFinalResults(knockoutWinners) {
    const thirdPlaceTeam =
        teams[knockoutWinners.W103];

    const championTeam =
        teams[knockoutWinners.W104];

    const resultsDiv = document.createElement("div");
    resultsDiv.classList.add("final-results-card");

    resultsDiv.innerHTML = `
        ${thirdPlaceTeam ? `
            <h2 class="third-place-rp">🥉 Third Place</h2>
            ${thirdPlaceTeam.flag} ${thirdPlaceTeam.name}</p>
        ` : ""}

        ${championTeam ? `
            <h2 class="world-champ-rp">🏆 World Champion</h2>
            <p class="podium-team">
            ${championTeam.flag} ${championTeam.name}</p>
        ` : ""}
    `;

    predictionsContainer.appendChild(resultsDiv);
}

//

playerSelect.addEventListener("change", showPredictions);

await checkPoolStatus();
await loadPlayers();

function renderProjectedStandings(matches, predictions) {
    const section = document.createElement("details");
    section.classList.add("revealed-phase");

    section.innerHTML = `
        <summary>📊 Projected Group Standings</summary>
    `;

    const groupStageMatches =
        matches.filter((match) => match.phase === "GROUP_STAGE");

    const predictedMatches =
        groupStageMatches.map((match) => {
            const prediction =
                predictions[match.matchId];

            if (!prediction) {
                return match;
            }

            return {
                ...match,
                homeGoals: prediction.homeGoals,
                awayGoals: prediction.awayGoals,
                finished: true
            };
        });

    const standingsByGroup = {};

    Object.keys(groups).forEach((group) => {
        const groupMatches =
            predictedMatches.filter((match) => {
                return match.group === group;
            });

        standingsByGroup[group] =
            calculateGroupStandings(
                groups[group],
                groupMatches
            );
    });

    Object.keys(standingsByGroup).forEach((group) => {
        const groupDiv = document.createElement("div");
        groupDiv.classList.add("projected-standings-card");

        let rows = "";

        standingsByGroup[group].forEach((team, index) => {
            const teamInfo = teams[team.team];

            let rowClass = "";

            if (index === 0 || index === 1) {
                rowClass = "qualified-row";
            } else if (index === 2) {
                rowClass = "third-place-row";
            }

            rows += `
    <tr class="${rowClass}">
        <td>${index + 1}</td>

        <td>
            ${teamInfo?.flag || ""}
            ${teamInfo?.shortName || team.team}
        </td>

        <td>${team.played}</td>
        <td>${team.wins}</td>
        <td>${team.draws}</td>
        <td>${team.losses}</td>
        <td>${team.goalsFor}</td>
        <td>${team.goalsAgainst}</td>
        <td>${team.goalDifference}</td>
        <td>${team.points}</td>
    </tr>
`;
        });

        groupDiv.innerHTML = `
    <div class="standings-box">
        <h3>Group ${group}</h3>

        <table>
            <thead>
                <tr>
                    <th>#</th>
                    <th>Team</th>
                    <th>P</th>
                    <th>W</th>
                    <th>D</th>
                    <th>L</th>
                    <th>GF</th>
                    <th>GA</th>
                    <th>GD</th>
                    <th>Pts</th>
                </tr>
            </thead>

            <tbody>
                ${rows}
            </tbody>
        </table>
    </div>
`;

        section.appendChild(groupDiv);
    });

    predictionsContainer.appendChild(section);
}