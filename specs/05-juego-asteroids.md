# 05 — Juego Asteroids jugable en la plataforma

**Estado:** Aprobado
**Depende de:** SPEC 01, SPEC 04
**Fecha:** 2026-09-18

**Objetivo:** Portar a TypeScript el juego `references/templates/started-games/02-asteroids` como el primer juego real de la plataforma, jugable en `/juegos/asteroids/jugar` dentro del reproductor existente y guardando su puntuación con `saveScore`.

## Alcance

**Incluye:**

- **Catálogo (DB):** migración `supabase/migrations/20260918000008_rename_rocas_to_asteroids.sql` que reemplaza el juego `rocas` por `asteroids` conservando su `sort_order`, `plays`, `color` y `cover` (`cover-rocas`):
  - inserta la fila `asteroids` (título `ASTEROIDS`, `short` y `long` reescritos: el `long` actual menciona OVNIs, que el juego no tiene);
  - reasigna a `asteroids` las filas de `scores` que apuntaban a `rocas` (`scores.game_id` no tiene `on update cascade`);
  - borra la fila `rocas`.
- **Motor del juego** en `lib/games/asteroids/`, portado de `game.js` a TypeScript sin cambiar la física ni las constantes (`RADII`, `SPEEDS`, `POINTS`, `POWERUP_*`, `TRIPLE_SPREAD`, cooldown de disparo 0,2 s, invencibilidad 3 s, `dt` acotado a 50 ms): clases `Bullet`, `Asteroid`, `PowerUp`, `Ship`, `Particle` y estado `playing | dead | gameover`, con canvas lógico fijo 800×600 y mundo toroidal. El motor **no dibuja HUD ni overlay de GAME OVER** y ya no reinicia con Espacio: el HUD y el reinicio los pone la plataforma.
- **Contrato motor ↔ plataforma** (`lib/games/types.ts`): el motor emite `onStats` (score, vidas, nivel), `onGameOver(finalScore)` y `onSfx(evento)`, y expone `pause`, `resume`, `restart`, `end`, `setKey` y `destroy`.
- **Componente** `components/games/AsteroidsCanvas.tsx` (`"use client"`): monta el motor en un `useEffect` con `requestAnimationFrame`, escucha teclado en `window`, y retira loop y listeners al desmontar. El canvas conserva 800×600 lógicos y se escala por CSS al ancho de `.crt-screen` manteniendo 4:3; vectores blancos sobre fondo negro, como el original.
- **Registro** `lib/games/registry.ts`: mapa `id → componente de juego`. `GamePlayer` usa la implementación real si el id está registrado (`asteroids`) y conserva el contador simulado actual para los demás.
- **Integración en `components/GamePlayer.tsx`** cuando el juego es real:
  - puntuación, vidas y nivel del HUD superior vienen del motor (el nivel deja de ser `score / 2500`);
  - PAUSA congela realmente el loop (también con las teclas `P` y `Esc`);
  - vidas = 0 abre el modal FIN DEL JUEGO y llama a `saveScore` automáticamente; el botón FIN hace lo mismo con la puntuación actual;
  - JUGAR DE NUEVO reinicia el motor; la arena decorativa (`.game-arena`) se sustituye por el canvas.
- **Teclado:** flechas y Espacio hacen `preventDefault` solo mientras el juego está montado, para evitar scroll de la página.
- **Power-up triple disparo (`3x`):** portado tal cual, incluida la aparición garantizada tras 5 kills.
- **Leyenda de controles** bajo el CRT: `← →` rotar · `↑` propulsar · `ESPACIO` disparar · `P` pausa.
- **Sonido mínimo** en `lib/games/asteroids/audio.ts`: efectos sintetizados con Web Audio (sin archivos de audio) para disparo, explosión (por tamaño), recoger power-up y muerte de la nave. El `AudioContext` se crea en el primer gesto del usuario (tecla o click). Botón `SONIDO/MUTE` en las acciones del HUD, con la preferencia en `localStorage` bajo `av_muted`; por defecto el sonido está activo.
- **Controles táctiles mínimos** `components/games/TouchControls.tsx`: `◀`, `▶`, `▲` (propulsar) y `DISPARAR`, visibles solo si `matchMedia("(pointer: coarse)")` coincide; usan `pointerdown/pointerup` sobre `setKey`.
- **CSS** en `app/globals.css`: canvas responsive dentro de `.crt-screen`, leyenda de controles y barra táctil, reutilizando las clases del tema existentes.

