/**
 * Genres that have a theme of their own, in themes/<genre id>.css. A genre
 * not listed borrows the fallback, so the page is never unstyled while its
 * theme is still being built.
 */
const THEMED_GENRES = new Set(['synthwave', 'lofi', 'eightbit', 'jazz', 'classical']);

export const FALLBACK_THEME = 'synthwave';

export function themeFor(genreId: string): string {
  return THEMED_GENRES.has(genreId) ? genreId : FALLBACK_THEME;
}
