/* Pré-rendu des balises <head> pour chaque route publique.
   ------------------------------------------------------------------
   Le site est une SPA : sans ce script, TOUTES les URLs servent le même index.html,
   donc le même <title> et la même <meta description>. Google finit par exécuter le JS
   et voir la bonne balise, mais :
     · la découverte est plus lente et le rendu n'est jamais garanti ;
     · Facebook, WhatsApp, LinkedIn, iMessage et la plupart des bots d'aperçu
       n'exécutent PAS de JavaScript : ils affichent toujours le titre de l'accueil.

   Ce script copie dist/index.html vers dist/<route>/index.html en remplaçant title,
   description, canonical et les balises Open Graph / Twitter par celles de la route.
   Le .htaccess sert le fichier réel quand il existe, et retombe sur index.html sinon,
   donc la navigation côté client n'est pas touchée.

   ⚠ Ce n'est PAS du rendu de contenu (le <body> reste vide) : c'est du pré-rendu de
   métadonnées. Pour du vrai SSR il faudrait passer le projet sous Vite SSR ou Next.
*/
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { ROUTES, SITE_URL } from './seo-routes.mjs'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const dist = join(root, 'dist')

/** Remplace le contenu d'une balise meta/title/link déjà présente dans le HTML. */
function setTag(html, pattern, replacement) {
  if (!pattern.test(html)) {
    console.warn(`[prerender] balise introuvable, ignorée : ${pattern}`)
    return html
  }
  return html.replace(pattern, replacement)
}

function withMeta(html, route) {
  const url = `${SITE_URL}${route.path === '/' ? '/' : route.path}`
  const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;')
  const title = esc(route.title)
  const description = esc(route.description)

  let out = html
  out = setTag(out, /<title>[\s\S]*?<\/title>/, `<title>${title}</title>`)
  out = setTag(out, /<meta name="description" content="[^"]*"\s*\/?>/, `<meta name="description" content="${description}" />`)
  out = setTag(out, /<link rel="canonical" href="[^"]*"\s*\/?>/, `<link rel="canonical" href="${url}" />`)
  out = setTag(out, /<meta property="og:title" content="[^"]*"\s*\/?>/, `<meta property="og:title" content="${title}" />`)
  out = setTag(out, /<meta property="og:description" content="[^"]*"\s*\/?>/, `<meta property="og:description" content="${description}" />`)
  out = setTag(out, /<meta property="og:url" content="[^"]*"\s*\/?>/, `<meta property="og:url" content="${url}" />`)
  out = setTag(out, /<meta name="twitter:title" content="[^"]*"\s*\/?>/, `<meta name="twitter:title" content="${title}" />`)
  out = setTag(out, /<meta name="twitter:description" content="[^"]*"\s*\/?>/, `<meta name="twitter:description" content="${description}" />`)
  return out
}

const base = await readFile(join(dist, 'index.html'), 'utf8')

for (const route of ROUTES) {
  if (route.path === '/') {
    await writeFile(join(dist, 'index.html'), withMeta(base, route))
    console.log('[prerender] /')
    continue
  }
  const dir = join(dist, route.path.replace(/^\//, ''))
  await mkdir(dir, { recursive: true })
  await writeFile(join(dir, 'index.html'), withMeta(base, route))
  console.log(`[prerender] ${route.path}`)
}
