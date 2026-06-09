import { knockoutMatches } from "./knockout-config.js";

import { matches } from "./matches.js";

import {
    getMatchesByGroup,
    getGroupTeams,
    getFinishedMatchesByGroup,
    calculateGroupFromMatches,
    getQualifiedTeams,
    getBestThirdPlaceTeams,
    buildQualifiedTeams
} from "./tournament.js";

import { groups } from "./groups.js";

import { teams } from "./teams.js";


//Grupo A
const groupTeams = ["usa", "mexico", "japan", "ghana"];

const groupMatches = [
    {
        homeTeam: "usa",
        awayTeam: "mexico",
        homeGoals: 2,
        awayGoals: 1
    },
    {
        homeTeam: "japan",
        awayTeam: "ghana",
        homeGoals: 1,
        awayGoals: 1
    },
    {
        homeTeam: "usa",
        awayTeam: "japan",
        homeGoals: 3,
        awayGoals: 0
    },
    {
        homeTeam: "mexico",
        awayTeam: "ghana",
        homeGoals: 2,
        awayGoals: 2
    }
];


//Grupo B
const groupBTeams = [
    "spain",
    "germany",
    "morocco",
    "canada"
];

const groupBMatches = [
    {
        homeTeam: "spain",
        awayTeam: "germany",
        homeGoals: 2,
        awayGoals: 0
    },
    {
        homeTeam: "morocco",
        awayTeam: "canada",
        homeGoals: 1,
        awayGoals: 1
    },
    {
        homeTeam: "spain",
        awayTeam: "morocco",
        homeGoals: 1,
        awayGoals: 0
    },
    {
        homeTeam: "germany",
        awayTeam: "canada",
        homeGoals: 3,
        awayGoals: 1
    }
];

function calculateGroupStandings(teams, matches) {
    const standings = {};

    teams.forEach((team) => {
        standings[team] = {
            team: team,
            points: 0,
            played: 0,
            wins: 0,
            draws: 0,
            losses: 0,
            goalsFor: 0,
            goalsAgainst: 0,
            goalDifference: 0
        };
    });

    matches.forEach((match) => {
        const home = standings[match.homeTeam];
        const away = standings[match.awayTeam];

        home.played++;
        away.played++;

        home.goalsFor += match.homeGoals;
        home.goalsAgainst += match.awayGoals;

        away.goalsFor += match.awayGoals;
        away.goalsAgainst += match.homeGoals;

        home.goalDifference =
            home.goalsFor - home.goalsAgainst;

        away.goalDifference =
            away.goalsFor - away.goalsAgainst;

        if (match.homeGoals > match.awayGoals) {
            home.points += 3;
            home.wins++;
            away.losses++;
        } else if (match.homeGoals < match.awayGoals) {
            away.points += 3;
            away.wins++;
            home.losses++;
        } else {
            home.points += 1;
            away.points += 1;
            home.draws++;
            away.draws++;
        }
    });

    const standingsArray = Object.values(standings);

    standingsArray.sort((a, b) => {
        if (b.points !== a.points) {
            return b.points - a.points;
        }

        if (b.goalDifference !== a.goalDifference) {
            return b.goalDifference - a.goalDifference;
        }

        return b.goalsFor - a.goalsFor;
    });

    return standingsArray;
}

//Creacion automatica de match
function createMatch(homeTeam, awayTeam) {
    return {
        homeTeam,
        awayTeam
    };
}

//Final
const groupATable =
    calculateGroupStandings(
        groupTeams,
        groupMatches
    );

const groupBTable =
    calculateGroupStandings(
        groupBTeams,
        groupBMatches
    );

const groupAQualified =
    getQualifiedTeams(groupATable);

const groupBQualified =
    getQualifiedTeams(groupBTable);

const qualifiedTeams =
    buildQualifiedTeams(
        groups,
        matches
    );

console.log(
    "Qualified Teams"
);

console.log(
    qualifiedTeams
);

console.log(
    "Best Third Places"
);

console.log(
    getBestThirdPlaceTeams(
        qualifiedTeams
    )
);

console.log("Grupo A");
console.log(groupAQualified);

console.log("Grupo B");
console.log(groupBQualified);

//Resolve Slot
function resolveSlot(slot, qualifiedTeams, matchWinners) {
    if (slot.startsWith("W")) {
        return matchWinners[slot];
    }

    const position = slot[0];
    const group = slot[1];

    const groupQualified = qualifiedTeams[group];

    if (position === "1") {
        return groupQualified.firstPlace;
    }

    if (position === "2") {
        return groupQualified.secondPlace;
    }

    if (position === "3") {
        return groupQualified.thirdPlace;
    }
}

