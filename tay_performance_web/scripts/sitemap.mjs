/* Génère public/sitemap.xml depuis scripts/seo-routes.mjs.
   Lancé avant le build (npm run build) : le sitemap ne peut donc plus se désynchroniser
   des routes réelles. lastmod = date du build. */
import { writeFile } from 'node:fs/promises'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { ROUTES, SITE_URL } from './seo-routes.mjs'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const lastmod = new Date().toISOString().slice(0, 10)

const urls = ROUTES.map((r) => {
  const loc = `${SITE_URL}${r.path === '/' ? '/' : r.path}`
  const image = r.image
    ? `
    <image:image>
      <image:loc>${SITE_URL}${r.image}</image:loc>
      <image:title>Vitres teintées Strasbourg — Tay Performance</image:title>
    </image:image>`
    : ''
  return `  <url>
    <loc>${loc}</loc>
    <lastmod>${lastmod}</lastmod>
    <changefreq>${r.changefreq}</changefreq>
    <priority>${r.priority}</priority>${image}
  </url>`
}).join('\n')

const xml = `<?xml version="1.0" encoding="UTF-8"?>
<!-- Généré par scripts/sitemap.mjs — ne pas éditer à la main. -->
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:image="http://www.google.com/schemas/sitemap-image/1.1">
${urls}
</urlset>
`

await writeFile(join(root, 'public', 'sitemap.xml'), xml)
console.log(`[sitemap] ${ROUTES.length} URLs → public/sitemap.xml`)
