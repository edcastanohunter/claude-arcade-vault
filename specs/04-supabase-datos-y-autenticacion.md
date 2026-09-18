# 04 — Supabase: datos y autenticación

**Estado:** Aprobado
**Depende de:** SPEC 01, SPEC 02, SPEC 03
**Fecha:** 2026-09-17

**Objetivo:** Reemplazar el catálogo mock, la autenticación falsa de `localStorage` y las puntuaciones simuladas por datos reales en Supabase (Postgres + Auth), con email+contraseña y OAuth de Google.

## Alcance

**Incluye:**

- **Infraestructura:** dependencias `@supabase/supabase-js` y `@supabase/ssr`; `lib/supabase/client.ts` (`createBrowserClient`) y `lib/supabase/server.ts` (`createServerClient` con `await cookies()`); `middleware.ts` + `lib/supabase/middleware.ts` para refrescar la sesión (sin proteger rutas); variables `NEXT_PUBLIC_SUPABASE_URL` y `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` añadidas a `.env.template`; `lib/supabase/database.types.ts` generado con el MCP de Supabase.
- **Esquema** (`supabase/migrations/`, un archivo `.sql` por paso lógico, aplicado con el MCP):
  - Enum `game_category` ('ARCADE','PUZZLE','SHOOTER','VERSUS').
  - Tabla `games`: `id text PK` (slug actual: `bloque-buster`, `caida`, etc.), `title`, `short`, `long`, `cat game_category`, `cover text`, `color text check in ('cyan','magenta','green','yellow')`, `plays text`, `sort_order int`.
  - Tabla `profiles`: `id uuid PK default gen_random_uuid()`, `user_id uuid unique references auth.users on delete cascade` **nullable**, `display_name text not null`, `is_demo boolean default false`, `created_at timestamptz default now()`.
  - Tabla `scores`: `id bigint generated always as identity PK`, `profile_id uuid references profiles`, `game_id text references games`, `score int not null check (score >= 0)`, `created_at timestamptz default now()`. Índices en `(game_id, score desc)` y `(profile_id)`.
  - Trigger `handle_new_user` sobre `auth.users` (`after insert`): crea la fila en `profiles` con `display_name` tomado de `raw_user_meta_data->>'display_name'` o del local-part del email, en mayúsculas y recortado a 10 caracteres (mismo criterio que hoy aplica `Auth.tsx`).
  - Vistas `v_game_leaderboard` (mejor marca por perfil y juego, con `rank`) y `v_global_leaderboard` (para el Salón de la Fama).
  - RLS activada en `games`, `profiles` y `scores`: lectura pública en las tres; sin escritura de cliente en `games`; en `profiles`, el dueño puede actualizar su propio `display_name`; en `scores`, `insert` permitido solo si `profile_id` pertenece a `auth.uid()`, sin `update` ni `delete`.
  - Migración de seed: los 8 juegos y los 18 perfiles/puntuaciones de demo, portados del contenido actual de `lib/data.ts` (`GAMES`, `PLAYERS`, `seededScores`), con `profiles.is_demo = true` y `user_id = null`.
- **Aplicación:**
  - `Library`, `GameDetail` y `HallOfFame` pasan a ser Server Components que leen de Supabase; los filtros de categoría siguen siendo interactivos en cliente, recibiendo los juegos ya cargados como prop.
  - `Auth.tsx`: login y registro reales con email+contraseña; botón "◆ GOOGLE" funcional vía `signInWithOAuth`; tras registrarse, estado "revisa tu correo para confirmar la cuenta"; botón "▣ GITHUB" se retira.
  - `app/auth/callback/route.ts` (`exchangeCodeForSession`, usado por el flujo OAuth) y `app/auth/confirm/route.ts` (`verifyOtp` con `token_hash` + `type`, usado por el enlace de confirmación de email).
  - `app/layout.tsx` (Server Component) obtiene la sesión y la pasa a `Nav` como prop; se elimina el `useEffect` de lectura de `localStorage` en `Nav.tsx`; cierre de sesión mediante Server Action.
  - Server Action `saveScore(gameId, score)`, invocada desde `GamePlayer` al terminar la partida (botón "SALIR"/fin del contador): si hay sesión, inserta una fila en `scores`; si es invitado, muestra un aviso para iniciar sesión y no escribe nada.
  - Se elimina el uso de `localStorage` (`av_user`, `av_scores`) y, de `lib/data.ts`, las constantes `GAMES`, `PLAYERS` y la función `seededScores()`. `CATS` se conserva derivado del enum en código.

**No incluye (fuera de alcance de este spec):**

