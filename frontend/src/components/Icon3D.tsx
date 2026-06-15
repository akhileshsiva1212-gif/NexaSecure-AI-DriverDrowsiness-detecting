// Glossy 3D-style icons: a colored gradient squircle tile (.icon3d adds the top highlight +
// drop shadow) with a clean white glyph. Reads like a modern "3D app icon" — premium, not flat
// emoji. Use a GRAD preset for the tile color and a Glyph* for the symbol.

import type { CSSProperties, ReactNode } from 'react'

export const GRAD = {
  cyan: ['#22d3ee', '#3b82f6'],
  green: ['#34d399', '#0d9488'],
  amber: ['#fbbf24', '#f97316'],
  red: ['#fb7185', '#e11d48'],
  violet: ['#a855f7', '#6366f1'],
  pink: ['#f472b6', '#db2777'],
  slate: ['#94a3b8', '#475569'],
} as const

export type GradKey = keyof typeof GRAD

export function Tile3D({
  grad,
  size = 40,
  className = '',
  pulse = false,
  children,
}: {
  grad: readonly [string, string] | [string, string]
  size?: number
  className?: string
  pulse?: boolean
  children: ReactNode
}) {
  const style: CSSProperties = {
    width: size,
    height: size,
    backgroundImage: `linear-gradient(150deg, ${grad[0]}, ${grad[1]})`,
  }
  return (
    <span className={`icon3d ${pulse ? 'animate-pulse-soft' : ''} ${className}`} style={style}>
      {children}
    </span>
  )
}

function Glyph({ children, s = 22 }: { children: ReactNode; s?: number }) {
  return (
    <svg
      width={s}
      height={s}
      viewBox="0 0 24 24"
      fill="none"
      stroke="#fff"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {children}
    </svg>
  )
}

export const GlyphShield = () => (
  <Glyph>
    <path d="M12 3l7 3v5c0 4.5-3 7.5-7 9-4-1.5-7-4.5-7-9V6l7-3z" />
    <path d="M9 12l2 2 4-4" />
  </Glyph>
)
export const GlyphShieldAlert = () => (
  <Glyph>
    <path d="M12 3l7 3v5c0 4.5-3 7.5-7 9-4-1.5-7-4.5-7-9V6l7-3z" />
    <path d="M12 8.5v4M12 15.5h.01" />
  </Glyph>
)
export const GlyphUser = () => (
  <Glyph>
    <circle cx="12" cy="8" r="3.2" />
    <path d="M5.8 19a6.2 6.2 0 0112.4 0" />
  </Glyph>
)
export const GlyphCar = () => (
  <Glyph>
    <path d="M4 13l1.4-3.8A2 2 0 017.3 8h9.4a2 2 0 011.9 1.2L20 13" />
    <path d="M3.6 13h16.8v3.6a.7.7 0 01-.7.7H18a.7.7 0 01-.7-.7V16.6H6.7v.3a.7.7 0 01-.7.7H4.3a.7.7 0 01-.7-.7V13z" />
    <circle cx="7.4" cy="16.3" r="1" />
    <circle cx="16.6" cy="16.3" r="1" />
  </Glyph>
)
export const GlyphBell = () => (
  <Glyph>
    <path d="M6 9a6 6 0 0112 0c0 4 1.2 5.5 2 6.3.3.3.1.7-.3.7H4.3c-.4 0-.6-.4-.3-.7C4.8 14.5 6 13 6 9z" />
    <path d="M10 19a2 2 0 004 0" />
  </Glyph>
)
export const GlyphSiren = () => (
  <Glyph>
    <path d="M7 18v-5a5 5 0 0110 0v5" />
    <path d="M5 18h14v2H5z" />
    <path d="M12 4V2.5M5 8L3.8 7M19 8l1.2-1" />
  </Glyph>
)
export const GlyphMusic = () => (
  <Glyph>
    <path d="M9 17V6l9-2v11" />
    <circle cx="7" cy="17" r="2" />
    <circle cx="16" cy="15" r="2" />
  </Glyph>
)
export const GlyphUpload = () => (
  <Glyph>
    <path d="M12 15V4M8 8l4-4 4 4" />
    <path d="M5 15v2.5A1.5 1.5 0 006.5 19h11a1.5 1.5 0 001.5-1.5V15" />
  </Glyph>
)
export const GlyphAlert = () => (
  <Glyph>
    <path d="M12 4.5l8 14H4l8-14z" />
    <path d="M12 10v3.5M12 16.5h.01" />
  </Glyph>
)
export const GlyphPerson = () => (
  <Glyph>
    <circle cx="12" cy="5.5" r="2.2" />
    <path d="M12 8v6M12 9.5L8.5 12M12 9.5l3.5 2.5M12 14l-2.5 5.5M12 14l2.5 5.5" />
  </Glyph>
)
export const GlyphRoad = () => (
  <Glyph>
    <path d="M8 4L4 20M16 4l4 16" />
    <path d="M12 5v2M12 11v2M12 17v2" />
  </Glyph>
)
export const GlyphTrend = () => (
  <Glyph>
    <path d="M4 17l5-5 3 3 7-7" />
    <path d="M16 8h4v4" />
  </Glyph>
)
export const GlyphPlug = () => (
  <Glyph>
    <path d="M9 3v5M15 3v5" />
    <path d="M7 8h10v2a5 5 0 01-10 0V8z" />
    <path d="M12 15v5" />
  </Glyph>
)
