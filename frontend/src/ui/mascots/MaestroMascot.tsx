import { memo } from 'react';
import { drift } from './motion';

const STAR = 'M0 -5 L1.1 -1.1 L5 0 L1.1 1.1 L0 5 L-1.1 1.1 L-5 0 L-1.1 -1.1 Z';

/** Gold dust drifting off the feathers: where it starts, and its delay. */
const DUST = [
  { x: 98, y: 92, delay: '0s' },
  { x: 134, y: 86, delay: '0.9s' },
  { x: 104, y: 70, delay: '1.7s' },
  { x: 130, y: 98, delay: '2.4s' },
  { x: 112, y: 84, delay: '3.1s' },
];

/** Filigree thrown off the baton tip on a beat, flying up over the visualizer. */
const FILIGREE = [
  { dx: -70, dy: -130 },
  { dx: 10, dy: -160 },
  { dx: 70, dy: -120 },
  { dx: 110, dy: -70 },
  { dx: -110, dy: -90 },
  { dx: 44, dy: -40 },
];

/** The five lines of a stave on the slanted sheet, parallel to its top edge. */
const STAVE = [0, 1, 2, 3, 4].map((i) => ({ y1: 110 + i * 4.4, y2: 102.6 + i * 4.4 }));

/**
 * Classical: the maestro owl, in white tie and a gold monocle, perched on
 * top of a music stand. Idle it surveys the score and breathes, gold dust
 * rising off its feathers; typing, it conducts, faster as wpm climbs, a gold
 * arc tracing the baton; on a beat it swings for the crescendo and throws
 * filigree up across the visualizer.
 */
