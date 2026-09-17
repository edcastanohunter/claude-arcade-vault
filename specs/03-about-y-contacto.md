# 03 — About y formulario de contacto con envío de correo

**Estado:** Aprobado
**Depende de:** SPEC 01, SPEC 02
**Fecha:** 2026-09-17

**Objetivo:** Portar `references/templates/home-about/about.jsx` como la ruta `/about` y hacer que su formulario de contacto envíe un correo real vía un Route Handler `POST /api/contact` con Resend.

## Alcance

**Incluye:**

- Nuevo componente `components/About.tsx` (`"use client"`, puerto de `references/templates/home-about/about.jsx`): hero "ACERCA DE ARCADE VAULT" con misión, `highlight-row` de 3 tarjetas con los iconos SVG `HighlightIcon` (`HEART`, `BROWSER`, `PLANT`), banner divisor de 24 píxeles animados, y sección de contacto (intro + tips con LEDs + formulario).
- Nueva ruta `app/about/page.tsx` que renderiza `<About />`.
- Reveal-on-scroll con `IntersectionObserver` sobre `.reveal`, igual que en `components/Home.tsx` (spec 02).
- CSS: portar a `app/globals.css` el bloque `ABOUT PAGE` de `references/templates/home-about/styles.css` (líneas 1071–1150, incluidos `@keyframes pxblink` y `@keyframes shake`). Se excluye todo lo que va de la línea 1151 en adelante (`GAMEPAD`, `Theme variants`, `.gp-themer` y sus media queries), que no lo usa `about.jsx`.
- CSS nuevo, no presente en la referencia:
  - `@media (max-width: 900px) { .contact-grid { grid-template-columns: 1fr; } }` y colapso de `.highlight-row` a una columna en móvil (la referencia las deja fijas en 2 y 3 columnas).
  - Variante `.terminal-error` del bloque `.terminal-success` (borde y texto en rojo/magenta) para el estado de fallo.
- Navegación: link "Acerca de" en `components/Nav.tsx` (barra desktop y panel móvil) después de "Salón de la Fama", con `isActive` cubriendo `/about`; y link "Acerca de" → `/about` en el `<footer>` de `app/layout.tsx`.
- Nuevo Route Handler `app/api/contact/route.ts` con `POST`:
  - Valida en servidor: `name`, `email`, `message` no vacíos; `email` con formato válido; longitudes máximas (`name` 80, `email` 160, `message` 2000). Si falla → `400` con `{ error }`, sin llamar al proveedor.
  - Honeypot: campo oculto `company` en el formulario; si viene con valor, se descarta el envío y se responde `200` (éxito falso) sin enviar nada.
  - Rate limit por IP en memoria del proceso (`Map<string, number[]>`, máx. 3 envíos por IP cada 10 minutos), leyendo la IP de la cabecera `x-forwarded-for`. Si se excede → `429`.
  - Envía el correo con `resend` (nueva dependencia): `to: process.env.CONTACT_TO_EMAIL`, `from: "Arcade Vault <onboarding@resend.dev>"`, `replyTo` el email del visitante, asunto `[Arcade Vault] Mensaje de <nombre>` y cuerpo con nombre, email y mensaje.
  - Si falta `RESEND_API_KEY`: en desarrollo (`NODE_ENV !== "production"`) loguea el mensaje en consola y responde `200`; en producción responde `500`.
  - Cualquier fallo del proveedor → `500` con `{ error }`.
- Estados del formulario en `About.tsx`: validación cliente con `shake` (se conserva de la referencia), estado `sending` (botón deshabilitado con texto "ENVIANDO…"), estado `sent` (terminal de éxito de la referencia con "ENVIAR OTRO MENSAJE") y estado `error` (terminal en variante de error con líneas `[ERROR]` y botón "REINTENTAR" que devuelve al formulario **conservando los datos escritos**).
- Archivo `.env.example` con `RESEND_API_KEY=` y `CONTACT_TO_EMAIL=`, y `.env*.local` ignorado en `.gitignore` (verificar; `create-next-app` ya lo incluye).

**No incluye (fuera de alcance de este spec):**

- Correo de auto-respuesta al visitante: solo se envía un correo, al equipo.
- Plantilla HTML del correo: se envía en texto plano; no se introduce React Email ni maquetación de email.
- Persistencia de los mensajes enviados (base de datos, log en disco, panel de administración).
- CAPTCHA / reCAPTCHA / Turnstile y rate limit distribuido (Redis, Upstash): el límite en memoria es suficiente para dev y un despliegue de una sola instancia.
- Verificación de dominio propio en Resend: se usa el remitente de pruebas `onboarding@resend.dev`; cambiar a un dominio verificado queda para otro spec.
- Los bloques `GAMEPAD`, `Theme variants` y `.gp-themer` de `styles.css` y el selector de temas de la referencia.
- Tests automatizados (la verificación es manual, como en specs 01 y 02).
- Cualquier cambio a `Home`, `Library`, `GameDetail`, `GamePlayer`, `Auth` o `HallOfFame`.

