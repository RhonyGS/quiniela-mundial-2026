//localStorage.clear();

import { matches } from "./matches.js";
import { teams } from "./teams.js";

import { initializeApp } from "https://www.gstatic.com/firebasejs/12.2.1/firebase-app.js";
import {
    getFirestore,
    collection,
    getDocs,
    doc,
    setDoc,
    getDoc
} from "https://www.gstatic.com/firebasejs/12.2.1/firebase-firestore.js";

import { groups } from "./groups.js";
import { knockoutMatches } from "./knockout-config.js";

import {
    buildQualifiedTeams,
    getBestThirdPlaceTeams,
    resolveKnockoutMatches,
    calculateGroupStandings,
    getThirdPlaceKey
} from "./tournament.js";

import { thirdPlaceMapping } from "./thirdPlaceMapping.js";

let currentResolvedKnockoutMatches = [];
let knockoutPredictions = {};
let lastQualifiedTeamsForBracket = null;
let lastBestThirdPlaces = [];
let lastThirdPlaceAllocation = {};

const roundOf32Message =
    document.getElementById("roundOf32Message");

const roundOf32Container =
    document.getElementById("roundOf32Container");

const roundOf16Container =
    document.getElementById("round-of-16-container");

const quarterfinalsContainer =
    document.getElementById("quarterfinals-container");

const semifinalsContainer =
    document.getElementById("semifinals-container");

const thirdPlaceContainer =
    document.getElementById("third-place-container");

const finalContainer =
    document.getElementById("final-container");

const thirdPlaceResult =
    document.getElementById("third-place-result");

const championResult =
    document.getElementById("champion-result");

const urlParams =
    new URLSearchParams(window.location.search);

const groupFromUrl =
    urlParams.get("group");

const firebaseConfig = {
    apiKey: "AIzaSyDShN1-nrnMrVu_60Owg3rxoxHvNAqi0iM",
    authDomain: "quinielamundial2026-bdb50.firebaseapp.com",
    projectId: "quinielamundial2026-bdb50",
    storageBucket: "quinielamundial2026-bdb50.firebasestorage.app",
    messagingSenderId: "280551838703",
    appId: "1:280551838703:web:afd9e065feffb9d47c1c1a"
};

const app = initializeApp(firebaseConfig);
console.log("Firebase conectado");
const db = getFirestore(app);

const matchesContainer = document.getElementById("matchesContainer");

//Barra de navegacion
const navbar = document.getElementById("navbar");

async function loadNavbar() {
    const settingsDoc = await getDoc(doc(db, "settings", "app"));
    const settings = settingsDoc.data();
    const groupQuery =
        groupFromUrl
            ? `?group=${groupFromUrl.toUpperCase()}`
            : "";

    if (settings.poolClosed === true) {
        navbar.innerHTML = `
            <a href="leaderboard.html${groupQuery}">🏆 Leaderboard</a>
            <a href="revealed-picks.html${groupQuery}">🔓 Revealed Picks</a>
        `;
    } else {
        navbar.innerHTML = `
            <a href="leaderboard.html${groupQuery}">🏆 Leaderboard</a>
        `;
    }
}

loadNavbar();

// Verificacion de estado de la quiniela para cerrar el formulario
const predictionForm = document.getElementById("predictionForm");
const closedMessage = document.getElementById("closedMessage");

async function checkPoolStatus() {
    const settingsDoc = await getDoc(doc(db, "settings", "app"));

    if (!settingsDoc.exists()) {
        return;
    }

    const settings = settingsDoc.data();

    if (settings.poolClosed === true) {
        predictionForm.style.display = "none";
        closedMessage.style.display = "block";
    } else {
        predictionForm.style.display = "block";
        closedMessage.style.display = "none";
    }
}
checkPoolStatus();


//Variables de predicciones
const button = document.getElementById("submitButton");

const playerNameInput = document.getElementById("playerName");
const resultParagraph = document.getElementById("result");

