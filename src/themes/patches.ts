// Typed per-patch theme contract — the ONLY thing a patch page overrides.
// This replaces the copy-pasted inline :root palette logic. As each patch page
// is ported, add its palette here so the page + JS effect-gates read one source.
// `warm` mirrors detail.js accentIsWarm() (ember field gating).

export interface PatchTheme {
  /** page background (also drives <meta theme-color>) */
  bg: string;
  /** primary accent */
  accent: string;
  /** secondary accent */
  accent2?: string;
  /** warm-hued accent -> ember field eligible (see detail.js accentIsWarm) */
  warm?: boolean;
}

export const patchThemes: Record<string, PatchTheme> = {
  '4.8.2': { bg: '#0c0a16', accent: '#1FB8A6', accent2: '#C79A4B', warm: false },
  // extend as pages are ported …
};
