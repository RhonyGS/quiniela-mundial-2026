import { initializeApp } from "https://www.gstatic.com/firebasejs/12.2.1/firebase-app.js";

import {
    getFirestore,
    collection,
    getDocs,
    doc,
    getDoc
} from "https://www.gstatic.com/firebasejs/12.2.1/firebase-firestore.js";

import { groups } from "./groups.js";
import { teams } from "./teams.js";
import { calculateGroupStandings } from "./tournament.js";
import {
    calculatePoints,
    getMatchNumber,
    isKnockoutMatch,
    getRealWinner,
    calculateBonusPoints
} from "./scoring.js";

const urlParams =
    new URLSearchParams(window.location.search);

const currentGroup =
    urlParams.get("group")?.toUpperCase();

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

const leaderboard = document.getElementById("leaderboard");

//Barra de navegacion
const navbar = document.getElementById("navbar");

async function loadNavbar() {
    const settingsDoc = await getDoc(doc(db, "settings", "app"));
    const settings = settingsDoc.data();

    const groupQuery =
        currentGroup
            ? `?group=${currentGroup}`
            : "";

    if (settings.poolClosed === true) {
        navbar.innerHTML = `
            <a href="revealed-picks.html${groupQuery}">
                🔓 Revealed Picks
            </a>
        `;
    } else {
        navbar.innerHTML = `
            <a href="index.html${groupQuery}">
                ⚽ Predictions
            </a>
        `;
    }
}

loadNavbar();

async function loadMatches() {
    const snapshot = await getDocs(collection(db, "matches"));

    const matches = [];

    snapshot.forEach((doc) => {
        matches.push(doc.data());
    });

    return matches;
}

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

async function loadLeaderboard() {
    const matches = await loadMatches();

    const predictionsSnapshot =
        await getDocs(collection(db, "predictions"));

    const leaderboardData = [];

    predictionsSnapshot.forEach((doc) => {
        const data = doc.data();

        const playerGroup =
            (data.groupCode || "DEFAULT").toUpperCase();

        if (currentGroup && playerGroup !== currentGroup) {
            return;
        }

        let totalPoints = 0;
        let exacts = 0;
        let hits = 0;

        matches.forEach((match) => {
            if (match.finished !== true) {
                return;
            }

            if (isKnockoutMatch(match)) {
                const knockoutPrediction =
                    data.knockoutPredictions?.[match.matchId];

                const predictedResolvedMatch =
                    data.resolvedKnockout?.find((predictedMatch) => {
                        return predictedMatch.matchId === match.matchId;
                    });

                const correctMatchup =
                    predictedResolvedMatch &&
                    predictedResolvedMatch.homeTeam === match.homeTeam &&
                    predictedResolvedMatch.awayTeam === match.awayTeam;

                if (!correctMatchup) {
                    return;
                }

                const matchNumber =
                    getMatchNumber(match.matchId);

                const predictedWinner =
                    data.knockoutWinners?.[`W${matchNumber}`];

                const realWinner =
                    getRealWinner(match);

                if (!knockoutPrediction) {
                    return;
                }

                const points = calculatePoints(
                    match.homeGoals,
                    match.awayGoals,
                    Number(knockoutPrediction.home),
                    Number(knockoutPrediction.away),
                    realWinner,
                    predictedWinner
                );

                totalPoints += points;

                if (points === 5) {
                    exacts++;
                } else if (points === 3) {
                    hits++;
                }

                return;
            }

            const prediction =
                data.predictions[match.matchId];

            if (!prediction) {
                return;
            }

            const points = calculatePoints(
                match.homeGoals,
                match.awayGoals,
                prediction.homeGoals,
                prediction.awayGoals
            );

            totalPoints += points;

            if (points === 5) {
                exacts++;
            } else if (points === 3) {
                hits++;
            }
        });

        const bonusBreakdown =
            calculateBonusPoints(matches, data);

        totalPoints += bonusBreakdown.total;

        leaderboardData.push({
            playerName: data.playerName,
            points: totalPoints,
            exacts: exacts,
            hits: hits,
            bonusBreakdown: bonusBreakdown
        });
    });

    leaderboardData.sort((a, b) => {
        return b.points - a.points;
    });

    leaderboard.innerHTML = "";

    leaderboardData.forEach((player, index) => {
        const tr = document.createElement("tr");

        let medal = "";

        if (index === 0) { medal = "🥇", tr.classList.add("gold-row"); }
        if (index === 1) { medal = "🥈", tr.classList.add("silver-row"); }
        if (index === 2) { medal = "🥉", tr.classList.add("bronze-row"); }

        tr.innerHTML = `
    <td>${medal || index + 1}</td>
    <td>
    <a href="revealed-picks.html?group=${currentGroup}&player=${encodeURIComponent(player.playerName)}">
        ${player.playerName}
    </a>
</td>
    <td>${player.points}</td>
    <td>${player.exacts}</td>
    <td>${player.hits}</td>
`;

        leaderboard.appendChild(tr);
    });
}

loadNavbar();
loadLeaderboard();