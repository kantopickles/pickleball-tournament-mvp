import { getSnapshot, jsonError, verifyAdminPin } from "@/lib/api";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import { NextResponse } from "next/server";

export async function GET(_request: Request, { params }: { params: { slug: string } }) {
  const snapshot = await getSnapshot(params.slug);
  if (!snapshot) return jsonError("大会が見つかりません。", 404);
  return jsonError("この大会ページはPIN確認後に表示されます。", 403);
}

export async function DELETE(request: Request, { params }: { params: { slug: string } }) {
  const body = (await request.json()) as { creatorPin?: string };
  const requiredCreatorPin = process.env.CREATOR_PIN?.trim();
  if (requiredCreatorPin && body.creatorPin?.trim() !== requiredCreatorPin) return jsonError("作成用PINが違います。", 403);

  const supabase = getSupabaseAdmin();
  const { data: tournament } = await supabase.from("tournaments").select("id").eq("slug", params.slug).single();
  if (!tournament) return jsonError("大会が見つかりません。", 404);

  const { error } = await supabase.from("tournaments").delete().eq("id", tournament.id);

  if (error) return jsonError("大会を削除できませんでした。", 500);

  return NextResponse.json({ ok: true });
}

export async function PATCH(request: Request, { params }: { params: { slug: string } }) {
  const body = (await request.json()) as {
    adminPin?: string;
    coverImageUrl?: string | null;
  };

  const adminPin = body.adminPin?.trim();
  const coverImageUrl = body.coverImageUrl?.trim() || null;

  if (!adminPin) return jsonError("管理者PINを入力してください。", 400);
  if (coverImageUrl && !coverImageUrl.startsWith("data:image/")) {
    return jsonError("大会画像の読み込みに失敗しました。画像を選び直してください。", 400);
  }

  const tournament = await verifyAdminPin(params.slug, adminPin);
  if (!tournament) return jsonError("管理者PINが違います。", 403);

  const supabase = getSupabaseAdmin();
  const { error } = await supabase
    .from("tournaments")
    .update({ cover_image_url: coverImageUrl })
    .eq("id", tournament.id);

  if (error?.message?.includes("cover_image_url")) {
    return jsonError("大会画像を使うには、Supabase に画像用の列を追加してください。", 400);
  }
  if (error) return jsonError("大会画像を更新できませんでした。", 500);

  const snapshot = await getSnapshot(params.slug);
  if (!snapshot) return jsonError("大会が見つかりません。", 404);

  return NextResponse.json(snapshot);
}
