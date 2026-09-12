/* ============================================================
   Icon — one inline-SVG set for the whole app.

   Why: the UI used bare unicode glyphs (⌕ ▶ ⚠ ✓ ✕ ★ ⚙ ⬡ ▤ …). iOS and Android
   render several of those with *emoji* presentation (⚠️ ▶️ ⚙️) or as tofu, so the
   same screen looked fine on desktop and broken on a phone. Every icon here is a
   24×24 vector using `currentColor`, so it inherits colour, scales with `size`
   and is perfectly centred by its box (no font baseline/descender drift).
   ============================================================ */

export type IconName =
  | 'search'
  | 'close'
  | 'check'
  | 'warning'
  | 'play'
  | 'pause'
  | 'volume'
  | 'volume-off'
  | 'arrow-right'
  | 'arrow-left'
  | 'arrow-down'
  | 'chevron-left'
  | 'chevron-right'
  | 'star'
  | 'user'
  | 'map-pin'
  | 'phone'
  | 'plus'
  | 'external'
  | 'list'
  | 'calendar'
  | 'users'
  | 'car'
  | 'receipt'
  | 'euro'
  | 'settings'

interface IconProps {
  name: IconName
  /** px — square. Default 20. */
  size?: number | string
  /** stroke width for the outline icons */
  strokeWidth?: number
  className?: string
  /** set when the icon carries meaning on its own */
  label?: string
  style?: React.CSSProperties
}

/* stroke-based paths (outline icons) */
const STROKE: Partial<Record<IconName, React.ReactNode>> = {
  search: (
    <>
      <circle cx="10.75" cy="10.75" r="6.25" />
      <path d="m15.5 15.5 4 4" />
    </>
  ),
  close: <path d="M6 6l12 12M18 6L6 18" />,
  check: <path d="m4.5 12.5 5 5 10-11" />,
  warning: (
    <>
      <path d="M12 4.5 2.9 20h18.2L12 4.5Z" />
      <path d="M12 10v4.2" />
      <path d="M12 17.2v.1" />
    </>
  ),
  'volume-off': (
    <>
      <path d="M4 9.5v5h3.5L12 18.5v-13L7.5 9.5H4Z" />
      <path d="m16.5 9.5 4 5M20.5 9.5l-4 5" />
    </>
  ),
  volume: (
    <>
      <path d="M4 9.5v5h3.5L12 18.5v-13L7.5 9.5H4Z" />
      <path d="M15.6 9.3a4 4 0 0 1 0 5.4" />
      <path d="M18.4 6.6a8 8 0 0 1 0 10.8" />
    </>
  ),
  'arrow-right': <path d="M4.5 12h14m-5.5-5.5L18.5 12 13 17.5" />,
  'arrow-left': <path d="M19.5 12h-14M11 6.5 5.5 12 11 17.5" />,
  'arrow-down': <path d="M12 4.5v14m5.5-5.5L12 18.5 6.5 13" />,
  'chevron-left': <path d="M14.5 6.5 9 12l5.5 5.5" />,
  'chevron-right': <path d="M9.5 6.5 15 12l-5.5 5.5" />,
  user: (
    <>
      <circle cx="12" cy="8.4" r="3.6" />
      <path d="M4.8 19.6c1.3-3.2 4-4.8 7.2-4.8s5.9 1.6 7.2 4.8" />
    </>
  ),
  'map-pin': (
    <>
      <path d="M12 21s7-5.6 7-11a7 7 0 1 0-14 0c0 5.4 7 11 7 11Z" />
      <circle cx="12" cy="10" r="2.6" />
    </>
  ),
  phone: <path d="M6.2 3.8h3l1.5 3.8-2 1.4a10.6 10.6 0 0 0 5.3 5.3l1.4-2 3.8 1.5v3a2 2 0 0 1-2.2 2A15.6 15.6 0 0 1 4.2 6a2 2 0 0 1 2-2.2Z" />,
  plus: <path d="M12 5v14M5 12h14" />,
  external: (
    <>
      <path d="M14 5h5v5" />
      <path d="M19 5l-7.5 7.5" />
      <path d="M18 14.5V18a1.5 1.5 0 0 1-1.5 1.5H6A1.5 1.5 0 0 1 4.5 18V7.5A1.5 1.5 0 0 1 6 6h3.5" />
    </>
  ),
  list: (
    <>
      <path d="M4.5 7h15M4.5 12h15M4.5 17h9" />
    </>
  ),
  calendar: (
    <>
      <rect x="3.75" y="5.25" width="16.5" height="14.5" rx="2.5" />
      <path d="M3.75 10h16.5M8.5 3.5v3.5M15.5 3.5v3.5" />
    </>
  ),
  users: (
    <>
      <circle cx="9.5" cy="8.6" r="3.4" />
      <path d="M3.6 19.4c1.1-3 3.4-4.5 5.9-4.5s4.8 1.5 5.9 4.5" />
      <path d="M16.3 5.6a3.2 3.2 0 0 1 0 6.1M18 19.4c-.3-1.2-.8-2.2-1.4-3" />
    </>
  ),
  car: (
    <>
      <path d="M3.5 13.5 5.4 8a2 2 0 0 1 1.9-1.3h9.4A2 2 0 0 1 18.6 8l1.9 5.5" />
      <path d="M3.5 13.5h17v3.2a1.3 1.3 0 0 1-1.3 1.3H4.8a1.3 1.3 0 0 1-1.3-1.3v-3.2Z" />
      <path d="M7 18v1.5M17 18v1.5" />
      <path d="M7 15.7h.1M16.9 15.7h.1" />
    </>
  ),
  receipt: (
    <>
      <path d="M6 3.5h12v17l-3-1.8-3 1.8-3-1.8-3 1.8v-17Z" />
      <path d="M9 8.5h6M9 12.5h6" />
    </>
  ),
  settings: (
    <>
      <circle cx="12" cy="12" r="3.1" />
      <path d="M19.2 14.6a7.7 7.7 0 0 0 0-5.2l-2-.5-.8-1.9 1-1.8a7.8 7.8 0 0 0-4.5-2.6l-1 1.8h-2l-1-1.8A7.8 7.8 0 0 0 4.6 5.2l1 1.8-.8 1.9-2 .5a7.7 7.7 0 0 0 0 5.2l2 .5.8 1.9-1 1.8a7.8 7.8 0 0 0 4.4 2.6l1-1.8h2l1 1.8a7.8 7.8 0 0 0 4.4-2.6l-1-1.8.8-1.9 2-.5Z" />
    </>
  ),
}

