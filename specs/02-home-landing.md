# 02 — Home: pantalla de aterrizaje (landing)

**Estado:** Aprivado
**Depende de:** SPEC 01
**Fecha:** 2026-09-17

**Objetivo:** Portar solo la pantalla `home.jsx` de `references/templates/home-about/` como la nueva ruta raíz `/`, moviendo la Biblioteca actual a `/biblioteca`, sin tocar `about.jsx` (fuera de alcance).

## Alcance

**Incluye:**

- Nuevo componente `components/Home.tsx` (puerto de `references/templates/home-about/home.jsx`): hero con siluetas flotantes animadas, sección "¿Por qué Arcade Vault?" (4 feature cards), preview de juegos (primeros 6 de `GAMES`), stats, "Actividad en Vivo" (ticker de últimas puntuaciones + top jugadores de hoy), pricing (plan único + FAQ), y CTA final.
- Reveal-on-scroll (`useReveal`, `IntersectionObserver` sobre `.reveal`) portado tal cual desde la referencia.
- `app/page.tsx` pasa a renderizar `<Home />` en vez de `<Library />`.
- Biblioteca se mueve de `/` a `/biblioteca`: nueva ruta `app/biblioteca/page.tsx` renderizando `<Library />`; `app/page.tsx` deja de importar `Library`.
- Actualización de `components/Nav.tsx`:
  - Se agrega el link "Inicio" → `/` (desktop y panel móvil), como primer ítem.
  - "Biblioteca" pasa a apuntar a `/biblioteca` (antes `/`); `isActive("biblioteca")` se ajusta para cubrir `/biblioteca` y `/juegos/*`.
  - El logo (click) sigue navegando a `/`.
  - No se agrega "Acerca de" (about queda fuera de alcance).
- CSS: portar a `app/globals.css` los bloques `HOME PAGE`, `ACTIVITY (leaderboard + ticker)` y `PRICING` de `references/templates/home-about/styles.css` (líneas 930–1070 y 1621–fin). Se excluyen explícitamente los bloques `ABOUT PAGE` y `GAMEPAD`/`Theme variants` (1071–1620), que pertenecen solo a `about.jsx`.
- Botones de la Home navegan con `next/navigation` (`useRouter`) en vez del `navigate({name:...})` por hash de la referencia: "EXPLORAR JUEGOS" y "VER TODOS LOS JUEGOS" → `/biblioteca`, "CREAR CUENTA" / "EMPEZAR GRATIS" → `/login`, click en `MiniCard` → `/juegos/[id]`, "VER SALÓN" → `/salon`, CTA final → `/biblioteca`.
- Sección "Actividad en Vivo" con datos dinámicos en vez de los strings fijos de la referencia:
  - Ticker "Últimas Puntuaciones": generado con `seededScores` (mismo patrón que `HallOfFame.tsx`) combinando cada fila con un juego de `GAMES` (cíclico) para mostrar su título y color; las etiquetas de tiempo relativo (`hace 2 min`, `hace 5 min`, ...) se mantienen como el arreglo fijo de la referencia, ya que no existe un reloj de partidas real.
  - "Top Jugadores · Hoy": `seededScores` con una semilla fija, tomando los primeros 5 resultados (igual formato que el podio de `HallOfFame`).
- Contadores de stats ("12+ JUEGOS", "MILES DE PARTIDAS", "GLOBAL RANKING") se mantienen como texto fijo de la referencia (no son datos derivables de `lib/data.ts`).

**No incluye (fuera de alcance de este spec):**

- La pantalla `about.jsx` / ruta `/acerca-de` — se omite por completo, incluidos sus estilos (`ABOUT PAGE`, `GAMEPAD`, `Theme variants`).
- Cualquier cambio a `Library`, `GameDetail`, `GamePlayer`, `Auth` o `HallOfFame` más allá de lo estrictamente necesario para mover Biblioteca a `/biblioteca` (no se modifica su lógica interna).
- Lógica de juego real, backend o persistencia nueva — el ticker/top-jugadores siguen siendo mock generado en el cliente, igual que el resto del proyecto.
- Tests automatizados o comparación de píxeles contra la referencia (la verificación es una revisión visual manual con Playwright).

## Modelo de datos

No se introducen estructuras nuevas. Se reutilizan `GAMES`, `PLAYERS` y `seededScores` ya existentes en `lib/data.ts` (spec 01), llamando `seededScores` con semillas fijas para el ticker y el top de jugadores de Home, siguiendo el mismo patrón que `components/HallOfFame.tsx`.

## Plan de implementación

