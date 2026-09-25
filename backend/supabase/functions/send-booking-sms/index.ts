// send-booking-sms — client SMS dispatcher (Twilio Programmable Messaging)
// Same Twilio account / Messaging Service as Supabase Auth phone OTP.
//
// Invoked by:
//   • Database Webhook — INSERT on public.booking_status_history
//       → `confirmed` (admin validated the RDV) and `in_progress → completed` (pose terminée + avis Google)
//   • pg_cron — { "type": "reminder" } once a day
//       → J-1 reminder, only for confirmed bookings made ≥ sms_reminder_min_lead_days before the RDV
//
// Secrets (supabase secrets set):
//   TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_MESSAGING_SERVICE_SID
//   WEBHOOK_SECRET — same value as send-booking-email (x-webhook-secret header)
// SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY are injected automatically.
//
// Idempotency: public.sms_claim() (0021) — one message per (booking, kind, slot_start).

import { createClient } from "npm:@supabase/supabase-js@2";

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
);

const TWILIO_SID = Deno.env.get("TWILIO_ACCOUNT_SID") ?? "";
const TWILIO_TOKEN = Deno.env.get("TWILIO_AUTH_TOKEN") ?? "";
const TWILIO_MSID = Deno.env.get("TWILIO_MESSAGING_SERVICE_SID") ?? "";
const WEBHOOK_SECRET = Deno.env.get("WEBHOOK_SECRET") ?? "";
const TZ = "Europe/Paris";

type SmsKind = "confirmed" | "reminder" | "completed";

type Booking = {
  id: string;
  reference: string;
  slot_start: string;
  status: string;
  contact_name: string;
  contact_phone: string | null;
  vehicle_variants: {
    generations: { models: { name: string; makes: { name: string } | null } | null } | null;
  } | null;
};

type Settings = {
  enabled: boolean;
  address: string;
  phone: string;
  reviewUrl: string;
  mapsUrl: string;
};

const BOOKING_SELECT =
  "id, reference, slot_start, status, contact_name, contact_phone, " +
  "vehicle_variants(generations(models(name, makes(name))))";

// ---------------------------------------------------------------- formatting

const dayFmt = new Intl.DateTimeFormat("fr-FR", { weekday: "long", day: "numeric", month: "long", timeZone: TZ });
const hourFmt = new Intl.DateTimeFormat("fr-FR", { hour: "2-digit", minute: "2-digit", timeZone: TZ });

const day = (iso: string) => dayFmt.format(new Date(iso)).replace(/ 1 /, " 1er "); // "jeudi 2 octobre", "jeudi 1er octobre"
const hour = (iso: string) => hourFmt.format(new Date(iso)).replace(":", "h"); // "14h30"
const firstName = (full: string) => full.trim().split(/\s+/)[0] ?? "";

function vehicleLabel(b: Booking): string {
  const m = b.vehicle_variants?.generations?.models;
  return m ? [m.makes?.name, m.name].filter(Boolean).join(" ") : "";
}

/** FR-first E.164. Accepts "06 12 34 56 78", "+33 6…", "0033 6…", "33612345678". */
export function toE164(raw: string | null | undefined): string | null {
  if (!raw) return null;
  let p = raw.replace(/[\s.\-()/]/g, "");
  if (p.startsWith("00")) p = "+" + p.slice(2);
  if (/^0[1-9]\d{8}$/.test(p)) p = "+33" + p.slice(1);
  else if (/^33[1-9]\d{8}$/.test(p)) p = "+" + p;
  return /^\+[1-9]\d{7,14}$/.test(p) ? p : null;
}

