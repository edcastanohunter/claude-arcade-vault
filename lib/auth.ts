import { createClient } from "@/lib/supabase/server";

export interface CurrentUser {
  id: string;
  profileId: string | null;
  name: string;
}

// Usuario de la sesión actual (validado con getUser) y su perfil, o null si es invitado.
export async function getCurrentUser(): Promise<CurrentUser | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: profile } = await supabase
    .from("profiles")
    .select("id, display_name")
    .eq("user_id", user.id)
    .maybeSingle();

  return {
    id: user.id,
    profileId: profile?.id ?? null,
    name: profile?.display_name ?? user.email?.split("@")[0].toUpperCase().slice(0, 10) ?? "PLAYER",
  };
}