**No incluye (fuera de alcance de este spec):**

- Los otros juegos de `references/templates/started-games` (`03-tetris`, `04-arkanoid`): cada uno tendrá su propio spec; este spec solo deja el registro listo para que agreguen una entrada.
- Reemplazar el simulador de los demás juegos del catálogo (`bloque-buster`, `caida`, etc.): siguen con el contador simulado.
- Cambios de reglas o física respecto al `game.js` original (OVNIs, hiperespacio, dificultad progresiva distinta, etc.).
- Recolorear el juego con el estilo neón de la plataforma: se mantiene el blanco sobre negro clásico.
- Validación o anti-trampa de puntuaciones en servidor (como en el spec 04, el cliente envía el score).
- Música de fondo, archivos de audio y ajuste de volumen (solo efectos sintetizados y mute).
- Gamepad, remapeo de teclas y controles táctiles por gestos (solo botones en pantalla).
- Cambios en `Auth`, `Nav`, `Home`, `About` o el esquema de tablas (la migración solo mueve datos del catálogo).
- Tests automatizados (la verificación es manual, como en specs 01–04).

## Modelo de datos

**Base de datos:** sin cambios de esquema. Solo datos: `games.id` `rocas` → `asteroids` y sus `scores`.

```sql
-- 20260918000008_rename_rocas_to_asteroids.sql (esquema ilustrativo)
insert into games (id, title, short, long, cat, cover, color, plays, sort_order)
  select 'asteroids', 'ASTEROIDS', <short>, <long>, cat, cover, color, plays, sort_order
  from games where id = 'rocas';
update scores set game_id = 'asteroids' where game_id = 'rocas';
delete from games where id = 'rocas';
```

**Tipos del motor** (`lib/games/types.ts`):

```ts
export interface GameStats {
  score: number;
  lives: number;
  level: number;
}

export type SfxEvent =
  | "shoot"
  | "explode-large"
  | "explode-medium"
  | "explode-small"
  | "powerup"
  | "ship-death";

export interface GameCallbacks {
  onStats: (s: GameStats) => void;
  onGameOver: (finalScore: number) => void;
  onSfx?: (e: SfxEvent) => void;
}

export interface GameHandle {
  pause(): void;
  resume(): void;
  restart(): void;
  end(): void; // termina la partida con la puntuación actual (botón FIN)
  setKey(
    code: "ArrowLeft" | "ArrowRight" | "ArrowUp" | "Space",
    down: boolean,
  ): void; // teclado táctil
  destroy(): void; // cancela rAF y retira listeners
}

export interface GameComponentProps {
  callbacks: GameCallbacks;
  paused: boolean;
  runId: number; // cambia para reiniciar la partida
  handleRef: React.RefObject<GameHandle | null>;
}
```

**Registro** (`lib/games/registry.ts`):

```ts
export const GAME_COMPONENTS: Record<
  string,
  React.ComponentType<GameComponentProps>
> = {
  asteroids: AsteroidsCanvas,
};
```

**Constantes del juego (sin cambios respecto a `game.js`):**

- Puntos por tamaño: grande 20, mediano 50, pequeño 100.
- Vidas iniciales 3; asteroides iniciales 4 y `3 + nivel` en cada nivel siguiente.
- Canvas lógico 800×600; coordenadas con origen arriba a la izquierda.

**Preferencia local:** `localStorage["av_muted"]` = `"1"` cuando el sonido está silenciado; ausente o `"0"` = activo. Toda lectura/escritura va en `try/catch`.

## Plan de implementación

Antes de escribir código, leer en `node_modules/next/dist/docs/` lo relativo a Client Components (según `AGENTS.md`).

