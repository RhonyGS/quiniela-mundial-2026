import { initializeApp } from "https://www.gstatic.com/firebasejs/12.2.1/firebase-app.js";

import {
    getFirestore,
    collection,
    getDocs,
    doc,
    getDoc
} from "https://www.gstatic.com/firebasejs/12.2.1/firebase-firestore.js";

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

    if (settings.poolClosed === true) {
        navbar.innerHTML = `
            <a href="revealed-picks.html">🔓 Revealed Picks</a>
        `;
    } else {
        navbar.innerHTML = `
            <a href="index.html">⚽ Predictions</a>
        `;
    }
}

loadNavbar();


//Calculo de puntaje
function calculatePoints(
    realHome,
    realAway,
    predictedHome,
    predictedAway,
    realWinner = null,
    predictedWinner = null
) {
    if (
        realHome === predictedHome &&
        realAway === predictedAway
    ) {
        return 5;
    }

    if (
        realWinner &&
        predictedWinner &&
        realWinner === predictedWinner
    ) {
        return 3;
    }

    const realHomeWins = realHome > realAway;
    const realAwayWins = realAway > realHome;
    const realDraw = realHome === realAway;

    const predictedHomeWins = predictedHome > predictedAway;
    const predictedAwayWins = predictedAway > predictedHome;
    const predictedDraw = predictedHome === predictedAway;

    if (
        realHomeWins === predictedHomeWins &&
        realAwayWins === predictedAwayWins &&
        realDraw === predictedDraw
    ) {
        return 3;
    }

    return 0;
}

function getMatchNumber(matchId) {
    return Number(matchId.replace("match", ""));
}

function isKnockoutMatch(match) {
    return match.phase !== "GROUP_STAGE";
}

function getRealWinner(match) {
    if (match.winner) {
        return match.winner;
    }

    if (match.homeGoals > match.awayGoals) {
        return match.homeTeam;
    }

    if (match.awayGoals > match.homeGoals) {
        return match.awayTeam;
    }

    return null;
}

async function loadMatches() {
    const snapshot = await getDocs(collection(db, "matches"));

    const matches = [];

    snapshot.forEach((doc) => {
        matches.push(doc.data());
    });

    return matches;
}

async function loadLeaderboard() {
    const matches = await loadMatches();

    const predictionsSnapshot =
        await getDocs(collection(db, "predictions"));

    const leaderboardData = [];

    predictionsSnapshot.forEach((doc) => {
        const data = doc.data();

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

                if (
                    match.matchId === "match104" &&
                    realWinner &&
                    predictedWinner === realWinner
                ) {
                    totalPoints += 10;
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

        leaderboardData.push({
            playerName: data.playerName,
            points: totalPoints,
            exacts: exacts,
            hits: hits
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
        <td>${player.playerName}</td>
        <td>${player.points}</td>
        <td>${player.exacts}</td>
        <td>${player.hits}</td>
    `;

        leaderboard.appendChild(tr);
    });
}

loadNavbar();
loadLeaderboard();