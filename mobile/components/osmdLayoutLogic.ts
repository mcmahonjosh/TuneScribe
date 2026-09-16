/** Pure OSMD layout helpers (also used when building WebView HTML). */

export function insertSystemBreaks(xml: string, measuresPerSystem: number): string {
  if (!xml || !measuresPerSystem) return xml;
  const cleaned = String(xml)
    .replace(/<print[^>]*\/>/g, '')
    .replace(/<print[^>]*>[\s\S]*?<\/print>/g, '');
  let index = 0;
  return cleaned.replace(/<measure\b([^>]*)>/g, (full, attrs: string) => {
    index += 1;
    if (index === 1 || (index - 1) % measuresPerSystem !== 0) {
      return full;
    }
    return `<measure${attrs}><print new-system="yes"/>`;
  });
}

/** Zoom level for OSMD fullscreen / compact layout. */
export function osmdZoomForLayout(
  layoutMode: 'fullscreen' | 'compact',
  width: number,
  height: number
): number {
  const landscape = width > height;
  if (layoutMode === 'fullscreen') {
    return landscape ? 0.55 : 0.38;
  }
  if (width < 380) return 0.5;
  if (width < 520) return 0.62;
  return 0.75;
}
