// send-booking-sms — client + admin SMS dispatcher (Twilio Programmable Messaging)
// Same Twilio account / Messaging Service as Supabase Auth phone OTP.
//
// Invoked by (migration 0022, public._notify_edge → pg_net):
//   • trigger AFTER INSERT on public.booking_status_history
//       → `confirmed` (admin validated the RDV, or created it directly as confirmed)
//         and `in_progress → completed` (pose terminée + avis Google)
//       → admin alert when a client cancels or reprograms a booking
//   • trigger AFTER INSERT on public.bookings → admin alert on a new client booking
//   • trigger AFTER INSERT / status UPDATE on public.service_requests (0023)
//       → admin alert on a new / cancelled devis, client SMS when the workshop declines it
//   • pg_cron — { "type": "reminder" } once a day
//       → J-1 reminder, only for confirmed bookings made ≥ sms_reminder_min_lead_days before the RDV
//
// Secrets (supabase secrets set):
//   TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_MESSAGING_SERVICE_SID
//   WEBHOOK_SECRET — same value as send-booking-email (x-webhook-secret header)
// SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY are injected automatically.
//
// Idempotency: public.sms_claim() (0021) — one client message per (booking, kind, slot_start);
// public.notify_claim() (0023) — one message per event for everything else.
//
// Admin phone: private_settings.admin_sms_phone (Admin → Config), else app_settings.contact_phone.

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
  contact_name: string | null;
  contact_phone: string | null;
  /** set = prestation personnalisée (0023) */
  custom_title: string | null;
  admin_message: string | null;
  created_by_admin: boolean;
  vehicle_variants: {
    generations: { models: { name: string; makes: { name: string } | null } | null } | null;
  } | null;
};

type ServiceRequest = {
  id: string;
  reference: string;
  user_id: string | null;
  service_label: string;
  contact_name: string | null;
  contact_phone: string;
  status: string;
  admin_reply: string | null;
};

type Settings = {
  enabled: boolean;
  address: string;
  phone: string;
  reviewUrl: string;
  mapsUrl: string;
};

const BOOKING_SELECT =
  "id, reference, slot_start, status, contact_name, contact_phone, custom_title, admin_message, created_by_admin, " +
  "vehicle_variants(generations(models(name, makes(name))))";

// ---------------------------------------------------------------- formatting

const dayFmt = new Intl.DateTimeFormat("fr-FR", { weekday: "long", day: "numeric", month: "long", timeZone: TZ });
const hourFmt = new Intl.DateTimeFormat("fr-FR", { hour: "2-digit", minute: "2-digit", timeZone: TZ });

const day = (iso: string) => dayFmt.format(new Date(iso)).replace(/ 1 /, " 1er "); // "jeudi 2 octobre", "jeudi 1er octobre"
const hour = (iso: string) => hourFmt.format(new Date(iso)).replace(":", "h"); // "14h30"
const firstName = (full: string | null) => full?.trim().split(/\s+/)[0] ?? "";

function vehicleLabel(b: Booking): string {
  const m = b.vehicle_variants?.generations?.models;
  return m ? [m.makes?.name, m.name].filter(Boolean).join(" ") : "";
}

