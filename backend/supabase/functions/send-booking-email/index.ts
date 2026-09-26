// send-booking-email — transactional email dispatcher (Resend)
// Invoked by (migration 0022, public._notify_edge → pg_net):
//   • trigger AFTER INSERT on public.bookings                → "demande reçue" + workshop notification
//   • trigger AFTER INSERT on public.booking_status_history  → confirmed / cancelled / completed / rescheduled
//   • pg_cron { "type": "reminder" } once a day               → J-1 reminder
//
// Secrets (supabase secrets set):
//   RESEND_API_KEY        — Resend API key (required: the function answers 500 without it)
//   EMAIL_FROM            — e.g. "Tay Performance <rdv@tayperformance.fr>" — domain VERIFIED in Resend.
//                           The default onboarding@resend.dev only delivers to the Resend account owner.
//   WORKSHOP_NOTIFY_EMAIL — inbox for new-booking notifications
//   WEBHOOK_SECRET        — same value as Vault `webhook_secret` (x-webhook-secret header)
// SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY are injected automatically.
//
// Idempotency + audit: public.email_claim() / email_log (0022) — one mail per
// (booking, kind, slot_start, recipient). Every send result is stored in email_log.

import { createClient } from "npm:@supabase/supabase-js@2";

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
);

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY") ?? "";
const EMAIL_FROM = Deno.env.get("EMAIL_FROM") ?? "Tay Performance <onboarding@resend.dev>";
const WORKSHOP_NOTIFY_EMAIL = Deno.env.get("WORKSHOP_NOTIFY_EMAIL") ?? "";
const WEBHOOK_SECRET = Deno.env.get("WEBHOOK_SECRET") ?? "";
const TZ = "Europe/Paris";

if (EMAIL_FROM.includes("resend.dev")) {
  console.warn("EMAIL_FROM uses resend.dev — Resend rejects every recipient except the account owner. Set EMAIL_FROM on a verified domain.");
}

type Kind = "received" | "workshop_new" | "confirmed" | "cancelled" | "completed" | "rescheduled" | "reminder";

type BookingRow = {
  id: string;
  reference: string;
  slot_start: string;
  slot_end: string;
  duration_min: number;
  status: string;
  price_total: number | null; // null = sur devis (utilitaire / pick-up), fixé par l'atelier après analyse
  contact_name: string;
  contact_email: string | null;
  legal_flag: string;
  for_other: boolean;
  created_by_admin: boolean;
  user_id: string | null;
  /** booker profile (only relevant when for_other) */
  profiles: { full_name: string | null; email: string | null } | null;
};

const BOOKING_SELECT =
  "id, reference, slot_start, slot_end, duration_min, status, price_total, contact_name, contact_email, " +
  "legal_flag, for_other, created_by_admin, user_id, profiles(full_name, email)";

const dateFmt = new Intl.DateTimeFormat("fr-FR", {
  weekday: "long", day: "numeric", month: "long", year: "numeric",
  timeZone: "Europe/Paris",
});
const timeFmt = new Intl.DateTimeFormat("fr-FR", {
  hour: "2-digit", minute: "2-digit", timeZone: "Europe/Paris",
});

// ---------------------------------------------------------------- send (claim → Resend → log)

async function resend(to: string, subject: string, html: string): Promise<{ id?: string; error?: string }> {
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({ from: EMAIL_FROM, to: [to], subject, html }),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) return { error: `${res.status} ${json.name ?? ""} ${json.message ?? ""}`.trim() };
  return { id: json.id };
}

async function send(b: BookingRow, kind: Kind, to: string | null | undefined, subject: string, html: string): Promise<string> {
  if (!to) return `${kind}:no_email`;
  const { data: logId, error: claimErr } = await supabase.rpc("email_claim", {
    p_booking_id: b.id, p_kind: kind, p_slot_start: b.slot_start, p_to: to,
  });
  if (claimErr) throw new Error(`email_claim: ${claimErr.message}`);
  if (!logId) return `${kind}:duplicate`;

  const r = await resend(to, subject, html);
  if (r.error) console.error("resend", kind, b.reference, to, r.error);
  const { error: logErr } = await supabase.from("email_log")
    .update({ ...(r.error ? { status: "failed", error: r.error } : { status: "sent", provider_id: r.id }), updated_at: new Date().toISOString() })
    .eq("id", logId);
  if (logErr) console.error("email_log update", logId, logErr.message);
  return r.error ? `${kind}:failed ${r.error}` : `${kind}:sent`;
}

