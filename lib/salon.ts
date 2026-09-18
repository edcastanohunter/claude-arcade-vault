import type { ScoreRow } from "@/lib/data";

// ===== Estado de /salon (SPEC 06): vive en la URL ?juego=&periodo=&q=&pagina= =====

export const PERIODS = ["hoy", "semana", "mes", "siempre"] as const;
export type Period = (typeof PERIODS)[number];

export const GLOBAL_VIEW = "global";
export const DETAIL_PAGE_SIZE = 10;
export const PREVIEW_SIZE = 5;
export const MAX_QUERY_LENGTH = 20;

export interface SalonParams {
  juego: string | null; // null = TODOS (rejilla); "global" | games.id
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

type RawParams = Record<string, string | string[] | undefined>;

const first = (v: string | string[] | undefined): string =>
  Array.isArray(v) ? (v[0] ?? "") : (v ?? "");

// Entrada no confiable: todo valor inválido cae al valor por defecto.
export function parseSalonParams(
  raw: RawParams,
  gameIds: string[],
): SalonParams {
  const juegoRaw = first(raw.juego);
  const juego =
    juegoRaw === GLOBAL_VIEW || gameIds.includes(juegoRaw) ? juegoRaw : null;

  const periodoRaw = first(raw.periodo);
  const periodo = (PERIODS as readonly string[]).includes(periodoRaw)
    ? (periodoRaw as Period)
    : "siempre";

  // Búsqueda y paginación solo existen en las vistas de detalle.
  if (juego === null) return { juego, periodo, q: "", pagina: 1 };

  const q = first(raw.q).trim().slice(0, MAX_QUERY_LENGTH);
  const n = Number(first(raw.pagina));
  const pagina = Number.isInteger(n) && n >= 1 ? n : 1;
  return { juego, periodo, q, pagina };
}

const DAY_MS = 24 * 60 * 60 * 1000;
const WINDOW_DAYS: Record<Exclude<Period, "siempre">, number> = {
  hoy: 1,
  semana: 7,
  mes: 30,
};

// Ventana móvil calculada en el servidor en cada petición; null = SIEMPRE.
export function periodSince(
  periodo: Period,
  now: Date = new Date(),
): string | null {
  if (periodo === "siempre") return null;
  return new Date(now.getTime() - WINDOW_DAYS[periodo] * DAY_MS).toISOString();
}

// URL de /salon para un estado dado; omite los valores por defecto para mantener la URL limpia.
export function salonHref(p: Partial<SalonParams>): string {
  const qs = new URLSearchParams();
  if (p.juego) qs.set("juego", p.juego);
  if (p.periodo && p.periodo !== "siempre") qs.set("periodo", p.periodo);
  if (p.juego && p.q) qs.set("q", p.q);
  if (p.juego && p.pagina && p.pagina > 1) qs.set("pagina", String(p.pagina));
  const s = qs.toString();
  return s ? `/salon?${s}` : "/salon";
}