/** What the admin needs to recognise a booking: "Golf 8" or the custom job's title. */
const bookingLabel = (b: Booking) => b.custom_title ?? vehicleLabel(b);
const whoLabel = (name: string | null) => name?.trim() || "client sans nom";

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
      return `${hello}votre RDV chez TAY Performance${b.custom_title ? ` (${b.custom_title})` : ""} est confirmé : ${day(b.slot_start)} à ${hour(b.slot_start)} ` +
        `(réf. ${b.reference}). ${b.admin_message ? `Message de l'atelier : ${b.admin_message} ` : ""}Adresse : ${s.address}. Itinéraire : ${s.mapsUrl} ` +
        `Merci d'arriver 5 min en avance. Une question ? ${s.phone}`;
    case "reminder":
      return `Rappel TAY Performance : ${who ? `${who}, ` : ""}on vous attend demain ${day(b.slot_start)} à ${hour(b.slot_start)} ` +
        `pour ${b.custom_title ?? "la pose de vos vitres teintées"} (réf. ${b.reference}). Adresse : ${s.address}. ` +
        `Itinéraire : ${s.mapsUrl} Imprévu ? Appelez-nous au ${s.phone}`;
    case "completed": {
      const car = vehicleLabel(b);
      const done = b.custom_title ? `Votre prestation (${b.custom_title})` : `La pose de vos vitres teintées${car ? ` sur votre ${car}` : ""}`;
      return `Merci${who ? ` ${who}` : ""} ! ${done} est terminée ` +
        `(réf. ${b.reference}, ${day(b.slot_start)}). Photos et garantie dans votre espace client. ` +
        `Votre avis compte beaucoup pour nous, laissez-nous un mot sur Google : ${s.reviewUrl}`;
    }
  }
}

const ADMIN_PREFIX = "TAY Admin -";

const adminNewBooking = (b: Booking) =>
  `${ADMIN_PREFIX} Nouvelle demande ${b.reference} : ${whoLabel(b.contact_name)}, ${bookingLabel(b)}, ` +
  `${day(b.slot_start)} à ${hour(b.slot_start)}. Tél ${b.contact_phone}. À valider dans le dashboard.`;

const adminCancelledBooking = (b: Booking) =>
  `${ADMIN_PREFIX} RDV annulé par le client : ${b.reference}, ${whoLabel(b.contact_name)}, ${bookingLabel(b)}, ` +
  `${day(b.slot_start)} à ${hour(b.slot_start)}. Créneau libéré.`;

const adminReprogrammed = (oldB: Booking, newB: Booking) =>
  `${ADMIN_PREFIX} RDV reprogrammé par le client : ${oldB.reference} > ${newB.reference}, ${whoLabel(newB.contact_name)}, ` +
  `${bookingLabel(newB)}, nouveau créneau ${day(newB.slot_start)} à ${hour(newB.slot_start)}. À valider.`;

const adminNewRequest = (r: ServiceRequest) =>
  `${ADMIN_PREFIX} Nouveau devis ${r.reference} (${r.service_label}) : ${whoLabel(r.contact_name)}, tél ${r.contact_phone}. ` +
  `À rappeler pour fixer date et prix.`;

const adminCancelledRequest = (r: ServiceRequest) =>
  `${ADMIN_PREFIX} Devis ${r.reference} (${r.service_label}) annulé par le client : ${whoLabel(r.contact_name)}, tél ${r.contact_phone}.`;

const clientDeclined = (r: ServiceRequest, s: Settings) => {
  const who = firstName(r.contact_name);
  return `${who ? `Bonjour ${who}, ` : "Bonjour, "}TAY Performance ne peut pas donner suite à votre demande ${r.reference} (${r.service_label}).` +
    `${r.admin_reply ? ` Motif : ${r.admin_reply}.` : ""} Une question ? ${s.phone}`;
};

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

