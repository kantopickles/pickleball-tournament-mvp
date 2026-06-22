import { getSnapshot, jsonError, resequenceParticipantSeeds, verifyAdminPin } from "@/lib/api";
import { getSupabaseAdmin } from "@/lib/supabase-admin";

export async function POST(request: Request, { params }: { params: { slug: string } }) {
  const body = (await request.json()) as { adminPin?: string; name?: string; blockNumber?: number };
  const tournament = await verifyAdminPin(params.slug, body.adminPin ?? "");
  if (!tournament) return jsonError("管理者PINが違います。", 403);

  const name = body.name?.trim();
  if (!name) return jsonError("参加者名を入力してください。");
  const blockCount = Math.max(tournament.block_count ?? 1, 1);
  const requestedBlockNumber = Number(body.blockNumber ?? 1);
  if (tournament.format === "league" && (!Number.isInteger(requestedBlockNumber) || requestedBlockNumber < 1 || requestedBlockNumber > blockCount)) {
    return jsonError("ブロックを正しく選んでください。");
  }

  const supabase = getSupabaseAdmin();
  const { data: participants, count } = await supabase
    .from("participants")
    .select("id,seed", { count: "exact" })
    .eq("tournament_id", tournament.id);

  const nextSeed = Math.max(0, ...((participants ?? []).map((participant) => participant.seed ?? 0))) + 1;

  const insertData = {
    tournament_id: tournament.id,
    name,
    pin_hash: tournament.participant_pin_hash ?? "",
    seed: nextSeed,
    block_number: tournament.format === "league" ? requestedBlockNumber : 1
  };

  const { error } = await supabase.from("participants").insert(insertData);

  if (error && tournament.format !== "league") {
    const fallback = await supabase.from("participants").insert({
      tournament_id: tournament.id,
      name,
      pin_hash: tournament.participant_pin_hash ?? "",
      seed: nextSeed
    });

    if (!fallback.error) {
      await resequenceParticipantSeeds(tournament.id);
      const snapshot = await getSnapshot(params.slug);
      return Response.json(snapshot);
    }
  }

  if (error) return jsonError("参加者を追加できませんでした。", 500);

  await resequenceParticipantSeeds(tournament.id);
  const snapshot = await getSnapshot(params.slug);
  return Response.json(snapshot);
}