// ---------------------------------------------------------------- data

async function getBooking(id: string): Promise<BookingRow | null> {
  const { data, error } = await supabase.from("bookings").select(BOOKING_SELECT).eq("id", id).single();
  if (error) console.error("booking read", id, error.message);
  return data as unknown as BookingRow | null;
}

async function getAddress(): Promise<string> {
  const { data } = await supabase.from("app_settings").select("value").eq("key", "workshop_address").maybeSingle();
  return typeof data?.value === "string" ? data.value : "19 Rue de l'industrie, 67400 Illkirch-Graffenstaden";
}

// ---------------------------------------------------------------- templates

function recapHtml(b: BookingRow, address: string): string {
  const d = new Date(b.slot_start);
  return `
  <table style="font-family:Arial,sans-serif;font-size:14px;color:#111;border-collapse:collapse">
    <tr><td style="padding:4px 12px 4px 0;color:#666">Référence</td><td><b>${b.reference}</b></td></tr>
    ${b.for_other ? `<tr><td style="padding:4px 12px 4px 0;color:#666">Rendez-vous pour</td><td>${b.contact_name}</td></tr>` : ""}
    <tr><td style="padding:4px 12px 4px 0;color:#666">Date</td><td>${dateFmt.format(d)}</td></tr>
    <tr><td style="padding:4px 12px 4px 0;color:#666">Heure</td><td>${timeFmt.format(d)}</td></tr>
    <tr><td style="padding:4px 12px 4px 0;color:#666">Durée estimée</td><td>~${b.duration_min} min</td></tr>
    <tr><td style="padding:4px 12px 4px 0;color:#666">${b.price_total == null ? "Prix" : "Total (règlement à l'atelier)"}</td><td><b>${b.price_total == null ? "communiqué par l'atelier après analyse de votre véhicule" : `${Number(b.price_total).toFixed(2)} €`}</b></td></tr>
    <tr><td style="padding:4px 12px 4px 0;color:#666">Adresse</td><td>${address}</td></tr>
  </table>`;
}

function wrap(title: string, body: string): string {
  return `<div style="font-family:Arial,sans-serif;max-width:560px;margin:0 auto;padding:24px">
    <h2 style="font-size:18px;color:#111">${title}</h2>${body}
    <p style="font-size:12px;color:#999;margin-top:24px">Tay Performance · Vitres teintées · Conforme réglementation France</p>
  </div>`;
}

/** When a profile books for someone else, the booker gets a copy of every notification. */
async function sendBookerCopy(b: BookingRow, kind: Kind, subject: string, intro: string, recap: string): Promise<string | null> {
  const bookerEmail = b.for_other ? b.profiles?.email : null;
  if (!bookerEmail || bookerEmail.toLowerCase() === b.contact_email?.toLowerCase()) return null;
  return await send(b, kind, bookerEmail,
    `${subject} (réservé pour ${b.contact_name})`,
    wrap(`Bonjour ${b.profiles?.full_name ?? ""},`.replace(" ,", ","), `<p>${intro}</p>${recap}`));
}

// ---------------------------------------------------------------- handlers

