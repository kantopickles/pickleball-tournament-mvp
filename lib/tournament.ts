import type { GameScore, Match, PublicParticipant, Standing } from "@/lib/types";

export function buildRoundRobinMatches(participants: PublicParticipant[]) {
  const matches: Array<Pick<Match, "round" | "position" | "participant1_id" | "participant2_id">> = [];

  participants.forEach((left, leftIndex) => {
    participants.slice(leftIndex + 1).forEach((right, rightIndex) => {
      matches.push({
        round: leftIndex + 1,
        position: rightIndex + 1,
        participant1_id: left.id,
        participant2_id: right.id
      });
    });
  });

  return matches;
}

export function buildTournamentMatches(participants: PublicParticipant[]) {
  const matches: Array<Pick<Match, "round" | "position" | "participant1_id" | "participant2_id">> = [];
  const slots: Array<PublicParticipant | null> = [...participants];
  if (slots.length % 2 === 1) {
    slots.splice(Math.ceil(slots.length / 2), 0, null);
  }
  const firstRoundMatches = Math.max(slots.length / 2, 1);

  for (let position = 1; position <= firstRoundMatches; position += 1) {
    const left = slots[(position - 1) * 2] ?? null;
    const right = slots[(position - 1) * 2 + 1] ?? null;
    matches.push({
      round: 1,
      position,
      participant1_id: left?.id ?? null,
      participant2_id: right?.id ?? null
    });
  }

  let previousRoundMatches = firstRoundMatches;
  for (let round = 2; previousRoundMatches > 1; round += 1) {
    const count = Math.ceil(previousRoundMatches / 2);
    for (let position = 1; position <= count; position += 1) {
      matches.push({
        round,
        position,
        participant1_id: null,
        participant2_id: null
      });
    }
    previousRoundMatches = count;
  }

  return matches;
}

export function calculateStandings(participants: PublicParticipant[], matches: Match[]) {
  const table = new Map<string, Standing>();

  participants.forEach((participant) => {
    table.set(participant.id, {
      participantId: participant.id,
      name: participant.name,
      played: 0,
      wins: 0,
      losses: 0,
      pointsFor: 0,
      pointsAgainst: 0,
      pointDiff: 0,
      rank: 0,
      blockNumber: participant.block_number
    });
  });

  matches.forEach((match) => {
    if (
      !match.locked ||
      !match.participant1_id ||
      !match.participant2_id ||
      match.participant1_score === null ||
      match.participant2_score === null
    ) {
      return;
    }

    const player1 = table.get(match.participant1_id);
    const player2 = table.get(match.participant2_id);
    if (!player1 || !player2) return;

    player1.played += 1;
    player2.played += 1;
    player1.pointsFor += match.participant1_score;
    player1.pointsAgainst += match.participant2_score;
    player2.pointsFor += match.participant2_score;
    player2.pointsAgainst += match.participant1_score;

    if (match.winner_id === match.participant1_id) {
      player1.wins += 1;
      player2.losses += 1;
    } else if (match.winner_id === match.participant2_id) {
      player2.wins += 1;
      player1.losses += 1;
    }
  });

  const standings = Array.from(table.values()).map((standing) => ({
    ...standing,
    pointDiff: standing.pointsFor - standing.pointsAgainst
  }));

  standings.sort((a, b) => {
    if (a.blockNumber !== b.blockNumber) return a.blockNumber - b.blockNumber;
    if (b.wins !== a.wins) return b.wins - a.wins;
    if (b.pointDiff !== a.pointDiff) return b.pointDiff - a.pointDiff;
    const headToHead = compareHeadToHead(a.participantId, b.participantId, matches);
    if (headToHead !== 0) return headToHead;
    if (b.pointsFor !== a.pointsFor) return b.pointsFor - a.pointsFor;
    return a.name.localeCompare(b.name, "ja");
  });

  let currentBlock = 0;
  let rank = 0;

  return standings.map((standing) => {
    if (standing.blockNumber !== currentBlock) {
      currentBlock = standing.blockNumber;
      rank = 1;
    } else {
      rank += 1;
    }

    return { ...standing, rank };
  });
}

function compareHeadToHead(leftId: string, rightId: string, matches: Match[]) {
  const match = matches.find(
    (item) =>
      item.locked &&
      item.participant1_score !== null &&
      item.participant2_score !== null &&
      ((item.participant1_id === leftId && item.participant2_id === rightId) ||
        (item.participant1_id === rightId && item.participant2_id === leftId))
  );

  if (!match?.winner_id) return 0;
  if (match.winner_id === leftId) return -1;
  if (match.winner_id === rightId) return 1;
  return 0;
}

export function winnerId(match: Pick<Match, "participant1_id" | "participant2_id" | "participant1_score" | "participant2_score" | "game_scores">) {
  if (match.game_scores?.length) {
    const gameWins = countGameWins(match.game_scores);
    if (gameWins.participant1Wins === gameWins.participant2Wins) return null;
    return gameWins.participant1Wins > gameWins.participant2Wins ? match.participant1_id : match.participant2_id;
  }

  if (match.participant1_score === null || match.participant2_score === null) return null;
  if (match.participant1_score === match.participant2_score) return null;
  return match.participant1_score > match.participant2_score ? match.participant1_id : match.participant2_id;
}

export function summarizeGameScores(gameScores: GameScore[]) {
  return gameScores.reduce(
    (summary, score) => ({
      participant1Score: summary.participant1Score + score.participant1Score,
      participant2Score: summary.participant2Score + score.participant2Score
    }),
    { participant1Score: 0, participant2Score: 0 }
  );
}

function countGameWins(gameScores: GameScore[]) {
  return gameScores.reduce(
    (summary, score) => ({
      participant1Wins: summary.participant1Wins + (score.participant1Score > score.participant2Score ? 1 : 0),
      participant2Wins: summary.participant2Wins + (score.participant2Score > score.participant1Score ? 1 : 0)
    }),
    { participant1Wins: 0, participant2Wins: 0 }
  );
}

export function nextTournamentSlot(round: number, position: number) {
  return {
    round: round + 1,
    position: Math.ceil(position / 2),
    side: position % 2 === 1 ? "participant1_id" : "participant2_id"
  } as const;
}