- Rutas protegidas por middleware (todas las páginas, incluida `/jugar`, siguen siendo accesibles sin sesión).
- Invitados anónimos de Supabase (`signInAnonymously`).
- OAuth con GitHub y magic link.
- Recuperación/cambio de contraseña, edición de perfil o avatares.
- Realtime en los rankings.
- Validación o anti-trampa de puntuaciones en servidor (el marcador sigue siendo el contador simulado de 220 ms de `GamePlayer`).
- Supabase Storage y Edge Functions.
- Cambios en `/api/contact` o en la página `/about` (spec 03).
- Tests automatizados.

## Modelo de datos

**Esquema Postgres (`supabase/migrations/`):**

```sql
create type game_category as enum ('ARCADE','PUZZLE','SHOOTER','VERSUS');

create table games (
  id text primary key,
  title text not null,
  short text not null,
  long text not null,
  cat game_category not null,
  cover text not null,
  color text not null check (color in ('cyan','magenta','green','yellow')),
  plays text not null,
  sort_order int not null
);

create table profiles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid unique references auth.users(id) on delete cascade,
  display_name text not null,
  is_demo boolean not null default false,
  created_at timestamptz not null default now()
);

create table scores (
  id bigint generated always as identity primary key,
  profile_id uuid not null references profiles(id),
  game_id text not null references games(id),
  score int not null check (score >= 0),
  created_at timestamptz not null default now()
);

create index scores_game_score_idx on scores (game_id, score desc);
create index scores_profile_idx on scores (profile_id);
```

**Vistas:**

- `v_game_leaderboard(game_id, profile_id, display_name, best_score, rank)` — mejor marca por perfil dentro de cada juego.
- `v_global_leaderboard(profile_id, display_name, total_best_score, rank)` — suma de mejores marcas por perfil, para el Salón de la Fama.

**Tipos TypeScript:** generados en `lib/supabase/database.types.ts` con `generate_typescript_types` del MCP; no se escriben a mano.

**`.env.template` (nuevas variables):**

```
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=
```

## Plan de implementación

1. **Infraestructura:** instalar `@supabase/supabase-js` y `@supabase/ssr`; crear `lib/supabase/client.ts`, `lib/supabase/server.ts`, `lib/supabase/middleware.ts` y `middleware.ts`; añadir las variables a `.env.template` y a `.env.local`. `npm run build` debe seguir pasando (sin uso todavía).
2. **Esquema y seed:** escribir y aplicar con el MCP las migraciones de `supabase/migrations/` (enum, tablas, trigger, vistas, RLS, seed); verificar con `list_tables` y `get_advisors` que no queden tablas sin RLS; generar `database.types.ts`.
3. **Catálogo desde la DB:** convertir `Library` y `GameDetail` en Server Components que leen `games`; actualizar la cabecera de `GamePlayer` para recibir el juego como prop; eliminar `GAMES`/`PLAYERS`/`seededScores` de `lib/data.ts` (dejando solo `CATS` y los tipos). Verificación manual con Playwright MCP.
4. **Autenticación real:** implementar `Auth.tsx` con email+contraseña y Google OAuth, `app/auth/callback/route.ts`, `app/auth/confirm/route.ts`; `app/layout.tsx` como Server Component pasando la sesión a `Nav`; sign-out con Server Action. Verificación manual con Playwright MCP (registro, confirmación, login, logout).
5. **Puntuaciones:** Server Action `saveScore`; `HallOfFame` y el ranking de `GameDetail` leyendo de `v_global_leaderboard` / `v_game_leaderboard`; retirar `av_scores` de `GamePlayer`. Verificación manual con Playwright MCP y `npm run build` final.

## Criterios de aceptación

- [ ] Las tablas `games`, `profiles` y `scores` existen con RLS activa; `get_advisors` (tipo `security`) no reporta errores sobre ellas.
- [ ] Un usuario nuevo que se registra con email+contraseña recibe un correo de confirmación; al confirmarlo, aparece su fila en `profiles` con `display_name` en mayúsculas.
- [ ] El login con Google completa `app/auth/callback/route.ts` y deja al usuario con sesión iniciada.
- [ ] Un invitado (sin sesión) puede abrir `/juegos/[id]/jugar` y jugar con normalidad.
- [ ] Al terminar la partida sin sesión, se muestra un aviso para iniciar sesión y no se crea ninguna fila en `scores`.
- [ ] Al terminar la partida con sesión, se crea exactamente una fila nueva en `scores` para ese usuario y juego.
- [ ] `/salon` muestra datos provenientes de `v_global_leaderboard`, incluidos los perfiles de demo sembrados.
- [ ] `/juegos/[id]` muestra el ranking de ese juego desde `v_game_leaderboard`.
- [ ] `Nav` refleja la sesión real (nombre de usuario y opción de salir) sin parpadeo de "no logueado" en la carga inicial.
- [ ] Cerrar sesión invalida la sesión de servidor y `Nav` vuelve a mostrar los botones de acceso.
- [ ] `grep` de `av_user`, `av_scores`, `seededScores` y `PLAYERS` en `app/`, `components/` y `lib/` no devuelve resultados.
- [ ] `npm run build` y `npm run lint` terminan sin errores.
- [ ] Ninguna variable de entorno salvo las prefijadas `NEXT_PUBLIC_*` aparece en el HTML o el bundle de cliente.
- [ ] `.env.template` documenta `NEXT_PUBLIC_SUPABASE_URL` y `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`.

