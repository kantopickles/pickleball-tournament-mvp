import { getSnapshot, jsonError, verifyAdminPin } from "@/lib/api";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import type { Match, PublicScheduleEntry, ScheduleStatus } from "@/lib/types";

function isMissingScheduleTable(error: { message?: string } | null) {
  return Boolean(error?.message?.includes("schedule_entries"));
}

async function persistScheduleOrder(tournamentId: string, entryIds: string[]) {
  const supabase = getSupabaseAdmin();

  await Promise.all(
    entryIds.map((entryId, index) =>
      supabase
        .from("schedule_entries")
        .update({ sequence: 1000 + index + 1, updated_at: new Date().toISOString() })
        .eq("id", entryId)
        .eq("tournament_id", tournamentId)
    )
  );

  await Promise.all(
    entryIds.map((entryId, index) =>
      supabase
        .from("schedule_entries")
        .update({ sequence: index + 1, updated_at: new Date().toISOString() })
        .eq("id", entryId)
        .eq("tournament_id", tournamentId)
    )
  );
}

async function resequenceScheduleEntries(tournamentId: string) {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("schedule_entries")
    .select("id,sequence")
    .eq("tournament_id", tournamentId)
    .order("sequence", { ascending: true });

  if (error || !data) return;
  await persistScheduleOrder(tournamentId, data.map((entry) => entry.id));
}

export async function POST(request: Request, { params }: { params: { slug: string } }) {
  const body = (await request.json()) as {
    adminPin?: string;
    matchIds?: string[];
    courtName?: string;
  };

  const tournament = await verifyAdminPin(params.slug, body.adminPin ?? "");
  if (!tournament) return jsonError("管理者PINが違います。", 403);

  const supabase = getSupabaseAdmin();
  const courtName = body.courtName?.trim() || "Aコート";
  const matchIds = Array.from(new Set((body.matchIds ?? []).filter(Boolean)));

  if (matchIds.length === 0) return jsonError("進行表に追加する試合を選んでください。");

  const { data: existingEntries, error: existingError } = await supabase
    .from("schedule_entries")
    .select("match_id,sequence")
    .eq("tournament_id", tournament.id)
    .order("sequence", { ascending: true });

  if (isMissingScheduleTable(existingError)) {
    return jsonError("進行表を使うには、Supabase SQL Editorで `supabase/migrations/004_schedule_entries.sql` を実行してください。", 400);
  }
  if (existingError) return jsonError("進行表を読み込めませんでした。", 500);

  const scheduledMatchIds = new Set((existingEntries ?? []).map((entry) => entry.match_id));
  const { data: matches, error: matchesError } = await supabase
    .from("matches")
    .select("*")
    .eq("tournament_id", tournament.id)
    .in("id", matchIds);

  if (matchesError || !matches) return jsonError("試合を読み込めませんでした。", 500);

  const nextSequence = Math.max(0, ...((existingEntries ?? []).map((entry) => entry.sequence ?? 0))) + 1;
  const insertTargets = (matches as Match[])
    .filter((match) => !scheduledMatchIds.has(match.id))
    .sort((left, right) => left.round - right.round || left.position - right.position)
    .map((match, index) => ({
      tournament_id: tournament.id,
      match_id: match.id,
      sequence: nextSequence + index,
      court_name: courtName,
      status: match.locked ? "completed" : ("pending" satisfies ScheduleStatus)
    }));

  if (insertTargets.length === 0) return jsonError("選んだ試合はすでに進行表へ追加されています。");

  const { error: insertError } = await supabase.from("schedule_entries").insert(insertTargets);
  if (insertError) return jsonError("進行表へ追加できませんでした。", 500);

  const snapshot = await getSnapshot(params.slug);
  if (!snapshot) return jsonError("大会が見つかりません。", 404);
  return Response.json(snapshot);
}

