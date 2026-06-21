import { NextResponse } from "next/server";
import { jsonError } from "@/lib/api";
import { createSlug, hashPin, isFourDigitPin } from "@/lib/pins";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import type { TournamentFormat } from "@/lib/types";

const formats: TournamentFormat[] = ["round_robin", "league", "tournament"];

export async function GET() {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("tournaments")
    .select("id,slug,name,format,block_count,match_game_count,created_at")
    .order("created_at", { ascending: false });

  if (error) {
    const fallback = await supabase.from("tournaments").select("id,slug,name,format,created_at").order("created_at", { ascending: false });
    if (fallback.error) return jsonError("大会一覧を読み込めませんでした。", 500);

    return NextResponse.json({
      tournaments: (fallback.data ?? []).map((tournament) => ({ ...tournament, block_count: 1, match_game_count: 1 }))
    });
  }

  return NextResponse.json({ tournaments: data ?? [] });
}

export async function POST(request: Request) {
  const body = (await request.json()) as {
    name?: string;
    format?: TournamentFormat;
    adminPin?: string;
    participantPin?: string;
    creatorPin?: string;
    blockCount?: number;
    matchGameCount?: number;
  };
  const name = body.name?.trim();
  const adminPin = body.adminPin?.trim();
  const participantPin = body.participantPin?.trim();
  const creatorPin = body.creatorPin?.trim();
  const blockCount = body.format === "league" ? Number(body.blockCount) : 1;
  const matchGameCount = Number(body.matchGameCount ?? 1);
  const requiredCreatorPin = process.env.CREATOR_PIN?.trim();

  if (requiredCreatorPin && creatorPin !== requiredCreatorPin) return jsonError("作成用PINが違います。", 403);
  if (!name) return jsonError("大会名を入力してください。");
  if (!body.format || !formats.includes(body.format)) return jsonError("大会形式を選んでください。");
  if (!adminPin || !isFourDigitPin(adminPin)) return jsonError("管理者PINは4桁の数字にしてください。");
  if (!participantPin || !isFourDigitPin(participantPin)) return jsonError("参加者PINは4桁の数字にしてください。");
  if (body.format === "league" && (!Number.isInteger(blockCount) || blockCount < 2 || blockCount > 8)) {
    return jsonError("リーグ戦のブロック数は2〜8で選んでください。");
  }
  if (![1, 3, 5].includes(matchGameCount)) return jsonError("何本勝負かを選んでください。");

  const supabase = getSupabaseAdmin();

  for (let attempt = 0; attempt < 5; attempt += 1) {
    const slug = createSlug();
    const insertData = {
      slug,
      name,
      format: body.format,
      block_count: blockCount,
      match_game_count: matchGameCount,
      admin_pin_hash: hashPin(adminPin),
      participant_pin_hash: hashPin(participantPin)
    };

    const { data, error } = await supabase.from("tournaments").insert(insertData).select("slug").single();

    if (!error && data) {
      return NextResponse.json({ slug: data.slug });
    }

    if (body.format !== "league") {
      const fallback = await supabase
        .from("tournaments")
        .insert({
          slug,
          name,
          format: body.format,
          admin_pin_hash: hashPin(adminPin),
          participant_pin_hash: hashPin(participantPin)
        })
        .select("slug")
        .single();

      if (!fallback.error && fallback.data) {
        return NextResponse.json({ slug: fallback.data.slug });
      }
    }
  }

  return jsonError("大会を作成できませんでした。時間をおいて再試行してください。", 500);
}
