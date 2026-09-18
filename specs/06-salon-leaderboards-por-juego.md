# 06 — Salón de la Fama: leaderboard por juego, periodo, búsqueda y paginación

**Estado:** Aprobado
**Depende de:** SPEC 01, SPEC 04
**Fecha:** 2026-09-18

**Objetivo:** Evolucionar `/salon` para mostrar una tabla top por cada juego (además de la global), filtrable por periodo (HOY / SEMANA / MES / SIEMPRE), con búsqueda de jugador y paginación de 10 en 10, guardando todo el estado en la URL.

## Alcance

**Incluye:**

- **Función SQL** `leaderboard(...)` en una migración nueva `supabase/migrations/20260918000009_leaderboard_function.sql`, `security invoker` y `stable`, que devuelve el ranking ya paginado:
  - Con `p_game_id` informado: mejor marca de cada perfil en ese juego dentro del periodo.
  - Con `p_game_id` nulo (global): suma, por perfil, de sus mejores marcas por juego dentro del periodo.
  - El `rank` se calcula **antes** de aplicar búsqueda y paginación, con `rank()` (los empates comparten posición, igual que las vistas actuales).
  - Las vistas `v_game_leaderboard` y `v_global_leaderboard` **se conservan** (las usan `GameDetail` y `getRecentScores`/`getGameLeaderboard`).
- **Estado en la URL** (`/salon?juego=&periodo=&q=&pagina=`), leído en el servidor:
  - `juego`: ausente = vista **TODOS** (rejilla); `global`; o un `games.id`.
  - `periodo`: `hoy` | `semana` | `mes` | `siempre` (por defecto `siempre`).
  - `q`: texto de búsqueda de jugador (solo vistas de detalle).
  - `pagina`: entero ≥ 1 (por defecto 1).
  - Cualquier valor inválido se normaliza al valor por defecto.
- **Vista TODOS (rejilla):** una tarjeta-tabla por juego con su **top 5** del periodo elegido y un enlace `VER TODO` a `?juego=<id>&periodo=<actual>`. Estado vacío por tarjeta: «SIN PUNTUACIONES EN ESTE PERIODO».
- **Vista de detalle (GLOBAL o un juego):** podio (top 3 de la primera página, oculto si hay `q` o `pagina > 1`), tabla de 10 filas por página, paginación `ANTERIOR / SIGUIENTE` con «PÁGINA X DE Y», campo de búsqueda de jugador y, para un juego, la fila «TU MEJOR MARCA» del usuario con sesión, calculada con el mismo periodo.
- **Selectores:** fila de chips de vista (`TODOS`, `GLOBAL`, un chip por juego) y fila de chips de periodo; ambos son enlaces (`Link`) que reescriben la URL, y cambiar de vista o de periodo reinicia `pagina` a 1 y conserva `q` solo en vistas de detalle.
- **Búsqueda:** subcadena, sin distinguir mayúsculas, sobre `display_name`; se envía con un `<form method="get">` (Enter o botón `BUSCAR`), sin consulta por cada tecla. El **rango real se conserva**: buscar «ANA» muestra sus filas con el rango que tienen en la tabla completa.
- **Periodos como ventanas móviles** calculadas en el servidor: HOY = últimas 24 h, SEMANA = últimos 7 días, MES = últimos 30 días, SIEMPRE = sin límite.
- **Aplicación:** `app/salon/page.tsx` pasa a leer `searchParams` y a pedir a la función solo lo que se ve; `components/HallOfFame.tsx` deja de recibir todos los tableros y pasa a renderizar según la URL; nuevos componentes de presentación para la tarjeta de juego y la tabla.
- **CSS** en `app/globals.css` (rejilla de tarjetas, chips de periodo, buscador, paginador), reutilizando las clases del tema (`.hall-*`, `.chip`, `.podium-*`); usar `/frontend-design` para la interfaz.

**No incluye (fuera de alcance de este spec):**

