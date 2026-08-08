/* ============================================================
   Mock data layer — UI phase only.
   Will be replaced by Supabase queries when the BL is wired.
   ============================================================ */
import type {
  Booking,
  ClientRow,
  PricingRuleRow,
  QueueEntry,
  TintZone,
  VehicleRequestLead,
  VehicleSummary,
  WorkshopDayConfig,
} from '../types/domain'

import frontWindshieldTint from '../assets/bmw_front_window_tint.png'
import frontSidesTint from '../assets/bmw_front_right_left_windows_tint.png'
import rearSidesTint from '../assets/bmw_back_windows_tint.png'
import visuel5 from '../assets/visuel5.jpg'
import visuel6 from '../assets/visuel6.jpg'

/* ---------- tint zones (mapped to layered preview assets) ---------- */
export const TINT_ZONES: TintZone[] = [
  {
    code: 'pare_brise',
    labelFr: 'Pare-brise',
    group: 'avant',
    isFront: true,
    legallyRestricted: true,
    price: 90,
    minutes: 40,
    layerSrc: frontWindshieldTint,
  },
  {
    code: 'front_sides',
    labelFr: 'Vitres avant latérales',
    detailFr: '(paire)',
    group: 'avant',
    isFront: true,
    legallyRestricted: true,
    price: 60,
    minutes: 30,
    layerSrc: frontSidesTint,
  },
  {
    code: 'rear_sides',
    labelFr: 'Vitres arrière latérales',
    detailFr: '(paire)',
    group: 'arriere',
    isFront: false,
    legallyRestricted: false,
    price: 70,
    minutes: 35,
    layerSrc: rearSidesTint,
  },
  {
    code: 'rear_window',
    labelFr: 'Lunette arrière',
    group: 'arriere',
    isFront: false,
    legallyRestricted: false,
    price: 50,
    minutes: 30,
  },
  {
    code: 'panoramic_roof',
    labelFr: 'Toit panoramique',
    group: 'option',
    isFront: false,
    legallyRestricted: false,
    price: 40,
    minutes: 25,
  },
]

export const VLT_STOPS = [5, 20, 35, 50, 70, 85] as const

export const WORKSHOP_SLOTS = ['08:30', '10:00', '11:30', '14:00', '15:30', '17:00']

/* ---------- vehicles ---------- */
export const DEMO_VEHICLE: VehicleSummary = {
  id: 'veh-1',
  make: 'BMW',
  model: 'M3',
  generation: 'F30',
  bodyLabel: 'Berline',
  bodyStyle: 'berline_4p',
  years: '2014–2018',
  year: 2016,
  nickname: 'Daily M3',
  plate: 'FG-320-TP',
  color: 'San Marino Blau',
  badge: 'M3',
}

export const GARAGE_VEHICLES: VehicleSummary[] = [
  DEMO_VEHICLE,
  {
    id: 'veh-2',
    make: 'Audi',
    model: 'RS3',
    generation: '8Y',
    bodyLabel: 'Berline',
    bodyStyle: 'berline_4p',
    years: '2021–présent',
    year: 2023,
    nickname: 'Week-end',
    plate: 'GH-847-RS',
    color: 'Gris Nardo',
    badge: 'RS3',
  },
]

/* ---------- client bookings ---------- */
export const CLIENT_BOOKINGS: Booking[] = [
  {
    id: 'bk-1',
    reference: 'TP-2026-4821',
    vehicle: DEMO_VEHICLE,
    serviceType: 'tint',
    dateLabel: 'Jeudi 20 août 2026',
    timeLabel: '10:00',
    durationMin: 95,
    status: 'confirmed',
    legalFlag: 'compliant',
    priceTotal: 150,
    specs: [
      { zone: 'rear_sides', vltPercent: 20, priceDelta: 70, isLegal: true },
      { zone: 'rear_window', vltPercent: 20, priceDelta: 50, isLegal: true },
    ],
    clientNotes: 'Film le plus sombre possible à l’arrière.',
  },
  {
    id: 'bk-2',
    reference: 'TP-2026-3390',
    vehicle: GARAGE_VEHICLES[1],
    serviceType: 'tint',
    dateLabel: 'Samedi 16 mai 2026',
    timeLabel: '14:00',
    durationMin: 130,
    status: 'completed',
    legalFlag: 'compliant',
    priceTotal: 250,
    warrantyYears: 5,
    specs: [
      { zone: 'front_sides', vltPercent: 70, priceDelta: 60, isLegal: true },
      { zone: 'rear_sides', vltPercent: 5, priceDelta: 70, isLegal: true },
      { zone: 'rear_window', vltPercent: 5, priceDelta: 50, isLegal: true },
    ],
    photos: [
      { kind: 'before', src: visuel5 },
      { kind: 'after', src: visuel6 },
    ],
  },
  {
    id: 'bk-3',
    reference: 'TP-2025-9927',
    vehicle: DEMO_VEHICLE,
    serviceType: 'tint',
    dateLabel: 'Mardi 2 décembre 2025',
    timeLabel: '08:30',
    durationMin: 60,
    status: 'cancelled',
    legalFlag: 'compliant',
    priceTotal: 120,
    specs: [{ zone: 'rear_window', vltPercent: 35, priceDelta: 50, isLegal: true }],
  },
]