// GSM-7 keeps a segment at 160 chars (153 when concatenated); one non-GSM char (’, ê, ç…)
// flips the whole SMS to UCS-2 → 70/67 chars per segment, i.e. ~2.3× the price.
const GSM7 = new Set(
  "@£$¥èéùìòÇ\nØø\rÅåΔ_ΦΓΛΩΠΨΣΘΞÆæßÉ !\"#¤%&'()*+,-./0123456789:;<=>?¡" +
    "ABCDEFGHIJKLMNOPQRSTUVWXYZÄÖÑÜ§¿abcdefghijklmnopqrstuvwxyzäöñüà^{}\\[~]|€",
);
const GSM_MAP: Record<string, string> = {
  "’": "'", "‘": "'", "“": '"', "”": '"', "«": '"', "»": '"', "–": "-", "—": "-",
  "…": "...", " ": " ", " ": " ", "ç": "c",
};
export function toGsm7(s: string): string {
  let out = "";
  for (const ch of s) {
    if (GSM7.has(ch)) { out += ch; continue; }
    if (GSM_MAP[ch] !== undefined) { out += GSM_MAP[ch]; continue; }
    const base = ch.normalize("NFD").replace(/\p{M}/gu, ""); // ê → e, ï → i, Ô → O
    out += base && [...base].every((c) => GSM7.has(c)) ? base : ch; // non-Latin names stay as-is (UCS-2)
  }
  return out;
}

// ---------------------------------------------------------------- templates

function render(kind: SmsKind, b: Booking, s: Settings): string {
  const who = firstName(b.contact_name);
  const hello = who ? `Bonjour ${who}, ` : "Bonjour, ";
  switch (kind) {
    case "confirmed":
      return `${hello}votre RDV chez TAY Performance est confirmé : ${day(b.slot_start)} à ${hour(b.slot_start)} ` +
        `(réf. ${b.reference}). Adresse : ${s.address}. Itinéraire : ${s.mapsUrl} ` +
        `Merci d'arriver 5 min en avance. Une question ? ${s.phone}`;
    case "reminder":
      return `Rappel TAY Performance : ${who ? `${who}, ` : ""}on vous attend demain ${day(b.slot_start)} à ${hour(b.slot_start)} ` +
        `pour la pose de vos vitres teintées (réf. ${b.reference}). Adresse : ${s.address}. ` +
        `Itinéraire : ${s.mapsUrl} Imprévu ? Appelez-nous au ${s.phone}`;
    case "completed": {
      const car = vehicleLabel(b);
      return `Merci${who ? ` ${who}` : ""} ! La pose de vos vitres teintées${car ? ` sur votre ${car}` : ""} est terminée ` +
        `(réf. ${b.reference}, ${day(b.slot_start)}). Photos et garantie dans votre espace client. ` +
        `Votre avis compte beaucoup pour nous, laissez-nous un mot sur Google : ${s.reviewUrl}`;
    }
  }
}

// ---------------------------------------------------------------- data

async function getSettings(): Promise<Settings> {
  const { data } = await supabase
    .from("app_settings")
    .select("key, value")
    .in("key", ["sms_enabled", "workshop_address", "contact_phone", "google_review_url", "google_maps_url"]);
  const v = Object.fromEntries((data ?? []).map((r) => [r.key, r.value]));
  return {
    enabled: v.sms_enabled !== false,
    address: v.workshop_address ?? "19 Rue de l'Industrie, 67400 Illkirch-Graffenstaden",
    phone: v.contact_phone ?? "06 05 50 50 28",
    reviewUrl: v.google_review_url ?? "https://maps.app.goo.gl/SDoKBodNRucu2WKE8",
    mapsUrl: v.google_maps_url ?? "https://maps.app.goo.gl/SDoKBodNRucu2WKE8",
  };
}

async function getBooking(id: string): Promise<Booking | null> {
  const { data, error } = await supabase.from("bookings").select(BOOKING_SELECT).eq("id", id).single();
  if (error) console.error("booking read", id, error.message);
  return data as unknown as Booking | null;
}

// ---------------------------------------------------------------- send

