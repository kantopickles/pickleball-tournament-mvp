import { getSnapshot, jsonError, resequenceParticipantSeeds, verifyAdminPin } from "@/lib/api";
import { getSupabaseAdmin } from "@/lib/supabase-admin";

export async function PATCH(request: Request, { params }: { params: { slug: string; participantId: string } }) {
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

  const updateData: { name: string; block_number?: number } = { name };
  if (tournament.format === "league") {
    updateData.block_number = requestedBlockNumber;
  }

  const supabase = getSupabaseAdmin();
  const { error } = await supabase
    .from("participants")
    .update(updateData)
    .eq("id", params.participantId)
    .eq("tournament_id", tournament.id);

  if (error) return jsonError("参加者名を変更できませんでした。", 500);

  const snapshot = await getSnapshot(params.slug);
  return Response.json(snapshot);
}

export async function DELETE(request: Request, { params }: { params: { slug: string; participantId: string } }) {
  const body = (await request.json()) as { adminPin?: string };
  const tournament = await verifyAdminPin(params.slug, body.adminPin ?? "");
  if (!tournament) return jsonError("管理者PINが違います。", 403);

  const supabase = getSupabaseAdmin();
  const { error } = await supabase
    .from("participants")
    .delete()
    .eq("id", params.participantId)
    .eq("tournament_id", tournament.id);

  if (error) return jsonError("参加者を削除できませんでした。", 500);

  await resequenceParticipantSeeds(tournament.id);
  const snapshot = await getSnapshot(params.slug);
  return Response.json(snapshot);
}