export async function PATCH(request: Request, { params }: { params: { slug: string } }) {
  const body = (await request.json()) as
    | {
        adminPin?: string;
        mode?: "move";
        entryId?: string;
        direction?: "up" | "down";
      }
    | {
        adminPin?: string;
        mode?: "reorder";
        entryId?: string;
        targetEntryId?: string;
        placement?: "before" | "after";
      }
    | {
        adminPin?: string;
        mode?: "update";
        entryId?: string;
        courtName?: string;
      };

  const tournament = await verifyAdminPin(params.slug, body.adminPin ?? "");
  if (!tournament) return jsonError("管理者PINが違います。", 403);

  const supabase = getSupabaseAdmin();
  const { data: entryData, error: entryError } = await supabase
    .from("schedule_entries")
    .select("*")
    .eq("id", body.entryId ?? "")
    .eq("tournament_id", tournament.id)
    .single();

  if (isMissingScheduleTable(entryError)) {
    return jsonError("進行表を使うには、Supabase SQL Editorで `supabase/migrations/004_schedule_entries.sql` を実行してください。", 400);
  }
  const entry = entryData as PublicScheduleEntry | null;
  if (!entry) return jsonError("進行表の行が見つかりません。", 404);

  if (body.mode === "move" || body.mode === "reorder") {
    const { data: entries, error } = await supabase
      .from("schedule_entries")
      .select("*")
      .eq("tournament_id", tournament.id)
      .order("sequence", { ascending: true });

    if (error || !entries) return jsonError("進行表を並べ替えできませんでした。", 500);

    const currentIndex = entries.findIndex((item) => item.id === entry.id);
    if (currentIndex < 0) return jsonError("進行表の行が見つかりません。", 404);

    let targetIndex = currentIndex;
    if (body.mode === "reorder") {
      targetIndex = entries.findIndex((item) => item.id === body.targetEntryId);
    } else {
      const moveBody = body as { direction?: "up" | "down" };
      targetIndex = moveBody.direction === "up" ? currentIndex - 1 : currentIndex + 1;
    }

    if (targetIndex < 0 || targetIndex >= entries.length) {
      const snapshot = await getSnapshot(params.slug);
      if (!snapshot) return jsonError("大会が見つかりません。", 404);
      return Response.json(snapshot);
    }

    const reordered = [...entries];
    const [moved] = reordered.splice(currentIndex, 1);
    const reorderBody = body as { mode?: "move" | "reorder"; placement?: "before" | "after" };
    let adjustedTargetIndex = body.mode === "reorder" && currentIndex < targetIndex ? targetIndex - 1 : targetIndex;
    if (body.mode === "reorder" && reorderBody.placement === "after") {
      adjustedTargetIndex += 1;
    }
    const targetEntry = entries[targetIndex];

    if (body.mode === "reorder" && targetEntry && moved.court_name !== targetEntry.court_name) {
      moved.court_name = targetEntry.court_name;
      await supabase
        .from("schedule_entries")
        .update({ court_name: targetEntry.court_name, updated_at: new Date().toISOString() })
        .eq("id", moved.id)
        .eq("tournament_id", tournament.id);
    }

    reordered.splice(adjustedTargetIndex, 0, moved);

    await persistScheduleOrder(tournament.id, reordered.map((item) => item.id));
  } else {
    const updateBody = body as {
      adminPin?: string;
      mode?: "update";
      entryId?: string;
      courtName?: string;
    };
    const nextCourtName = updateBody.courtName?.trim() || "Aコート";

    const { error } = await supabase
      .from("schedule_entries")
      .update({
        court_name: nextCourtName,
        updated_at: new Date().toISOString()
      })
      .eq("id", entry.id);

    if (error) return jsonError("進行表を更新できませんでした。", 500);
  }

  await resequenceScheduleEntries(tournament.id);
  const snapshot = await getSnapshot(params.slug);
  if (!snapshot) return jsonError("大会が見つかりません。", 404);
  return Response.json(snapshot);
}

export async function DELETE(request: Request, { params }: { params: { slug: string } }) {
  const body = (await request.json()) as { adminPin?: string; entryId?: string };
  const tournament = await verifyAdminPin(params.slug, body.adminPin ?? "");
  if (!tournament) return jsonError("管理者PINが違います。", 403);

  const supabase = getSupabaseAdmin();
  const { error } = await supabase
    .from("schedule_entries")
    .delete()
    .eq("id", body.entryId ?? "")
    .eq("tournament_id", tournament.id);

  if (isMissingScheduleTable(error)) {
    return jsonError("進行表を使うには、Supabase SQL Editorで `supabase/migrations/004_schedule_entries.sql` を実行してください。", 400);
  }
  if (error) return jsonError("進行表から削除できませんでした。", 500);

  await resequenceScheduleEntries(tournament.id);
  const snapshot = await getSnapshot(params.slug);
  if (!snapshot) return jsonError("大会が見つかりません。", 404);
  return Response.json(snapshot);
}