async function twilioSend(to: string, body: string): Promise<{ sid?: string; error?: string }> {
  const res = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${TWILIO_SID}/Messages.json`, {
    method: "POST",
    headers: {
      Authorization: "Basic " + btoa(`${TWILIO_SID}:${TWILIO_TOKEN}`),
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({ To: to, MessagingServiceSid: TWILIO_MSID, Body: body }),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) return { error: `${res.status} ${json.code ?? ""} ${json.message ?? ""}`.trim() };
  return { sid: json.sid };
}

async function dispatch(kind: SmsKind, b: Booking, s: Settings): Promise<void> {
  const to = toE164(b.contact_phone);
  const { data: logId, error: claimErr } = await supabase.rpc("sms_claim", {
    p_booking_id: b.id, p_kind: kind, p_slot_start: b.slot_start, p_to: to,
  });
  if (claimErr) throw new Error(`sms_claim: ${claimErr.message}`);
  if (!logId) return; // already sent / in flight for this slot

  const done = (patch: Record<string, unknown>) =>
    supabase.from("sms_log").update({ ...patch, updated_at: new Date().toISOString() }).eq("id", logId);

  if (!to) {
    await done({ status: "skipped", error: `INVALID_PHONE: ${b.contact_phone ?? "null"}` });
    return;
  }
  const r = await twilioSend(to, toGsm7(render(kind, b, s)));
  if (r.error) console.error("twilio", kind, b.reference, r.error);
  await done(r.error ? { status: "failed", error: r.error } : { status: "sent", provider_sid: r.sid });
}

// ---------------------------------------------------------------- handlers

async function handleStatusRow(rec: { booking_id: string; from_status: string | null; to_status: string; note: string | null }) {
  if (rec.from_status === null || rec.from_status === rec.to_status) return; // creation / price / reschedule rows
  let kind: SmsKind | null = null;
  if (rec.to_status === "confirmed" && rec.from_status !== "in_progress") kind = "confirmed"; // step-back ≠ new confirmation
  if (rec.to_status === "completed" && rec.from_status === "in_progress") kind = "completed";
  if (!kind) return;

  const s = await getSettings();
  if (!s.enabled) return;
  const b = await getBooking(rec.booking_id);
  if (!b || b.status !== rec.to_status) return; // status moved again before we ran
  if (kind === "confirmed" && new Date(b.slot_start) < new Date()) return;
  await dispatch(kind, b, s);
}

async function handleReminders(): Promise<number> {
  const s = await getSettings();
  if (!s.enabled) return 0;
  const { data: ids, error } = await supabase.rpc("sms_reminder_candidates");
  if (error) throw new Error(`sms_reminder_candidates: ${error.message}`);
  let n = 0;
  for (const id of (ids ?? []) as string[]) {
    const b = await getBooking(id);
    if (!b) continue;
    try {
      await dispatch("reminder", b, s);
      n++;
    } catch (e) {
      console.error("reminder", id, e); // one bad row must not block the others
    }
  }
  return n;
}

Deno.serve(async (req) => {
  try {
    if (!WEBHOOK_SECRET || req.headers.get("x-webhook-secret") !== WEBHOOK_SECRET) {
      return new Response("forbidden", { status: 403 });
    }
    if (!TWILIO_SID || !TWILIO_TOKEN || !TWILIO_MSID) {
      console.error("Twilio secrets missing");
      return new Response(JSON.stringify({ ok: false, error: "not_configured" }), { status: 500 });
    }
    const payload = await req.json();
    let processed = 0;
    if (payload?.type === "reminder") {
      processed = await handleReminders();
    } else if (payload?.type === "INSERT" && payload?.table === "booking_status_history") {
      await handleStatusRow(payload.record);
    }
    return new Response(JSON.stringify({ ok: true, processed }), { headers: { "Content-Type": "application/json" } });
  } catch (e) {
    console.error(e);
    return new Response(JSON.stringify({ ok: false }), { status: 500 });
  }
});
