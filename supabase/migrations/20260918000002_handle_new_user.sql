-- Crea el perfil al registrarse un usuario en auth.users.
create function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (user_id, display_name)
  values (
    new.id,
    upper(left(
      coalesce(
        nullif(trim(new.raw_user_meta_data->>'display_name'), ''),
        split_part(new.email, '@', 1)
      ),
      10
    ))
  );
  return new;
end;
$$;

revoke execute on function public.handle_new_user() from public, anon, authenticated;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