1. **Migración del catálogo:** hacer `grep` de `rocas` en `app/`, `components/`, `lib/` y `supabase/` (ajustar cualquier referencia por id); escribir y aplicar `20260918000008_rename_rocas_to_asteroids.sql`. Verificar con `execute_sql` que `games` tiene 8 filas, `asteroids` existe, `rocas` no, y que ningún `scores.game_id` apunta a `rocas`. `/juegos/asteroids` y `/juegos/asteroids/jugar` cargan con el simulador actual.
2. **Motor en TypeScript:** crear `lib/games/types.ts` y `lib/games/asteroids/` (entidades, constantes, `createAsteroidsGame(canvas, callbacks)` devolviendo un `GameHandle`). Sin UI todavía: `npm run build` y `npm run lint` pasan.
3. **Componente + registro + integración en `GamePlayer`:** crear `components/games/AsteroidsCanvas.tsx` y `lib/games/registry.ts`; adaptar `GamePlayer` (stats desde el motor, PAUSA real, fin de partida automático con `saveScore`, FIN, JUGAR DE NUEVO, `preventDefault` de teclas). Los demás juegos siguen con el simulador. Verificación manual en `/juegos/asteroids/jugar`.
4. **Escalado y leyenda de controles:** CSS responsive del canvas dentro de `.crt-screen` (4:3) y leyenda bajo el CRT. Verificación manual a anchos desktop y móvil.
5. **Sonido:** crear `lib/games/asteroids/audio.ts` (síntesis Web Audio, `AudioContext` diferido al primer gesto), conectar `onSfx` y añadir el botón `SONIDO/MUTE` con persistencia en `av_muted`.
6. **Controles táctiles:** crear `components/games/TouchControls.tsx` (solo con `pointer: coarse`) conectado a `handle.setKey`; comprobar con emulación táctil de Chrome DevTools.

## Criterios de aceptación

- [ ] `/juegos/asteroids/jugar` muestra el canvas del juego y arranca una partida sin errores en la consola.
- [ ] `/juegos/rocas` y `/juegos/rocas/jugar` responden 404; el catálogo sigue mostrando 8 juegos y ROCAS ya no aparece.
- [ ] Ninguna fila de `scores` referencia `rocas` y las puntuaciones demo anteriores de ese juego aparecen en el ranking de `/juegos/asteroids`.
- [ ] `←`/`→` rotan la nave, `↑` propulsa y `Espacio` dispara; la nave y los disparos se envuelven por los bordes del canvas.
- [ ] Pulsar flechas o Espacio durante la partida no hace scroll de la página.
- [ ] Destruir un asteroide grande suma 20, uno mediano 50 y uno pequeño 100; el HUD superior de la plataforma refleja el valor.
- [ ] Un asteroide grande se parte en 2 medianos y uno mediano en 2 pequeños; uno pequeño no se parte.
- [ ] El HUD muestra 3 vidas al iniciar y baja una al chocar con un asteroide; la nave reaparece parpadeando con invencibilidad de 3 s.
- [ ] Al destruir todos los asteroides el nivel del HUD sube en 1 y aparecen `3 + nivel` asteroides nuevos.
- [ ] El power-up `3x` aparece y, al recogerlo, la nave dispara 3 balas abiertas durante 5 s.
- [ ] El botón PAUSA y las teclas `P` y `Esc` congelan la partida (nada se mueve ni el score cambia) y reanudan sin salto brusco de posiciones.
- [ ] Al perder la última vida se abre el modal FIN DEL JUEGO con la puntuación final del motor, sin necesidad de pulsar FIN.
- [ ] Con sesión iniciada, terminar la partida (por vidas o con FIN) crea exactamente una fila en `scores` con `game_id = 'asteroids'` y el score del modal; sin sesión aparece el aviso de iniciar sesión y no se crea ninguna fila.
- [ ] JUGAR DE NUEVO reinicia con score 0, 3 vidas y nivel 1.
- [ ] Salir de la ruta con SALIR o el botón atrás no deja el loop ni los listeners activos (el teclado en otras páginas se comporta con normalidad y no hay errores en consola).
- [ ] El canvas mantiene proporción 4:3 y cabe sin scroll horizontal a 390 px de ancho.
- [ ] Los efectos de disparo, explosión, power-up y muerte suenan tras el primer gesto; antes de éste no se crea ningún `AudioContext`.
- [ ] `SONIDO/MUTE` silencia todos los efectos y el estado se conserva tras recargar (`av_muted`).
- [ ] Con emulación táctil los botones `◀ ▶ ▲ DISPARAR` controlan la nave; en un dispositivo con puntero fino no se muestran.
- [ ] Otro juego del catálogo (por ejemplo `/juegos/caida/jugar`) sigue funcionando con el simulador actual.
- [ ] `npm run build` y `npm run lint` terminan sin errores.

## Decisiones tomadas y descartadas