- Vista tabular del catálogo de juegos (filas ordenables) y CRUD/administración de juegos: «tabla de juegos» aquí significa una tabla top por juego, no una tabla del catálogo.
- Cambios en `GameDetail`, `Home`, `Library`, el ticker de la home o el reproductor: siguen leyendo las vistas actuales.
- Cambios en el esquema de tablas (`games`, `profiles`, `scores`) o en las vistas existentes.
- Periodos por calendario o por zona horaria del usuario, rangos personalizados de fechas.
- Búsqueda mientras se escribe (debounce/live), autocompletado y búsqueda por otra cosa que no sea `display_name`.
- Perfil público de jugador, historial de partidas, avatares y enlaces desde una fila a un perfil.
- Realtime, caché o vistas materializadas de rankings.
- Validación o anti-trampa de puntuaciones (el cliente sigue enviando el score, como en los specs 04 y 05).
- Tests automatizados (la verificación es manual, como en specs 01–05).

## Modelo de datos

**Base de datos:** sin cambios de tablas ni de vistas. Se añade una función:

```sql
-- 20260918000009_leaderboard_function.sql (firma ilustrativa)
create or replace function public.leaderboard(
  p_game_id    text        default null,  -- null = global
  p_since      timestamptz default null,  -- null = SIEMPRE
  p_search     text        default null,  -- subcadena de display_name
  p_profile_id uuid        default null,  -- fila "tu mejor marca"
  p_limit      int         default 10,
  p_offset     int         default 0
)
returns table (
  rank        int,
  profile_id  uuid,
  display_name text,
  score       int,
  achieved_at timestamptz,  -- null en el ranking global
  total_count bigint        -- filas totales tras filtrar (para paginar)
)
language sql stable security invoker set search_path = public;
```

- El ranking se calcula sobre todos los perfiles con marca en el periodo; después se filtra por `p_search` (comparando con `position(lower(p_search) in lower(display_name)) > 0`, sin comodines) y `p_profile_id`, y por último se aplica `limit/offset`.
- Al ser `security invoker`, se aplican las políticas RLS de lectura pública ya existentes.

**Tipos TypeScript** (`lib/salon.ts`; `ScoreRow` de `lib/data.ts` se reutiliza sin cambios):

```ts
export const PERIODS = ["hoy", "semana", "mes", "siempre"] as const;
export type Period = (typeof PERIODS)[number];

export interface SalonParams {
  juego: string | null; // null = TODOS; "global" | games.id
  periodo: Period;
  q: string; // recortado, máx. 20 caracteres
  pagina: number; // >= 1
}

export interface LeaderboardPage {
  rows: ScoreRow[];
  total: number; // total_count de la función
  page: number;
  pageSize: number; // 10 en detalle, 5 en rejilla
}
```

**Convenciones:**

- Ventanas móviles: `since = ahora − 1 día | 7 días | 30 días`, calculado por petición en el servidor; `siempre` → `p_since = null`.
- Con `p_since` informado la ventana es `[p_since, now()]`: se excluyen las marcas con fecha futura (el seed demo del spec 04 trae 20 con fechas hasta 2026-12-25). Con `p_since = null` (SIEMPRE) no hay límite superior, para seguir igualando a las vistas.
- Tamaños: rejilla 5 filas por juego; detalle 10 filas por página.
- Fecha de fila: `dd/mm/aaaa` en UTC, como hoy (`fmtDate`); global muestra `—`.

## Plan de implementación

Antes de escribir código, leer en `node_modules/next/dist/docs/` lo relativo a `searchParams` en páginas y a `Link` (según `AGENTS.md`).

1. **Función SQL:** escribir y aplicar `20260918000009_leaderboard_function.sql` con el MCP de Supabase; comprobar con `execute_sql` que `leaderboard(<juego>, null, null, null, 1000, 0)` y `leaderboard(null, null, null, null, 1000, 0)` coinciden fila a fila con `v_game_leaderboard` y `v_global_leaderboard`; correr `get_advisors` (security) y regenerar `lib/supabase/database.types.ts`. `npm run build` y `npm run lint` pasan; la app no cambia todavía.
2. **Capa de datos:** crear `lib/salon.ts` (`Period`, `SalonParams`, `parseSalonParams`, `periodSince`) y añadir a `lib/scores.ts` `getLeaderboard(params)` y `getBoardPreviews(games, periodo)` (una llamada por juego en `Promise.all`, top 5). Sin UI todavía: `build` y `lint` pasan.
3. **Página guiada por URL con rejilla y detalle sin paginar:** convertir `app/salon/page.tsx` para leer `searchParams`; refactorizar `components/HallOfFame.tsx` (chips de vista y de periodo como `Link`) y crear la tarjeta de juego (`components/salon/GameBoardCard.tsx`) y la tabla (`components/salon/LeaderboardTable.tsx`). TODOS muestra la rejilla; GLOBAL/juego muestran podio, top 10 y «TU MEJOR MARCA». Verificación manual de las cuatro vistas de periodo.
4. **Búsqueda y paginación:** añadir el formulario `BUSCAR` y el paginador; ocultar el podio con `q` o `pagina > 1`; redirigir a `pagina=1` si la página pedida queda fuera de rango. Verificación manual con la búsqueda de un nombre demo y con varias páginas del ranking global.
5. **Limpieza y responsive:** eliminar `getAllGameLeaderboards`, `getGlobalLeaderboard` y `getProfileBests` de `lib/scores.ts` solo si `grep` no muestra otros consumidores; ajustar el CSS de la rejilla y del paginador a 390 px de ancho; `npm run build` y `npm run lint` finales.

