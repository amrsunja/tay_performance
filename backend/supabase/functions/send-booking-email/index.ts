// send-booking-email — transactional email dispatcher (Resend)
// Invoked by: Database Webhooks (INSERT on bookings, INSERT on booking_status_history)
// and by pg_cron for the J-1 reminder ({ "type": "reminder" }).
//
// Secrets (supabase secrets set):
//   RESEND_API_KEY        — Resend API key
//   EMAIL_FROM            — e.g. "Tay Performance <rdv@tayperformance.fr>"
//   WORKSHOP_NOTIFY_EMAIL — inbox for new-booking notifications
//   WEBHOOK_SECRET        — shared secret; set the same value as a `x-webhook-secret`
//                           header on the Database Webhooks
// SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY are injected automatically.

import { createClient } from "npm:@supabase/supabase-js@2";

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
);

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY") ?? "";
const EMAIL_FROM = Deno.env.get("EMAIL_FROM") ?? "Tay Performance <onboarding@resend.dev>";
const WORKSHOP_NOTIFY_EMAIL = Deno.env.get("WORKSHOP_NOTIFY_EMAIL") ?? "";
const WEBHOOK_SECRET = Deno.env.get("WEBHOOK_SECRET") ?? "";

type BookingRow = {
  id: string;
  reference: string;
  slot_start: string;
  slot_end: string;
  duration_min: number;
  status: string;
  price_total: number;
  contact_name: string;
  contact_email: string | null;
  legal_flag: string;
};

const dateFmt = new Intl.DateTimeFormat("fr-FR", {
  weekday: "long", day: "numeric", month: "long", year: "numeric",
  timeZone: "Europe/Paris",
});
const timeFmt = new Intl.DateTimeFormat("fr-FR", {
  hour: "2-digit", minute: "2-digit", timeZone: "Europe/Paris",
});

async function sendEmail(to: string, subject: string, html: string) {
  if (!RESEND_API_KEY || !to) return;
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({ from: EMAIL_FROM, to: [to], subject, html }),
  });
  if (!res.ok) console.error("resend error", res.status, await res.text());
}

async function getBooking(id: string): Promise<BookingRow | null> {
  const { data } = await supabase
    .from("bookings")
    .select("id, reference, slot_start, slot_end, duration_min, status, price_total, contact_name, contact_email, legal_flag")
    .eq("id", id)
    .single();
  return data as BookingRow | null;
}

async function getAddress(): Promise<string> {
  const { data } = await supabase.from("app_settings").select("value").eq("key", "workshop_address").single();
  return typeof data?.value === "string" ? data.value : "19 Rue de l'industrie, 67400 Illkirch-Graffenstaden";
}

function recapHtml(b: BookingRow, address: string): string {
  const d = new Date(b.slot_start);
  return `
  <table style="font-family:Arial,sans-serif;font-size:14px;color:#111;border-collapse:collapse">
    <tr><td style="padding:4px 12px 4px 0;color:#666">Référence</td><td><b>${b.reference}</b></td></tr>
    <tr><td style="padding:4px 12px 4px 0;color:#666">Date</td><td>${dateFmt.format(d)}</td></tr>
    <tr><td style="padding:4px 12px 4px 0;color:#666">Heure</td><td>${timeFmt.format(d)}</td></tr>
    <tr><td style="padding:4px 12px 4px 0;color:#666">Durée estimée</td><td>~${b.duration_min} min</td></tr>
    <tr><td style="padding:4px 12px 4px 0;color:#666">Total (règlement à l'atelier)</td><td><b>${Number(b.price_total).toFixed(2)} €</b></td></tr>
    <tr><td style="padding:4px 12px 4px 0;color:#666">Adresse</td><td>${address}</td></tr>
  </table>`;
}

function wrap(title: string, body: string): string {
  return `<div style="font-family:Arial,sans-serif;max-width:560px;margin:0 auto;padding:24px">
    <h2 style="font-size:18px;color:#111">${title}</h2>${body}
    <p style="font-size:12px;color:#999;margin-top:24px">Tay Performance · Vitres teintées · Conforme réglementation France</p>
  </div>`;
}

