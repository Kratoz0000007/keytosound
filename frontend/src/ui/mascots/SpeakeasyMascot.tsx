import { memo } from 'react';
import { drift } from './motion';

const TAIL = 'M156 160 Q186 162 184 134 Q182 118 192 110';
const GRILLE = [62, 66, 70, 74, 78];
/** The sax's key valves, top to bottom; they light in this order. */
const VALVES = [124, 136, 148];

const FUR = '#100A0C';
const SUIT = '#1A0F13';
const EDGE = '#2A181F';
const FLOOR = '#0B080A';
const CRIMSON = '#E63946';
const BRASS = '#D4AF37';
const IVORY = '#FDF8F0';
const STEEL = '#9E8087';

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

/** A beat's soundwave: a wide band of translucent brass with a bright hairline inside. */
function Ring({ className }: { className: string }) {
  return (
    <g className={className}>
      <ellipse
        cx="140"
        cy="194"
        rx="16"
        ry="4"
        fill="none"
        stroke="rgba(212, 175, 55, 0.3)"
        strokeWidth="6"
        vectorEffect="non-scaling-stroke"
      />
      <ellipse
        cx="140"
        cy="194"
        rx="16"
        ry="4"
        fill="none"
        stroke={BRASS}
        strokeOpacity="0.55"
        strokeWidth="1"
        vectorEffect="non-scaling-stroke"
      />
    </g>
  );
}

/**
 * Jazz: the speakeasy sax cat. A fedora cat in a suit leaning on a vintage
 * ribbed condenser mic under a crimson spotlight. Idle, it breathes, its
 * tail curls, a shoe taps and smoke drifts off the mic. Typing, it raises
 * the sax and plays, the paw tapping at the live tempo and the key valves
 * flashing amber on each stroke. On a beat, rings of brass sound roll out
 * across the stage floor.
 */
