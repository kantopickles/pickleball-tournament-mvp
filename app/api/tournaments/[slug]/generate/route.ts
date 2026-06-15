import { getSnapshot, jsonError, verifyAdminPin } from "@/lib/api";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import { buildRoundRobinMatches, buildTournamentMatches, nextTournamentSlot } from "@/lib/tournament";
import type { Match } from "@/lib/types";

export async function POST(request: Request, { params }: { params: { slug: string } }) {
  const body = (await request.json()) as { adminPin?: string };
  const tournament = await verifyAdminPin(params.slug, body.adminPin ?? "");
  if (!tournament) return jsonError("管理者PINが違います。", 403);

  const supabase = getSupabaseAdmin();
  const { data: participants, error: participantsError } = await supabase
    .from("participants")
    .select("id,tournament_id,name,seed,block_number,created_at")
    .eq("tournament_id", tournament.id)
    .order("seed", { ascending: true });

  const fallbackParticipants =
    participantsError && tournament.format !== "league"
      ? await supabase
          .from("participants")
          .select("id,tournament_id,name,seed,created_at")
          .eq("tournament_id", tournament.id)
          .order("seed", { ascending: true })
      : null;

  const rawParticipants = (participants ?? fallbackParticipants?.data ?? []) as Array<{
    id: string;
    tournament_id: string;
    name: string;
    seed: number;
    block_number?: number;
    created_at: string;
  }>;
  const publicParticipants = rawParticipants.map((participant) => ({
    ...participant,
    block_number: participant.block_number ?? 1
  }));
  if (publicParticipants.length < 2) return jsonError("ドロー生成には参加者が2名以上必要です。");

  await supabase.from("matches").delete().eq("tournament_id", tournament.id);

  const seeds =
    tournament.format === "tournament"
      ? buildTournamentMatches(publicParticipants)
      : tournament.format === "league"
        ? buildLeagueMatches(publicParticipants)
        : buildRoundRobinMatches(publicParticipants);

  const { data: inserted, error } = await supabase
    .from("matches")
    .insert(seeds.map((match) => ({ ...match, tournament_id: tournament.id })))
    .select("*")
    .order("round", { ascending: true })
    .order("position", { ascending: true });

  if (error) return jsonError("ドローを生成できませんでした。", 500);

  if (tournament.format === "tournament") {
    await advanceByes(tournament.id, (inserted ?? []) as Match[]);
  }

  const snapshot = await getSnapshot(params.slug);
  return Response.json(snapshot);
}

function buildLeagueMatches(participants: Array<{ id: string; block_number?: number }>) {
  const matches: ReturnType<typeof buildRoundRobinMatches> = [];
  const blockNumbers = Array.from(new Set(participants.map((participant) => participant.block_number ?? 1))).sort((a, b) => a - b);

  blockNumbers.forEach((blockNumber) => {
    const blockParticipants = participants.filter((participant) => (participant.block_number ?? 1) === blockNumber);
    const blockMatches = buildRoundRobinMatches(blockParticipants as Parameters<typeof buildRoundRobinMatches>[0]);
    blockMatches.forEach((match, index) => {
      matches.push({
        ...match,
        round: blockNumber,
        position: index + 1
      });
    });
  });

  return matches;
}

async function advanceByes(tournamentId: string, matches: Match[]) {
  const supabase = getSupabaseAdmin();
  let changed = true;

  while (changed) {
    changed = false;
    const { data } = await supabase
      .from("matches")
      .select("*")
      .eq("tournament_id", tournamentId)
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
