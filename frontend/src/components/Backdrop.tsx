// Premium automotive backdrop: a synthwave horizon — glowing sun, perspective grid floor, and
// a sleek sports-car silhouette — rendered once, fixed behind the whole app. Pointer-events
// none and low opacity so it sets a mood without ever competing with the dashboard content.

const GRID_H = 14 // horizontal floor lines
const GRID_V = 22 // vertical converging lines

export function Backdrop() {
  const horizon = 470
  const vpx = 720 // vanishing point x

  // Horizontal floor lines, denser toward the horizon (perspective).
  const hLines = Array.from({ length: GRID_H }, (_, i) => {
    const t = (i + 1) / GRID_H
    return horizon + Math.pow(t, 2.1) * (900 - horizon)
  })
  // Vertical lines fanning from the vanishing point to the bottom edge.
  const vLines = Array.from({ length: GRID_V + 1 }, (_, i) => {
    const t = i / GRID_V // 0..1
    return -1440 + t * (1440 * 3) // spread wide across the bottom
  })

  return (
    <div className="pointer-events-none fixed inset-0 z-0 overflow-hidden">
      <svg
        className="h-full w-full"
        viewBox="0 0 1440 900"
        preserveAspectRatio="xMidYMid slice"
        aria-hidden="true"
      >
        <defs>
          <linearGradient id="bd-sky" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#070318" />
            <stop offset="42%" stopColor="#160a3a" />
            <stop offset="62%" stopColor="#3b1166" />
            <stop offset="78%" stopColor="#7a1f6b" />
            <stop offset="100%" stopColor="#0a0420" />
          </linearGradient>
          <radialGradient id="bd-sun" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#ffe9a8" />
            <stop offset="40%" stopColor="#ff8a3d" />
            <stop offset="75%" stopColor="#ff2d8e" />
            <stop offset="100%" stopColor="#ff2d8e" stopOpacity="0" />
          </radialGradient>
          <linearGradient id="bd-floor" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#0c0a2a" />
            <stop offset="100%" stopColor="#05030f" />
          </linearGradient>
          <linearGradient id="bd-car" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#1a2740" />
            <stop offset="100%" stopColor="#060912" />
          </linearGradient>
          <linearGradient id="bd-glass" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#3ee0ff" stopOpacity="0.5" />
            <stop offset="100%" stopColor="#7a5cff" stopOpacity="0.15" />
          </linearGradient>
          <filter id="bd-blur" x="-30%" y="-30%" width="160%" height="160%">
            <feGaussianBlur stdDeviation="9" />
          </filter>
        </defs>

        {/* Sky + sun */}
        <rect x="0" y="0" width="1440" height="900" fill="url(#bd-sky)" />
        <g className="bd-sun-pulse" style={{ transformOrigin: '720px 380px' }}>
          <circle cx="720" cy="380" r="220" fill="url(#bd-sun)" opacity="0.55" />
          <circle cx="720" cy="385" r="120" fill="url(#bd-sun)" />
          {/* horizontal slits across the lower half of the sun */}
          {[396, 410, 426, 444, 464].map((y, i) => (
            <rect key={y} x="600" y={y} width="240" height={3 + i * 1.6} fill="#0a0420" opacity="0.9" rx="2" />
          ))}
        </g>

        {/* Horizon glow line */}
        <rect x="0" y={horizon - 2} width="1440" height="4" fill="#ff4fa3" opacity="0.55" filter="url(#bd-blur)" />

        {/* Floor */}
        <rect x="0" y={horizon} width="1440" height={900 - horizon} fill="url(#bd-floor)" />
        <g stroke="#19d3ff" strokeOpacity="0.22" strokeWidth="1.5">
          {hLines.map((y, i) => (
            <line key={`h${i}`} x1="0" y1={y} x2="1440" y2={y} />
          ))}
          {vLines.map((xb, i) => (
            <line key={`v${i}`} x1={vpx} y1={horizon} x2={xb} y2="900" />
          ))}
        </g>

        {/* Sports-car silhouette, centered just above the foreground. */}
        <g transform="translate(720 560)" opacity="0.9">
          {/* underglow */}
          <ellipse cx="0" cy="60" rx="230" ry="26" fill="#19d3ff" opacity="0.25" filter="url(#bd-blur)" />
          {/* body */}
          <path
            d="M -210,44
               C -208,18 -196,12 -168,10
               L -120,4
               C -96,-16 -54,-30 -2,-32
               C 54,-34 104,-24 142,-2
               L 188,16
               C 210,22 214,30 212,44
               L 198,52
               L -198,52 Z"
            fill="url(#bd-car)"
            stroke="#35e6ff"
            strokeOpacity="0.55"
            strokeWidth="2"
          />
          {/* cabin glass */}
          <path
            d="M -96,-12 C -72,-24 -34,-30 2,-30 C 44,-30 84,-22 112,-6 L 80,-8 L -70,-6 Z"
            fill="url(#bd-glass)"
          />
          {/* wheels */}
          <g fill="#05060c" stroke="#9b6bff" strokeOpacity="0.6" strokeWidth="2">
            <circle cx="-120" cy="50" r="30" />
            <circle cx="128" cy="50" r="30" />
          </g>
          <g fill="#19d3ff" opacity="0.5">
            <circle cx="-120" cy="50" r="9" />
            <circle cx="128" cy="50" r="9" />
          </g>
          {/* head/tail light glints */}
          <circle cx="206" cy="30" r="6" fill="#bff4ff" opacity="0.9" />
          <circle cx="-206" cy="30" r="5" fill="#ff5b8f" opacity="0.85" />
        </g>

        {/* Vignette to settle the edges */}
        <rect x="0" y="0" width="1440" height="900" fill="url(#bd-sky)" opacity="0" />
      </svg>
      {/* Soft dark gradient so content near the top stays legible. */}
      <div className="absolute inset-0 bg-gradient-to-b from-nexa-bg/85 via-nexa-bg/55 to-nexa-bg/92" />
    </div>
  )
}
