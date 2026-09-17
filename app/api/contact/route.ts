import { NextRequest, NextResponse } from "next/server";
import { Resend } from "resend";

const MAX_NAME_LEN = 80;
const MAX_EMAIL_LEN = 160;
const MAX_MESSAGE_LEN = 2000;

const RATE_LIMIT_MAX = 3;
const RATE_LIMIT_WINDOW_MS = 10 * 60 * 1000; // 10 minutos

// Rate limit por IP en memoria del proceso. Se reinicia en cada deploy/reinicio
// y no funciona entre múltiples instancias — suficiente para dev y una sola instancia.
const hits = new Map<string, number[]>();

function isRateLimited(ip: string): boolean {
  const now = Date.now();
  const timestamps = (hits.get(ip) || []).filter((t) => now - t < RATE_LIMIT_WINDOW_MS);
  if (timestamps.length >= RATE_LIMIT_MAX) {
    hits.set(ip, timestamps);
    return true;
  }
  timestamps.push(now);
  hits.set(ip, timestamps);
  return false;
}

function getClientIp(req: NextRequest): string {
  const forwardedFor = req.headers.get("x-forwarded-for");
  if (forwardedFor) return forwardedFor.split(",")[0].trim();
  return "unknown";
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

interface ContactPayload {
  name?: string;
  email?: string;
  message?: string;
  company?: string; // honeypot: debe llegar vacío
}

function validate(payload: ContactPayload): string | null {
  const name = payload.name?.trim() ?? "";
  const email = payload.email?.trim() ?? "";
  const message = payload.message?.trim() ?? "";

  if (!name || !email || !message) return "Faltan campos obligatorios.";
  if (name.length > MAX_NAME_LEN) return "El nombre es demasiado largo.";
  if (email.length > MAX_EMAIL_LEN || !EMAIL_RE.test(email)) return "El correo electrónico no es válido.";
  if (message.length > MAX_MESSAGE_LEN) return "El mensaje es demasiado largo.";
  return null;
}

export async function POST(req: NextRequest) {
  let payload: ContactPayload;
  try {
    payload = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Cuerpo de la petición inválido." }, { status: 400 });
  }

  // Honeypot: los bots rellenan este campo oculto; se responde éxito falso sin enviar nada.
  if (payload.company) {
    return NextResponse.json({ ok: true });
  }

  const validationError = validate(payload);
  if (validationError) {
    return NextResponse.json({ ok: false, error: validationError }, { status: 400 });
  }

  const ip = getClientIp(req);
  if (isRateLimited(ip)) {
    return NextResponse.json(
      { ok: false, error: "Demasiados mensajes enviados. Intenta de nuevo más tarde." },
      { status: 429 }
    );
  }

  const name = payload.name!.trim();
  const email = payload.email!.trim();
  const message = payload.message!.trim();

  const apiKey = process.env.RESEND_API_KEY;
  const toEmail = process.env.CONTACT_TO_EMAIL;

  if (!apiKey) {
    if (process.env.NODE_ENV !== "production") {
      console.log(
        `[contact] RESEND_API_KEY no configurada — modo mock. Mensaje recibido: name=${name} email=${email} message=${message}`
      );
      return NextResponse.json({ ok: true });
    }
    return NextResponse.json({ ok: false, error: "El servicio de correo no está configurado." }, { status: 500 });
  }

  if (!toEmail) {
    return NextResponse.json({ ok: false, error: "El servicio de correo no está configurado." }, { status: 500 });
  }

  try {
    const resend = new Resend(apiKey);
    const { error } = await resend.emails.send({
      from: "Arcade Vault <onboarding@resend.dev>",
      to: toEmail,
      replyTo: email,
      subject: `[Arcade Vault] Mensaje de ${name}`,
      text: `Nombre: ${name}\nCorreo: ${email}\n\n${message}`,
    });

    if (error) {
      console.error("[contact] Error de Resend:", error);
      return NextResponse.json({ ok: false, error: "No se pudo enviar el mensaje." }, { status: 500 });
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[contact] Error inesperado:", err);
    return NextResponse.json({ ok: false, error: "No se pudo enviar el mensaje." }, { status: 500 });
  }
}
