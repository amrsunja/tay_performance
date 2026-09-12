/* Shared shell for the three legal pages. Builds the sticky table of contents from the
   sections it is given, so a section can never exist without a matching anchor. */
import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import SiteHeader from '../../components/layout/SiteHeader'
import SiteFooter from '../../components/layout/SiteFooter'
import { useSeo } from '../../lib/seo'
import { SITE_NAME, SITE_URL } from '../../lib/site'
import { LEGAL_UPDATED, LEGAL_UPDATED_ISO } from '../../lib/legal'
import styles from './legal.module.css'

export interface LegalSection {
  id: string
  title: string
  body: ReactNode
}

interface Props {
  kicker: string
  title: string
  lede: string
  seoTitle: string
  seoDescription: string
  path: string
  sections: LegalSection[]
}

export default function LegalLayout({ kicker, title, lede, seoTitle, seoDescription, path, sections }: Props) {
  useSeo({
    title: seoTitle,
    description: seoDescription,
    path,
    jsonLd: {
      '@context': 'https://schema.org',
      '@type': 'WebPage',
      name: `${title} — ${SITE_NAME}`,
      url: `${SITE_URL}${path}`,
      inLanguage: 'fr-FR',
      dateModified: LEGAL_UPDATED_ISO,
      isPartOf: { '@id': `${SITE_URL}/#website` },
      publisher: { '@id': `${SITE_URL}/#business` },
      breadcrumb: {
        '@type': 'BreadcrumbList',
        itemListElement: [
          { '@type': 'ListItem', position: 1, name: 'Accueil', item: `${SITE_URL}/` },
          { '@type': 'ListItem', position: 2, name: title, item: `${SITE_URL}${path}` },
        ],
      },
    },
  })

  return (
    <div className={styles.page}>
      <SiteHeader />
      <main className={styles.main}>
        <div className={styles.head}>
          <div className={styles.kickerRow}>
            <span className={styles.kickerLine} />
            <span className={`mono ${styles.kicker}`}>{kicker}</span>
          </div>
          <h1 className={`clash ${styles.h1}`}>
            {title}
            <span style={{ color: 'var(--accent-500)' }}>.</span>
          </h1>
          <p className={styles.lede}>{lede}</p>
          <span className={`mono ${styles.updated}`}>Dernière mise à jour : {LEGAL_UPDATED}</span>
        </div>

        <div className={styles.layout}>
          <nav className={styles.toc} aria-label="Sommaire de la page">
            <span className={`mono ${styles.tocTitle}`}>Sommaire</span>
            {sections.map((s, i) => (
              <a key={s.id} href={`#${s.id}`} className={styles.tocLink}>
                {String(i + 1).padStart(2, '0')} · {s.title}
              </a>
            ))}
          </nav>

          <div className={styles.prose}>
            {sections.map((s) => (
              <section key={s.id} id={s.id}>
                <h2 className="sat">{s.title}</h2>
                {s.body}
              </section>
            ))}

            <div className={styles.backRow}>
              <Link to="/" className="ghost" style={{ fontSize: 14, padding: '12px 20px', borderRadius: 12 }}>
                ← Retour à l'accueil
              </Link>
              <Link to="/adresse" className="ghost" style={{ fontSize: 14, padding: '12px 20px', borderRadius: 12 }}>
                Nous contacter
              </Link>
            </div>
          </div>
        </div>
      </main>
      <SiteFooter />
    </div>
  )
}

/** Key/value fact block — a TODO value is rendered in amber so it can't ship unnoticed. */
export function Facts({ rows }: { rows: [string, string | null][] }) {
  return (
    <div className={styles.facts}>
      {rows
        .filter(([, v]) => v != null)
        .map(([k, v]) => (
          <Row key={k} k={k} v={v as string} />
        ))}
    </div>
  )
}

function Row({ k, v }: { k: string; v: string }) {
  const todo = v.startsWith('⚠ À COMPLÉTER')
  return (
    <>
      <div className={`mono ${styles.factKey}`}>{k}</div>
      <div className={`${styles.factVal} ${todo ? styles.todo : ''}`}>{v}</div>
    </>
  )
}

export function Callout({ children, warn = false }: { children: ReactNode; warn?: boolean }) {
  return <div className={`${styles.callout} ${warn ? styles.calloutWarn : ''}`}>{children}</div>
}

export { styles as legalStyles }