- **Portar a TypeScript en vez de embeber con iframe:** el iframe habría requerido `postMessage` para score, vidas, pausa y guardado, y dejaría el juego aislado del reproductor. Con un motor propio el HUD, la pausa y `saveScore` se conectan directamente. Descartado: `public/` + iframe.
- **Motor separado del componente React (`lib/games/asteroids/` + `AsteroidsCanvas`):** el estado del juego cambia 60 veces por segundo y no debe vivir en `useState`; el motor lo mantiene y solo emite `onStats` al HUD. También deja la lógica sin dependencias de React para reutilizar el patrón en Tetris y Arkanoid.
- **Registro `id → componente` con simulador como fallback:** los siguientes juegos solo añaden una entrada; no se reescribe `GamePlayer` para cada uno ni se rompe el resto del catálogo.
- **El HUD de la plataforma manda; el canvas no dibuja HUD ni GAME OVER:** evita información duplicada y usa el modal FIN DEL JUEGO y el flujo `saveScore` del spec 04. Consecuencia: se elimina el «ESPACIO PARA REINICIAR» del original; se reinicia con JUGAR DE NUEVO.
- **`asteroids` como id nuevo reemplazando a `rocas`, en vez de reutilizar `rocas` o mantener ambos:** decisión del usuario sobre el nombre. Renombrar mediante inserción + reasignación de `scores` + borrado conserva el ranking demo y no deja dos juegos casi idénticos; no se usa `update games set id` porque la FK de `scores` no tiene `on update cascade`. Descartado: conservar ambos y borrar sin migrar los scores.
- **Se conserva `cover-rocas` y el color:** el arte de portada ya representa asteroides; renombrar la clase no aporta valor.
- **Canvas 800×600 escalado por CSS, blanco sobre negro:** la física depende de las coordenadas lógicas y se preserva idéntica; escalar por CSS resuelve el responsive. Descartado: recolorear con neón de la plataforma (se aparta del clásico y añade trabajo visual).
- **Pausa real por motor, con `P`/`Esc` además del botón:** el simulador solo pausaba un `setInterval`; aquí hay un loop de juego y el atajo mejora la jugabilidad.
- **Sonido y táctil incluidos aunque el original no los trae:** decisión del usuario. Se limitan a la versión mínima (efectos sintetizados sin archivos y botones en pantalla) para no dominar el spec; ampliaciones (música, volumen, gestos, gamepad) van a otro.
- **Sonido activo por defecto tras el primer gesto, con MUTE persistente:** los navegadores bloquean el audio sin gesto del usuario, por lo que el contexto se crea diferido. La preferencia queda en `localStorage` (por viewer, sin necesidad de cuenta).
- **Los demás juegos de `started-games` (Tetris, Arkanoid) quedan fuera:** son juegos distintos con su propio motor; mezclarlos rompería la regla de una sola funcionalidad por spec.

## Riesgos identificados

- **Doble montaje en modo estricto de React (dev):** el `useEffect` se ejecuta, limpia y vuelve a ejecutar; si `destroy()` no cancela `requestAnimationFrame` y no retira los listeners de `window`, habrá dos loops o disparos duplicados.
- **Reanudar tras pausa o pestaña en segundo plano:** si `lastTime` no se reinicia en `resume()`, el primer `dt` es grande; el tope de 50 ms lo acota, pero hay que reiniciar la marca de tiempo igualmente.
- **`preventDefault` global de teclas:** bloquear flechas y Espacio en `window` puede romper el uso del teclado en la modal, el modal de FIN y los botones enfocados; solo debe hacerse mientras el juego está activo y no en modal abierto.
- **Reasignación de `scores` en la migración:** si falla entre `insert`, `update` y `delete`, puede dejar el catálogo con ambos juegos o con scores huérfanos; debe ejecutarse en una sola transacción.
- **Score enviado desde el cliente:** sigue siendo falsificable (Server Action sin validación de la jugada); se acepta como en el spec 04.
- **Autoplay de audio:** el `AudioContext` puede quedar en `suspended`; hay que llamar a `resume()` en el primer gesto y tolerar navegadores sin Web Audio (el juego debe funcionar en silencio).
- **Táctil y scroll:** los botones en pantalla necesitan `touch-action: none` y bloquear el menú contextual por pulsación larga; de lo contrario, mantener pulsado provoca zoom, selección o scroll.
- **Carga en SSR:** el motor usa `window`, `document` y canvas; debe instanciarse solo dentro de `useEffect` en un Client Component, o el build fallará.
