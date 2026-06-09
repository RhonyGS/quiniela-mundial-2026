import { initializeApp } from "https://www.gstatic.com/firebasejs/12.2.1/firebase-app.js";

import {
    getFirestore,
    collection,
    getDocs,
    doc,
    getDoc
} from "https://www.gstatic.com/firebasejs/12.2.1/firebase-firestore.js";

import { teams } from "./teams.js";

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
    navbar.innerHTML = `
        <a href="leaderboard.html">🏆 Leaderboard</a>
    `;
}

loadNavbar();

async function checkPoolStatus() {
    const settingsDoc = await getDoc(doc(db, "settings", "app"));

    if (!settingsDoc.exists()) {
        window.location.href = "leaderboard.html";
        return;
    }

    const settings = settingsDoc.data();

    if (settings.poolClosed === false) {
        window.location.href = "leaderboard.html";
    }
}

async function loadPlayers() {
    const querySnapshot =
        await getDocs(collection(db, "predictions"));

    querySnapshot.forEach((doc) => {
        const data = doc.data();

        const option = document.createElement("option");

        option.value = data.playerName;
        option.textContent = data.playerName;

        playerSelect.appendChild(option);
    });
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

    const revealedMatches = [
        ...matches.filter((match) => match.phase === "GROUP_STAGE"),
        ...(data.resolvedKnockout || [])
    ];
    const knockoutPredictions = data.knockoutPredictions || {};
    const knockoutWinners = data.knockoutWinners || {};

    predictionsContainer.innerHTML = `
    <div class="player-card">
        👤 ${data.playerName}
    </div>
`;

    renderPhase("Group Stage", "GROUP_STAGE", revealedMatches, data, knockoutPredictions);
    renderPhase("Round of 32", "ROUND_OF_32", revealedMatches, data, knockoutPredictions);
    renderPhase("Round of 16", "ROUND_OF_16", revealedMatches, data, knockoutPredictions);
    renderPhase("Quarterfinals", "QUARTERFINAL", revealedMatches, data, knockoutPredictions);
    renderPhase("Semifinals", "SEMIFINAL", revealedMatches, data, knockoutPredictions);
    renderPhase("Third Place Match", "THIRD_PLACE", revealedMatches, data, knockoutPredictions);
    renderPhase("Final", "FINAL", revealedMatches, data, knockoutPredictions);

    renderFinalResults(knockoutWinners);
}

///

function renderPhase(title, phase, matches, data, knockoutPredictions) {
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
            <h2>🥉 Third Place</h2>
            <p>${thirdPlaceTeam.flag} ${thirdPlaceTeam.name}</p>
        ` : ""}

        ${championTeam ? `
            <h2>🏆 World Champion</h2>
            <p>${championTeam.flag} ${championTeam.name}</p>
        ` : ""}
    `;

    predictionsContainer.appendChild(resultsDiv);
}

//

playerSelect.addEventListener("change", showPredictions);

await checkPoolStatus();
await loadPlayers();