async function handleBookingCreated(bookingId: string): Promise<string[]> {
  const b = await getBooking(bookingId);
  if (!b) return ["error:booking_not_found"];
  // admin_create_booking: the booking is born `confirmed` — the confirmation mail comes from
  // its history row (null → confirmed); no "demande reçue", no workshop notification.
  if (b.created_by_admin) return ["ignored:admin_created"];

  const recap = recapHtml(b, await getAddress());
  const out: string[] = [];
  out.push(await send(b, "received", b.contact_email, `Demande reçue — ${b.reference}`,
    wrap(`Bonjour ${b.contact_name},`,
      `<p>Votre créneau est réservé. L'atelier confirme votre rendez-vous rapidement — vous recevrez un e-mail dès validation.</p>${recap}`)));
  const copy = await sendBookerCopy(b, "received", `Demande reçue — ${b.reference}`,
    `Vous avez réservé un créneau pour <b>${b.contact_name}</b>. L'atelier confirme rapidement.`, recap);
  if (copy) out.push(copy);
  out.push(await send(b, "workshop_new", WORKSHOP_NOTIFY_EMAIL, `Nouvelle demande — ${b.reference}`,
    wrap("Nouvelle demande de réservation",
      (b.for_other ? `<p>Réservé par <b>${b.profiles?.full_name ?? "profil"}</b> (${b.profiles?.email ?? "—"}) pour <b>${b.contact_name}</b>.</p>` : "") + recap)));
  return out;
}

async function handleStatusChange(bookingId: string, from: string | null, to: string): Promise<string[]> {
  const b = await getBooking(bookingId);
  if (!b) return ["error:booking_not_found"];
  if (b.status !== to) return [`ignored:status_moved_to_${b.status}`];
  if (!b.contact_email && !(b.for_other && b.profiles?.email)) return [`${to}:no_email`];
  const recap = recapHtml(b, await getAddress());
  const out: (string | null)[] = [];
  switch (to) {
    case "confirmed":
      if (from === "in_progress") return ["ignored:step_back"]; // not a new confirmation
      out.push(await send(b, "confirmed", b.contact_email, `Rendez-vous confirmé — ${b.reference}`,
        wrap(`C'est confirmé, ${b.contact_name} !`,
          `<p>On vous attend à l'atelier. Présentez-vous 5 min avant — un café vous attend.</p>${recap}`)));
      out.push(await sendBookerCopy(b, "confirmed", `Rendez-vous confirmé — ${b.reference}`,
        `Le rendez-vous que vous avez réservé pour <b>${b.contact_name}</b> est confirmé.`, recap));
      break;
    case "cancelled":
      out.push(await send(b, "cancelled", b.contact_email, `Rendez-vous annulé — ${b.reference}`,
        wrap("Rendez-vous annulé",
          `<p>Votre rendez-vous a été annulé. Besoin d'un nouveau créneau ? Réservez en ligne quand vous voulez.</p>${recap}`)));
      out.push(await sendBookerCopy(b, "cancelled", `Rendez-vous annulé — ${b.reference}`,
        `Le rendez-vous que vous avez réservé pour <b>${b.contact_name}</b> a été annulé.`, recap));
      break;
    case "completed":
      if (from !== "in_progress") return [`ignored:${from}->completed`];
      out.push(await send(b, "completed", b.contact_email, `Pose terminée — ${b.reference}`,
        wrap(`Merci ${b.contact_name} !`,
          `<p>Votre pose est terminée. Retrouvez les photos et votre garantie dans votre espace « Mes réservations ».</p>${recap}`)));
      break;
    default:
      return [`ignored:${from}->${to}`];
  }
  return out.filter((x): x is string => x !== null);
}

/** Admin moved the booking (0018) — note: reschedule|<old ISO>|<new ISO>|<reason> */
async function handleRescheduled(bookingId: string, note: string): Promise<string[]> {
  const b = await getBooking(bookingId);
  if (!b) return ["error:booking_not_found"];
  const [, oldIso, , ...rest] = note.split("|");
  const reason = rest.join("|").trim();
  const old = new Date(oldIso);
  const was = Number.isNaN(old.getTime()) ? "" : `${dateFmt.format(old)} à ${timeFmt.format(old)}`;
  const recap = recapHtml(b, await getAddress());
  const intro = `L'atelier a déplacé votre rendez-vous${was ? ` (initialement le ${was})` : ""}.`
    + (reason ? ` Motif : ${reason}.` : "")
    + " Voici le nouveau créneau :";
  const out: (string | null)[] = [];
  out.push(await send(b, "rescheduled", b.contact_email, `Rendez-vous déplacé — ${b.reference}`,
    wrap(`Bonjour ${b.contact_name},`, `<p>${intro}</p>${recap}`)));
  out.push(await sendBookerCopy(b, "rescheduled", `Rendez-vous déplacé — ${b.reference}`,
    `Le rendez-vous réservé pour <b>${b.contact_name}</b> a été déplacé${was ? ` (initialement le ${was})` : ""}.`, recap));
  return out.filter((x): x is string => x !== null);
}

