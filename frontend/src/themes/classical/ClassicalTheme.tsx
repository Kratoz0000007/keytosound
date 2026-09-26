import type { StageProps } from '../stage/StageCanvas';
import { ClassicalBackgroundCanvas } from './ClassicalBackgroundCanvas';

/**
 * Classical's live layer, mounted only while the theme is active. The rest
 * of the theme lives elsewhere: tokens, filigree and surfaces in
 * themes/classical.css, the notes that fly from the caret into the
 * mascot's ear and the border sweep in themes/fx/classical.ts, and the
 * mascot itself in ui/mascots/AudiophileRedMascot.tsx. This adds the hall
 * behind the page.
 */
export function ClassicalTheme(props: StageProps) {
  return <ClassicalBackgroundCanvas {...props} />;
}