## Decisiones tomadas y descartadas

- **Auth + catálogo + puntuaciones en un solo spec, por fases:** los tres dominios comparten la misma migración de infraestructura y dependen entre sí (las puntuaciones necesitan `profiles`, que necesita `auth`); dividir en tres specs habría fragmentado una única rama de trabajo coherente. Descartado: tres specs separados (04/05/06).
- **Se revierte el "sin backend" de los specs 01–03:** esa exclusión era deliberada para la fase visual (MVP de pantallas); este spec es explícitamente el que introduce persistencia real.
- **Email+contraseña y Google, sin GitHub ni magic link:** cubre el caso de uso principal con el menor número de integraciones externas que configurar.
- **Confirmación de cuenta por email:** más realista que desactivarla, a costa de una ruta adicional (`/auth/confirm`); se documenta como riesgo la cuota del SMTP por defecto de Supabase.
- **El invitado se mantiene sin rutas protegidas:** preserva el comportamiento actual (`playAsGuest()`); solo se le pide sesión en el momento de guardar la puntuación, no antes.
- **`profiles.user_id` nullable en vez de que `profiles.id` referencie directamente a `auth.users`:** permite sembrar los 18 perfiles de demo sin fabricar usuarios de autenticación falsos.
- **Migraciones versionadas en `supabase/migrations/` aplicadas vía MCP:** deja el esquema reproducible y en control de versiones, sin requerir Docker/CLI local. Descartado: aplicar SQL solo por MCP sin archivos en el repo, y Supabase CLI con stack local (exige Docker).
- **`scores` guarda historial (una fila por partida), no solo el mejor:** permite mostrar ranking histórico y es la base más simple para agregarlo luego con una vista, sin perder datos. Descartado: upsert de un único mejor score por usuario y juego (pierde historial), y vista materializada (optimización prematura).
- **Los datos falsos existentes se siembran como demo en la DB en vez de borrarse:** evita pantallas vacías al terminar el spec y documenta con `is_demo = true` que no son partidas reales. Descartado: arrancar con tablas vacías, y mantener `seededScores()` como fallback (mezclaría datos reales y falsos).
- **La puntuación se guarda al terminar la partida vía Server Action**, no con un botón explícito ni autoguardado periódico: es una sola escritura por partida y no requiere cambiar el HUD.
- **Lectura de datos con Server Components**, no desde el cliente con `useEffect`: aprovecha el App Router ya existente y evita una consulta extra en el navegador; solo lo interactivo (filtros, formularios, reproductor) sigue siendo `"use client"`.
- **`plays` se conserva como texto cosmético; `best` no se guarda en `games`:** la mejor marca se deriva siempre de `scores` mediante vista, evitando dos fuentes de verdad para el mismo dato.
- **Se corrige el nombre de archivo de entorno:** este spec usa `.env.template` (el que existe realmente en el repo), no `.env.example` como escribió por error el spec 03.

## Riesgos identificados

- Si alguien prefija por error la clave de servicio (`service_role`) con `NEXT_PUBLIC_`, quedaría expuesta en el bundle de cliente; solo deben llevar ese prefijo la URL y la clave pública.
- Las puntuaciones son falsificables porque el `insert` en `scores` se dispara desde el cliente sin validar la jugada en servidor; se acepta porque el propio marcador es un contador simulado, no un juego real.
- Olvidar activar RLS en alguna tabla o vista dejaría escritura o lectura pública no intencionada; se verifica con `get_advisors` antes de cerrar la fase 2.
- La URL de redirección de Google OAuth debe registrarse tanto en Google Cloud como en el dashboard de Supabase, y difiere entre `localhost` y producción; un olvido rompe el login en uno de los dos entornos.
- El servicio SMTP por defecto de Supabase para los correos de confirmación tiene cuota baja y puede terminar en spam; para producción haría falta un proveedor SMTP propio (fuera de alcance).
- El trigger `handle_new_user` puede generar el mismo `display_name` para dos usuarios distintos (mismo local-part de email); no hay restricción de unicidad sobre ese campo.
- `.env.local` ya contiene `SUPABASE_DB_PWD`, que no es ninguna de las dos variables que necesita la app (`NEXT_PUBLIC_SUPABASE_URL` y `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`); puede llevar a confusión al configurar el entorno.