const matchWinners = {};

const match73 = {
    matchId: "match073",
    homeSlot: "1A",
    awaySlot: "2B"
};

const resolvedMatch73 = {
    matchId: match73.matchId,
    homeTeam: resolveSlot(match73.homeSlot, qualifiedTeams, matchWinners),
    awayTeam: resolveSlot(match73.awaySlot, qualifiedTeams, matchWinners)
};

console.log("Resolved Match 73");
console.log(resolvedMatch73);

// Winner Slots
matchWinners["W73"] = resolvedMatch73.homeTeam;

const match89 = {
    matchId: "match089",
    homeSlot: "W73",
    awaySlot: "1B"
};

const resolvedMatch89 = {
    matchId: match89.matchId,
    homeTeam: resolveSlot(match89.homeSlot, qualifiedTeams, matchWinners),
    awayTeam: resolveSlot(match89.awaySlot, qualifiedTeams, matchWinners)
};

console.log("Resolved Match 89");
console.log(resolvedMatch89);
//----

function resolveKnockoutMatches(knockoutMatches, qualifiedTeams, matchWinners) {
    return knockoutMatches.map((match) => {
        return {
            matchId: match.matchId,
            homeTeam: resolveSlot(
                match.homeSlot,
                qualifiedTeams,
                matchWinners
            ),
            awayTeam: resolveSlot(
                match.awaySlot,
                qualifiedTeams,
                matchWinners
            )
        };
    });
}

const resolvedKnockoutMatches =
    resolveKnockoutMatches(
        knockoutMatches,
        qualifiedTeams,
        matchWinners
    );

console.log("Resolved Knockout Matches");
console.log(resolvedKnockoutMatches);

//
const groupAMatchesFromOfficial =
    getMatchesByGroup(matches, "A");

console.log("Group A matches from matches.js:");
console.log(groupAMatchesFromOfficial);

///

const groupATeamsFromGroups =
    getGroupTeams(groups, "A");

console.log("Group A teams from groups.js:");
console.log(groupATeamsFromGroups);

//

const finishedGroupA =
    getFinishedMatchesByGroup(
        matches,
        "A"
    );

console.log(
    "Finished Group A Matches:"
);

console.log(finishedGroupA);

//

const realGroupATable =
    calculateGroupFromMatches(
        "A",
        groups,
        matches
    );

console.log(
    "Real Group A Table"
);

console.log(realGroupATable);

console.log(
    teams["mexico"].flag +
    " " +
    teams["mexico"].name
);

console.log(
    teams["southAfrica"].flag +
    " " +
    teams["southAfrica"].name
);

console.log(
    "Group A matches:"
);

console.log(
    getMatchesByGroup(matches, "A")
);

console.log(
    "Group B matches:"
);

console.log(
    getMatchesByGroup(matches, "B")
);

const matchIds = matches.map((match) => {
    return Number(match.matchId.replace("match", ""));
});

matchIds.sort((a, b) => a - b);

console.log("Match IDs:");
console.log(matchIds);

for (let i = 1; i <= 72; i++) {
    if (!matchIds.includes(i)) {
        console.log("Missing match:", i);
    }
}

const duplicates = matchIds.filter((id, index) => {
    return matchIds.indexOf(id) !== index;
});

console.log("Duplicates:");
console.log(duplicates);

console.log("Total matches:", matches.length);

for (const group of ["A", "B", "C", "D", "E", "F", "G", "H", "I", "J", "K", "L"]) {
    console.log(
        "Group " + group + ":",
        getMatchesByGroup(matches, group).length
    );
}

////

Object.keys(groups).forEach((group) => {
    const groupMatches =
        getMatchesByGroup(matches, group).filter((match) => {
            return match.finished === true;
        });

    const standings =
        calculateGroupStandings(
            groups[group],
            groupMatches
        );

    qualifiedTeams[group] =
        getQualifiedTeams(standings);
});

console.log(qualifiedTeams);

console.log(
    getBestThirdPlaceTeams(
        qualifiedTeams
    )
);

console.log("Qualified Teams");
console.log(qualifiedTeams);

console.log("Best Third Places");
console.log(
    getBestThirdPlaceTeams(
        qualifiedTeams
    )
);

const bestThirdPlaces =
    getBestThirdPlaceTeams(qualifiedTeams);

const roundOf32 =
    resolveKnockoutMatches(
        knockoutMatches,
        qualifiedTeams,
        {},
        bestThirdPlaces
    );

console.log("Round of 32");
console.log(roundOf32);

console.log("ROUND OF 32");

roundOf32.forEach((match) => {
    console.log(
        match.matchId,
        match.homeTeam,
        "vs",
        match.awayTeam
    );
});