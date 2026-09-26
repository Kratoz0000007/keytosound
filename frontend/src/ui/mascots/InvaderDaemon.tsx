import { memo, type ReactElement } from 'react';
import { drift } from './motion';

/** One sprite pixel, in viewBox units; the sprite is 13 x 10 of them. */
const CELL = 10;
const COLS = 13;
const LEFT = (240 - COLS * CELL) / 2;
const TOP = 44;
/** The sprite's middle, where the laser fires from. */
const MID_X = LEFT + (COLS * CELL) / 2;
const MID_Y = TOP + 5 * CELL;

/** Horns, skull and a row of teeth; '.' inside the skull are the eye sockets. */
const HEAD = [
  '.#.........#.',
  '..#.......#..',
  '..#########..',
  '.###########.',
  '##..#####..##',
  '##..#####..##',
  '#############',
  '###.#.#.#.###',
];

/** The two frames of the legs, swapped outright to make it scuttle. */
const LEGS_A = ['.#.#.....#.#.', '#...#...#...#'];
const LEGS_B = ['#.#.......#.#', '.#...#.#...#.'];

/** A pupil glowing in the top of each socket. */
const PUPILS = ['.............', '.............', '.............', '.............', '...#.....#...'];

/** Pixels knocked loose on a keystroke, and where each flies. */
const SPARKS = [
  { dx: -70, dy: -34 },
  { dx: 72, dy: -30 },
  { dx: -54, dy: 26 },
  { dx: 58, dy: 30 },
];

/** Horizontal runs of '#' become one rect each, starting at sprite row firstRow. */
function pixels(rows: string[], firstRow = 0) {
  const rects: ReactElement[] = [];
  for (let r = 0; r < rows.length; r++) {
    const row = rows[r];
    let start = -1;
    for (let c = 0; c <= row.length; c++) {
      const on = row[c] === '#';
      if (on && start < 0) start = c;
      if (!on && start >= 0) {
        rects.push(
          <rect
            key={`${r}-${start}`}
            x={LEFT + start * CELL}
            y={TOP + (firstRow + r) * CELL}
            width={(c - start) * CELL}
            height={CELL}
          />,
        );
        start = -1;
      }
    }
  }
  return rects;
}

/**
 * 8-Bit: the invader daemon, a horned pixel alien drawn square to the
 * pixel in phosphor green. Idle it bobs in two frames, legs scuttling;
 * typing, both lock to the typing tempo, and past 80 wpm it burns alert
 * yellow and jitters in place. On a beat it fires a pixel laser clean
 * across the screen, with a square shockwave around it. Every move is
 * stepped: nothing eases.
 *
 * Colour comes from CSS as currentColor, so the overdrive swap is one
 * property. The laser runs far past the card on both sides; the theme
 * clips horizontal overflow on the page so it never scrolls.
 */
export const InvaderDaemon = memo(function InvaderDaemon() {
  return (
    <svg className="mascot-svg m-daemon" viewBox="0 0 240 200" shapeRendering="crispEdges">
      {/* The laser: a dashed pixel beam each way, a yellow core in green rails. */}
      <g className="m-daemon-laser">
        <rect x={-1600} y={MID_Y - 6} width={3440} height="2" fill="#00FF41" />
        <rect x={-1600} y={MID_Y + 4} width={3440} height="2" fill="#00FF41" />
        <line
          x1={-1600}
          y1={MID_Y}
          x2={1840}
          y2={MID_Y}
          stroke="#FFF500"
          strokeWidth="4"
          strokeDasharray="10 4"
        />
      </g>

      <rect className="m-daemon-shadow" x={LEFT + 20} y="178" width={COLS * CELL - 40} height="6" fill="#008F11" />

      <g className="m-daemon-bob">
        <g className="m-daemon-jitter">
          <g className="m-tap">
            <g className="m-daemon-sprite">
              {pixels(HEAD)}
              <g className="m-daemon-frame-a">{pixels(LEGS_A, HEAD.length)}</g>
              <g className="m-daemon-frame-b">{pixels(LEGS_B, HEAD.length)}</g>
            </g>
            <g className="m-daemon-pupils" fill="#FFFFFF">
              {pixels(PUPILS)}
            </g>
          </g>
        </g>
      </g>

      {/* A square shockwave, stepping outward from the sprite on a beat. */}
      <rect
        className="m-daemon-shock"
        x={MID_X - 40}
        y={MID_Y - 40}
        width="80"
        height="80"
        fill="none"
        stroke="#00FF41"
        strokeWidth="4"
        strokeDasharray="8 8"
        vectorEffect="non-scaling-stroke"
      />

      <g transform={`translate(${MID_X} ${MID_Y})`}>
        {SPARKS.map((s, i) => (
          <rect
            key={i}
            className="m-daemon-spark"
            x="-4"
            y="-4"
            width="8"
            height="8"
            fill={i % 2 ? '#FFF500' : '#00FF41'}
            style={drift(s.dx, s.dy)}
          />
        ))}
      </g>
    </svg>
  );
});
