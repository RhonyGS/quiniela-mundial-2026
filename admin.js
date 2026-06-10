import { initializeApp }
    from "https://www.gstatic.com/firebasejs/12.2.1/firebase-app.js";

import {
    getFirestore,
    doc,
    setDoc,
    getDoc,
    getDocs,
    collection
}
    from "https://www.gstatic.com/firebasejs/12.2.1/firebase-firestore.js";

import { matches } from "./matches.js";

import { groups } from "./groups.js";
import {
    buildQualifiedTeams,
    getBestThirdPlaceTeams,
    resolveKnockoutMatches
} from "./tournament.js";
import { knockoutMatches } from "./knockout-config.js";
import { thirdPlaceMapping } from "./thirdPlaceMapping.js";

const adminLogin = document.getElementById("adminLogin");
const adminPanel = document.getElementById("adminPanel");
const adminPassword = document.getElementById("adminPassword");
const adminLoginButton = document.getElementById("adminLoginButton");
const adminLoginMessage = document.getElementById("adminLoginMessage");

const ADMIN_PASSWORD = "Qm2026!Denver#Final$WorldCup";

adminLoginButton.addEventListener("click", () => {
    if (adminPassword.value === ADMIN_PASSWORD) {
        adminLogin.style.display = "none";
        adminPanel.style.display = "block";
    } else {
        adminLoginMessage.textContent = "Incorrect password.";
    }
});

///

async function loadMatches() {
    const snapshot = await getDocs(
        collection(db, "matches")
    );

    const matches = [];

    snapshot.forEach((doc) => {
        matches.push(doc.data());
    });

    matches.sort((a, b) => {
        return a.matchId.localeCompare(b.matchId);
    });

    return matches;
}

function getThirdPlaceKey(bestThirdPlaces) {
    return bestThirdPlaces
        .map((team) => team.group)
        .sort()
        .join("");
}

function buildRealKnockoutMatches(allMatches) {
    const groupMatches =
        allMatches.filter((match) => {
            return (
                match.phase === "GROUP_STAGE" &&
                match.finished === true
            );
        });

    const qualifiedTeams =
        buildQualifiedTeams(groups, groupMatches);

    const bestThirdPlaces =
        getBestThirdPlaceTeams(qualifiedTeams);

    const thirdPlaceKey =
        getThirdPlaceKey(bestThirdPlaces);

    const thirdPlaceAllocation =
        thirdPlaceMapping[thirdPlaceKey];

    const realMatchWinners =
        getRealMatchWinners(allMatches);

    const resolvedKnockout =
        resolveKnockoutMatches(
            knockoutMatches,
            qualifiedTeams,
            realMatchWinners,
            bestThirdPlaces,
            thirdPlaceAllocation
        );

    const savedMatchesById = {};

    allMatches.forEach((match) => {
        savedMatchesById[match.matchId] = match;
    });

    const mergedKnockout =
        resolvedKnockout.map((match) => {
            const savedMatch =
                savedMatchesById[match.matchId];

            return {
                ...match,
                homeGoals: savedMatch?.homeGoals ?? "",
                awayGoals: savedMatch?.awayGoals ?? "",
                winner: savedMatch?.winner ?? null,
                finished: savedMatch?.finished ?? false
            };
        });

    return mergedKnockout;
}

const uploadMatchesButton =
    document.getElementById("uploadMatchesButton");

const message =
    document.getElementById("message");

uploadMatchesButton.addEventListener("click", async () => {
    for (const match of matches) {
        await setDoc(
            doc(db, "matches", match.matchId),
            match
        );
    }

    message.textContent =
        "All matches uploaded to Firebase.";
});

const firebaseConfig = {
    apiKey: "AIzaSyDShN1-nrnMrVu_60Owg3rxoxHvNAqi0iM",
    authDomain: "quinielamundial2026-bdb50.firebaseapp.com",
    projectId: "quinielamundial2026-bdb50",
    storageBucket: "quinielamundial2026-bdb50.firebasestorage.app",
    messagingSenderId: "280551838703",
    appId: "1:280551838703:web:afd9e065feffb9d47c1c1a"
};

const app =
    initializeApp(firebaseConfig);

const db =
    getFirestore(app);

//Barra de navegacion
const navbar = document.getElementById("navbar");

async function loadNavbar() {
    const settingsDoc = await getDoc(doc(db, "settings", "app"));
    const settings = settingsDoc.data();

    if (settings.poolClosed === true) {
        navbar.innerHTML = `
            <a href="leaderboard.html">🏆 Leaderboard</a> |
            <a href="revealed-picks.html">🔓 Revealed Picks</a>
        `;
    } else {
        navbar.innerHTML = `
            <a href="index.html">⚽ Predictions</a> |
            <a href="leaderboard.html">🏆 Leaderboard</a>
        `;
    }
}

loadNavbar();

//Cierre de quiniela
const closePoolButton = document.getElementById("closePoolButton");
const openPoolButton = document.getElementById("openPoolButton");

