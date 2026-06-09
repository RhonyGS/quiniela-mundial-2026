import { thirdPlaceMapping } from "./thirdPlaceMapping.js";

export function calculateGroupStandings(teams, matches) {
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

//////

export function getQualifiedTeams(standings) {
    return {
        firstPlace: standings[0],
        secondPlace: standings[1],
        thirdPlace: standings[2]
    };
}
//////

export function resolveSlot(slot, qualifiedTeams, matchWinners, bestThirdPlaces) {
    if (slot.startsWith("W") || slot.startsWith("L")) {
        return matchWinners[slot];
    }

    if (slot.startsWith("3") && slot.length > 2) {
        const allowedGroups = slot.slice(1).split("");

        const selectedThird = bestThirdPlaces.find((thirdPlace) => {
            return allowedGroups.includes(thirdPlace.group);
        });

        if (!selectedThird) {
            return null;
        }

        return selectedThird.team;
    }

    const position = slot[0];
    const group = slot[1];

    const groupQualified = qualifiedTeams[group];

    if (position === "1") {
        return groupQualified.firstPlace.team;
    }

    if (position === "2") {
        return groupQualified.secondPlace.team;
    }

    if (position === "3") {
        return groupQualified.thirdPlace.team;
    }

    return null;
}

////

export function resolveKnockoutMatches(
    knockoutMatches,
    qualifiedTeams,
    matchWinners,
    bestThirdPlaces,
    thirdPlaceAllocation = {}
) {
    return knockoutMatches.map((match) => {
        const resolvedHomeSlot =
            resolveThirdPlaceSlot(
                match.homeSlot,
                match.awaySlot,
                thirdPlaceAllocation
            );

        const resolvedAwaySlot =
            resolveThirdPlaceSlot(
                match.awaySlot,
                match.homeSlot,
                thirdPlaceAllocation
            );

        return {
            matchId: match.matchId,
            phase: match.phase,

            homeSlot: match.homeSlot,
            awaySlot: match.awaySlot,

            resolvedHomeSlot,
            resolvedAwaySlot,

            homeTeam: resolveSlot(
                resolvedHomeSlot,
                qualifiedTeams,
                matchWinners,
                bestThirdPlaces
            ),

            awayTeam: resolveSlot(
                resolvedAwaySlot,
                qualifiedTeams,
                matchWinners,
                bestThirdPlaces
            )
        };
    });
}

//////

function resolveThirdPlaceSlot(
    slot,
    opponentSlot,
    thirdPlaceAllocation
) {
    const isThirdPlacePlaceholder =
        slot.startsWith("3") && slot.length > 2;

    if (!isThirdPlacePlaceholder) {
        return slot;
    }

    return thirdPlaceAllocation[opponentSlot] || slot;
}

/////
export function getMatchesByGroup(matches, group) {
    return matches.filter((match) => {
        return match.group === group;
    });
}

///

export function getGroupTeams(groups, groupName) {
    return groups[groupName];
}

///

export function getFinishedMatches(matches) {
    return matches.filter((match) => {
        return match.finished === true;
    });
}

//

export function getFinishedMatchesByGroup(
    matches,
    group
) {
    return matches.filter((match) => {
        return (
            match.group === group &&
            match.finished === true
        );
    });
}

//

export function calculateGroupFromMatches(
    groupName,
    groups,
    matches
) {
    const teams = groups[groupName];

    const groupMatches = matches.filter((match) => {
        return (
            match.group === groupName &&
            match.finished === true
        );
    });

    return calculateGroupStandings(
        teams,
        groupMatches
    );
}

///////
export function getBestThirdPlaceTeams(allQualifiedTeams, limit = 8) {
    const thirdPlaceTeams = [];

    Object.keys(allQualifiedTeams).forEach((group) => {
        thirdPlaceTeams.push({
            group: group,
            team: allQualifiedTeams[group].thirdPlace.team,
            points: allQualifiedTeams[group].thirdPlace.points,
            goalDifference: allQualifiedTeams[group].thirdPlace.goalDifference,
            goalsFor: allQualifiedTeams[group].thirdPlace.goalsFor
        });
    });

    thirdPlaceTeams.sort((a, b) => {
        if (b.points !== a.points) {
            return b.points - a.points;
        }

        if (b.goalDifference !== a.goalDifference) {
            return b.goalDifference - a.goalDifference;
        }

        return b.goalsFor - a.goalsFor;
    });

    return thirdPlaceTeams.slice(0, limit);
}

////

export function buildQualifiedTeams(groups, matches) {
    const qualifiedTeams = {};

    Object.keys(groups).forEach((group) => {

        const groupMatches =
            matches.filter((match) => {
                return (
                    match.group === group &&
                    match.finished === true
                );
            });

        const standings =
            calculateGroupStandings(
                groups[group],
                groupMatches
            );

        qualifiedTeams[group] =
            getQualifiedTeams(standings);

        qualifiedTeams[group] = {
            firstPlace: {
                ...standings[0],
                group
            },
            secondPlace: {
                ...standings[1],
                group
            },
            thirdPlace: {
                ...standings[2],
                group
            }
        };
    });

    return qualifiedTeams;
}

///Mejores terceros
export function getThirdPlaceKey(bestThirdPlaces) {
    return bestThirdPlaces
        .map(team => team.group)
        .sort()
        .join("");
}