async function handleBookingCreated(bookingId: string) {
  const b = await getBooking(bookingId);
  if (!b) return;
  const address = await getAddress();
  const recap = recapHtml(b, address);
  if (b.contact_email) {
    await sendEmail(
      b.contact_email,
      `Demande reçue — ${b.reference}`,
      wrap(`Bonjour ${b.contact_name},`,
        `<p>Votre créneau est réservé. L'atelier confirme votre rendez-vous rapidement — vous recevrez un e-mail dès validation.</p>${recap}`),
    );
  }
  if (WORKSHOP_NOTIFY_EMAIL) {
    await sendEmail(WORKSHOP_NOTIFY_EMAIL, `Nouvelle demande — ${b.reference}`,
      wrap("Nouvelle demande de réservation", recap));
  }
}

async function handleStatusChange(bookingId: string, toStatus: string) {
  const b = await getBooking(bookingId);
  if (!b?.contact_email) return;
  const address = await getAddress();
  const recap = recapHtml(b, address);
  switch (toStatus) {
    case "confirmed":
      await sendEmail(b.contact_email, `Rendez-vous confirmé — ${b.reference}`,
        wrap(`C'est confirmé, ${b.contact_name} !`,
          `<p>On vous attend à l'atelier. Présentez-vous 5 min avant — un café vous attend.</p>${recap}`));
      break;
    case "cancelled":
      await sendEmail(b.contact_email, `Rendez-vous annulé — ${b.reference}`,
        wrap("Rendez-vous annulé",
          `<p>Votre rendez-vous a été annulé. Besoin d'un nouveau créneau ? Réservez en ligne quand vous voulez.</p>${recap}`));
      break;
    case "completed":
      await sendEmail(b.contact_email, `Pose terminée — ${b.reference}`,
        wrap(`Merci ${b.contact_name} !`,
          `<p>Votre pose est terminée. Retrouvez les photos et votre garantie dans votre espace « Mes réservations ».</p>${recap}`));
      break;
  }
}

async function handleReminders() {
  // tomorrow's confirmed bookings (Europe/Paris)
  const now = new Date();
  const paris = new Date(now.toLocaleString("en-US", { timeZone: "Europe/Paris" }));
  const start = new Date(paris); start.setDate(start.getDate() + 1); start.setHours(0, 0, 0, 0);
  const end = new Date(start); end.setDate(end.getDate() + 1);
  const { data } = await supabase
    .from("bookings")
    .select("id, reference, slot_start, slot_end, duration_min, status, price_total, contact_name, contact_email, legal_flag")
    .eq("status", "confirmed")
    .gte("slot_start", start.toISOString())
    .lt("slot_start", end.toISOString());
  const address = await getAddress();
  for (const b of (data ?? []) as BookingRow[]) {
    if (!b.contact_email) continue;
    await sendEmail(b.contact_email, `Rappel — rendez-vous demain (${b.reference})`,
      wrap(`À demain, ${b.contact_name} !`,
        `<p>Petit rappel de votre rendez-vous à l'atelier.</p>${recapHtml(b, address)}`));
  }
}

Deno.serve(async (req) => {
  try {
    if (WEBHOOK_SECRET && req.headers.get("x-webhook-secret") !== WEBHOOK_SECRET) {
      return new Response("forbidden", { status: 403 });
    }
    const payload = await req.json();

    if (payload?.type === "reminder") {
      await handleReminders();
    } else if (payload?.type === "INSERT" && payload?.table === "bookings") {
      await handleBookingCreated(payload.record.id);
    } else if (payload?.type === "INSERT" && payload?.table === "booking_status_history") {
      const rec = payload.record;
      if (rec.from_status !== null) {
        await handleStatusChange(rec.booking_id, rec.to_status);
      }
    }
    return new Response(JSON.stringify({ ok: true }), {
      headers: { "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error(e);
    return new Response(JSON.stringify({ ok: false }), { status: 500 });
  }
});
