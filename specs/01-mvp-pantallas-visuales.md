# 01 — MVP: pantallas visuales de Arcade Vault

**Estado:** Aprobado
**Depende de:** —
**Fecha:** 2026-09-16

**Objetivo:** Implementar, solo en su aspecto visual e interactivo de maquetación, las 5 pantallas de `references/templates/` (biblioteca, detalle de juego, reproductor, autenticación, salón de la fama) como rutas reales de Next.js App Router, sin implementar la lógica de ningún juego.

## Alcance

**Incluye:**

- Migración de las 5 pantallas de referencia a componentes React + rutas de App Router:
  - `Library` (biblioteca.jsx) → `/`
  - `GameDetail` (detalle.jsx) → `/juegos/[id]`
  - `GamePlayer` (reproductor.jsx) → `/juegos/[id]/jugar`
  - `Auth` (auth.jsx) → `/login`
  - `HallOfFame` (salon.jsx) → `/salon`
- `Nav` (nav.jsx) como layout compartido (barra superior + panel móvil), montado en `app/layout.tsx`.
- Navegación real entre las 5 rutas usando `next/navigation` (`useRouter`/`Link`) en vez del router por hash del `app.jsx` de referencia.
- Datos mock (`GAMES`, `CATS`, `PLAYERS`, `seededScores`) portados literalmente desde `data.jsx` a `lib/data.ts`, tipados.
- Contenido de texto (títulos, categorías, copys en español) reutilizado tal cual del template, sin traducir.
- Covers de juego como bloques CSS (`cover-bricks`, `cover-tetro`, etc.), reutilizando las clases ya presentes en `app/globals.css`.
- Comportamiento mock client-side ya presente en la referencia, sin backend real:
  - Login/registro/invitado en `/login` escribe un usuario simulado en `localStorage` (`av_user`) y redirige a `/`.
  - `Nav` lee ese usuario para mostrar "Iniciar sesión" vs. nombre de usuario + cerrar sesión.
  - En `/juegos/[id]/jugar`: HUD con puntuación que se auto-incrementa cada 220ms (`setInterval`) simulando partida, botones Pausa/Fin/Salir, modal de fin de partida con guardado de puntuación en `localStorage` (`av_scores`) — todo copiado del comportamiento de `reproductor.jsx`, sin que exista un juego jugable real detrás.
- Reemplazo del contenido scaffold de `app/page.tsx` (logo de Next.js, links de Vercel) por la pantalla `Library`.

**No incluye (fuera de alcance de este spec):**

- Cualquier lógica de juego real (colisiones, controles, reglas, física) — los "juegos" siguen sin existir, el arena del reproductor es un mockup estático animado por CSS/HTML igual que en la referencia.
- Backend, API routes, base de datos o autenticación real — todo el estado es mock en `localStorage`, como en el template.
- Persistencia real de puntuaciones más allá de `localStorage` del navegador.
- Recuperación de contraseña, verificación de email, OAuth real (los botones "GOOGLE"/"GITHUB" son solo visuales, sin funcionalidad).
- Internacionalización / soporte multi-idioma — el contenido queda fijo en español.
- Tests automatizados de UI (no se pide en este spec).

## Modelo de datos

No se introduce persistencia real ni modelos de backend. Se portan estructuras TypeScript puramente client-side a `lib/data.ts`:

```ts
export type GameCategory = "ARCADE" | "PUZZLE" | "SHOOTER" | "VERSUS";

export interface Game {
  id: string;
  title: string;
  short: string;
  long: string;
  cat: GameCategory;
  cover: string; // clase CSS del bloque de portada, p.ej. "cover-bricks"
  color: "cyan" | "magenta" | "green" | "yellow";
  best: number;
  plays: string;
}

export interface ScoreRow {
  rank: number;
  name: string;
  score: number;
  date: string;
}

export const GAMES: Game[];
export const CATS: readonly ["TODOS", "ARCADE", "PUZZLE", "SHOOTER", "VERSUS"];
export function seededScores(seed: number, count?: number): ScoreRow[];
```

Estado mock en `localStorage` (sin cambios de formato respecto a la referencia):

- `av_user`: `{ name: string } | null`
- `av_scores`: array de `{ game: string; score: number; name: string; at: number }`

## Plan de implementación

1. **Datos base**: crear `lib/data.ts` portando `GAMES`, `CATS`, `PLAYERS` y `seededScores` de `references/templates/data.jsx`, tipado en TS, sin usar `window.*`.
2. **Layout y navegación**: crear `components/Nav.tsx` (puerto de `nav.jsx` usando `Link`/`usePathname` de `next/navigation` en vez de la prop `route`/`navigate` por hash), montarlo en `app/layout.tsx` junto al `<footer>` que ya trae `app.jsx`. Manejar el estado de usuario (`av_user`) con un hook simple (`useState` + `useEffect` leyendo `localStorage`) dentro del propio layout o un `components/NavClient.tsx` marcado `"use client"`.
3. **Biblioteca (`/`)**: crear `components/GameCard.tsx` y `components/Library.tsx` (puerto de `biblioteca.jsx`, filtros por búsqueda/categoría con `useState`), y reemplazar `app/page.tsx` para renderizar `<Library />`.
4. **Detalle (`/juegos/[id]`)**: crear `components/GameDetail.tsx` (puerto de `detalle.jsx`) y `app/juegos/[id]/page.tsx` que resuelve el `id` desde los params, busca el juego en `GAMES` y llama `notFound()` si no existe.
5. **Reproductor (`/juegos/[id]/jugar`)**: crear `components/GamePlayer.tsx` (puerto de `reproductor.jsx`, client component con el `setInterval` mock, HUD, modal de guardado en `av_scores`) y `app/juegos/[id]/jugar/page.tsx`.
6. **Login (`/login`)**: crear `components/Auth.tsx` (puerto de `auth.jsx`, escribe `av_user` y redirige a `/` con `useRouter`) y `app/login/page.tsx`.
7. **Salón de la fama (`/salon`)**: crear `components/HallOfFame.tsx` (puerto de `salon.jsx`) y `app/salon/page.tsx`.
8. **Limpieza**: eliminar el contenido scaffold sobrante de `app/page.tsx` (imports de `next/image` a `/next.svg`/`/vercel.svg` si quedan sin uso) y verificar que `app/globals.css` ya cubre todas las clases usadas (`cover-*`, `.av-*`, `.pixel`, `.mono`, etc.) sin necesitar estilos nuevos.
9. **Verificación manual**: `npm run dev` y recorrer las 5 rutas navegando desde la UI (no solo por URL), confirmando el flujo: biblioteca → detalle → jugar → fin de partida con guardado → salón de la fama → login/logout reflejado en `Nav`.

