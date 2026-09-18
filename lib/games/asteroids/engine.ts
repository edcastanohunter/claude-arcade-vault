import type { GameCallbacks, GameHandle, SfxEvent } from "../types";
import {
  H,
  INITIAL_ASTEROIDS,
  INITIAL_LIVES,
  MAX_DT,
  POINTS,
  POWERUP_DROP_CHANCE,
  POWERUP_DURATION,
  W,
} from "./constants";
import {
  Asteroid,
  Bullet,
  Particle,
  PowerUp,
  Ship,
  dist,
  rand,
  type Keys,
} from "./entities";

type State = "playing" | "dead" | "gameover";

const SIZE_SFX: Record<number, SfxEvent> = {
  1: "explode-small",
  2: "explode-medium",
  3: "explode-large",
};

/**
 * Motor de Asteroids: mantiene el estado, el loop (rAF) y el teclado.
 * No dibuja HUD ni GAME OVER: emite stats/fin de partida a la plataforma.
 */
export function createAsteroidsGame(
  canvas: HTMLCanvasElement,
  callbacks: GameCallbacks,
): GameHandle {
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas 2D no disponible");

  const keys: Keys = {};
  const justPressed: Keys = {};

  let ship = new Ship();
  let bullets: Bullet[] = [];
  let asteroids: Asteroid[] = [];
  let particles: Particle[] = [];
  let powerUps: PowerUp[] = [];
  let score = 0;
  let lives = INITIAL_LIVES;
  let level = 1;
  let state: State = "playing";
  let deadTimer = 0;
  let powerUpSpawned = false;
  let killsSinceSpawn = 0;

  let paused = false;
  let destroyed = false;
  let rafId = 0;
  let lastTime: number | null = null;
  let lastStats = "";

  // ── Input ───────────────────────────────────────────────────────────────────
  function setKey(code: string, down: boolean) {
    if (down && !keys[code]) justPressed[code] = true;
    keys[code] = down;
  }

  function pressed(code: string) {
    const val = justPressed[code];
    justPressed[code] = false;
    return val;
  }

  const onKeyDown = (e: KeyboardEvent) => setKey(e.code, true);
  const onKeyUp = (e: KeyboardEvent) => setKey(e.code, false);
  window.addEventListener("keydown", onKeyDown);
  window.addEventListener("keyup", onKeyUp);

  // ── Eventos hacia la plataforma ─────────────────────────────────────────────
  function emitStats() {
    const key = `${score}|${lives}|${level}`;
    if (key === lastStats) return;
    lastStats = key;
    callbacks.onStats({ score, lives, level });
  }

  function sfx(e: SfxEvent) {
    callbacks.onSfx?.(e);
  }

  function finish() {
    if (state === "gameover") return;
    state = "gameover";
    emitStats();
    callbacks.onGameOver(score);
  }

  // ── Estado del juego ────────────────────────────────────────────────────────
  function spawnAsteroids(count: number) {
    const SAFE_DIST = 130;
    for (let i = 0; i < count; i++) {
      let x: number, y: number;
      do {
        x = rand(0, W);
        y = rand(0, H);
      } while (Math.hypot(x - W / 2, y - H / 2) < SAFE_DIST);
      asteroids.push(new Asteroid(x, y, 3));
    }
  }

  function initGame() {
    ship = new Ship();
    bullets = [];
    asteroids = [];
    particles = [];
    powerUps = [];
    powerUpSpawned = false;
    killsSinceSpawn = 0;
    score = 0;
    lives = INITIAL_LIVES;
    level = 1;
    state = "playing";
    justPressed["Space"] = false;
    spawnAsteroids(INITIAL_ASTEROIDS);
    lastStats = "";
    emitStats();
  }

  function nextLevel() {
    level++;
    bullets = [];
    particles = [];
    powerUps = [];
    powerUpSpawned = false;
    killsSinceSpawn = 0;
    ship.reset();
    spawnAsteroids(3 + level);
    emitStats();
  }

  function explode(x: number, y: number, count = 8) {
    for (let i = 0; i < count; i++) particles.push(new Particle(x, y));
  }

  function killShip() {
    explode(ship.x, ship.y, 14);
    ship.dead = true;
    lives--;
    sfx("ship-death");
    if (lives <= 0) {
      finish();
    } else {
      state = "dead";
      deadTimer = 2;
      emitStats();
    }
  }

  // ── Update ──────────────────────────────────────────────────────────────────
  function update(dt: number) {
    if (state === "gameover") {
      particles.forEach((p) => p.update(dt));
      particles = particles.filter((p) => !p.dead);
      return;
    }

    if (state === "dead") {
      deadTimer -= dt;
      particles.forEach((p) => p.update(dt));
      particles = particles.filter((p) => !p.dead);
      asteroids.forEach((a) => a.update(dt));
      if (deadTimer <= 0) {
        state = "playing";
        ship.reset();
      }
      return;
    }

    // Disparar
    if (pressed("Space")) {
      const shots = ship.tryShoot();
      if (shots.length) {
        bullets.push(...shots);
        sfx("shoot");
      }
    }

    ship.update(dt, keys);
    bullets.forEach((b) => b.update(dt));
    asteroids.forEach((a) => a.update(dt));
    particles.forEach((p) => p.update(dt));
    powerUps.forEach((p) => p.update(dt));

    bullets = bullets.filter((b) => !b.dead);
    particles = particles.filter((p) => !p.dead);
    powerUps = powerUps.filter((p) => !p.dead);

    for (const p of powerUps) {
      if (!p.dead && dist(ship, p) < ship.radius + p.radius) {
        p.dead = true;
        ship.tripleShot = POWERUP_DURATION;
        sfx("powerup");
      }
    }

    // Bala vs asteroide
    const newAsteroids: Asteroid[] = [];
    for (const b of bullets) {
      for (const a of asteroids) {
        if (!a.dead && !b.dead && dist(b, a) < a.radius) {
          b.dead = true;
          a.dead = true;
          score += POINTS[a.size];
          sfx(SIZE_SFX[a.size]);
          explode(a.x, a.y, a.size * 5);
          newAsteroids.push(...a.split());
          if (!powerUpSpawned) {
            killsSinceSpawn++;
            const guaranteed = killsSinceSpawn >= 5;
            if (guaranteed || Math.random() < POWERUP_DROP_CHANCE) {
              powerUps.push(new PowerUp(a.x, a.y));
              powerUpSpawned = true;
            }
          }
        }
      }
    }
    asteroids = asteroids.filter((a) => !a.dead).concat(newAsteroids);
    bullets = bullets.filter((b) => !b.dead);
    emitStats();

    // Nave vs asteroide
    if (ship.invincible <= 0) {
      for (const a of asteroids) {
        if (dist(ship, a) < ship.radius + a.radius * 0.82) {
          killShip();
          break;
        }
      }
    }

    // Nivel completado
    if (state === "playing" && asteroids.length === 0) nextLevel();
  }

  // ── Draw ────────────────────────────────────────────────────────────────────
  function draw() {
    if (!ctx) return;
    ctx.fillStyle = "#000";
    ctx.fillRect(0, 0, W, H);

    particles.forEach((p) => p.draw(ctx));
    asteroids.forEach((a) => a.draw(ctx));
    powerUps.forEach((p) => p.draw(ctx));
    bullets.forEach((b) => b.draw(ctx));
    ship.draw(ctx);
  }

  // ── Loop principal ──────────────────────────────────────────────────────────
  function loop(ts: number) {
    if (destroyed || paused) return;
    const dt = lastTime === null ? 0 : Math.min((ts - lastTime) / 1000, MAX_DT);
    lastTime = ts;
    update(dt);
    draw();
    rafId = requestAnimationFrame(loop);
  }

  initGame();
  draw();
  rafId = requestAnimationFrame(loop);

  return {
    pause() {
      if (paused || destroyed) return;
      paused = true;
      cancelAnimationFrame(rafId);
    },
    resume() {
      if (!paused || destroyed) return;
      paused = false;
      lastTime = null; // evita un dt grande tras la pausa
      justPressed["Space"] = false;
      rafId = requestAnimationFrame(loop);
    },
    restart() {
      if (destroyed) return;
      initGame();
      draw();
    },
    end() {
      if (destroyed) return;
      finish();
    },
    setKey,
    destroy() {
      destroyed = true;
      cancelAnimationFrame(rafId);
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
    },
  };
}