## Criterios de aceptación

- [ ] `leaderboard(<game_id>, null, null, null, 1000, 0)` devuelve las mismas filas, rangos y puntuaciones que `v_game_leaderboard` para ese juego, y `leaderboard(null, null, null, null, 1000, 0)` las mismas que `v_global_leaderboard`.
- [ ] `get_advisors` (tipo `security`) no reporta errores nuevos tras la migración.
- [ ] `/salon` sin parámetros muestra una tarjeta por cada juego del catálogo (8) con un máximo de 5 filas cada una.
- [ ] `VER TODO` en una tarjeta abre `/salon?juego=<id>&periodo=<actual>` con la tabla completa de ese juego, 10 filas por página como máximo.
- [ ] Los chips `TODOS`, `GLOBAL` y uno por juego navegan cambiando la URL; recargar la página o abrir la URL en otra pestaña muestra la misma vista.
- [ ] Con `periodo=hoy`, `semana` y `mes` solo aparecen marcas creadas dentro de esa ventana; `siempre` incluye todas.
- [ ] Una puntuación guardada ahora mismo con `saveScore` aparece en `periodo=hoy` del juego correspondiente.
- [ ] Un periodo sin marcas muestra el estado vacío en la tarjeta o en la tabla, sin error.
- [ ] La vista GLOBAL suma las mejores marcas por juego dentro del periodo elegido (comprobable con un perfil que tenga marcas en dos juegos).
- [ ] Buscar un nombre (en minúsculas o mayúsculas) muestra solo perfiles cuyo `display_name` contiene el texto, con el mismo rango que tienen sin filtrar.
- [ ] Una búsqueda sin resultados muestra «SIN RESULTADOS» y conserva el campo de búsqueda relleno.
- [ ] `SIGUIENTE` y `ANTERIOR` cambian `pagina`, el texto «PÁGINA X DE Y» es correcto y el botón queda deshabilitado en la primera y en la última página.
- [ ] `?pagina=999` redirige a `pagina=1`; `?pagina=abc`, `?periodo=xyz` y `?juego=inexistente` se normalizan a los valores por defecto sin error.
- [ ] Cambiar de periodo o de vista reinicia `pagina` a 1.
- [ ] El podio no aparece con `q` informado ni con `pagina > 1`.
- [ ] Con sesión iniciada, en la vista de un juego aparece «TU MEJOR MARCA» con el rango calculado para el periodo elegido; sin sesión no aparece.
- [ ] `/juegos/[id]` (ranking del juego) y la home siguen funcionando igual que antes.
- [ ] La página no tiene scroll horizontal a 390 px de ancho y la rejilla pasa a una columna.
- [ ] `npm run build` y `npm run lint` terminan sin errores.

## Decisiones tomadas y descartadas

