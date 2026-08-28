/* "Suivez-nous" — static social block: Instagram + TikTok links and a slider of
   atelier videos (src/assets/videos). The first video autoplays muted; tapping
   any card plays it with sound (and pauses the others), tapping again pauses.
   The automated Instagram feed will replace the static list later. */
import { useRef, useState } from 'react'
import SectionTag from '../../components/ui/SectionTag'
import video1 from '../../assets/videos/video1.mp4'
import video2 from '../../assets/videos/video2.mp4'
import video3 from '../../assets/videos/video3.mp4'
import video4 from '../../assets/videos/video4.mp4'
import styles from './landing.module.css'

export const SOCIAL_LINKS = {
  instagram: 'https://www.instagram.com/tay_performance/',
  tiktok: 'https://www.tiktok.com/@tay_performance',
  facebook: 'https://www.facebook.com/p/Tay-Performance-100086047330108/',
} as const

const VIDEOS = [video1, video2, video3, video4]

function InstagramIcon() {
  return (
    <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden>
      <rect x="2.5" y="2.5" width="19" height="19" rx="5.5" />
      <circle cx="12" cy="12" r="4.4" />
      <circle cx="17.6" cy="6.4" r="1.3" fill="currentColor" stroke="none" />
    </svg>
  )
}

function SpeakerIcon({ muted }: { muted: boolean }) {
  return (
    <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M4 9.5v5h3.5L12 18.5v-13L7.5 9.5H4z" fill="currentColor" stroke="none" />
      {muted ? (
        <path d="M16 9l5 6M21 9l-5 6" />
      ) : (
        <>
          <path d="M15.5 9.2a4 4 0 0 1 0 5.6" />
          <path d="M18.3 6.5a8 8 0 0 1 0 11" />
        </>
      )}
    </svg>
  )
}

function FacebookIcon() {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor" aria-hidden>
      <path d="M13.5 22v-8h2.7l.4-3.2h-3.1V8.8c0-.9.3-1.6 1.6-1.6h1.7V4.4c-.3 0-1.3-.1-2.5-.1-2.5 0-4.1 1.5-4.1 4.2v2.3H7.4V14h2.8v8h3.3z" />
    </svg>
  )
}

function TikTokIcon() {
  return (
    <svg viewBox="0 0 24 24" width="22" height="22" fill="currentColor" aria-hidden>
      <path d="M16.6 3c.36 1.94 1.62 3.45 3.9 3.75v2.6c-1.5.03-2.83-.42-3.9-1.2v5.9c0 3.66-2.53 5.95-5.66 5.95-3 0-5.44-2.17-5.44-5.2 0-3 2.36-5.2 5.5-5.2.31 0 .62.03.92.08v2.75a2.9 2.9 0 0 0-.95-.16 2.55 2.55 0 0 0-2.62 2.55 2.52 2.52 0 0 0 2.6 2.5c1.6 0 2.75-1.15 2.75-3.1V3h2.9Z" />
    </svg>
  )
}