/** "YYYY-MM-DD" of an instant, in the workshop timezone */
const ymd = (d: Date) =>
  new Intl.DateTimeFormat("en-CA", { timeZone: TZ, year: "numeric", month: "2-digit", day: "2-digit" }).format(d);

async function handleReminders(): Promise<string[]> {
  // tomorrow in Europe/Paris — compared as calendar dates, independent of the runtime's UTC clock
  const [y, m, d] = ymd(new Date()).split("-").map(Number);
  const tomorrow = new Date(Date.UTC(y, m - 1, d + 1)).toISOString().slice(0, 10);
  const now = Date.now();
  const { data, error } = await supabase
    .from("bookings")
    .select(BOOKING_SELECT)
    .eq("status", "confirmed")
    .gte("slot_start", new Date(now).toISOString())
    .lt("slot_start", new Date(now + 60 * 60 * 1000 * 60).toISOString()); // 60 h window, filtered below
  if (error) throw new Error(`reminder query: ${error.message}`);
  const address = await getAddress();
  const out: string[] = [];
  for (const b of (data ?? []) as unknown as BookingRow[]) {
    if (ymd(new Date(b.slot_start)) !== tomorrow) continue;
    try {
      out.push(`${b.reference}:` + await send(b, "reminder", b.contact_email, `Rappel — rendez-vous demain (${b.reference})`,
        wrap(`À demain, ${b.contact_name} !`,
          `<p>Petit rappel de votre rendez-vous à l'atelier.</p>${recapHtml(b, address)}`)));
    } catch (e) {
      console.error("reminder", b.reference, e); // one bad row must not block the others
      out.push(`${b.reference}:error ${e instanceof Error ? e.message : e}`);
    }
  }
  return out;
}

Deno.serve(async (req) => {
  try {
    if (!WEBHOOK_SECRET || req.headers.get("x-webhook-secret") !== WEBHOOK_SECRET) {
      console.error("forbidden: x-webhook-secret missing or different from WEBHOOK_SECRET");
      return new Response("forbidden", { status: 403 });
    }
    if (!RESEND_API_KEY) {
      console.error("RESEND_API_KEY missing");
      return new Response(JSON.stringify({ ok: false, error: "not_configured" }), { status: 500 });
    }
    const payload = await req.json();
    let result: string[] = ["ignored:unknown_payload"];

    if (payload?.type === "reminder") {
      result = await handleReminders();
    } else if (payload?.type === "INSERT" && payload?.table === "bookings") {
      result = await handleBookingCreated(payload.record.id);
    } else if (payload?.type === "INSERT" && payload?.table === "booking_status_history") {
      const rec = payload.record;
      const note: string = rec.note ?? "";
      if (note.startsWith("reschedule|")) {
        result = await handleRescheduled(rec.booking_id, note);
      } else if (rec.from_status !== rec.to_status && (rec.from_status !== null || rec.to_status === "confirmed")) {
        // from = to rows are price / revenue annotations; null → requested is the client's own
        // booking (handled by the bookings INSERT); null → confirmed is an admin-created booking
        result = await handleStatusChange(rec.booking_id, rec.from_status, rec.to_status);
      } else {
        result = ["ignored:not_a_transition"];
      }
    }
    console.log("send-booking-email", JSON.stringify(result));
    // the body lands in net._http_response.content — readable from the SQL editor
    return new Response(JSON.stringify({ ok: true, result }), {
      headers: { "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error(e);
    return new Response(JSON.stringify({ ok: false, error: e instanceof Error ? e.message : String(e) }), { status: 500 });
  }
});