- **Evolucionar `/salon` en vez de crear `/leaderboard`:** la ruta, el enlace del `Nav` y el diseño ya existen; una ruta nueva duplicaría contenido. Descartado: página nueva y widgets sueltos en otras páginas.
- **«Tabla de juegos» = una tabla top por juego:** decisión del usuario. Descartadas la vista tabular del catálogo, la administración de juegos (exige roles y RLS de escritura, spec propio) y cambios de esquema en `games`.
- **Un solo spec para leaderboard y tablas por juego:** ambas piezas son lecturas sobre los mismos datos y caben en una rama; se acepta un spec algo más grande.
- **Rejilla de tarjetas como vista por defecto, con detalle paginado:** da la «tabla por juego» de un vistazo y lleva a la tabla completa con `VER TODO`. Descartados: solo pestañas (no aporta la vista conjunta) y ocho tablas completas apiladas (scroll excesivo).
- **Función SQL (RPC) parametrizada + `searchParams`, en vez de filtrar en cliente o crear vistas por periodo:** las vistas no exponen periodo, filtrar en el navegador exige descargar todas las marcas y no escala, y una vista por periodo no permite búsqueda ni `offset`. La URL como estado hace las vistas compartibles y renderizables en servidor.
- **Se conservan las vistas y se añade la función, sin migrar `GameDetail`:** minimiza el alcance y el riesgo. Consecuencia: dos vías de cálculo del mismo ranking; se mitiga con el criterio de igualdad fila a fila.
- **`security invoker`:** la función hereda las políticas RLS de lectura pública y no amplía permisos.
- **Periodos como ventanas móviles (24 h / 7 d / 30 d):** evitan decidir zona horaria y «inicio de semana». Descartado: periodos por calendario (más complejos y ambiguos).
- **Rango real al buscar, sin renumerar:** buscar «ANA» no debe mostrarla como #1 si es la #7. Descartado: renumerar sobre los resultados.
- **Búsqueda por envío de formulario y paginación numerada de 10 en 10:** funciona sin JavaScript y evita una consulta por tecla. Descartados: búsqueda en vivo con debounce y «ver más» acumulativo (requiere estado de cliente).
- **Búsqueda por `position(lower(...))` en vez de `ilike`:** evita escapar `%`, `_` y `\` del texto del usuario.
- **Top 5 en la rejilla y 10 en el detalle:** 8 tarjetas de 5 filas caben en pantalla sin saturar; el detalle es la tabla completa.
- **GLOBAL con periodo suma las mejores marcas por juego dentro del periodo:** mantiene el significado actual de `v_global_leaderboard` aplicado a la ventana elegida.
- **Se conserva «TU MEJOR MARCA» solo en vistas de un juego:** es el comportamiento actual; en GLOBAL sigue sin mostrarse.

## Riesgos identificados

- **Datos demo antiguos y futuros:** las puntuaciones sembradas en el spec 04 quedan fuera de las ventanas HOY/SEMANA/MES (o tienen fecha futura, 20 de ellas, y se excluyen con el límite `<= now()`), con lo que esos periodos aparecerán casi vacíos hasta que se jueguen partidas reales; el estado vacío debe ser presentable y la verificación de periodos requiere insertar puntuaciones (por ejemplo jugando `asteroids` o con `execute_sql`). Las fechas futuras del seed siguen contando en SIEMPRE.
- **Dos fuentes del mismo ranking (vistas y función):** si una cambia, pueden divergir; se controla con el criterio de igualdad y dejando anotada en la migración la relación con las vistas.
- **`searchParams` en este Next.js:** en versiones recientes es una `Promise` y volver dinámica la página cambia su caché; hay que confirmar la forma exacta en `node_modules/next/dist/docs/` antes de implementar. La página ya es dinámica por la lectura de la sesión.
- **Paginación inestable:** si se guardan puntuaciones entre dos peticiones, una fila puede repetirse o saltarse entre páginas; se acepta (sin realtime ni snapshot).
- **Empates en el corte de página:** `rank()` da el mismo rango a varios perfiles y `limit/offset` sobre un orden no determinista puede alternar su orden; la función debe ordenar por `rank`, luego `achieved_at` y luego `display_name`/`profile_id` para que el orden sea estable.
- **Nombres duplicados:** `display_name` no es único (riesgo ya anotado en el spec 04); la búsqueda puede devolver perfiles distintos con el mismo nombre y la clave de fila debe ser `profile_id`.
- **Coste de la rejilla:** son 8 llamadas RPC por carga de `/salon`; con el volumen actual es despreciable, pero crece con el catálogo y con el histórico de `scores` (los índices `scores_game_score_idx` y `scores_profile_idx` ya cubren la lectura por juego).
- **Entrada de usuario en la URL:** `q`, `juego`, `periodo` y `pagina` son entrada no confiable; se validan y acotan (`q` ≤ 20 caracteres, `periodo` contra la lista, `pagina` entero positivo) y `juego` solo se acepta si existe en `games`.
