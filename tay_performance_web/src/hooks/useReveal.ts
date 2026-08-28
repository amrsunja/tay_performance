import { useEffect } from 'react'

/**
 * Scroll-reveal: watches every `[data-reveal]` node under the document,
 * adds `.tp-in` when it enters the viewport (staggered via `data-delay`).
 * Mirrors the motion language of the design mockups.
 *
 * Nodes mounted after the hook ran (async data → cards) are picked up via a
 * MutationObserver, so lists rendered from react-query never stay at opacity 0.
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

    const observeAll = (root: ParentNode) => {
      root.querySelectorAll?.('[data-reveal]:not(.tp-in)').forEach((el) => io.observe(el))
    }
    observeAll(document)

    const mo = new MutationObserver((records) => {
      for (const r of records) {
        r.addedNodes.forEach((n) => {
          if (!(n instanceof HTMLElement)) return
          if (n.matches('[data-reveal]:not(.tp-in)')) io.observe(n)
          observeAll(n)
        })
      }
    })
    mo.observe(document.body, { childList: true, subtree: true })

    return () => {
      mo.disconnect()
      io.disconnect()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps)
}