button.addEventListener("click", async () => {
    const playerName = playerNameInput.value.trim();
    const groupCode =
        groupFromUrl?.toUpperCase() || "DEFAULT";

    if (playerName === "") {
        resultParagraph.textContent = "Please enter your name.";
        return;
    }

    if (!groupCode) {
        resultParagraph.textContent =
            "Invalid group link.";

        return;
    }

    const settingsDoc = await getDoc(doc(db, "settings", "app"));
    const settings = settingsDoc.data();

    if (settings.poolClosed === true) {
        resultParagraph.textContent = "The pool is closed.";
        return;
    }

    const predictions = {};

    matches.forEach((match) => {
        const homeInput = document.getElementById(
            `${match.matchId}-home`
        );

        const awayInput = document.getElementById(
            `${match.matchId}-away`
        );

        predictions[match.matchId] = {
            homeGoals: Number(homeInput.value),
            awayGoals: Number(awayInput.value)
        };
    });

    const matchWinners =
        getKnockoutMatchWinners();

    const prediction = {
        playerName: playerName,
        submitted: true,

        predictions: predictions,
        groupCode: groupCode,
        knockoutPredictions: knockoutPredictions,
        knockoutWinners: matchWinners,
        resolvedKnockout: currentResolvedKnockoutMatches,

        createdAt: new Date().toISOString()
    };

    const playerDocRef = doc(db, "predictions", playerName);
    const playerDoc = await getDoc(playerDocRef);

    if (playerDoc.exists() && playerDoc.data().submitted === true) {
        resultParagraph.textContent =
            "You already submitted your predictions. You cannot edit them.";

        return;
    }

    if (!matchWinners.W104) {
        resultParagraph.textContent =
            "Please complete your entire bracket before submitting.";

        return;
    }

    await setDoc(playerDocRef, prediction);

    playerNameInput.disabled = true;
    button.disabled = true;

    matches.forEach((match) => {
        document.getElementById(`${match.matchId}-home`).disabled = true;
        document.getElementById(`${match.matchId}-away`).disabled = true;
    });

    Object.keys(knockoutPredictions).forEach((matchId) => {
        const homeInput =
            document.getElementById(`${matchId}-home`);

        const awayInput =
            document.getElementById(`${matchId}-away`);

        if (homeInput) {
            homeInput.disabled = true;
        }

        if (awayInput) {
            awayInput.disabled = true;
        }
    });

    document
        .querySelectorAll('input[type="radio"]')
        .forEach((radio) => {
            radio.disabled = true;
        });

    resultParagraph.textContent =
        "Predictions submitted successfully!";

    resultParagraph.className =
        "success-message";
});

function getResultType(realHome, realAway, predictedHome, predictedAway) {
    const points = calculatePoints(
        realHome,
        realAway,
        predictedHome,
        predictedAway
    );

    if (points === 5) {
        return "exact";
    }

    if (points === 3) {
        return "hit";
    }

    return "miss";
}

//Creacion automatica de partidos

function renderMatches() {
    matchesContainer.innerHTML = "";

    const groups = {};

    matches.forEach((match) => {
        if (!groups[match.group]) {
            groups[match.group] = [];
        }

        groups[match.group].push(match);
    });

    Object.keys(groups).forEach((group) => {
        const groupDetails = document.createElement("details");
        groupDetails.classList.add("group-section");

        const groupSummary = document.createElement("summary");
        groupSummary.textContent = `Group ${group}`;

        groupDetails.appendChild(groupSummary);

        groups[group].forEach((match) => {
            const homeTeam = teams[match.homeTeam];
            const awayTeam = teams[match.awayTeam];

            const matchDiv = document.createElement("div");
            matchDiv.classList.add("match-card");

            matchDiv.innerHTML = `
                ${match.date ? `
                <p class="match-date">
                ${match.date}
                </p>
                ` : ""}

                <div class="match-score-row">

                    <span class="team-name">
                        ${homeTeam.flag} ${homeTeam.shortName}
                    </span>

                    <input
                        id="${match.matchId}-home"
                        type="number"
                        min="0"
                        placeholder=""
                    >

                    <span class="score-divider">-</span>

                    <input
                        id="${match.matchId}-away"
                        type="number"
                        min="0"
                        placeholder=""
                    >

                    <span class="team-name">
                        ${awayTeam.flag} ${awayTeam.shortName}
                    </span>

                </div>

                <p>
                    ${homeTeam.name}
                    vs
                    ${awayTeam.name}
                </p>
            `;

            groupDetails.appendChild(matchDiv);
            const inputs = matchDiv.querySelectorAll("input");

            inputs.forEach((input) => {
                input.addEventListener("input", updateRoundOf32);
            });
            //const homeInput =
            //  document.getElementById(`${match.matchId}-home`);

            //const awayInput =
            //  document.getElementById(`${match.matchId}-away`);

            // homeInput.addEventListener("input", updateRoundOf32);
            //awayInput.addEventListener("input", updateRoundOf32);
        });

        const standingsDiv = document.createElement("div");
        standingsDiv.id = `standings-${group}`;
        standingsDiv.classList.add("standings-box");

        groupDetails.appendChild(standingsDiv);

        matchesContainer.appendChild(groupDetails);

        groups[group].forEach((match) => {
            const homeInput =
                document.getElementById(`${match.matchId}-home`);

            const awayInput =
                document.getElementById(`${match.matchId}-away`);

            if (homeInput && awayInput) {
                homeInput.addEventListener("input", updateRoundOf32);
                awayInput.addEventListener("input", updateRoundOf32);
            }
        });
    });
    updateRoundOf32();
}

