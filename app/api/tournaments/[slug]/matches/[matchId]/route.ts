import { getSnapshot, jsonError, verifyAdminPin, verifyParticipantPin } from "@/lib/api";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import { nextTournamentSlot, summarizeGameScores, winnerId } from "@/lib/tournament";
import type { GameScore, Match } from "@/lib/types";

export async function PATCH(request: Request, { params }: { params: { slug: string; matchId: string } }) {
  const body = (await request.json()) as {
    mode?: "result" | "swap" | "unlock";
    pin?: string;
    participant1Id?: string | null;
    participant2Id?: string | null;
    participantId?: string;
    participant1Score?: number;
    participant2Score?: number;
    gameScores?: GameScore[];
  };

  const supabase = getSupabaseAdmin();
  const { data: tournament } = await supabase.from("tournaments").select("*").eq("slug", params.slug).single();
  if (!tournament) return jsonError("大会が見つかりません。", 404);

  const { data: matchData } = await supabase.from("matches").select("*").eq("id", params.matchId).eq("tournament_id", tournament.id).single();
  const match = matchData as Match | null;
  if (!match) return jsonError("試合が見つかりません。", 404);

  const isAdmin = Boolean(await verifyAdminPin(params.slug, body.pin ?? ""));

  if (body.mode === "unlock") {
    if (!isAdmin) return jsonError("管理者PINが必要です。", 403);
    await supabase
      .from("matches")
      .update({ locked: false, participant1_score: null, participant2_score: null, game_scores: null, winner_id: null })
      .eq("id", match.id);
    await supabase
      .from("schedule_entries")
      .update({ status: "pending", updated_at: new Date().toISOString() })
      .eq("tournament_id", tournament.id)
      .eq("match_id", match.id);
    const snapshot = await getSnapshot(params.slug);
    return Response.json(snapshot);
  }

  if (body.mode === "swap") {
    if (!isAdmin) return jsonError("管理者PINが必要です。", 403);
    await supabase
      .from("matches")
      .update({
        participant1_id: body.participant1Id || null,
        participant2_id: body.participant2Id || null,
        participant1_score: null,
        participant2_score: null,
        game_scores: null,
        winner_id: null,
        locked: false
      })
      .eq("id", match.id);
    await supabase
      .from("schedule_entries")
      .update({ status: "pending", updated_at: new Date().toISOString() })
      .eq("tournament_id", tournament.id)
      .eq("match_id", match.id);
    const snapshot = await getSnapshot(params.slug);
    return Response.json(snapshot);
  }

  if (match.locked && !isAdmin) return jsonError("この試合は入力済みのためロックされています。", 403);
  if (!match.participant1_id || !match.participant2_id) return jsonError("対戦相手が未確定の試合です。");

  const canParticipantEdit = await verifyParticipantPin(tournament.id, body.pin ?? "");

  if (!isAdmin && !canParticipantEdit) return jsonError("この試合の参加者PIN、または管理者PINが必要です。", 403);
  if (!isAdmin) {
    if (!body.participantId) return jsonError("参加者を選択してください。", 403);
    if (body.participantId !== match.participant1_id && body.participantId !== match.participant2_id) {
      return jsonError("選択した参加者が含まれる試合だけ入力できます。", 403);
    }
  }

  const matchGameCount = Number(tournament.match_game_count ?? 1);
  const gameScores =
    matchGameCount > 1
      ? body.gameScores
      : [
          {
            participant1Score: Number(body.participant1Score),
            participant2Score: Number(body.participant2Score)
          }
        ];

  if (!Array.isArray(gameScores) || gameScores.length !== matchGameCount) {
    return jsonError(`${matchGameCount}本分の得点を入力してください。`);
  }

  for (const score of gameScores) {
    if (
      !Number.isInteger(score.participant1Score) ||
      !Number.isInteger(score.participant2Score) ||
      score.participant1Score < 0 ||
      score.participant2Score < 0
    ) {
      return jsonError("得点は0以上の整数で入力してください。");
    }
  }

  const summary = summarizeGameScores(gameScores);
  const nextWinner = winnerId({
    participant1_id: match.participant1_id,
    participant2_id: match.participant2_id,
    participant1_score: summary.participant1Score,
    participant2_score: summary.participant2Score,
    game_scores: gameScores
  });

  if (!nextWinner) return jsonError("引き分けのため勝者を決められません。");

  await supabase
    .from("matches")
    .update({
      participant1_score: summary.participant1Score,
      participant2_score: summary.participant2Score,
      game_scores: gameScores,
      winner_id: nextWinner,
      locked: true,
      updated_at: new Date().toISOString()
    })
    .eq("id", match.id);

  await supabase
    .from("schedule_entries")
    .update({ status: "completed", updated_at: new Date().toISOString() })
    .eq("tournament_id", tournament.id)
    .eq("match_id", match.id);

  if ((tournament.format === "tournament" || (tournament.format === "league" && match.round >= 100)) && nextWinner) {
    const next = nextTournamentSlot(match.round, match.position);
    await supabase
      .from("matches")
      .update({ [next.side]: nextWinner })
      .eq("tournament_id", tournament.id)
      .eq("round", next.round)
      .eq("position", next.position);
  }

  const snapshot = await getSnapshot(params.slug);
  return Response.json(snapshot);
}