closePoolButton.addEventListener("click", async () => {
    await setDoc(doc(db, "settings", "app"), {
        poolClosed: true
    });

    message.textContent = "La quiniela fue cerrada.";
});

openPoolButton.addEventListener("click", async () => {
    await setDoc(doc(db, "settings", "app"), {
        poolClosed: false
    });

    message.textContent = "La quiniela fue reabierta.";
});

//----------

const adminMatchesContainer =
    document.getElementById("adminMatchesContainer");

function renderAdminMatches(matches) {
    adminMatchesContainer.innerHTML = "";

    matches.forEach((match) => {
        const matchDiv = document.createElement("div");
        matchDiv.classList.add("match-card");

        const isKnockout =
            match.phase !== "GROUP_STAGE";

        const homeTeam =
            match.homeTeam || match.homeSlot;

        const awayTeam =
            match.awayTeam || match.awaySlot;

        matchDiv.innerHTML = `
            <p>
                <strong>
                    ${match.matchId.toUpperCase()} -
                    ${match.phase}
                    ${match.group ? `Group ${match.group}` : ""}
                </strong>
            </p>

            <div class="match-score-row">
                <span>${homeTeam}</span>

                <input
                    id="${match.matchId}-home"
                    type="number"
                    min="0"
                    placeholder=""
                    value="${match.homeGoals ?? ""}"
                >

                <span>-</span>

                <input
                    id="${match.matchId}-away"
                    type="number"
                    min="0"
                    placeholder=""
                    value="${match.awayGoals ?? ""}"
                >

                <span>${awayTeam}</span>
            </div>

            ${isKnockout ? `
    <div
        class="admin-winner-section"
        id="${match.matchId}-winner-section"
        style="display: none;"
    >
                    <p>Winner / Advances</p>

                    <label>
                        <input
                            type="radio"
                            name="${match.matchId}-winner"
                            value="${match.homeTeam}"
                        >
                        ${homeTeam}
                    </label>

                    <label>
                        <input
                            type="radio"
                            name="${match.matchId}-winner"
                            value="${match.awayTeam}"
                        >
                        ${awayTeam}
                    </label>
                </div>
            ` : ""}

            <button id="${match.matchId}-save">
                Save / Update Result
            </button>
        `;

        adminMatchesContainer.appendChild(matchDiv);

        const homeInput =
            document.getElementById(`${match.matchId}-home`);

        const awayInput =
            document.getElementById(`${match.matchId}-away`);

        const winnerSection =
            document.getElementById(`${match.matchId}-winner-section`);

        function updateWinnerSectionVisibility() {
            if (!isKnockout || !winnerSection) {
                return;
            }

            if (
                homeInput.value !== "" &&
                awayInput.value !== "" &&
                Number(homeInput.value) === Number(awayInput.value)
            ) {
                winnerSection.style.display = "block";
            } else {
                winnerSection.style.display = "none";
            }
        }

        homeInput.addEventListener("input", updateWinnerSectionVisibility);
        awayInput.addEventListener("input", updateWinnerSectionVisibility);

        updateWinnerSectionVisibility();

        const saveButton =
            document.getElementById(`${match.matchId}-save`);

        saveButton.addEventListener("click", async () => {
            const homeGoals =
                Number(document.getElementById(`${match.matchId}-home`).value);

            const awayGoals =
                Number(document.getElementById(`${match.matchId}-away`).value);

            const selectedWinner =
                document.querySelector(
                    `input[name="${match.matchId}-winner"]:checked`
                );

            const winner =
                isKnockout && selectedWinner
                    ? selectedWinner.value
                    : null;

            await setDoc(
                doc(db, "matches", match.matchId),
                {
                    ...match,
                    homeGoals,
                    awayGoals,
                    winner,
                    finished: true
                }
            );
        });
    });
}


const allMatches = await loadMatches();

console.log(allMatches);
console.log(allMatches.length);

const realKnockoutMatches =
    buildRealKnockoutMatches(allMatches);

renderAdminMatches([
    ...allMatches.filter((match) => match.phase === "GROUP_STAGE"),
    ...realKnockoutMatches
]);

/////


function getRealMatchWinners(allMatches) {
    const winners = {};

    allMatches.forEach((match) => {
        if (match.finished !== true) {
            return;
        }

        if (match.phase === "GROUP_STAGE") {
            return;
        }

        const matchNumber =
            Number(match.matchId.replace("match", ""));

        let winner = null;
        let loser = null;

        if (match.winner) {
            winner = match.winner;

            loser =
                match.winner === match.homeTeam
                    ? match.awayTeam
                    : match.homeTeam;
        } else if (match.homeGoals > match.awayGoals) {
            winner = match.homeTeam;
            loser = match.awayTeam;
        } else if (match.awayGoals > match.homeGoals) {
            winner = match.awayTeam;
            loser = match.homeTeam;
        } else {
            return;
        }

        winners[`W${matchNumber}`] = winner;

        if (match.phase === "SEMIFINAL") {
            winners[`L${matchNumber}`] = loser;
        }
    });

    return winners;
}