1. **Mover Biblioteca a `/biblioteca`**: crear `app/biblioteca/page.tsx` que renderiza `<Library />`; vaciar `app/page.tsx` de la importación de `Library` (se reemplaza en el paso 3).
2. **CSS de Home**: copiar a `app/globals.css` los bloques `HOME PAGE` (líneas 930–1070) y `ACTIVITY` + `PRICING` (líneas 1621–fin) de `references/templates/home-about/styles.css`, sin incluir `ABOUT PAGE` ni `GAMEPAD`/`Theme variants`.
3. **Componente `Home`**: crear `components/Home.tsx` (`"use client"` por el `useReveal`/`IntersectionObserver` y por `useRouter`), portando `FloatingSilhouettes`, `MiniCard`, `FeatureIcon` y la sección de Actividad en Vivo con datos de `seededScores`/`GAMES` en vez de los arreglos fijos de la referencia. `app/page.tsx` pasa a renderizar `<Home />`.
4. **Actualizar `Nav`**: agregar el link "Inicio" (`/`) antes de "Biblioteca" en `components/Nav.tsx` (desktop y panel móvil), cambiar el `href` de "Biblioteca" a `/biblioteca`, y ajustar `isActive` para que "Inicio" solo esté activo en `/` y "Biblioteca" cubra `/biblioteca` y `/juegos/*`.
5. **Verificación manual con Playwright**: levantar `npm run dev`, navegar `/` con el MCP de Playwright, revisar visualmente cada sección (hero, features, preview de juegos, stats, actividad en vivo, pricing, CTA final) contra `references/templates/home-about/arcade-vault-standalone.html`/`home.jsx`, confirmar que los links de Home navegan a las rutas correctas, que `/biblioteca` sigue funcionando igual que antes en `/`, y que `Nav` muestra "Inicio" y "Biblioteca" con el estado activo correcto en cada ruta.
6. **Build**: `npm run build` sin errores de TypeScript ni de rutas.

## Criterios de aceptación

- [ ] `/` renderiza la Home (hero, siluetas animadas, 4 feature cards, preview de 6 juegos, stats, actividad en vivo, pricing con FAQ, CTA final), no la Biblioteca.
- [ ] `/biblioteca` renderiza la pantalla de Biblioteca (buscador, chips de categoría, grid de juegos) igual que antes vivía en `/`.
- [ ] En Home: "EXPLORAR JUEGOS", "VER TODOS LOS JUEGOS" y el CTA final navegan a `/biblioteca`; "CREAR CUENTA" y "EMPEZAR GRATIS" navegan a `/login`; click en una `MiniCard` navega a `/juegos/[id]` correcto; "VER SALÓN" navega a `/salon`.
- [ ] Las secciones marcadas `.reveal` aparecen con la animación de entrada al hacer scroll (igual que en la referencia).
- [ ] El ticker "Últimas Puntuaciones" y "Top Jugadores · Hoy" muestran datos generados con `seededScores`/`GAMES`, no los strings hardcodeados de la referencia.
- [ ] `Nav` muestra "Inicio" antes de "Biblioteca" (sin "Acerca de"), con el estado activo correcto: "Inicio" solo en `/`, "Biblioteca" en `/biblioteca` y `/juegos/*`.
- [ ] No existe ninguna ruta ni link a "Acerca de" / `about` en la aplicación.
- [ ] `npm run build` compila sin errores.
- [ ] Revisión visual manual con Playwright confirma que colores, tipografía y layout de Home coinciden con `references/templates/home-about/arcade-vault-standalone.html`.

## Decisiones tomadas y descartadas

- **Home reemplaza a Biblioteca en `/`, Biblioteca se mueve a `/biblioteca`**: se prioriza la fidelidad con `nav.jsx` de la referencia (donde "Inicio" es la raíz y "Biblioteca" es una ruta propia) sobre minimizar el diff de spec 01. Alternativa descartada: dejar Home en `/inicio` y no tocar `/`, por divergir del modelo de navegación de la referencia.
- **Se agrega "Inicio" a `Nav`, no se agrega "Acerca de"**: consistente con que `about.jsx` queda explícitamente fuera de alcance de este spec.
- **Actividad en Vivo con datos dinámicos (`seededScores`) en vez de los strings fijos de la referencia**: se prefiere reutilizar el mock ya existente (mismo patrón que `HallOfFame.tsx`) para que la sección no muestre siempre los mismos nombres/puntuaciones en cada carga, aunque la referencia original los hardcodea. Las etiquetas de tiempo relativo se mantienen fijas porque no existe (ni se va a introducir en este spec) un reloj de partidas real que las genere.
- **CSS: se portan solo los bloques HOME PAGE, ACTIVITY y PRICING**: se excluyen `ABOUT PAGE` y `GAMEPAD`/`Theme variants` porque pertenecen únicamente a `about.jsx`, que no se implementa en este spec; incluirlos sería CSS muerto.
- **Verificación con Playwright como revisión visual manual, no test automatizado**: consistente con cómo se verificó spec 01 (sin infraestructura de testing en el proyecto); se usa el MCP de Playwright ya configurado (ver README) para navegar y comparar visualmente, no para un pixel-diff automatizado.

## Riesgos identificados

- **CSS del bloque ACTIVITY/PRICING con nombres de clase genéricos** (`.ticker`, `.top-list`, `.price-card`, etc.): si alguna de estas clases ya existe con otro significado en `app/globals.css` (portado de `references/templates/styles.css`), podría haber colisión de estilos entre Home y otras pantallas. Verificar con búsqueda de texto antes de pegar el bloque.
- **`IntersectionObserver` en `"use client"`**: como en spec 01, cualquier lectura de `document`/`window` (incluyendo `useReveal`) debe quedar en un componente cliente; si `Home` se declarara como Server Component por error, el build fallaría.
