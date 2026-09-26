import { memo } from 'react';
import { approach, litBy, stageHeat, type Ripple } from '../stage/motion';
import { StageCanvas, type Scene, type StageProps } from '../stage/StageCanvas';
import { coneSprite, drawCone, glowSprite } from '../stage/sprites';
import {
  ceilingLight,
  DUST,
  liveRipples,
  spawnMote,
  STAVE,
  staveEnergy,
  staveLineY,
  staveOffset,
  stepMote,
  type Mote,
} from './stage';

/** Seconds for the ceiling light to come up, or fade, when the playing crosses 60 wpm. */
const HEAT_TAU = 0.8;
/** Horizontal step between the points a stave line is drawn through, px. */
const STEP = 8;

function createClassicalScene(): Scene {
  const beam = coneSprite('197, 160, 89', '247, 241, 229');
  // Drawn at full strength; DUST.alpha brings it down to the room's 0.15.
  const mote = glowSprite(
    [
      [0, 'rgba(212, 175, 55, 1)'],
      [0.35, 'rgba(212, 175, 55, 0.5)'],
      [1, 'rgba(212, 175, 55, 0)'],
    ],
    2,
    64,
  );

  let width = 0;
  let height = 0;
  let motes: Mote[] = [];
  let ripples: Ripple[] = [];
  let heat = 0;

  return {
    resize(w, h) {
      width = w;
      height = h;
      if (motes.length === 0) {
        motes = Array.from({ length: DUST.count }, () => spawnMote(w, h, Math.random, true));
      }
    },

    draw(ctx, now, dt, input) {
      for (const e of input.events) {
        ripples.push({
          x: Number.isNaN(e.x) ? width / 2 : e.x,
          y: Number.isNaN(e.y) ? height / 2 : e.y,
          bornMs: e.at,
        });
      }
      ripples = liveRipples(ripples, now);
      heat = approach(heat, stageHeat(input.wpm, now - input.lastKeyAt), dt, HEAT_TAU);
      const light = ceilingLight(now, heat, width, height);

      ctx.globalCompositeOperation = 'source-over';
      ctx.globalAlpha = 1;
      ctx.clearRect(0, 0, width, height);

      // The stave, hairline gold, bending wherever a ripple is passing.
      ctx.lineWidth = 1;
      ctx.lineJoin = 'round';
      ctx.strokeStyle = 'rgb(197, 160, 89)';
      for (let i = 0; i < 5; i++) {
        const y = staveLineY(i, height);
        let peak = 0;
        ctx.beginPath();
        for (let x = 0; x <= width + STEP; x += STEP) {
          const off = ripples.length ? staveOffset(ripples, x, y, now) : 0;
          if (off !== 0) peak = Math.max(peak, staveEnergy(ripples, x, y, now));
          if (x === 0) ctx.moveTo(x, y + off);
          else ctx.lineTo(x, y + off);
        }
        ctx.globalAlpha = STAVE.alpha;
        ctx.stroke();
        // The line warms while sound runs along it.
        if (peak > 0.02) {
          ctx.globalCompositeOperation = 'lighter';
          ctx.globalAlpha = STAVE.rippleAlpha * peak;
          ctx.stroke();
          ctx.globalCompositeOperation = 'source-over';
        }
      }

      ctx.globalCompositeOperation = 'lighter';
      if (light.alpha > 0.001) {
        ctx.globalAlpha = light.alpha;
        drawCone(ctx, beam, light);
      }

      // Dust on the warm air, burning brighter inside the light.
      for (const m of motes) {
        stepMote(m, dt, now, width, height, Math.random);
        const lit = heat > 0.01 ? litBy(light, m.x, m.y) * heat : 0;
        ctx.globalAlpha = Math.min(1, DUST.alpha * (1 + DUST.litBoost * lit));
        const r = m.r * (1 + 0.6 * lit);
        ctx.drawImage(mote, m.x - r * 2, m.y - r * 2, r * 4, r * 4);
      }
      ctx.globalCompositeOperation = 'source-over';
      ctx.globalAlpha = 1;
    },
  };
}

/**
 * The concert hall behind the page: one stave ruled faintly across the
 * room, with ripples of sound running along it from wherever the caret is
 * at each keystroke, and gold dust rising on the warm air. Past 60 wpm a
 * ceiling light comes up over the middle of the hall and the dust inside
 * it glows.
 */
export const ClassicalBackgroundCanvas = memo(function ClassicalBackgroundCanvas(props: StageProps) {
  return <StageCanvas createScene={createClassicalScene} caret className="stage-canvas" {...props} />;
});