/* ---------- admin: daily queue ---------- */
export const ADMIN_QUEUE: QueueEntry[] = [
  {
    id: 'q-1',
    time: '08:30',
    endTime: '10:05',
    owner: 'Karim B.',
    phone: '06 12 44 09 31',
    vehicle: DEMO_VEHICLE,
    durationMin: 95,
    status: 'completed',
    specs: [
      { zone: 'rear_sides', vltPercent: 20, priceDelta: 70, isLegal: true },
      { zone: 'rear_window', vltPercent: 20, priceDelta: 50, isLegal: true },
    ],
  },
  {
    id: 'q-2',
    time: '10:30',
    endTime: '12:40',
    owner: 'Sophie L.',
    phone: '07 68 20 77 45',
    vehicle: {
      id: 'veh-3',
      make: 'Tesla',
      model: 'Model Y',
      generation: 'Juniper',
      bodyLabel: 'SUV 5 portes',
      bodyStyle: 'suv_5p',
      years: '2025–présent',
      badge: 'MY',
    },
    durationMin: 130,
    status: 'in_progress',
    specs: [
      { zone: 'front_sides', vltPercent: 70, priceDelta: 60, isLegal: true },
      { zone: 'rear_sides', vltPercent: 5, priceDelta: 70, isLegal: true },
      { zone: 'rear_window', vltPercent: 5, priceDelta: 50, isLegal: true },
      { zone: 'panoramic_roof', vltPercent: 5, priceDelta: 40, isLegal: true },
    ],
  },
  {
    id: 'q-3',
    time: '14:00',
    endTime: '15:10',
    owner: 'Mehdi A.',
    phone: '06 55 81 12 60',
    vehicle: {
      id: 'veh-4',
      make: 'Mini',
      model: 'Cooper S',
      generation: 'F56',
      bodyLabel: 'Citadine 3 portes',
      bodyStyle: 'citadine_3p',
      years: '2014–2024',
      badge: 'CS',
    },
    durationMin: 70,
    status: 'confirmed',
    specs: [
      { zone: 'rear_sides', vltPercent: 20, priceDelta: 70, isLegal: true },
      { zone: 'rear_window', vltPercent: 35, priceDelta: 50, isLegal: true },
    ],
  },
  {
    id: 'q-4',
    time: '15:30',
    endTime: '17:45',
    owner: 'Julien R.',
    phone: '07 81 34 55 02',
    vehicle: {
      id: 'veh-5',
      make: 'Audi',
      model: 'Q5',
      generation: 'FY',
      bodyLabel: 'SUV 5 portes',
      bodyStyle: 'suv_5p',
      years: '2017–2024',
      badge: 'Q5',
    },
    durationMin: 135,
    status: 'requested',
    specs: [
      { zone: 'front_sides', vltPercent: 50, priceDelta: 60, isLegal: false },
      { zone: 'rear_sides', vltPercent: 5, priceDelta: 70, isLegal: true },
      { zone: 'rear_window', vltPercent: 5, priceDelta: 50, isLegal: true },
    ],
  },
]