## Modelo de datos

No se introduce persistencia. Solo el contrato del endpoint y sus tipos locales:

```ts
// app/api/contact/route.ts
interface ContactPayload {
  name: string;
  email: string;
  message: string;
  company?: string; // honeypot: debe llegar vacío
}

// Respuestas
// 200 -> { ok: true }
// 400 -> { ok: false, error: string }   // validación
// 429 -> { ok: false, error: string }   // rate limit
// 500 -> { ok: false, error: string }   // fallo del proveedor o falta de config en producción
```

Variables de entorno (en `.env.local`, documentadas en `.env.example`):

- `RESEND_API_KEY` — clave de API de Resend. Ausente en dev ⇒ modo mock (log en consola + `200`).
- `CONTACT_TO_EMAIL` — dirección de destino de los mensajes.

Estado local de `components/About.tsx`:

```ts
type Status = "idle" | "sending" | "sent" | "error";
const [form, setForm] = useState({ name: "", email: "", msg: "", company: "" });
const [status, setStatus] = useState<Status>("idle");
const [sentName, setSentName] = useState<string | null>(null);
const [errorMsg, setErrorMsg] = useState<string | null>(null);
const [shake, setShake] = useState(false);
```

## Plan de implementación

1. **CSS**: copiar a `app/globals.css` el bloque `ABOUT PAGE` de `references/templates/home-about/styles.css` (1071–1150, con `@keyframes pxblink` y `@keyframes shake`), sin nada de la 1151 en adelante. Añadir al final la media query de `.contact-grid`/`.highlight-row` y la variante `.terminal-error`. Antes de pegar, comprobar por búsqueda de texto que ninguna de esas clases ya existe en `app/globals.css` (`.field` y `@keyframes blink` **sí** existen ya y no se duplican).
2. **Página estática**: crear `components/About.tsx` con el hero, `highlight-row`, `HighlightIcon` (los tres SVG portados tal cual) y el divisor, más el `IntersectionObserver` de reveal; crear `app/about/page.tsx`. En este punto el formulario puede quedar sin envío real.
3. **Endpoint**: `npm i resend`; crear `app/api/contact/route.ts` con la validación, el honeypot, el rate limit por IP, el envío con Resend y el fallback mock en dev; crear `.env.example` y verificar el `.gitignore`.
4. **Conectar el formulario**: en `components/About.tsx`, `onSubmit` valida en cliente (shake si hay campos vacíos), pasa a `sending`, hace `fetch("/api/contact", { method: "POST", body: JSON.stringify(...) })` y según la respuesta pasa a `sent` o a `error`. Renderizar los tres estados (formulario/terminal éxito/terminal error) y el honeypot oculto.
5. **Navegación**: añadir "Acerca de" → `/about` en `components/Nav.tsx` (desktop y panel móvil, con `isActive`) y en el `<footer>` de `app/layout.tsx`.
6. **Verificación manual con Playwright**: `npm run dev`, navegar a `/about` desde el link del Nav, comparar visualmente contra `references/templates/home-about/arcade-vault-standalone.html`, y probar los cuatro caminos: campos vacíos (shake), envío correcto (terminal de éxito con el nombre en mayúsculas), envío fallido (terminal de error + "REINTENTAR" conserva los datos) y el rate limit al cuarto envío seguido.
7. **Build**: `npm run build` sin errores de TypeScript ni de rutas.

## Criterios de aceptación

- [ ] `/about` renderiza el hero "ACERCA DE ARCADE VAULT", la misión, las 3 tarjetas de highlight con sus iconos pixelados, el divisor animado y la sección de contacto, con el mismo aspecto que `arcade-vault-standalone.html`.
- [ ] Las secciones `.reveal` (divisor y contacto) aparecen con la animación de entrada al hacer scroll.
- [ ] `Nav` muestra "Acerca de" después de "Salón de la Fama" en desktop y en el panel móvil, marcado como activo solo en `/about`; el footer también enlaza a `/about`.
- [ ] Enviar el formulario con algún campo vacío dispara la animación `shake` y **no** hace ninguna petición a `/api/contact`.
- [ ] Un envío válido muestra la terminal `VAULT-OS` de éxito con el nombre en mayúsculas, y "ENVIAR OTRO MENSAJE" devuelve al formulario vacío.
- [ ] Con `RESEND_API_KEY` y `CONTACT_TO_EMAIL` configuradas, un envío válido hace llegar un correo a `CONTACT_TO_EMAIL` cuyo `Reply-To` es el email escrito en el formulario y cuyo cuerpo contiene nombre, email y mensaje.
- [ ] Mientras la petición está en vuelo el botón está deshabilitado y muestra "ENVIANDO…"; no se puede enviar dos veces con un doble click.
- [ ] Si el endpoint responde error, se muestra la terminal en variante de error y "REINTENTAR" devuelve al formulario **con los datos escritos intactos**.
- [ ] `POST /api/contact` con `message` vacío, email mal formado o un campo por encima del máximo responde `400` sin enviar correo (comprobable con `curl`).
- [ ] `POST /api/contact` con el honeypot `company` relleno responde `200` y no envía correo.
- [ ] El cuarto `POST /api/contact` desde la misma IP dentro de la ventana de 10 minutos responde `429`.
- [ ] Sin `RESEND_API_KEY` en dev, el envío responde `200` y el mensaje aparece en la consola del servidor; no se rompe la revisión visual.
- [ ] No hay ninguna clave ni dirección de correo hardcodeada en el repo; `.env.example` documenta las dos variables y `.env.local` está ignorado por git.
- [ ] `npm run build` compila sin errores.

