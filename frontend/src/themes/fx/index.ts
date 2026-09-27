import { createClassicalFx } from './classical';
import { createEightbitFx } from './eightbit';
import { createJazzFx } from './jazz';
import { createLofiFx } from './lofi';

/**
 * Effects a theme plays on live keystrokes, on top of its CSS. Replays do
 * not trigger them: there is no caret to throw particles from.
 */
export interface ThemeFx {
  onKey(key: string, area: HTMLTextAreaElement): void;
  dispose(): void;
}

const ENGINES: Record<string, () => ThemeFx> = {
  eightbit: createEightbitFx,
  lofi: createLofiFx,
  jazz: createJazzFx,
  classical: createClassicalFx,
};

export function createThemeFx(theme: string): ThemeFx | null {
  return ENGINES[theme]?.() ?? null;
}
