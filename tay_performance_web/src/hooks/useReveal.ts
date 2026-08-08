import { useEffect } from 'react'

/**
 * Scroll-reveal: watches every `[data-reveal]` node under the document,
 * adds `.tp-in` when it enters the viewport (staggered via `data-delay`).
 * Mirrors the motion language of the design mockups.
 */
export function useReveal(deps: unknown[] = []) {
  useEffect(() => {
    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) return
          const el = entry.target as HTMLElement
          const delay = el.dataset.delay ? parseInt(el.dataset.delay, 10) : 0
          el.style.transitionDelay = `${delay}ms`
          el.classList.add('tp-in')
          io.unobserve(el)
        })
      },
      { threshold: 0.15 },
    )
    document.querySelectorAll('[data-reveal]:not(.tp-in)').forEach((el) => io.observe(el))
    return () => io.disconnect()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps)
}
