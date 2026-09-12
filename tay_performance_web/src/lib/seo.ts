/* Per-route <head> management without a dependency: title, description, canonical, robots,
   Open Graph / Twitter and optional JSON-LD. Static defaults live in index.html; this hook
   overrides them on navigation (React Router SPA). */
import { useEffect } from 'react'
import { DEFAULT_DESCRIPTION, SITE_NAME, SITE_URL } from './site'

export interface SeoOptions {
  /** Page title without the brand suffix. */
  title: string
  description?: string
  /** Path (e.g. "/reserver") — turned into the canonical URL. Defaults to current pathname. */
  path?: string
  /** Private / transactional pages: keep them out of the index. */
  noindex?: boolean
  /** Extra JSON-LD to inject for this route (removed on unmount). */
  jsonLd?: Record<string, unknown> | Record<string, unknown>[]
}

function upsertMeta(selector: string, attrs: Record<string, string>) {
  let el = document.head.querySelector<HTMLMetaElement | HTMLLinkElement>(selector)
  if (!el) {
    el = document.createElement(selector.startsWith('link') ? 'link' : 'meta')
    document.head.appendChild(el)
  }
  for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, v)
}

export function useSeo({ title, description = DEFAULT_DESCRIPTION, path, noindex = false, jsonLd }: SeoOptions) {
  useEffect(() => {
    const pathname = path ?? window.location.pathname
    const url = `${SITE_URL}${pathname === '/' ? '/' : pathname.replace(/\/$/, '')}`
    const fullTitle = title.includes(SITE_NAME) ? title : `${title} · ${SITE_NAME}`

    document.title = fullTitle
    upsertMeta('meta[name="description"]', { name: 'description', content: description })
    upsertMeta('meta[name="robots"]', { name: 'robots', content: noindex ? 'noindex, nofollow' : 'index, follow, max-image-preview:large' })
    upsertMeta('link[rel="canonical"]', { rel: 'canonical', href: url })
    upsertMeta('meta[property="og:title"]', { property: 'og:title', content: fullTitle })
    upsertMeta('meta[property="og:description"]', { property: 'og:description', content: description })
    upsertMeta('meta[property="og:url"]', { property: 'og:url', content: url })
    upsertMeta('meta[name="twitter:title"]', { name: 'twitter:title', content: fullTitle })
    upsertMeta('meta[name="twitter:description"]', { name: 'twitter:description', content: description })

    let script: HTMLScriptElement | null = null
    if (jsonLd) {
      script = document.createElement('script')
      script.type = 'application/ld+json'
      script.dataset.route = pathname
      script.text = JSON.stringify(jsonLd)
      document.head.appendChild(script)
    }
    return () => {
      script?.remove()
    }
    // jsonLd is expected to be a module-level constant per route
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [title, description, path, noindex])
}