/* ---------- admin: clients ---------- */
export const ADMIN_CLIENTS: ClientRow[] = [
  { id: 'c-1', fullName: 'Karim Benali', email: 'karim.b@gmail.com', phone: '06 12 44 09 31', vehicles: 2, bookings: 4, lastVisit: '02/08/2026' },
  { id: 'c-2', fullName: 'Sophie Lemaire', email: 'sophie.lemaire@outlook.fr', phone: '07 68 20 77 45', vehicles: 1, bookings: 1, lastVisit: '02/08/2026' },
  { id: 'c-3', fullName: 'Mehdi Amrani', email: 'mehdi.amrani@proton.me', phone: '06 55 81 12 60', vehicles: 1, bookings: 2, lastVisit: '17/07/2026' },
  { id: 'c-4', fullName: 'Julien Roth', email: 'j.roth67@gmail.com', phone: '07 81 34 55 02', vehicles: 3, bookings: 6, lastVisit: '05/07/2026' },
  { id: 'c-5', fullName: 'Laura Schmitt', email: 'laura.schmitt@yahoo.fr', phone: '06 90 23 18 74', vehicles: 1, bookings: 1, lastVisit: '28/06/2026' },
]

/* ---------- admin: pricing matrix ---------- */
export const PRICING_RULES: PricingRuleRow[] = [
  { bodyStyle: 'citadine_3p', labelFr: 'Citadine 3 portes', sizeClass: 'S', glassFactor: 0.7, basePrice: 180, laborRatePerMin: 0.4 },
  { bodyStyle: 'citadine_5p', labelFr: 'Citadine 5 portes', sizeClass: 'S', glassFactor: 0.8, basePrice: 200, laborRatePerMin: 0.4 },
  { bodyStyle: 'coupe_2p', labelFr: 'Coupé 2 portes', sizeClass: 'M', glassFactor: 0.85, basePrice: 220, laborRatePerMin: 0.4 },
  { bodyStyle: 'berline_4p', labelFr: 'Berline 4 portes', sizeClass: 'M', glassFactor: 1.0, basePrice: 240, laborRatePerMin: 0.4 },
  { bodyStyle: 'break_5p', labelFr: 'Break 5 portes', sizeClass: 'L', glassFactor: 1.15, basePrice: 280, laborRatePerMin: 0.4 },
  { bodyStyle: 'monospace', labelFr: 'Monospace', sizeClass: 'L', glassFactor: 1.25, basePrice: 300, laborRatePerMin: 0.4 },
  { bodyStyle: 'suv_5p', labelFr: 'SUV 5 portes', sizeClass: 'XL', glassFactor: 1.4, basePrice: 340, laborRatePerMin: 0.4 },
  { bodyStyle: 'utilitaire', labelFr: 'Utilitaire', sizeClass: 'XL', glassFactor: 1.3, basePrice: 320, laborRatePerMin: 0.4 },
]

/* ---------- admin: workshop config ---------- */
export const WORKSHOP_WEEK: WorkshopDayConfig[] = [
  { weekday: 1, labelFr: 'Lundi', open: true, openTime: '09:00', closeTime: '18:00' },
  { weekday: 2, labelFr: 'Mardi', open: true, openTime: '09:00', closeTime: '18:00' },
  { weekday: 3, labelFr: 'Mercredi', open: true, openTime: '09:00', closeTime: '18:00' },
  { weekday: 4, labelFr: 'Jeudi', open: true, openTime: '09:00', closeTime: '18:00' },
  { weekday: 5, labelFr: 'Vendredi', open: true, openTime: '09:00', closeTime: '19:00' },
  { weekday: 6, labelFr: 'Samedi', open: true, openTime: '09:00', closeTime: '16:00' },
  { weekday: 7, labelFr: 'Dimanche', open: false, openTime: '—', closeTime: '—' },
]

export const BLACKOUT_DATES = [
  { id: 'bo-1', date: '15/08/2026', reason: 'Assomption — atelier fermé' },
  { id: 'bo-2', date: '24/08/2026', reason: 'Congés annuels (semaine 35)' },
]

/* ---------- admin: taxonomy leads ---------- */
export const VEHICLE_REQUESTS: VehicleRequestLead[] = [
  { id: 'vr-1', rawText: 'Alpine A110 2022, coupé', requestedBy: 'laura.schmitt@yahoo.fr', createdAt: '28/07/2026', status: 'new' },
  { id: 'vr-2', rawText: 'Peugeot 5008 GT 2021 7 places', requestedBy: 'j.roth67@gmail.com', createdAt: '21/07/2026', status: 'resolved' },
]