## Criterios de aceptación

- [ ] `/` renderiza la pantalla de biblioteca con buscador, chips de categoría funcionales (filtran `GAMES` en el cliente) y grid de tarjetas de juego.
- [ ] Click en una tarjeta o en "JUGAR" navega a `/juegos/[id]` con los datos correctos del juego.
- [ ] `/juegos/[id]` muestra portada, tags, descripción, stats y tabla de mejores puntuaciones (vía `seededScores`), con botones "JUGAR AHORA" (→ `/juegos/[id]/jugar`) y "VOLVER AL VAULT" (→ `/`).
- [ ] `/juegos/[id]/jugar` muestra el HUD (jugador, puntuación, vidas, nivel), el arena CRT mock, y la puntuación se auto-incrementa mientras no está en pausa ni terminado.
- [ ] En `/juegos/[id]/jugar`, "PAUSA" detiene el incremento de puntuación y "FIN" abre el modal de fin de partida; guardar puntuación escribe en `localStorage` (`av_scores`) y muestra el toast de confirmación.
- [ ] `/login` permite iniciar sesión, crear cuenta o entrar como invitado; cualquiera de las tres acciones escribe `av_user` en `localStorage` (o lo deja `null` para invitado) y redirige a `/`.
- [ ] `Nav` refleja el estado de sesión: muestra "Iniciar Sesión" si `av_user` es `null`, o el nombre de usuario con opción de cerrar sesión si hay usuario.
- [ ] `/salon` muestra el podio (top 3), la tabla completa de puntuaciones por juego seleccionable por tabs, y la fila "tu mejor marca" cuando hay usuario logueado.
- [ ] Todas las rutas comparten el mismo `Nav` y fondo/tema visual (`av-bg`, `av-noise`) ya definidos en `app/globals.css`, sin estilos rotos ni clases faltantes.
- [ ] No existe lógica de juego real en ningún punto: `GamePlayer` no procesa input de teclado/touch ni colisiones, solo el mock de puntuación por tiempo.
- [ ] `npm run build` compila sin errores de TypeScript ni de rutas.

## Decisiones tomadas y descartadas

- **Rutas reales de App Router en vez de router por hash**: se descarta portar el `route`/`location.hash` de `app.jsx` porque no es idiomático en Next.js App Router y el proyecto ya está estructurado por convención de carpetas `app/`. Se gana deep-linking real y se alinea con el resto del proyecto.
- **Contenido en español, sin traducir**: el copy del template (`"ARCADE VAULT"`, `"INSERTA UNA MONEDA PARA JUGAR"`, nombres de jugadores, etc.) se mantiene literal para no introducir inconsistencias ni requerir un sistema de i18n fuera de alcance.
- **Mock de `setInterval` y `localStorage` conservado**: aunque es comportamiento "funcional" y no solo visual, se mantiene porque es parte integral de cómo se ven y se sienten estas pantallas en la referencia (HUD que cambia, modal de guardado, nav con sesión); omitirlo dejaría las pantallas visualmente incompletas frente al template. Se aclara explícitamente que esto no es "lógica de juego" (no hay reglas, colisiones ni interacción de juego real), por lo que no viola la restricción "no implementar ningún juego".
- **Covers CSS en vez de imágenes**: se reutilizan las clases `cover-*` ya portadas en `app/globals.css` (confirmado con `wc -l` que el archivo ya tiene el CSS completo del template, 952 líneas) en vez de generar assets de imagen, evitando trabajo de diseño gráfico fuera de alcance.
- **Datos en `lib/data.ts`**: se prefiere `lib/` sobre `app/data.ts` para separar datos compartidos de las rutas, siguiendo la convención más común en proyectos Next.js con alias `@/*`.
- **Un componente por pantalla en `components/`**: se refleja 1:1 la estructura de archivos de `references/templates/` (`biblioteca.jsx` → `Library.tsx`, etc.) para minimizar la distancia entre la referencia y el código final, facilitando la revisión.

## Riesgos identificados

- **`localStorage` en Server Components**: `GamePlayer`, `Auth` y `Nav` deben marcarse `"use client"` explícitamente; si se omite, Next.js fallará en build o en render porque `localStorage`/`window` no existen en el servidor.
- **Hidratación del estado de `Nav`**: leer `av_user` de `localStorage` en el primer render del cliente puede producir un mismatch de hidratación si no se maneja con cuidado (p. ej. renderizar el estado "no logueado" en el server y actualizar tras montar en el cliente, tal como hace ya el patrón de `useState(() => ...)` del template).
