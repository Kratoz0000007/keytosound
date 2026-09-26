import { memo } from 'react';
import { approach, litBy, stageHeat } from '../stage/motion';
import { StageCanvas, type Scene, type StageProps } from '../stage/StageCanvas';
import { coneSprite, drawCone, glowSprite } from '../stage/sprites';
import {
  DUST,
  gust,
  SMOKE,
  spawnMote,
  spawnPuff,
  spotlight,
  stepMote,
  stepPuff,
  type Mote,
  type Puff,
} from './stage';

/** Seconds for the lights to warm up, or cool down, when the typing crosses 60 wpm. */
const HEAT_TAU = 0.6;

function createJazzScene(): Scene {
  const cone = coneSprite('230, 57, 70', '255, 196, 190');
  // One puff of smoke: crimson at the heart, thinning through brass to nothing.
  const puff = glowSprite(
    [
      [0, 'rgba(230, 57, 70, 0.04)'],
      [0.5, 'rgba(212, 175, 55, 0.02)'],
      [1, 'rgba(212, 175, 55, 0)'],
    ],
    6,
  );

  let width = 0;
  let height = 0;
  let puffs: Puff[] = [];
  let motes: Mote[] = [];
  let heat = 0;
  let draft = 0;

  return {
    resize(w, h) {
      width = w;
      height = h;
      if (puffs.length === 0) {
        puffs = Array.from({ length: SMOKE.count }, () => spawnPuff(w, h, Math.random, true));
        motes = Array.from({ length: DUST.count }, () => spawnMote(w, h, Math.random, true));
      }
    },

    draw(ctx, now, dt, input) {
      if (input.events.length) draft = gust(draft, input.events.length);
      draft = approach(draft, 0, dt, SMOKE.draftTau);
      heat = approach(heat, stageHeat(input.wpm, now - input.lastKeyAt), dt, HEAT_TAU);

      const cones = [spotlight(-1, now, heat, width, height), spotlight(1, now, heat, width, height)];
      const lit = (x: number, y: number) => Math.max(litBy(cones[0], x, y), litBy(cones[1], x, y));

      ctx.globalCompositeOperation = 'source-over';
      ctx.globalAlpha = 1;
      ctx.clearRect(0, 0, width, height);

      // Smoke first, thickening where a beam passes through it.
      for (const p of puffs) {
        stepPuff(p, dt, now, draft, width, height, Math.random);
        ctx.globalAlpha = Math.min(1, p.alpha * (1 + 2.5 * lit(p.x, p.y)));
        ctx.drawImage(puff, p.x - p.r, p.y - p.r, p.r * 2, p.r * 2);
      }

      // Light adds: beams and the dust they catch.
      ctx.globalCompositeOperation = 'lighter';
      for (const c of cones) {
        ctx.globalAlpha = c.alpha;
        drawCone(ctx, cone, c);
      }

      ctx.fillStyle = '#D4AF37';
      for (const m of motes) {
        stepMote(m, dt, now, draft, width, height, Math.random);
        const twinkle = 0.75 + 0.25 * Math.sin(now * 0.004 + m.phase);
        ctx.globalAlpha = (DUST.darkAlpha + DUST.litAlpha * lit(m.x, m.y)) * twinkle;
        ctx.fillRect(m.x, m.y, m.size, m.size);
      }
      ctx.globalCompositeOperation = 'source-over';
      ctx.globalAlpha = 1;
    },
  };
}

/**
 * The speakeasy behind the page: two crimson spotlights swaying from the
 * top corners through a room of slow smoke and drifting dust. Past 60 wpm
 * the beams brighten and tighten; each keystroke sends a draft through the
 * smoke that pushes it right, then settles.
 */
export const JazzBackgroundCanvas = memo(function JazzBackgroundCanvas(props: StageProps) {
  return <StageCanvas createScene={createJazzScene} className="stage-canvas" {...props} />;
});
