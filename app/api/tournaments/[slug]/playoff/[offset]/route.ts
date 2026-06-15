import { getSnapshot, jsonError, verifyAdminPin } from "@/lib/api";
import { getSupabaseAdmin } from "@/lib/supabase-admin";

const PLAYOFF_ROUND_SPAN = 100;

export async function DELETE(request: Request, { params }: { params: { slug: string; offset: string } }) {
  const body = (await request.json()) as { adminPin?: string };
  const tournament = await verifyAdminPin(params.slug, body.adminPin ?? "");
  if (!tournament) return jsonError("管理者PINが違います。", 403);

  const offset = Number(params.offset);
  if (!Number.isInteger(offset) || offset < 100) return jsonError("削除するトーナメントを選べませんでした。");

  const supabase = getSupabaseAdmin();
  const { error } = await supabase
    .from("matches")
    .delete()
    .eq("tournament_id", tournament.id)
    .gte("round", offset)
    .lt("round", offset + PLAYOFF_ROUND_SPAN);

  if (error) return jsonError("トーナメントを削除できませんでした。", 500);

  const snapshot = await getSnapshot(params.slug);
  return Response.json(snapshot);
}
