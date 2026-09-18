"use server";

import { createClient } from "@/lib/supabase/server";

export type SaveScoreResult = { ok: true } | { ok: false; reason: "guest" | "invalid" | "error" };

// Guarda una fila en `scores` para el usuario con sesión; el invitado no escribe nada.
export async function saveScore(gameId: string, score: number): Promise<SaveScoreResult> {
  if (typeof gameId !== "string" || !Number.isInteger(score) || score < 0) return { ok: false, reason: "invalid" };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, reason: "guest" };

  const { data: profile } = await supabase.from("profiles").select("id").eq("user_id", user.id).maybeSingle();
  if (!profile) return { ok: false, reason: "error" };

  const { error } = await supabase.from("scores").insert({ profile_id: profile.id, game_id: gameId, score });
  return error ? { ok: false, reason: "error" } : { ok: true };
}
