import { memo } from 'react';
import { drift } from './motion';

const YELLOW = '#F6D02F';
const YELLOW_SHADE = '#E0B41E';
const PIKA_LINE = '#6B4A00';
const CHEEK = '#E24B3B';
const BLUE = '#7FC6D0';
const SQUIRT_LINE = '#2F6E7E';
const SHELL = '#B8703A';
const PLASTRON = '#F0DA8A';
const INK = '#1A1A1A';

const EAR_L = 'M44 76 Q24 58 15 32 Q36 44 56 70 Z';
const EAR_R = 'M78 70 Q92 50 101 25 Q107 50 90 77 Z';

/** The lightning-bolt tail, rising behind Pikachu. */
const BOLT =
  'M92 146 L104 128 L98 124 L114 104 L106 100 L126 72 L138 80 L120 102 L128 106 L112 126 L118 130 L100 152 Z';

/** Notes drifting up from between them while they vibe, and where each goes. */
const NOTES = [
  { glyph: '♪', x: 122, y: 120, dx: -14, dy: -70, delay: '0s' },
  { glyph: '♫', x: 128, y: 126, dx: 12, dy: -80, delay: '-0.6s' },
  { glyph: '♩', x: 118, y: 130, dx: -4, dy: -76, delay: '-1.2s' },
];

/** Bubbles Squirtle blows on a beat. */
const BUBBLES = [
  { dx: 18, dy: -44, r: 4 },
  { dx: 30, dy: -30, r: 3 },
  { dx: 8, dy: -60, r: 2.6 },
  { dx: 36, dy: -54, r: 3.4 },
];

/**
 * Lo-Fi: Pikachu and Squirtle, vibing. Pikachu sits on the left, one paw
 * up, grinning; Squirtle stands beside it, arm out, tail curled.
 *
 * Idle, they sway slowly to the room and Squirtle's tail swings. Typing,
 * they bob their heads at the typing tempo, half a beat apart, Pikachu's
 * paw waving, while notes float up between them. Each keystroke twitches
 * Pikachu's ears; on a beat Pikachu's cheeks crackle and Squirtle blows
 * bubbles.
 *
 * Everything moves in CSS (mascots.css), off the stage's data-state,
 * data-tap and data-hit and its --m-tempo.
 */