export const ClassicalMascot = memo(function ClassicalMascot() {
  return (
    <svg className="mascot-svg m-owl" viewBox="0 0 240 200">
      <defs>
        <filter id="m-owl-glow" x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation="2" result="blur" />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>

      {/* The stand: tripod, pole, and the slanted desk with its score. */}
      <path
        d="M116 180 L96 197 M116 180 L136 197 M116 180 L116 197"
        stroke="#2A3448"
        strokeWidth="2.5"
        strokeLinecap="round"
      />
      <rect x="114" y="138" width="4" height="44" fill="#2A3448" />
      <path d="M66 104 L166 96 L170 136 L70 144 Z" fill="#F7F1E5" stroke="#C5A059" strokeWidth="1.5" />
      {STAVE.map((l, i) => (
        <line
          key={i}
          x1="74"
          y1={l.y1}
          x2="160"
          y2={l.y2}
          stroke="#131822"
          strokeOpacity="0.55"
          strokeWidth="0.7"
        />
      ))}
      <g fill="#131822" opacity="0.8">
        <ellipse cx="88" cy="114.5" rx="2.4" ry="1.8" />
        <ellipse cx="104" cy="115" rx="2.4" ry="1.8" />
        <ellipse cx="122" cy="107" rx="2.4" ry="1.8" />
        <ellipse cx="140" cy="110" rx="2.4" ry="1.8" />
      </g>
      <path d="M70 144 L170 136 L171 140 L71 148 Z" fill="#C5A059" />

      <g className="m-owl-body">
        <path
          d="M116 102 Q92 102 92 76 Q92 50 116 48 Q140 50 140 76 Q140 102 116 102 Z"
          fill="#1A202C"
          stroke="#C5A059"
          strokeWidth="1"
          strokeOpacity="0.6"
        />
        <path d="M116 58 L108 92 Q116 96 124 92 Z" fill="#F7F1E5" />
        <path d="M116 58 L104 84 L99 66 Z" fill="#0B0E14" />
        <path d="M116 58 L128 84 L133 66 Z" fill="#0B0E14" />
        <circle cx="116" cy="76" r="1.3" fill="#0B0E14" />
        <circle cx="116" cy="84" r="1.3" fill="#0B0E14" />
        <path d="M108 58 L116 61.5 L108 65 Z M124 58 L116 61.5 L124 65 Z" fill="#C5A059" />
        <circle cx="116" cy="61.5" r="1.8" fill="#D4AF37" />
        <path d="M94 70 Q88 88 98 100 Q102 86 100 72 Z" fill="#131822" />
        <path d="M104 101 l-3 3 M108 101 l0 4 M112 101 l3 3" stroke="#D4AF37" strokeWidth="1.4" strokeLinecap="round" />
        <path d="M120 101 l-3 3 M124 101 l0 4 M128 101 l3 3" stroke="#D4AF37" strokeWidth="1.4" strokeLinecap="round" />
      </g>

      {DUST.map((d, i) => (
        <circle
          key={i}
          className="m-owl-dust"
          cx={d.x}
          cy={d.y}
          r="1.3"
          fill="#E5C158"
          style={{ animationDelay: d.delay }}
        />
      ))}

      <g className="m-tap">
        <g className="m-owl-head">
          <path d="M96 30 L92 12 L106 22 Z" fill="#1A202C" stroke="#C5A059" strokeOpacity="0.6" />
          <path d="M136 30 L140 12 L126 22 Z" fill="#1A202C" stroke="#C5A059" strokeOpacity="0.6" />
          <ellipse cx="116" cy="36" rx="24" ry="20" fill="#1A202C" stroke="#C5A059" strokeWidth="1" strokeOpacity="0.6" />
          <circle cx="106" cy="36" r="9.5" fill="#F7F1E5" />
          <circle cx="126" cy="36" r="9.5" fill="#F7F1E5" />
          <circle cx="104.5" cy="37" r="4.5" fill="#0B0E14" />
          <circle cx="124.5" cy="37" r="4.5" fill="#0B0E14" />
          <circle cx="103" cy="35.5" r="1.2" fill="#FFFFFF" />
          <circle cx="123" cy="35.5" r="1.2" fill="#FFFFFF" />
          <ellipse className="m-owl-lid" cx="106" cy="36" rx="10" ry="10" fill="#1A202C" />
          <ellipse className="m-owl-lid" cx="126" cy="36" rx="10" ry="10" fill="#1A202C" />
          <circle cx="126" cy="36" r="11.5" fill="none" stroke="#D4AF37" strokeWidth="1.8" />
          <path d="M136 42 Q142 58 134 70" fill="none" stroke="#D4AF37" strokeWidth="0.9" strokeDasharray="1.6 1.6" />
          <path d="M112 44 L120 44 L116 52 Z" fill="#D4AF37" />
          <path d="M97 25 L111 29 M135 25 L121 29" stroke="#C5A059" strokeWidth="1.4" strokeLinecap="round" />
        </g>
      </g>

      {/* The arc the baton traces while conducting. */}
      <path
        className="m-owl-trail"
        d="M112 1 A69 69 0 0 1 201 42"
        fill="none"
        stroke="#E5C158"
        strokeWidth="2"
        strokeLinecap="round"
        filter="url(#m-owl-glow)"
      />

      <g className="m-hit">
        <g className="m-owl-arm">
          <path
            d="M136 64 Q152 58 158 48 Q146 50 134 58 Z"
            fill="#131822"
            stroke="#C5A059"
            strokeOpacity="0.5"
          />
          <line x1="156" y1="50" x2="186" y2="18" stroke="#D4AF37" strokeWidth="2.2" strokeLinecap="round" />
          <circle cx="186" cy="18" r="2.4" fill="#FFFFFF" stroke="#1C1A17" strokeWidth="0.8" />
          <circle cx="156" cy="50" r="3.2" fill="#FFFFFF" stroke="#1C1A17" strokeWidth="0.8" />
        </g>
      </g>

      <g transform="translate(186 18)">
        {FILIGREE.map((f, i) => (
          <path key={i} className="m-owl-spark" d={STAR} fill="#D4AF37" style={drift(f.dx, f.dy)} />
        ))}
      </g>
    </svg>
  );
});
