import type { ComponentType } from 'react';
import { ClassicalTheme } from './classical/ClassicalTheme';
import { CyberTerminalTheme } from './eightbit/CyberTerminalTheme';
import { JazzTheme } from './jazz/JazzTheme';
import type { StageProps } from './stage/StageCanvas';

/** The themes with a live layer behind the page. The rest are CSS all the way down. */
const LAYERS: Record<string, ComponentType<StageProps>> = {
  eightbit: CyberTerminalTheme,
  jazz: JazzTheme,
  classical: ClassicalTheme,
};

/**
 * The active theme's live layer, if it has one. Keyed by theme, so
 * switching genre tears one stage down and builds the next from scratch.
 */
export function ThemeBackdrop({ theme, ...props }: StageProps & { theme: string }) {
  const Layer = LAYERS[theme];
  return Layer ? <Layer key={theme} {...props} /> : null;
}