export default function SocialSection() {
  const sliderRef = useRef<HTMLDivElement>(null)
  const videoRefs = useRef<(HTMLVideoElement | null)[]>([])
  const [playing, setPlaying] = useState<number | null>(0) // first autoplays
  // per-video sound state — the first one must start muted (autoplay policy)
  const [muted, setMuted] = useState<boolean[]>(() => VIDEOS.map((_, i) => i === 0))

  const toggleMute = (i: number) => {
    const el = videoRefs.current[i]
    const next = !muted[i]
    setMuted((m) => m.map((v, j) => (j === i ? next : v)))
    if (el) {
      el.muted = next
      if (!next && el.paused) {
        // unmuting a paused card → play it (user gesture, sound allowed)
        videoRefs.current.forEach((v, j) => {
          if (v && j !== i) v.pause()
        })
        el.play()
        setPlaying(i)
      }
    }
  }

  const scrollBy = (dir: -1 | 1) => {
    const el = sliderRef.current
    if (el) el.scrollBy({ left: dir * Math.round(el.clientWidth * 0.8), behavior: 'smooth' })
  }

  const toggle = (i: number) => {
    const el = videoRefs.current[i]
    if (!el) return
    if (el.paused) {
      videoRefs.current.forEach((v, j) => {
        if (v && j !== i) v.pause()
      })
      el.muted = muted[i] // respect the speaker toggle
      el.play()
      setPlaying(i)
    } else {
      el.pause()
      setPlaying(null)
    }
  }

  return (
    <section id="social" className={styles.section}>
      <div className={styles.inner}>
        <div className={styles.sectionHead}>
          <div data-reveal data-anim="left">
            <SectionTag gradient="linear-gradient(90deg,#ED1C24,#29ABE2)">Suivez-nous</SectionTag>
            <h2 className={`sat ${styles.h2}`}>
              L'atelier au quotidien,
              <br />
              en story et en vidéo
            </h2>
          </div>
          <div data-reveal data-anim="right" className={styles.socialLinks}>
            <a
              href={SOCIAL_LINKS.instagram}
              target="_blank"
              rel="noreferrer"
              className={styles.socialBtn}
              aria-label="Instagram @tay_performance"
            >
              <InstagramIcon />
              <span className={`mono ${styles.socialBtnLabel}`}>@tay_performance</span>
            </a>
            <a
              href={SOCIAL_LINKS.tiktok}
              target="_blank"
              rel="noreferrer"
              className={styles.socialBtn}
              aria-label="TikTok @tay_performance"
            >
              <TikTokIcon />
              <span className={`mono ${styles.socialBtnLabel}`}>@tay_performance</span>
            </a>
            <a
              href={SOCIAL_LINKS.facebook}
              target="_blank"
              rel="noreferrer"
              className={styles.socialBtn}
              aria-label="Facebook Tay Performance"
            >
              <FacebookIcon />
              <span className={`mono ${styles.socialBtnLabel}`}>Tay Performance</span>
            </a>
          </div>
        </div>

        <div data-reveal className={styles.socialSliderWrap}>
          <button type="button" className={styles.socialArrow} aria-label="Précédent" onClick={() => scrollBy(-1)}>
            ‹
          </button>

          <div ref={sliderRef} className={styles.socialSlider}>
            {VIDEOS.map((src, i) => (
              <div
                key={src}
                role="button"
                tabIndex={0}
                className={styles.socialVideoCard}
                onClick={() => toggle(i)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault()
                    toggle(i)
                  }
                }}
                aria-label={playing === i ? 'Mettre en pause' : 'Lire la vidéo'}
              >
                <video
                  ref={(el) => {
                    videoRefs.current[i] = el
                  }}
                  src={src}
                  className={styles.socialVideo}
                  autoPlay={i === 0}
                  muted={i === 0}
                  loop
                  playsInline
                  preload={i === 0 ? 'auto' : 'metadata'}
                  onPlay={() => setPlaying(i)}
                  onPause={() => setPlaying((p) => (p === i ? null : p))}
                />
                <span
                  className={styles.socialVideoOverlay}
                  style={{ opacity: playing === i ? 0 : 1 }}
                  aria-hidden
                >
                  <span className={styles.socialVideoPlay}>▶</span>
                </span>
                <button
                  type="button"
                  className={styles.socialVideoBadge}
                  aria-label={muted[i] ? 'Activer le son' : 'Couper le son'}
                  aria-pressed={!muted[i]}
                  onClick={(e) => {
                    e.stopPropagation()
                    toggleMute(i)
                  }}
                >
                  <SpeakerIcon muted={muted[i]} />
                </button>
              </div>
            ))}
          </div>

          <button type="button" className={styles.socialArrow} aria-label="Suivant" onClick={() => scrollBy(1)}>
            ›
          </button>
        </div>

        <div className={`mono ${styles.socialHint}`}>
          L'atelier en vidéo · retrouvez tout sur Instagram, TikTok et Facebook
        </div>
      </div>
    </section>
  )
}