function getCurrentGroupPredictionsAsMatches() {
    return matches.map((match) => {
        const homeInput =
            document.getElementById(`${match.matchId}-home`);

        const awayInput =
            document.getElementById(`${match.matchId}-away`);

        const homeGoals =
            homeInput.value === ""
                ? 0
                : Number(homeInput.value);

        const awayGoals =
            awayInput.value === ""
                ? 0
                : Number(awayInput.value);

        return {
            ...match,
            homeGoals: homeGoals,
            awayGoals: awayGoals,
            finished: true,
            isComplete:
                homeInput.value !== "" &&
                awayInput.value !== ""
        };
    });
}

function generatePlayerRoundOf32() {
    const predictedMatches =
        getCurrentGroupPredictionsAsMatches();

    const qualifiedTeams =
        buildQualifiedTeams(
            groups,
            predictedMatches
        );

    const bestThirdPlaces =
        getBestThirdPlaceTeams(
            qualifiedTeams
        );

    const roundOf32 =
        resolveKnockoutMatches(
            knockoutMatches,
            qualifiedTeamsForBracket,
            {},
            bestThirdPlaces,
            thirdPlaceAllocation
        );

    renderRoundOf32(roundOf32);
}

function renderRoundOf32(knockoutMatchesResolved) {
    renderKnockoutPhase(
        knockoutMatchesResolved,
        "ROUND_OF_32",
        roundOf32Container
    );
}


function updateRoundOf32() {

    console.clear();

    updateGroupStandings();
    roundOf32Message.textContent = "";

    const predictedMatches =
        getCurrentGroupPredictionsAsMatches();

    const completedPredictedMatches =
        predictedMatches.filter((match) => {
            return match.isComplete === true;
        });

    const qualifiedTeamsForStandings =
        buildQualifiedTeams(
            groups,
            completedPredictedMatches
        );

    const qualifiedTeamsForBracket =
        buildQualifiedTeams(
            groups,
            predictedMatches
        );

    const bestThirdPlaces =
        getBestThirdPlaceTeams(
            qualifiedTeamsForStandings
        );

    //
    const thirdPlaceKey =
        getThirdPlaceKey(bestThirdPlaces);

    const thirdPlaceAllocation =
        thirdPlaceMapping[thirdPlaceKey];

    lastQualifiedTeamsForBracket = qualifiedTeamsForBracket;
    lastBestThirdPlaces = bestThirdPlaces;
    lastThirdPlaceAllocation = thirdPlaceAllocation;

    renderThirdPlaceSection(
        qualifiedTeamsForStandings,
        bestThirdPlaces,
        thirdPlaceKey,
        thirdPlaceAllocation
    );

    //
    const previousMatchWinners =
        getKnockoutMatchWinners();

    const roundOf32 =
        resolveKnockoutMatches(
            knockoutMatches,
            qualifiedTeamsForBracket,
            previousMatchWinners,
            bestThirdPlaces,
            thirdPlaceAllocation
        );

    currentResolvedKnockoutMatches = roundOf32;

    const matchWinners =
        getKnockoutMatchWinners();

    console.log(
        "Match winners:",
        matchWinners
    );

    const fullKnockout =
        resolveKnockoutMatches(
            knockoutMatches,
            qualifiedTeamsForBracket,
            matchWinners,
            bestThirdPlaces,
            thirdPlaceAllocation
        );

    currentResolvedKnockoutMatches = fullKnockout;

    renderRoundOf32(fullKnockout);

}

