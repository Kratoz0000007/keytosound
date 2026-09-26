import { memo } from 'react';

const TORSO = 'M76 198 L84 134 Q120 124 156 134 L164 198 Z';
const KEY_LINES = [74, 82, 90, 98, 106, 114, 122, 130, 138, 146];
const BLACK_KEYS = [71, 79, 95, 103, 111, 127, 135];

/**
 * Synthwave: a neon synth robot in headphones, one cyan eye and one pink,
 * a keytar slung across it, and CRT scanlines over the whole chassis.
 * Idle it floats and its eyes breathe; typing, it headbangs and glitches on
 * each keystroke; on a beat it fires a laser from its eye and splits RGB.
 */
export const SynthMascot = memo(function SynthMascot() {
  return (
    <svg className="mascot-svg m-synth" viewBox="0 0 240 200">
      <defs>
        <linearGradient id="m-synth-beam" x1="1" y1="0" x2="0" y2="0">
          <stop offset="0" stopColor="#FFFFFF" />
          <stop offset="0.12" stopColor="#FF0055" />
          <stop offset="0.55" stopColor="#00F0FF" />
          <stop offset="1" stopColor="#00F0FF" stopOpacity="0" />
        </linearGradient>
        <pattern id="m-synth-scan" width="4" height="3" patternUnits="userSpaceOnUse">
          <rect width="4" height="1" fill="#000000" opacity="0.5" />
        </pattern>
        <filter id="m-synth-glow" x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation="2.5" result="blur" />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
        <clipPath id="m-synth-torso-clip">
          <path d={TORSO} />
        </clipPath>
        <clipPath id="m-synth-head-clip">
          <rect x="84" y="46" width="72" height="70" rx="12" />
        </clipPath>
      </defs>

      <ellipse
        className="m-synth-floor"
        cx="120"
        cy="196"
        rx="62"
        ry="4"
        fill="#FF0055"
        filter="url(#m-synth-glow)"
      />

      <g className="m-float">
        <g className="m-tap">
          <path d="M84 142 L94 178" stroke="#1F1F33" strokeWidth="7" strokeLinecap="round" />
          <path d="M156 142 L150 170" stroke="#1F1F33" strokeWidth="7" strokeLinecap="round" />
          <path d={TORSO} fill="#151522" stroke="#00F0FF" strokeWidth="2" />
          <rect x="100" y="148" width="40" height="3" fill="#FF0055" />
          <rect x="100" y="156" width="40" height="3" fill="#00F0FF" />
          <rect
            x="76"
            y="124"
            width="88"
            height="76"
            fill="url(#m-synth-scan)"
            clipPath="url(#m-synth-torso-clip)"
          />
          <rect x="112" y="114" width="16" height="14" fill="#1F1F33" />

          <g className="m-synth-head">
            <path
              d="M78 70 Q78 34 120 34 Q162 34 162 70"
              fill="none"
              stroke="#1F1F33"
              strokeWidth="5"
            />
            <rect
              x="84"
              y="46"
              width="72"
              height="70"
              rx="12"
              fill="#151522"
              stroke="#FF0055"
              strokeWidth="2"
            />
            <line x1="120" y1="46" x2="120" y2="29" stroke="#FF0055" strokeWidth="2" />
            <circle
              className="m-synth-antenna"
              cx="120"
              cy="26"
              r="4"
              fill="#FFE600"
              filter="url(#m-synth-glow)"
            />
            <rect x="92" y="62" width="56" height="26" rx="6" fill="#0B0B12" />
            <rect
              className="m-synth-eye"
              x="99"
              y="70"
              width="16"
              height="10"
              rx="2"
              fill="#00F0FF"
              filter="url(#m-synth-glow)"
            />
            <rect
              className="m-synth-eye"
              x="125"
              y="70"
              width="16"
              height="10"
              rx="2"
              fill="#FF0055"
              filter="url(#m-synth-glow)"
            />
            <rect x="106" y="97" width="28" height="3" fill="#00F0FF" opacity="0.7" />
            <rect x="106" y="103" width="28" height="3" fill="#00F0FF" opacity="0.4" />
            <rect
              x="84"
              y="46"
              width="72"
              height="70"
              fill="url(#m-synth-scan)"
              clipPath="url(#m-synth-head-clip)"
            />
            <rect x="74" y="60" width="11" height="30" rx="3" fill="#FF0055" />
            <rect x="155" y="60" width="11" height="30" rx="3" fill="#00F0FF" />
            {/* The laser leaves from the cyan eye and cuts left across the stage. */}
            <rect
              className="m-synth-laser"
              x="-180"
              y="73"
              width="279"
              height="4"
              rx="2"
              fill="url(#m-synth-beam)"
            />
          </g>

          <g transform="rotate(-10 120 178)">
            <rect x="58" y="168" width="126" height="20" rx="4" fill="#FF0055" />
            <rect x="66" y="172" width="84" height="12" fill="#FFFFFF" />
            {KEY_LINES.map((x) => (
              <rect key={x} x={x} y="172" width="1" height="12" fill="#151522" />
            ))}
            {BLACK_KEYS.map((x) => (
              <rect key={x} x={x} y="172" width="5" height="7" fill="#151522" />
            ))}
            <circle cx="166" cy="178" r="4" fill="#00F0FF" filter="url(#m-synth-glow)" />
            <circle cx="176" cy="178" r="2.5" fill="#FFE600" />
          </g>
        </g>
      </g>
    </svg>
  );
});