export const SpeakeasyMascot = memo(function SpeakeasyMascot() {
  return (
    <svg className="mascot-svg m-jazz" viewBox="0 0 240 200">
      <defs>
        <linearGradient id="m-jazz-beam" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={CRIMSON} stopOpacity="0.4" />
          <stop offset="1" stopColor={CRIMSON} stopOpacity="0.05" />
        </linearGradient>
        <radialGradient id="m-jazz-pool" cx="0.5" cy="0.5" r="0.5">
          <stop offset="0" stopColor={CRIMSON} stopOpacity="0.45" />
          <stop offset="1" stopColor={CRIMSON} stopOpacity="0" />
        </radialGradient>
        {/* Polished brass: a hot highlight rolling off into the shadow side. */}
        <linearGradient id="m-jazz-brass" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#F3DC8E" />
          <stop offset="0.45" stopColor={BRASS} />
          <stop offset="1" stopColor="#7A5C16" />
        </linearGradient>
        <linearGradient id="m-jazz-mic" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#1C1114" />
          <stop offset="0.4" stopColor="#3A262D" />
          <stop offset="1" stopColor="#140C0F" />
        </linearGradient>
        <filter id="m-jazz-haze" x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation="2" />
        </filter>
      </defs>

      <g className="m-jazz-light">
        <path d="M108 -12 L136 -12 L208 198 L36 198 Z" fill="url(#m-jazz-beam)" />
        <ellipse cx="124" cy="194" rx="92" ry="10" fill="url(#m-jazz-pool)" />
      </g>

      {/* The vintage ribbed condenser mic on its stand. */}
      <ellipse cx="70" cy="196" rx="22" ry="3.5" fill={SUIT} stroke={EDGE} />
      <rect x="68" y="110" width="4" height="86" fill={STEEL} />
      <path d="M56 100 Q70 118 84 100" fill="none" stroke={STEEL} strokeWidth="2" />
      <rect x="56" y="54" width="28" height="52" rx="14" fill="url(#m-jazz-mic)" stroke={BRASS} strokeWidth="1.2" />
      {GRILLE.map((y) => (
        <line key={y} x1="60" y1={y} x2="80" y2={y} stroke={STEEL} strokeOpacity="0.6" />
      ))}
      <rect x="56" y="84" width="28" height="4" fill="url(#m-jazz-brass)" />
      <circle cx="70" cy="96" r="2.5" fill={BRASS} />

      {/* Smoke curling up off the top of the mic. */}
      <g
        stroke={IVORY}
        strokeOpacity="0.22"
        strokeWidth="3"
        strokeLinecap="round"
        fill="none"
        filter="url(#m-jazz-haze)"
      >
        <path className="m-jazz-wisp" d="M70 52 Q62 40 70 28 Q78 16 70 4" />
        <path className="m-jazz-wisp m-jazz-wisp-late" d="M72 52 Q80 42 73 30 Q66 18 74 6" />
      </g>

      <g className="m-jazz-tail">
        <path d={TAIL} fill="none" stroke={FUR} strokeWidth="6" strokeLinecap="round" />
        <path d={TAIL} fill="none" stroke={CRIMSON} strokeOpacity="0.55" strokeWidth="1" />
      </g>

      {/* Legs, a planted shoe and the tapping one. */}
      <path d="M132 164 L127 188 M148 164 L150 188" stroke={FUR} strokeWidth="9" strokeLinecap="round" />
      <ellipse cx="123" cy="193" rx="10" ry="4.5" fill={FLOOR} stroke={IVORY} strokeOpacity="0.3" />
      <ellipse cx="120" cy="191.5" rx="3.5" ry="1.2" fill={IVORY} opacity="0.35" />
      <g className="m-jazz-foot">
        <ellipse cx="155" cy="193" rx="10" ry="4.5" fill={FLOOR} stroke={IVORY} strokeOpacity="0.3" />
        <ellipse cx="158" cy="191.5" rx="3.5" ry="1.2" fill={IVORY} opacity="0.35" />
      </g>

      {/* Everything above the legs rises and falls with its breath. */}
      <g className="m-jazz-breathe">
        <g className="m-jazz-body">
          <path
            d="M122 112 Q140 104 158 112 L160 168 Q140 174 120 168 Z"
            fill={SUIT}
            stroke={CRIMSON}
            strokeWidth="1.2"
            strokeOpacity="0.8"
          />
          <path d="M134 112 L140 134 L146 112 Z" fill={IVORY} />
          <path d="M134 113 L140 116 L134 119 Z M146 113 L140 116 L146 119 Z" fill={CRIMSON} />
          {/* Leaning on the mic stand. */}
          <path d="M124 118 Q104 126 84 116" stroke={SUIT} strokeWidth="8" strokeLinecap="round" fill="none" />
          <circle cx="82" cy="115" r="5" fill={FUR} stroke={CRIMSON} strokeOpacity="0.6" />
          <path d="M156 118 Q170 130 164 146" stroke={SUIT} strokeWidth="8" strokeLinecap="round" fill="none" />
        </g>

        <g className="m-hit">
          <g className="m-tap">
            <g className="m-jazz-head">
              <path d="M126 84 L128 66 L138 76 Z" fill={FUR} stroke={CRIMSON} strokeOpacity="0.7" />
              <path d="M142 76 L152 66 L154 84 Z" fill={FUR} stroke={CRIMSON} strokeOpacity="0.7" />
              <circle cx="140" cy="90" r="17" fill={FUR} stroke={CRIMSON} strokeWidth="1.2" />
              {/* Half-lidded gold eyes: too cool to open them all the way. */}
              <ellipse cx="133" cy="90" rx="3.6" ry="2.6" fill={BRASS} />
              <ellipse cx="147" cy="90" rx="3.6" ry="2.6" fill={BRASS} />
              <rect x="129" y="86" width="22" height="3.2" fill={FUR} />
              <rect x="132.6" y="89" width="1.2" height="3" fill={FLOOR} />
              <rect x="146.6" y="89" width="1.2" height="3" fill={FLOOR} />
              <path d="M138.5 96 L141.5 96 L140 98 Z" fill={CRIMSON} />
              <path
                d="M128 97 L118 95 M128 99 L118 101 M152 97 L162 95 M152 99 L162 101"
                stroke={IVORY}
                strokeOpacity="0.35"
                strokeWidth="0.8"
              />
              {/* The fedora, tipped low over one eye. */}
              <g transform="rotate(-9 140 74)">
                <ellipse cx="140" cy="75" rx="27" ry="4.5" fill={FLOOR} stroke={EDGE} />
                <path d="M122 75 Q121 52 140 52 Q159 52 158 75 Z" fill={SUIT} stroke={EDGE} />
                <path d="M133 54 Q140 60 147 54" fill="none" stroke={FLOOR} strokeWidth="2" />
                <rect x="122" y="67" width="36" height="5" fill="url(#m-jazz-brass)" />
              </g>
            </g>
          </g>
        </g>

        {/* The sax: drawn raised, and lowered by CSS while idle. */}
        <g className="m-jazz-sax">
          <g className="m-jazz-sax-play">
            <path d="M147 99 Q156 98 160 106" fill="none" stroke={BRASS} strokeWidth="3" strokeLinecap="round" />
            <path
              d="M160 106 L166 150 Q168 170 152 174"
              fill="none"
              stroke="url(#m-jazz-brass)"
              strokeWidth="8"
              strokeLinecap="round"
            />
            <path d="M156 166 Q138 164 136 178 Q148 186 158 180 Z" fill="url(#m-jazz-brass)" />
            <path d="M161 112 L165 146" stroke="#FFF6DA" strokeOpacity="0.45" strokeWidth="1.5" />
            {VALVES.map((cy, i) => (
              <circle
                key={cy}
                className={`m-jazz-valve m-jazz-valve-${i + 1}`}
                cx={166 + Math.min(i, 1)}
                cy={cy}
                r="2.2"
              />
            ))}
          </g>
        </g>
        <circle className="m-jazz-paw" cx="164" cy="146" r="5" fill={FUR} stroke={CRIMSON} strokeOpacity="0.6" />
      </g>

      {/* Notes rise from the bell as it plays. */}
      <g transform="translate(142 172)">
        <g className="m-jazz-note" style={drift(-22, -54)}>
          <Note fill={BRASS} />
        </g>
        <g className="m-jazz-note m-jazz-note-late" style={drift(14, -60)}>
          <Note fill={CRIMSON} />
        </g>
      </g>

      {/* On a beat, three rings of brass sound roll out across the stage. */}
      <Ring className="m-jazz-ring" />
      <Ring className="m-jazz-ring m-jazz-ring-late" />
      <Ring className="m-jazz-ring m-jazz-ring-later" />
      <g transform="translate(140 186)">
        <g className="m-jazz-beat-note" style={drift(-120, -36)}>
          <Note fill={BRASS} />
        </g>
        <g className="m-jazz-beat-note" style={drift(118, -44)}>
          <Note fill={CRIMSON} />
        </g>
      </g>
    </svg>
  );
});
