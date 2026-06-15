import { getSnapshot, jsonError, verifyAdminPin } from "@/lib/api";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import { buildTournamentMatches, calculateStandings, nextTournamentSlot } from "@/lib/tournament";
import type { Match, Participant, PublicParticipant } from "@/lib/types";

const PLAYOFF_ROUND_OFFSET = 1000;
const PLAYOFF_ROUND_SPAN = 100;

export async function POST(request: Request, { params }: { params: { slug: string } }) {
  const body = (await request.json()) as { adminPin?: string; rankStart?: number; rankEnd?: number };
  const tournament = await verifyAdminPin(params.slug, body.adminPin ?? "");
  if (!tournament) return jsonError("管理者PINが違います。", 403);
  if (tournament.format !== "league") return jsonError("決勝トーナメントはリーグ戦大会で作成できます。");

  const rankStart = Number(body.rankStart ?? 1);
  const rankEnd = Number(body.rankEnd ?? rankStart);
  if (!Number.isInteger(rankStart) || !Number.isInteger(rankEnd) || rankStart < 1 || rankEnd < rankStart || rankEnd > 8) {
    return jsonError("作成する順位トーナメントを正しく選んでください。");
  }
  const roundOffset = playoffRoundOffset(rankStart, rankEnd);

  const supabase = getSupabaseAdmin();
  const [{ data: participants }, { data: matches }] = await Promise.all([
    supabase.from("participants").select("*").eq("tournament_id", tournament.id).order("seed", { ascending: true }),
    supabase.from("matches").select("*").eq("tournament_id", tournament.id).lte("round", Math.max(tournament.block_count ?? 1, 1))
  ]);

  const publicParticipants = ((participants ?? []) as Participant[]).map(({ pin_hash: _pinHash, ...participant }) => participant);
  const leagueMatches = (matches ?? []) as Match[];
  const standings = calculateStandings(publicParticipants as PublicParticipant[], leagueMatches);
  const blockNumbers = Array.from(new Set(publicParticipants.map((participant) => participant.block_number))).sort((a, b) => a - b);

  const hasUnplayedLeagueMatches = leagueMatches.some((match) => !match.locked && match.participant1_id && match.participant2_id);
  if (hasUnplayedLeagueMatches) return jsonError("未入力のリーグ戦があります。先にブロック内の試合を入力してください。");

  const qualifiers = blockNumbers.flatMap((blockNumber) =>
    standings
      .filter((standing) => standing.blockNumber === blockNumber && standing.rank >= rankStart && standing.rank <= rankEnd)
      .sort((a, b) => a.rank - b.rank)
      .map((standing) => publicParticipants.find((participant) => participant.id === standing.participantId))
      .filter(Boolean)
  ) as PublicParticipant[];

  if (qualifiers.length < 2) return jsonError(`${playoffTitle(rankStart, rankEnd)}には2名以上の進出者が必要です。`);

  await supabase
    .from("matches")
    .delete()
    .eq("tournament_id", tournament.id)
    .gte("round", roundOffset)
    .lt("round", roundOffset + PLAYOFF_ROUND_SPAN);

  const bracketMatches = buildTournamentMatches(seedQualifiers(qualifiers, rankStart, rankEnd)).map((match) => ({
    ...match,
    round: match.round + roundOffset,
    tournament_id: tournament.id
  }));

  const { data: inserted, error } = await supabase
    .from("matches")
    .insert(bracketMatches)
    .select("*")
    .order("round", { ascending: true })
    .order("position", { ascending: true });

  if (error) return jsonError(`${playoffTitle(rankStart, rankEnd)}を作成できませんでした。`, 500);

  await advancePlayoffByes(tournament.id, roundOffset);

  const snapshot = await getSnapshot(params.slug);
  return Response.json(snapshot);
}

function seedQualifiers(qualifiers: PublicParticipant[], rankStart: number, rankEnd: number) {
  if (rankStart === rankEnd) return qualifiers;

  const ranksPerBlock = rankEnd - rankStart + 1;
  const seeded: PublicParticipant[] = [];
  for (let rankIndex = 0; rankIndex < ranksPerBlock; rankIndex += 1) {
    const rankGroup = qualifiers.filter((_, index) => index % ranksPerBlock === rankIndex);
    seeded.push(...(rankIndex % 2 === 0 ? rankGroup : rankGroup.reverse()));
  }
  return seeded;
}

async function advancePlayoffByes(tournamentId: string, roundOffset: number) {
  const supabase = getSupabaseAdmin();
  let changed = true;

  while (changed) {
    changed = false;
    const { data } = await supabase
      .from("matches")
      .select("*")
      .eq("tournament_id", tournamentId)
      .gte("round", roundOffset)
      .lt("round", roundOffset + PLAYOFF_ROUND_SPAN)
      .order("round", { ascending: true })
      .order("position", { ascending: true });

    for (const match of (data ?? []) as Match[]) {
      const winner =
        match.participant1_id && !match.participant2_id
          ? match.participant1_id
          : match.participant2_id && !match.participant1_id
            ? match.participant2_id
            : null;

      if (!winner || match.winner_id === winner) continue;

      await supabase.from("matches").update({ winner_id: winner, locked: true }).eq("id", match.id);

      const next = nextTournamentSlot(match.round, match.position);
      const { data: nextMatch } = await supabase
        .from("matches")
        .select("id")
        .eq("tournament_id", tournamentId)
        .eq("round", next.round)
        .eq("position", next.position)
        .maybeSingle();

      if (nextMatch) {
        await supabase
          .from("matches")
          .update({ [next.side]: winner })
          .eq("tournament_id", tournamentId)
          .eq("round", next.round)
          .eq("position", next.position);
      }

      changed = true;
    }
  }
}

function playoffRoundOffset(rankStart: number, rankEnd: number) {
  return PLAYOFF_ROUND_OFFSET + rankStart * 100 + rankEnd * 10;
}

function playoffTitle(rankStart: number, rankEnd: number) {
  return rankStart === rankEnd ? `${rankStart}位トーナメント` : `${rankStart}位-${rankEnd}位トーナメント`;
}
