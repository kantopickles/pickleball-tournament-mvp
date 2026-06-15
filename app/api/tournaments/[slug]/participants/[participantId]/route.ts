import { getSnapshot, jsonError, verifyAdminPin } from "@/lib/api";
import { getSupabaseAdmin } from "@/lib/supabase-admin";

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

  const snapshot = await getSnapshot(params.slug);
  return Response.json(snapshot);
}
