import { memo } from 'react';
import { drift } from './motion';

const TAIL = 'M156 160 Q186 162 184 134 Q182 118 192 110';
const GRILLE = [62, 66, 70, 74, 78];

/** An eighth note, drawn at the origin. */
function Note({ fill }: { fill: string }) {
  return (
    <g fill={fill}>
      <ellipse cx="0" cy="0" rx="4.5" ry="3.4" transform="rotate(-20)" />
      <rect x="3.3" y="-17" width="1.6" height="17" />
      <path d="M4.9 -17 Q12 -14 10.5 -7" fill="none" stroke={fill} strokeWidth="1.6" />
    </g>
  );
}

/**
 * Jazz: the speakeasy cat. A fedora cat in a suit leaning on a vintage
 * condenser microphone under a crimson spotlight, sax in hand. Idle its tail
 * sways, a shoe taps and smoke drifts up; typing, it raises the sax and
 * plays, notes rising from the bell; on a beat, gold and crimson rings of
 * sound roll out across the stage floor.
 */
export const JazzMascot = memo(function JazzMascot() {
  return (
    <svg className="mascot-svg m-jazz" viewBox="0 0 240 200">
      <defs>
        <linearGradient id="m-jazz-beam" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#E63946" stopOpacity="0.4" />
          <stop offset="1" stopColor="#E63946" stopOpacity="0.05" />
        </linearGradient>
        <radialGradient id="m-jazz-pool" cx="0.5" cy="0.5" r="0.5">
          <stop offset="0" stopColor="#E63946" stopOpacity="0.45" />
          <stop offset="1" stopColor="#E63946" stopOpacity="0" />
        </radialGradient>
        <filter id="m-jazz-glow" x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation="2.5" result="blur" />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
        <filter id="m-jazz-haze" x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation="2" />
        </filter>
      </defs>

      <g className="m-jazz-light">
        <path d="M108 -12 L136 -12 L208 198 L36 198 Z" fill="url(#m-jazz-beam)" />
        <ellipse cx="124" cy="194" rx="92" ry="10" fill="url(#m-jazz-pool)" />
      </g>

      <g
        stroke="#FCEFE3"
        strokeOpacity="0.22"
        strokeWidth="3"
        strokeLinecap="round"
        fill="none"
        filter="url(#m-jazz-haze)"
      >
        <path className="m-jazz-wisp" d="M36 196 Q30 176 38 160 Q46 144 38 128" />
        <path className="m-jazz-wisp m-jazz-wisp-late" d="M210 196 Q216 174 208 156 Q200 140 208 122" />
      </g>

      {/* The vintage condenser mic on its stand. */}
      <ellipse cx="70" cy="196" rx="22" ry="3.5" fill="#1E1216" stroke="#331A20" />
      <rect x="68" y="110" width="4" height="86" fill="#9E8087" />
      <path d="M56 100 Q70 118 84 100" fill="none" stroke="#9E8087" strokeWidth="2" />
      <rect x="56" y="54" width="28" height="52" rx="14" fill="#2A1A20" stroke="#FFB703" strokeWidth="1.2" />
      {GRILLE.map((y) => (
        <line key={y} x1="60" y1={y} x2="80" y2={y} stroke="#9E8087" strokeOpacity="0.6" />
      ))}
      <rect x="56" y="84" width="28" height="4" fill="#FFB703" />
      <circle cx="70" cy="96" r="2.5" fill="#FFB703" />

      <g className="m-jazz-tail">
        <path d={TAIL} fill="none" stroke="#180F12" strokeWidth="6" strokeLinecap="round" />
        <path d={TAIL} fill="none" stroke="#E63946" strokeOpacity="0.55" strokeWidth="1" />
      </g>

      {/* Legs, a planted shoe and the tapping one. */}
      <path
        d="M132 164 L127 188 M148 164 L150 188"
        stroke="#180F12"
        strokeWidth="9"
        strokeLinecap="round"
      />
      <ellipse cx="123" cy="193" rx="10" ry="4.5" fill="#0D090B" stroke="#FCEFE3" strokeOpacity="0.3" />
      <ellipse cx="120" cy="191.5" rx="3.5" ry="1.2" fill="#FCEFE3" opacity="0.35" />
      <g className="m-jazz-foot">
        <ellipse cx="155" cy="193" rx="10" ry="4.5" fill="#0D090B" stroke="#FCEFE3" strokeOpacity="0.3" />
        <ellipse cx="158" cy="191.5" rx="3.5" ry="1.2" fill="#FCEFE3" opacity="0.35" />
      </g>

      <g className="m-jazz-body">
        <path
          d="M122 112 Q140 104 158 112 L160 168 Q140 174 120 168 Z"
          fill="#1E1216"
          stroke="#E63946"
          strokeWidth="1.2"
          strokeOpacity="0.8"
        />
        <path d="M134 112 L140 134 L146 112 Z" fill="#FCEFE3" />
        <path d="M134 113 L140 116 L134 119 Z M146 113 L140 116 L146 119 Z" fill="#E63946" />
        {/* Leaning on the mic stand. */}
        <path d="M124 118 Q104 126 84 116" stroke="#1E1216" strokeWidth="8" strokeLinecap="round" fill="none" />
        <circle cx="82" cy="115" r="5" fill="#180F12" stroke="#E63946" strokeOpacity="0.6" />
        <path d="M156 118 Q170 130 164 146" stroke="#1E1216" strokeWidth="8" strokeLinecap="round" fill="none" />
      </g>

      <g className="m-hit">
        <g className="m-tap">
          <g className="m-jazz-head">
            <path d="M126 84 L128 66 L138 76 Z" fill="#180F12" stroke="#E63946" strokeOpacity="0.7" />
            <path d="M142 76 L152 66 L154 84 Z" fill="#180F12" stroke="#E63946" strokeOpacity="0.7" />
            <circle cx="140" cy="90" r="17" fill="#180F12" stroke="#E63946" strokeWidth="1.2" />
            {/* Half-lidded gold eyes: too cool to open them all the way. */}
            <ellipse cx="133" cy="90" rx="3.6" ry="2.6" fill="#FFB703" />
            <ellipse cx="147" cy="90" rx="3.6" ry="2.6" fill="#FFB703" />
            <rect x="129" y="86" width="22" height="3.2" fill="#180F12" />
            <rect x="132.6" y="89" width="1.2" height="3" fill="#0D090B" />
            <rect x="146.6" y="89" width="1.2" height="3" fill="#0D090B" />
            <path d="M138.5 96 L141.5 96 L140 98 Z" fill="#E63946" />
            <path
              d="M128 97 L118 95 M128 99 L118 101 M152 97 L162 95 M152 99 L162 101"
              stroke="#FCEFE3"
              strokeOpacity="0.35"
              strokeWidth="0.8"
            />
            <g transform="rotate(-9 140 74)">
              <ellipse cx="140" cy="75" rx="27" ry="4.5" fill="#0D090B" stroke="#331A20" />
              <path d="M122 75 Q121 52 140 52 Q159 52 158 75 Z" fill="#1E1216" stroke="#331A20" />
              <path d="M133 54 Q140 60 147 54" fill="none" stroke="#0D090B" strokeWidth="2" />
              <rect x="122" y="67" width="36" height="5" fill="#FFB703" />
            </g>
          </g>
        </g>
      </g>

      {/* The sax: drawn raised, and lowered by CSS while idle. */}
      <g className="m-jazz-sax">
        <g className="m-jazz-sax-play">
        <path d="M147 99 Q156 98 160 106" fill="none" stroke="#FFB703" strokeWidth="3" strokeLinecap="round" />
        <path
          d="M160 106 L166 150 Q168 170 152 174"
          fill="none"
          stroke="#FFB703"
          strokeWidth="8"
          strokeLinecap="round"
        />
        <path d="M156 166 Q138 164 136 178 Q148 186 158 180 Z" fill="#FFB703" />
        <path d="M161 112 L165 146" stroke="#FFFFFF" strokeOpacity="0.4" strokeWidth="1.5" />
        <circle cx="166" cy="124" r="2.2" fill="#FB8500" />
        <circle cx="167" cy="136" r="2.2" fill="#FB8500" />
        <circle cx="167" cy="148" r="2.2" fill="#FB8500" />
        </g>
      </g>
      <circle cx="164" cy="146" r="5" fill="#180F12" stroke="#E63946" strokeOpacity="0.6" />

      {/* Notes rise from the bell as it plays. */}
      <g transform="translate(142 172)">
        <g className="m-jazz-note" style={drift(-22, -54)}>
          <Note fill="#FFB703" />
        </g>
        <g className="m-jazz-note m-jazz-note-late" style={drift(14, -60)}>
          <Note fill="#E63946" />
        </g>
      </g>

      {/* On a beat, rings of sound roll out across the stage. */}
      <ellipse
        className="m-jazz-ring"
        cx="140"
        cy="194"
        rx="16"
        ry="4"
        fill="none"
        stroke="#FFB703"
        strokeWidth="2"
        vectorEffect="non-scaling-stroke"
        filter="url(#m-jazz-glow)"
      />
      <ellipse
        className="m-jazz-ring m-jazz-ring-late"
        cx="140"
        cy="194"
        rx="16"
        ry="4"
        fill="none"
        stroke="#E63946"
        strokeWidth="2"
        vectorEffect="non-scaling-stroke"
        filter="url(#m-jazz-glow)"
      />
      <g transform="translate(140 186)">
        <g className="m-jazz-beat-note" style={drift(-120, -36)}>
          <Note fill="#FFB703" />
        </g>
        <g className="m-jazz-beat-note" style={drift(118, -44)}>
          <Note fill="#E63946" />
        </g>
      </g>
    </svg>
  );
});