getKnockoutMatchWinners();

function updateGroupStandings() {
    const predictedMatches =
        getCurrentGroupPredictionsAsMatches();

    Object.keys(groups).forEach((group) => {
        const groupMatches =
            predictedMatches.filter((match) => {
                return (
                    match.group === group &&
                    match.isComplete === true
                );
            });

        const standings =
            calculateGroupStandings(
                groups[group],
                groupMatches
            );

        const standingsDiv =
            document.getElementById(`standings-${group}`);

        if (!standingsDiv) {
            return;
        }

        standingsDiv.innerHTML = `
            <h3>Projected Standings</h3>

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
                    ${standings
                .map((team, index) => {
                    const teamInfo = teams[team.team];

                    let rowClass = "";

                    if (index === 0 || index === 1) {
                        rowClass = "qualified-row";
                    }
                    else if (index === 2) {
                        rowClass = "third-place-row";
                    }

                    return `
    <tr class="${rowClass}">
        <td>${index + 1}</td>

        <td>
            ${teamInfo.flag}
            ${teamInfo.shortName}
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
                })
                .join("")}
                </tbody>
            </table>
        `;
    });
}

renderMatches();

/////

function renderThirdPlaceSection(
    qualifiedTeamsForStandings,
    bestThirdPlaces,
    thirdPlaceKey,
    thirdPlaceAllocation
) {
    const bestContainer =
        document.getElementById("best-third-places-container");

    const keyContainer =
        document.getElementById("third-place-key-container");

    const allocationContainer =
        document.getElementById("third-place-allocation-container");

    if (!bestContainer || !keyContainer || !allocationContainer) {
        return;
    }

    const allThirdPlaces =
        Object.values(qualifiedTeamsForStandings)
            .map((group) => group.thirdPlace)
            .filter((team) => team && team.team);

    const sortedThirdPlaces =
        [...allThirdPlaces].sort((a, b) => {
            if (b.points !== a.points) {
                return b.points - a.points;
            }

            if (b.goalDifference !== a.goalDifference) {
                return b.goalDifference - a.goalDifference;
            }

            if (b.goalsFor !== a.goalsFor) {
                return b.goalsFor - a.goalsFor;
            }

            return (a.group || "").localeCompare(b.group || "");
        });

    bestContainer.innerHTML = `
        <h2 class="best-third-placed-teams">Best Third-Placed Teams</h2>

        ${sortedThirdPlaces
            .map((team, index) => {

                const teamInfo = teams[team.team];

                const qualified =
                    bestThirdPlaces.some(
                        (best) => best.team === team.team
                    );

                return `
                    <div class="third-place-list-row ${qualified ? "qualified-third" : "eliminated-third"}">
                        <span>${index + 1}.</span>
<span>
    ${teamInfo.flag}
    ${teamInfo.shortName}
</span>

<span class="group-badge">
    Group ${team.group}
</span>                        <span>${team.points} pts</span>
                        <span>GD ${team.goalDifference}</span>
                        <span>GF ${team.goalsFor}</span>
                    </div>
                `;
            })
            .join("")}
    `;

    keyContainer.innerHTML = `
        <h3 class="third-place-pattern">FIFA Third-Place Pattern</h3>
        <p class="third-place-key">${thirdPlaceKey || "Waiting for predictions..."}</p>
    `;

    allocationContainer.innerHTML = `
        <h3>FIFA Allocation</h3>

        <div class="third-place-allocation-grid">
            ${thirdPlaceAllocation
            ? Object.entries(thirdPlaceAllocation)
                .map(([slot, assigned]) => {
                    return `
                            <div>
                                <strong>${slot}</strong>
                                →
                                <span>${assigned}</span>
                            </div>
                        `;
                })
                .join("")
            : "Waiting for allocation..."
        }
        </div>
    `;
}

//////

function getKnockoutMatchWinners() {
    const winners = {};

    knockoutMatches.forEach((match) => {
        const knockoutPhases = [
            "ROUND_OF_32",
            "ROUND_OF_16",
            "QUARTERFINAL",
            "SEMIFINAL",
            "THIRD_PLACE",
            "FINAL"

        ];

        if (!knockoutPhases.includes(match.phase)) {
            return;
        }

        const prediction =
            knockoutPredictions[match.matchId];

        if (!prediction) {
            return;
        }

        if (prediction.home === "" || prediction.away === "") {
            return;
        }

        const homeGoals = Number(prediction.home);
        const awayGoals = Number(prediction.away);

        const resolvedMatch =
            currentResolvedKnockoutMatches.find(
                (resolved) => resolved.matchId === match.matchId
            );

        if (!resolvedMatch) {
            return;
        }

        const matchNumber =
            Number(match.matchId.replace("match", ""));

        let winner = null;
        let loser = null;

        if (homeGoals === awayGoals) {
            const selectedWinner =
                document.querySelector(
                    `input[name="${match.matchId}-winner"]:checked`
                );

            if (!selectedWinner) {
                return;
            }

            winner =
                selectedWinner.value === "home"
                    ? resolvedMatch.homeTeam
                    : resolvedMatch.awayTeam;

            loser =
                selectedWinner.value === "home"
                    ? resolvedMatch.awayTeam
                    : resolvedMatch.homeTeam;
        }
        else {
            winner =
                homeGoals > awayGoals
                    ? resolvedMatch.homeTeam
                    : resolvedMatch.awayTeam;

            loser =
                homeGoals > awayGoals
                    ? resolvedMatch.awayTeam
                    : resolvedMatch.homeTeam;
        }

        winners[`W${matchNumber}`] = winner;

        if (match.phase === "SEMIFINAL") {
            winners[`L${matchNumber}`] = loser;
        }
    });

    return winners;
}

////

function updateKnockoutWinnersOnly(changedPhase) {
    let fullKnockout = [];

    for (let i = 0; i < 4; i++) {
        const matchWinners =
            getKnockoutMatchWinners();



        fullKnockout =
            resolveKnockoutMatches(
                knockoutMatches,
                lastQualifiedTeamsForBracket,
                matchWinners,
                lastBestThirdPlaces,
                lastThirdPlaceAllocation
            );

        currentResolvedKnockoutMatches = fullKnockout;
    }

    const finalMatchWinners =
        getKnockoutMatchWinners();

    console.log(finalMatchWinners);

    if (changedPhase === "ROUND_OF_32") {
        renderRoundOf16(fullKnockout);
        renderQuarterfinals(fullKnockout);
        renderSemifinals(fullKnockout);
        renderThirdPlace(fullKnockout);
        renderFinal(fullKnockout);
    }

    if (changedPhase === "ROUND_OF_16") {
        renderQuarterfinals(fullKnockout);
        renderSemifinals(fullKnockout);
        renderThirdPlace(fullKnockout);
        renderFinal(fullKnockout);
    }

    if (changedPhase === "QUARTERFINAL") {
        renderSemifinals(fullKnockout);
        renderThirdPlace(fullKnockout);
        renderFinal(fullKnockout);
    }

    if (changedPhase === "SEMIFINAL") {
        renderThirdPlace(fullKnockout);
        renderFinal(fullKnockout);
    }
    renderFinalResults();
}

////

function renderRoundOf16(
    knockoutMatchesResolved
) {
    renderKnockoutPhase(
        knockoutMatchesResolved,
        "ROUND_OF_16",
        roundOf16Container
    );
}

////

function renderKnockoutPhase(
    knockoutMatchesResolved,
    phase,
    container
) {
    container.innerHTML = "";

    const matches =
        knockoutMatchesResolved.filter((match) => {
            return match.phase === phase;
        });

    matches.forEach((match) => {

        const homeTeam =
            teams[match.homeTeam];

        const awayTeam =
            teams[match.awayTeam];

        if (!homeTeam || !awayTeam) {
            return;
        }

        const matchDiv =
            document.createElement("div");

        matchDiv.classList.add("match-card");

        matchDiv.innerHTML = `
            <p class="slot-label">
                ${match.homeSlot} vs ${match.awaySlot}
            </p>

            <div class="match-score-row">

                <span class="team-name">
                    ${homeTeam.flag}
                    ${homeTeam.shortName}
                </span>

                <input
    id="${match.matchId}-home"
    type="number"
    min="0"
    placeholder=""
    value="${knockoutPredictions[match.matchId]?.home ?? ""}"
