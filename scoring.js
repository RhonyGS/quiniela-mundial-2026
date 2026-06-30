import { groups } from "./groups.js";
import { teams } from "./teams.js";

import {
    calculateGroupStandings
} from "./tournament.js";

export function calculatePoints(
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

export function getMatchNumber(matchId) {
    return Number(matchId.replace("match", ""));
}

export function isKnockoutMatch(match) {
    return match.phase !== "GROUP_STAGE";
}

export function getRealWinner(match) {
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

//Puntos bonus por clasificados y posiciones
export function getPredictedGroupStandings(matches, predictions) {
    const standingsByGroup = {};

    Object.keys(groups).forEach((group) => {
        const groupMatches = matches
            .filter((match) => {
                return (
                    match.phase === "GROUP_STAGE" &&
                    match.group === group
                );
            })
            .map((match) => {
                const prediction = predictions[match.matchId];

                return {
                    ...match,
                    homeGoals: prediction.homeGoals,
                    awayGoals: prediction.awayGoals,
                    finished: true
                };
            });

        standingsByGroup[group] =
            calculateGroupStandings(groups[group], groupMatches);
    });

    return standingsByGroup;
}

export function getRealGroupStandings(matches) {
    const standingsByGroup = {};

    Object.keys(groups).forEach((group) => {
        const groupMatches = matches.filter((match) => {
            return (
                match.phase === "GROUP_STAGE" &&
                match.group === group &&
                match.finished === true
            );
        });

        if (groupMatches.length < 6) {
            return;
        }

        standingsByGroup[group] =
            calculateGroupStandings(groups[group], groupMatches);
    });

    return standingsByGroup;
}

export function getRoundOf32Teams(standingsByGroup) {
    const qualifiedTeams = [];
    const thirdPlaceTeams = [];

    Object.keys(standingsByGroup).forEach((group) => {
        const standings = standingsByGroup[group];

        qualifiedTeams.push(standings[0].team);
        qualifiedTeams.push(standings[1].team);

        thirdPlaceTeams.push({
            group,
            team: standings[2].team,
            points: standings[2].points,
            goalDifference: standings[2].goalDifference,
            goalsFor: standings[2].goalsFor
        });
    });

    thirdPlaceTeams.sort((a, b) => {
        if (b.points !== a.points) return b.points - a.points;
        if (b.goalDifference !== a.goalDifference) return b.goalDifference - a.goalDifference;
        return b.goalsFor - a.goalsFor;
    });

    thirdPlaceTeams.slice(0, 8).forEach((team) => {
        qualifiedTeams.push(team.team);
    });

    return qualifiedTeams;
}

export function countMatchingTeams(predictedTeams, realTeams) {
    let count = 0;

    predictedTeams.forEach((team) => {
        if (realTeams.includes(team)) {
            count++;
        }
    });

    return count;
}

export function getRealWinnersByRange(matches, start, end) {
    const winners = [];

    matches.forEach((match) => {
        const matchNumber = getMatchNumber(match.matchId);

        if (
            matchNumber >= start &&
            matchNumber <= end &&
            match.finished === true
        ) {
            const winner = getRealWinner(match);

            if (winner) {
                winners.push(winner);
            }
        }
    });

    return winners;
}

export function getPredictedWinnersByRange(knockoutWinners, start, end) {
    const winners = [];

    for (let matchNumber = start; matchNumber <= end; matchNumber++) {
        const winner = knockoutWinners?.[`W${matchNumber}`];

        if (winner) {
            winners.push(winner);
        }
    }

    return winners;
}

export function getMatchupBonusValue(phase) {
    if (phase === "ROUND_OF_32") return 2;
    if (phase === "ROUND_OF_16") return 3;
    if (phase === "QUARTERFINAL") return 5;
    if (phase === "SEMIFINAL") return 7;
    if (phase === "FINAL") return 10;

    return 0;
}

export function calculateGroupBonus(matches, data) {
    let points = 0;

    const qualifiers = [];
    const positions = [];

    const predictedStandings =
        getPredictedGroupStandings(matches, data.predictions);

    const realStandings =
        getRealGroupStandings(matches);

    // +1 exact group position
    Object.keys(realStandings).forEach((group) => {
        realStandings[group].forEach((realTeam, index) => {
            const predictedTeam =
                predictedStandings[group]?.[index];

            const correct =
                predictedTeam &&
                predictedTeam.team === realTeam.team;

            if (correct) {
                points += 1;
            }

            positions.push({
                group,
                team: realTeam.team,
                position: index + 1,
                correct,
                points: correct ? 1 : 0
            });
        });
    });

    // +2 Round of 32 qualifier
    if (Object.keys(realStandings).length === 12) {
        const predictedR32Teams =
            getRoundOf32Teams(predictedStandings);

        const realR32Teams =
            getRoundOf32Teams(realStandings);

        realR32Teams.forEach((team) => {
            const correct =
                predictedR32Teams.includes(team);

            if (correct) {
                points += 2;
            }

            qualifiers.push({
                team,
                correct,
                points: correct ? 2 : 0
            });
        });
    }

    return {
        points,
        qualifiers,
        positions
    };
}

export function calculateMatchupBonus(matches, data) {
    const breakdown = {
        round32: 0,
        round16: 0,
        quarterfinals: 0,
        semifinals: 0,
        final: 0,
        total: 0
    };

    matches.forEach((match) => {
        if (
            match.finished !== true ||
            match.phase === "GROUP_STAGE" ||
            match.phase === "THIRD_PLACE"
        ) {
            return;
        }

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

        if (match.phase === "ROUND_OF_32") breakdown.round32++;
        if (match.phase === "ROUND_OF_16") breakdown.round16++;
        if (match.phase === "QUARTERFINAL") breakdown.quarterfinals++;
        if (match.phase === "SEMIFINAL") breakdown.semifinals++;
        if (match.phase === "FINAL") breakdown.final++;
    });

    breakdown.total =
        breakdown.round32 * 2 +
        breakdown.round16 * 3 +
        breakdown.quarterfinals * 5 +
        breakdown.semifinals * 7 +
        breakdown.final * 10;

    return breakdown;
}

export function calculateProgressionBonus(matches, data) {
    const knockoutWinners =
        data.knockoutWinners || {};

    const breakdown = {
        round16: countMatchingTeams(
            getPredictedWinnersByRange(knockoutWinners, 73, 88),
            getRealWinnersByRange(matches, 73, 88)
        ),

        quarterfinals: countMatchingTeams(
            getPredictedWinnersByRange(knockoutWinners, 89, 96),
            getRealWinnersByRange(matches, 89, 96)
        ),

        semifinals: countMatchingTeams(
            getPredictedWinnersByRange(knockoutWinners, 97, 100),
            getRealWinnersByRange(matches, 97, 100)
        ),

        finalists: countMatchingTeams(
            getPredictedWinnersByRange(knockoutWinners, 101, 102),
            getRealWinnersByRange(matches, 101, 102)
        ),

        total: 0
    };

    breakdown.total =
        breakdown.round16 * 3 +
        breakdown.quarterfinals * 5 +
        breakdown.semifinals * 8 +
        breakdown.finalists * 12;

    return breakdown;
}

export function calculateChampionBonus(matches, data) {
    const finalMatch =
        matches.find((match) => match.matchId === "match104");

    if (!finalMatch || finalMatch.finished !== true) {
        return {
            pending: true,
            correct: false,
            total: 0
        };
    }

    const realChampion =
        getRealWinner(finalMatch);

    const predictedChampion =
        data.knockoutWinners?.W104;

    const correct =
        realChampion &&
        predictedChampion === realChampion;

    return {
        pending: false,
        correct,
        total: correct ? 25 : 0
    };
}

export function calculateBonusPoints(matches, data) {
    const groupBonus =
        calculateGroupBonus(matches, data);

    const matchupBonus =
        calculateMatchupBonus(matches, data);

    const progressionBonus =
        calculateProgressionBonus(matches, data);

    const championBonus =
        calculateChampionBonus(matches, data);

    return {
        total:
            groupBonus.points +
            matchupBonus.total +
            progressionBonus.total +
            championBonus.total,

        groupBonus,
        matchupBonus,
        progressionBonus,
        championBonus
    };
}