## Decisiones tomadas y descartadas

- **Envío real vía Route Handler + Resend**: se descarta mantener el mock de `about.jsx` (que solo pinta la terminal de éxito) porque el objetivo explícito es enviar correo. Frente a Nodemailer/SMTP se elige Resend por ser una sola dependencia, una sola variable de clave y funcionar en Vercel sin servidor SMTP propio. Esto introduce el primer `app/api/` del proyecto, que hasta ahora era 100% cliente + `localStorage`.
- **Ruta `/about`, no `/acerca-de`**: decisión del usuario; diverge de las rutas en español ya existentes (`/biblioteca`, `/salon`, `/juegos`) pero coincide con el nombre del archivo de referencia.
- **Remitente `onboarding@resend.dev` y destino en `CONTACT_TO_EMAIL`**: evita tener que verificar un dominio para que el spec sea implementable hoy. El email del visitante no se usa como `from` (sería rechazado por SPF/DKIM), sino como `Reply-To`.
- **Sin auto-respuesta al visitante**: la terminal de éxito en pantalla ya confirma el envío; un segundo correo duplicaría llamadas al proveedor y obligaría a manejar el fallo parcial.
- **Modo mock en dev cuando falta `RESEND_API_KEY`, error 500 en producción**: permite clonar el repo y revisar el flujo completo sin cuenta de Resend, sin el riesgo de que producción "finja" enviar.
- **Rate limit en memoria, no Redis**: suficiente para dev y una instancia; se acepta que se reinicia en cada deploy y que no cubre despliegues multi-instancia. Un límite distribuido sería otro spec.
- **Honeypot en vez de CAPTCHA**: coste casi cero y ninguna dependencia de terceros ni impacto visual en la estética arcade.
- **Estado de error dentro de la terminal (`.terminal-error`) en vez de mensaje inline**: reutiliza el lenguaje visual `VAULT-OS` que la referencia ya usa para el éxito, y da un "REINTENTAR" explícito. Se descarta el shake + texto inline por ser menos visible.
- **Media query añadida para `.contact-grid`**: la referencia deja el formulario en 2 columnas fijas a cualquier ancho; se añade el colapso a 1 columna porque el resto de pantallas del proyecto sí son responsive.
- **Se porta solo el bloque `ABOUT PAGE` del CSS**: `GAMEPAD` y `Theme variants` (1151–1620) pertenecen al selector de temas de la referencia, que no forma parte de `about.jsx`; incluirlos sería CSS muerto (mismo criterio que el spec 02).

## Riesgos identificados

- **Secretos en el bundle**: `RESEND_API_KEY` y `CONTACT_TO_EMAIL` deben leerse **solo** dentro de `app/api/contact/route.ts`. Si alguna se prefijara con `NEXT_PUBLIC_` o se leyera desde `About.tsx`, la clave acabaría en el JavaScript del cliente.
- **Endpoint abierto como relay de correo**: aunque hay validación, honeypot y rate limit, `/api/contact` es público. El límite en memoria no protege ante IPs rotativas ni sobrevive a los reinicios de proceso.
- **`x-forwarded-for` falsificable**: la IP usada para el rate limit viene de una cabecera que el cliente puede fabricar si no hay un proxy de confianza delante que la reescriba. El límite es disuasorio, no una garantía.
- **Cuota y entregabilidad de Resend**: el remitente compartido `onboarding@resend.dev` puede caer en spam y el plan gratuito tiene límite diario; el correo puede "enviarse" con éxito y no llegar a la bandeja de entrada.
- **Colisión de clases CSS**: `.field`, `.divider` y `@keyframes blink` ya existen en `app/globals.css`; pegar el bloque completo sin revisar duplicaría reglas o cambiaría estilos de `Auth`/otras pantallas.
- **`IntersectionObserver` en Server Component**: como en specs 01 y 02, `About.tsx` debe llevar `"use client"` o el build fallará.
