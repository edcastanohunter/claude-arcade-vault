// Evita open-redirects: solo se aceptan rutas internas ("/algo", nunca "//host").
export function safeNext(next: string | null): string {
  return next && next.startsWith("/") && !next.startsWith("//") ? next : "/";
}