export const PikachuSquirtleMascot = memo(function PikachuSquirtleMascot() {
  return (
    <svg className="mascot-svg m-poke" viewBox="0 0 240 200">
      <defs>
        <clipPath id="m-pika-ear-l">
          <path d={EAR_L} />
        </clipPath>
        <clipPath id="m-pika-ear-r">
          <path d={EAR_R} />
        </clipPath>
      </defs>

      <ellipse cx="72" cy="184" rx="44" ry="5" fill="#000" opacity="0.28" />
      <ellipse cx="178" cy="190" rx="40" ry="5" fill="#000" opacity="0.28" />

      {/* ---- Pikachu */}
      <g className="m-pika">
        <path d={BOLT} fill={YELLOW} stroke={PIKA_LINE} strokeWidth="1.5" strokeLinejoin="round" />
        <path d="M92 146 L104 128 L112 134 L100 152 Z" fill="#9C6B30" stroke={PIKA_LINE} strokeWidth="1.5" strokeLinejoin="round" />

        {/* Body, sitting, and its two feet stuck out in front. */}
        <path d="M42 118 Q38 150 50 168 Q70 177 92 168 Q102 148 94 118 Q70 108 42 118 Z" fill={YELLOW} stroke={PIKA_LINE} strokeWidth="1.5" />
        <path d="M48 150 Q52 164 62 168" fill="none" stroke={YELLOW_SHADE} strokeWidth="3" strokeLinecap="round" />
        <ellipse cx="50" cy="174" rx="14" ry="7" fill={YELLOW} stroke={PIKA_LINE} strokeWidth="1.5" transform="rotate(-12 50 174)" />
        <ellipse cx="90" cy="174" rx="14" ry="7" fill={YELLOW} stroke={PIKA_LINE} strokeWidth="1.5" transform="rotate(12 90 174)" />
        <path d="M40 176 l3 -4 M45 178 l2 -5 M100 176 l-3 -4 M95 178 l-2 -5" stroke={PIKA_LINE} strokeWidth="1.2" strokeLinecap="round" />

        {/* The resting arm. */}
        <path d="M46 126 Q37 140 47 147 Q54 140 52 128 Z" fill={YELLOW} stroke={PIKA_LINE} strokeWidth="1.5" />

        {/* The raised paw, waving. */}
        <g className="m-pika-wave">
          <path d="M88 124 Q104 118 110 102 Q117 99 117 108 Q111 124 95 134 Z" fill={YELLOW} stroke={PIKA_LINE} strokeWidth="1.5" />
          <path d="M110 102 l-1 -5 M113 101 l1 -5 M116 103 l3 -3" stroke={PIKA_LINE} strokeWidth="1.2" strokeLinecap="round" />
        </g>

        <g className="m-pika-head">
          <g className="m-tap">
            <g className="m-pika-ear-l">
              <path d={EAR_L} fill={YELLOW} stroke={PIKA_LINE} strokeWidth="1.5" />
              <rect x="10" y="26" width="34" height="22" fill={INK} clipPath="url(#m-pika-ear-l)" />
            </g>
            <g className="m-pika-ear-r">
              <path d={EAR_R} fill={YELLOW} stroke={PIKA_LINE} strokeWidth="1.5" />
              <rect x="84" y="20" width="26" height="22" fill={INK} clipPath="url(#m-pika-ear-r)" />
            </g>
          </g>

          <ellipse cx="66" cy="92" rx="31" ry="26" fill={YELLOW} stroke={PIKA_LINE} strokeWidth="1.5" />
          {/* Eyes, rosy cheeks, a tiny nose and a big open grin. */}
          <circle cx="55" cy="89" r="4.6" fill={INK} />
          <circle cx="79" cy="89" r="4.6" fill={INK} />
          <circle cx="56.6" cy="87.4" r="1.7" fill="#FFFFFF" />
          <circle cx="80.6" cy="87.4" r="1.7" fill="#FFFFFF" />
          <circle cx="44" cy="101" r="7" fill={CHEEK} />
          <circle cx="89" cy="101" r="7" fill={CHEEK} />
          <ellipse cx="67" cy="96" rx="1.6" ry="1" fill={INK} />
          <path d="M57 99 Q67 120 77 99 Q67 104 57 99 Z" fill="#6B2615" stroke={PIKA_LINE} strokeWidth="1" />
          <path d="M60.5 107 Q67 116 73.5 107 Q67 110 60.5 107 Z" fill="#E86A50" />

          {/* On a beat, electricity crackles off both cheeks. */}
          <g className="m-pika-spark" fill="none" stroke="#FFF36B" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <path d="M36 98 l-6 -4 l4 -2 l-7 -6" />
            <path d="M36 106 l-7 2 l3 3 l-8 3" />
            <path d="M97 98 l6 -4 l-4 -2 l7 -6" />
            <path d="M97 106 l7 2 l-3 3 l8 3" />
          </g>
        </g>
      </g>

      {/* ---- Squirtle */}
      <g className="m-squirt">
        {/* The curly tail. */}
        <g className="m-squirt-tail">
          <path d="M196 168 Q226 170 226 150 Q226 134 212 134 Q200 136 202 148 Q204 156 212 154" fill="none" stroke={SQUIRT_LINE} strokeWidth="13" strokeLinecap="round" />
          <path d="M196 168 Q226 170 226 150 Q226 134 212 134 Q200 136 202 148 Q204 156 212 154" fill="none" stroke={BLUE} strokeWidth="10" strokeLinecap="round" />
          <path d="M218 150 Q218 142 212 142 Q208 143 209 148" fill="none" stroke={SQUIRT_LINE} strokeWidth="1.2" strokeLinecap="round" />
        </g>

        {/* The shell, its rim showing behind the body. */}
        <path d="M190 114 Q212 140 201 174 L185 172 Q194 142 181 117 Z" fill={SHELL} stroke="#6B3A15" strokeWidth="1.5" />
        <path d="M192 120 Q206 142 198 168" fill="none" stroke="#F3E3B8" strokeWidth="2" />

        {/* Stubby legs. */}
        <ellipse cx="160" cy="182" rx="12" ry="8" fill={BLUE} stroke={SQUIRT_LINE} strokeWidth="1.5" />
        <ellipse cx="192" cy="184" rx="12" ry="8" fill={BLUE} stroke={SQUIRT_LINE} strokeWidth="1.5" />
        <path d="M152 188 l1 -4 M158 190 l0 -4 M184 190 l1 -4 M190 192 l0 -4" stroke={SQUIRT_LINE} strokeWidth="1.2" strokeLinecap="round" />

        {/* Body and the yellow plastron, plated. */}
        <ellipse cx="175" cy="148" rx="24" ry="30" fill={BLUE} stroke={SQUIRT_LINE} strokeWidth="1.5" />
        <ellipse cx="174" cy="150" rx="17" ry="24" fill={PLASTRON} stroke="#9A7A30" strokeWidth="1.2" />
        <path d="M174 127 L174 173 M158 140 Q174 145 190 140 M158 159 Q174 164 190 159" fill="none" stroke="#9A7A30" strokeWidth="1.2" />

        {/* The arm held out to the side, swinging to the music. */}
        <g className="m-squirt-arm">
          <path d="M156 128 Q140 123 129 128 Q126 137 135 137 Q146 137 156 141 Z" fill={BLUE} stroke={SQUIRT_LINE} strokeWidth="1.5" />
          <path d="M130 131 l-3 -2 M129 135 l-4 0" stroke={SQUIRT_LINE} strokeWidth="1.2" strokeLinecap="round" />
        </g>
        {/* The other arm, bent in front. */}
        <path d="M193 127 Q207 140 199 157 Q190 159 190 151 Q196 142 187 133 Z" fill={BLUE} stroke={SQUIRT_LINE} strokeWidth="1.5" />

        <g className="m-squirt-head">
          <ellipse cx="176" cy="92" rx="31" ry="28" fill={BLUE} stroke={SQUIRT_LINE} strokeWidth="1.5" />
          <path d="M152 76 Q162 66 176 66" fill="none" stroke="#A6DCE3" strokeWidth="3" strokeLinecap="round" />
          {/* Big red-brown eyes, a little brow over each, a small smile. */}
          <path d="M157 78 Q164 75 170 79 M183 79 Q190 75 196 78" fill="none" stroke={SQUIRT_LINE} strokeWidth="1.3" strokeLinecap="round" />
          <ellipse cx="164" cy="90" rx="6.5" ry="8.5" fill="#7A2418" stroke={INK} strokeWidth="1.2" />
          <ellipse cx="189" cy="90" rx="6.5" ry="8.5" fill="#7A2418" stroke={INK} strokeWidth="1.2" />
          <ellipse cx="165" cy="91.5" rx="3.4" ry="5" fill={INK} />
          <ellipse cx="190" cy="91.5" rx="3.4" ry="5" fill={INK} />
          <circle cx="166.5" cy="87" r="2" fill="#FFFFFF" />
          <circle cx="191.5" cy="87" r="2" fill="#FFFFFF" />
          <path d="M166 106 Q176 111 186 106" fill="none" stroke={SQUIRT_LINE} strokeWidth="1.5" strokeLinecap="round" />
          <path d="M173 100 l1 1 M179 100 l-1 1" stroke={SQUIRT_LINE} strokeWidth="1.2" strokeLinecap="round" />

          {/* On a beat, bubbles rise from its mouth. */}
          <g transform="translate(186 106)">
            {BUBBLES.map((b, i) => (
              <circle
                key={i}
                className="m-squirt-bubble"
                r={b.r}
                fill="#DFF7FB"
                fillOpacity="0.35"
                stroke="#DFF7FB"
                strokeWidth="1"
                style={drift(b.dx, b.dy)}
              />
            ))}
          </g>
        </g>
      </g>

      {/* Notes floating up between them while they vibe. */}
      {NOTES.map((n, i) => (
        <text
          key={i}
          className="m-poke-note"
          x={n.x}
          y={n.y}
          fill="#FFF3D6"
          fontSize="14"
          textAnchor="middle"
          style={{ ...drift(n.dx, n.dy), animationDelay: n.delay }}
        >
          {n.glyph}
        </text>
      ))}
    </svg>
  );
});
