import { useEffect, useRef } from 'react'

interface CountUpProps {
  target: number
  /** Divide the animated value for decimals, e.g. 49 / 10 → "4.9". */
  divide?: number
  suffix?: string
  duration?: number
  className?: string
}

/** Mono "instrument readout" count-up, triggered when scrolled into view. */
export default function CountUp({ target, divide = 1, suffix = '', duration = 1300, className }: CountUpProps) {
  const ref = useRef<HTMLSpanElement>(null)

  useEffect(() => {
    const el = ref.current
    if (!el) return
    let raf = 0
    const io = new IntersectionObserver(
      (entries) => {
        if (!entries[0].isIntersecting) return
        io.disconnect()
        const start = performance.now()
        const tick = (now: number) => {
          const t = Math.min((now - start) / duration, 1)
          const eased = 1 - Math.pow(1 - t, 3)
          const val = target * eased
          el.textContent = (divide > 1 ? (val / divide).toFixed(1) : Math.round(val).toString()) + suffix
          if (t < 1) raf = requestAnimationFrame(tick)
        }
        raf = requestAnimationFrame(tick)
      },
      { threshold: 0.4 },
    )
    io.observe(el)
    return () => {
      io.disconnect()
      cancelAnimationFrame(raf)
    }
  }, [target, divide, suffix, duration])

  return (
    <span ref={ref} className={className}>
      0
    </span>
  )
}