/* solid paths (filled icons) */
const FILL: Partial<Record<IconName, React.ReactNode>> = {
  play: <path d="M8 5.2v13.6a.8.8 0 0 0 1.22.68l10.5-6.8a.8.8 0 0 0 0-1.36L9.22 4.52A.8.8 0 0 0 8 5.2Z" />,
  pause: <path d="M7.5 4.5h3.2v15H7.5zM13.3 4.5h3.2v15h-3.2z" />,
  star: <path d="m12 3.6 2.62 5.5 6.03.82-4.4 4.2 1.09 5.98L12 17.24 6.66 20.1l1.1-5.98-4.41-4.2 6.03-.82L12 3.6Z" />,
  euro: <path d="M15.9 6.6a5.6 5.6 0 0 0-8 2.2h4.6v1.7H7.4a6.4 6.4 0 0 0 0 1.5h5.1v1.7H7.9a5.6 5.6 0 0 0 8 2.2l.9 1.5a7.4 7.4 0 0 1-10.8-3.7H4.3v-1.7h1.3a8 8 0 0 1 0-1.5H4.3V8.8h1.7A7.4 7.4 0 0 1 16.8 5.1l-.9 1.5Z" />,
}

export default function Icon({ name, size = 20, strokeWidth = 1.8, className, label, style }: IconProps) {
  const filled = FILL[name]
  const a11y = label ? { role: 'img' as const, 'aria-label': label } : { 'aria-hidden': true }
  return (
    <svg
      viewBox="0 0 24 24"
      width={size}
      height={size}
      className={className}
      style={{ flex: 'none', display: 'block', ...style }}
      fill={filled ? 'currentColor' : 'none'}
      stroke={filled ? 'none' : 'currentColor'}
      strokeWidth={filled ? undefined : strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      focusable="false"
      {...a11y}
    >
      {filled ?? STROKE[name] ?? null}
    </svg>
  )
}
