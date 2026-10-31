/* The workshop runs on Paris time whatever the admin's browser timezone. */
const parisFmt = new Intl.DateTimeFormat('sv-SE', {
  timeZone: 'Europe/Paris', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
})

export function parisParts(d: Date): { date: string; time: string } {
  const p = parisFmt.format(d) // "2026-09-25 14:30"
  return { date: p.slice(0, 10), time: p.slice(11, 16) }
}

/** "2026-09-25" + "14:30" read as Europe/Paris wall-clock time → instant */
export function parisToDate(date: string, time: string): Date {
  const [y, m, d] = date.split('-').map(Number)
  const [hh, mm] = time.split(':').map(Number)
  const wanted = Date.UTC(y, m - 1, d, hh, mm)
  let t = wanted
  for (let i = 0; i < 2; i++) {
    const p = parisParts(new Date(t))
    const [py, pm, pd] = p.date.split('-').map(Number)
    const [ph, pmin] = p.time.split(':').map(Number)
    t -= Date.UTC(py, pm - 1, pd, ph, pmin) - wanted
  }
  return new Date(t)
}