>

<span class="score-divider">-</span>

<input
    id="${match.matchId}-away"
    type="number"
    min="0"
    placeholder=""
    value="${knockoutPredictions[match.matchId]?.away ?? ""}"
>

                <span class="team-name">
                    ${awayTeam.flag}
                    ${awayTeam.shortName}
                </span>

            </div>

<div class="tie-breaker" id="${match.matchId}-tie-breaker" style="display: none;">
    <p>Who advances?</p>

    <label>
        <input
            type="radio"
            name="${match.matchId}-winner"
            value="home"
        >
        ${homeTeam.flag} ${homeTeam.shortName}
    </label>

    <label>
        <input
            type="radio"
            name="${match.matchId}-winner"
            value="away"
        >
        ${awayTeam.flag} ${awayTeam.shortName}
    </label>
</div>

            <p>
                ${homeTeam.name}
                vs
                ${awayTeam.name}
            </p>
        `;

        container.appendChild(matchDiv);

        const inputs =
            matchDiv.querySelectorAll("input");

        inputs.forEach((input) => {
            input.addEventListener("input", () => {
                knockoutPredictions[match.matchId] = {
                    home: document.getElementById(`${match.matchId}-home`).value,
                    away: document.getElementById(`${match.matchId}-away`).value
                };

                const homeGoals =
                    knockoutPredictions[match.matchId].home;

                const awayGoals =
                    knockoutPredictions[match.matchId].away;

                const tieBreaker =
                    document.getElementById(`${match.matchId}-tie-breaker`);

                if (
                    homeGoals !== "" &&
                    awayGoals !== "" &&
                    Number(homeGoals) === Number(awayGoals)
                ) {
                    tieBreaker.style.display = "block";
                }
                else {
                    tieBreaker.style.display = "none";
                }

                updateKnockoutWinnersOnly(match.phase);
            });
        });
    });
}

////

function renderQuarterfinals(
    knockoutMatchesResolved
) {
    renderKnockoutPhase(
        knockoutMatchesResolved,
        "QUARTERFINAL",
        quarterfinalsContainer
    );
}

////

function renderSemifinals(
    knockoutMatchesResolved
) {
    renderKnockoutPhase(
        knockoutMatchesResolved,
        "SEMIFINAL",
        semifinalsContainer
    );
}

////

function renderThirdPlace(knockoutMatchesResolved) {
    renderKnockoutPhase(
        knockoutMatchesResolved,
        "THIRD_PLACE",
        thirdPlaceContainer
    );
}

/////

function renderFinal(
    knockoutMatchesResolved
) {
    renderKnockoutPhase(
        knockoutMatchesResolved,
        "FINAL",
        finalContainer
    );
}

////

function renderFinalResults() {
    const matchWinners =
        getKnockoutMatchWinners();

    const thirdPlaceTeam =
        teams[matchWinners.W103];

    const championTeam =
        teams[matchWinners.W104];

    thirdPlaceResult.innerHTML = thirdPlaceTeam
        ? `
        <h2 class="third-place-pr">🥉 Third Place</h2>
        <p>
            ${thirdPlaceTeam.flag} ${thirdPlaceTeam.name}
        </p>
    `
        : "";

    championResult.innerHTML = championTeam
        ? `
        <h2>🏆 World Champion</h2>
        <p class="podium-team">
            ${championTeam.flag} ${championTeam.name}
        </p>
    `
        : "";
}

////

