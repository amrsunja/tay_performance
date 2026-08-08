interface SectionTagProps {
  children: string
  /** Render the label with a brand gradient instead of octane. */
  gradient?: string
  centered?: boolean
}

export default function SectionTag({ children, gradient, centered }: SectionTagProps) {
  return (
    <div className="section-tag" style={centered ? { justifyContent: 'center' } : undefined}>
      <span className="section-tag__line" />
      <span
        className="section-tag__label"
        style={
          gradient
            ? {
                background: gradient,
                WebkitBackgroundClip: 'text',
                backgroundClip: 'text',
                color: 'transparent',
              }
            : undefined
        }
      >
        {children}
      </span>
    </div>
  )
}