async function getAdminPhone(s: Settings): Promise<string | null> {
  const { data, error } = await supabase.from("private_settings").select("value").eq("key", "admin_sms_phone").maybeSingle();
  if (error) console.error("admin phone read", error.message);
  return toE164(data?.value) ?? toE164(s.phone);
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

async function dispatch(kind: SmsKind, b: Booking, s: Settings): Promise<string> {
  const to = toE164(b.contact_phone);
  const { data: logId, error: claimErr } = await supabase.rpc("sms_claim", {
    p_booking_id: b.id, p_kind: kind, p_slot_start: b.slot_start, p_to: to,
  });
  if (claimErr) throw new Error(`sms_claim: ${claimErr.message}`);
  if (!logId) return `${kind}:duplicate`; // already sent / in flight for this slot

  const done = (patch: Record<string, unknown>) =>
    supabase.from("sms_log").update({ ...patch, updated_at: new Date().toISOString() }).eq("id", logId);

  if (!to) {
    await done({ status: "skipped", error: `INVALID_PHONE: ${b.contact_phone ?? "null"}` });
    return `${kind}:invalid_phone`;
  }
  const r = await twilioSend(to, toGsm7(render(kind, b, s)));
  if (r.error) console.error("twilio", kind, b.reference, r.error);
  const { error: logErr } = await done(r.error ? { status: "failed", error: r.error } : { status: "sent", provider_sid: r.sid });
  if (logErr) console.error("sms_log update", logId, logErr.message);
  return r.error ? `${kind}:failed ${r.error}` : `${kind}:sent ${r.sid}`;
}

/** One message per event (0023): admin alerts + request notices, not tied to a booking slot. */
async function dispatchEvent(eventKey: string, to: string | null, body: string): Promise<string> {
  const { data: logId, error: claimErr } = await supabase.rpc("notify_claim", {
    p_event_key: eventKey, p_channel: "sms", p_to: to,
  });
  if (claimErr) throw new Error(`notify_claim: ${claimErr.message}`);
  if (!logId) return `${eventKey}:duplicate`;

  const done = (patch: Record<string, unknown>) =>
    supabase.from("notification_log").update({ ...patch, updated_at: new Date().toISOString() }).eq("id", logId);

  if (!to) {
    await done({ status: "skipped", error: "INVALID_PHONE" });
    return `${eventKey}:invalid_phone`;
  }
  const r = await twilioSend(to, toGsm7(body));
  if (r.error) console.error("twilio", eventKey, r.error);
  const { error: logErr } = await done(r.error ? { status: "failed", error: r.error } : { status: "sent", provider_id: r.sid });
  if (logErr) console.error("notification_log update", logId, logErr.message);
  return r.error ? `${eventKey}:failed ${r.error}` : `${eventKey}:sent ${r.sid}`;
}

// ---------------------------------------------------------------- handlers

/** reschedule_booking writes `reprogrammation → <new ref>` on the old booking's cancelled row. */
const REPROGRAM_NOTE = "reprogrammation → ";

async function handleBookingInsert(rec: { id: string; reference: string; created_by_admin: boolean }): Promise<string> {
  if (rec.created_by_admin) return "ignored:admin_created"; // he made it himself
  const s = await getSettings();
  if (!s.enabled) return "ignored:sms_disabled";
  // a reprogrammed booking is announced once, by the cancelled row of the old one
  const { data: moved } = await supabase.from("booking_status_history").select("id")
    .eq("note", REPROGRAM_NOTE + rec.reference).limit(1);
  if (moved?.length) return "ignored:reprogrammed";
  const b = await getBooking(rec.id);
  if (!b) return "error:booking_not_found";
  return await dispatchEvent(`admin:booking:${b.id}:new`, await getAdminPhone(s), adminNewBooking(b));
}

async function handleCancelled(
  rec: { id: string; booking_id: string; changed_by: string | null; note: string | null },
): Promise<string> {
  // the admin cancelling from his own dashboard does not need a text about it
  if (rec.changed_by) {
    const { data: who } = await supabase.from("profiles").select("role").eq("id", rec.changed_by).maybeSingle();
    if (who && who.role !== "client") return "ignored:cancelled_by_staff";
  }
  const s = await getSettings();
  if (!s.enabled) return "ignored:sms_disabled";
  const b = await getBooking(rec.booking_id);
  if (!b) return "error:booking_not_found";

  let body = adminCancelledBooking(b);
  if (rec.note?.startsWith(REPROGRAM_NOTE)) {
    const { data: next } = await supabase.from("bookings").select(BOOKING_SELECT)
      .eq("reference", rec.note.slice(REPROGRAM_NOTE.length)).maybeSingle();
    if (next) body = adminReprogrammed(b, next as unknown as Booking);
  }
  return await dispatchEvent(`admin:history:${rec.id}:cancelled`, await getAdminPhone(s), body);
}

async function handleServiceRequest(type: "INSERT" | "UPDATE", r: ServiceRequest): Promise<string> {
  const s = await getSettings();
  if (!s.enabled) return "ignored:sms_disabled";
  if (type === "INSERT") return await dispatchEvent(`admin:request:${r.id}:new`, await getAdminPhone(s), adminNewRequest(r));
  if (r.status === "cancelled") return await dispatchEvent(`admin:request:${r.id}:cancelled`, await getAdminPhone(s), adminCancelledRequest(r));
  if (r.status === "declined") return await dispatchEvent(`client:request:${r.id}:declined`, toE164(r.contact_phone), clientDeclined(r, s));
  return `ignored:request_${r.status}`; // confirmed → the new booking's history row notifies
}

async function handleStatusRow(
  rec: { id: string; booking_id: string; from_status: string | null; to_status: string; changed_by: string | null; note: string | null },
): Promise<string> {
  if (rec.to_status === "cancelled" && rec.from_status !== "cancelled") return await handleCancelled(rec);

  // admin_create_booking inserts the booking directly as `confirmed` (history row null → confirmed):
  // that IS the confirmation. Client bookings start with null → requested (no SMS).
  const adminCreated = rec.from_status === null && rec.to_status === "confirmed";
  if (!adminCreated && (rec.from_status === null || rec.from_status === rec.to_status)) return "ignored:not_a_transition";

  let kind: SmsKind | null = null;
  if (rec.to_status === "confirmed" && rec.from_status !== "in_progress") kind = "confirmed"; // step-back ≠ new confirmation
  if (rec.to_status === "completed" && rec.from_status === "in_progress") kind = "completed";
  if (!kind) return `ignored:${rec.from_status}->${rec.to_status}`;

  const s = await getSettings();
  if (!s.enabled) return "ignored:sms_disabled";
  const b = await getBooking(rec.booking_id);
  if (!b) return "error:booking_not_found";
  if (b.status !== rec.to_status) return `ignored:status_moved_to_${b.status}`; // moved again before we ran
  if (kind === "confirmed" && new Date(b.slot_start) < new Date()) return "ignored:slot_in_past";
  return await dispatch(kind, b, s);
}

async function handleReminders(): Promise<string[]> {
  const s = await getSettings();
  if (!s.enabled) return ["ignored:sms_disabled"];
  const { data: ids, error } = await supabase.rpc("sms_reminder_candidates");
  if (error) throw new Error(`sms_reminder_candidates: ${error.message}`);
  const out: string[] = [];
  for (const id of (ids ?? []) as string[]) {
    const b = await getBooking(id);
    if (!b) { out.push(`${id}:booking_not_found`); continue; }
    try {
      out.push(`${b.reference}:${await dispatch("reminder", b, s)}`);
    } catch (e) {
      console.error("reminder", id, e); // one bad row must not block the others
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
    if (!TWILIO_SID || !TWILIO_TOKEN || !TWILIO_MSID) {
      console.error("Twilio secrets missing");
      return new Response(JSON.stringify({ ok: false, error: "not_configured" }), { status: 500 });
    }
    const payload = await req.json();
    let result: string | string[] = "ignored:unknown_payload";
    if (payload?.type === "reminder") {
      result = await handleReminders();
    } else if (payload?.type === "INSERT" && payload?.table === "booking_status_history") {
      result = await handleStatusRow(payload.record);
    } else if (payload?.type === "INSERT" && payload?.table === "bookings") {
      result = await handleBookingInsert(payload.record);
    } else if ((payload?.type === "INSERT" || payload?.type === "UPDATE") && payload?.table === "service_requests") {
      result = await handleServiceRequest(payload.type, payload.record);
    }
    console.log("send-booking-sms", JSON.stringify(result));
    // the body lands in net._http_response.content — readable from the SQL editor
    return new Response(JSON.stringify({ ok: true, result }), { headers: { "Content-Type": "application/json" } });
  } catch (e) {
    console.error(e);
    return new Response(JSON.stringify({ ok: false, error: e instanceof Error ? e.message : String(e) }), { status: 500 });
  }
});
