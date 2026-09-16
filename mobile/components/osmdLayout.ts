/** Injected into OSMD WebView HTML to configure engraving (system breaks applied in TS before load). */
export const OSMD_LAYOUT_SETUP = `
function configureOsmdLayout(osmd, layoutMode) {
  if (!osmd || !osmd.EngravingRules) return;
  osmd.EngravingRules.NewPageAtXMLNewPageAttribute = false;
  osmd.EngravingRules.RenderMeasureNumbersOnlyAtSystemStart = true;
  const width = document.getElementById('score')?.clientWidth || window.innerWidth || 360;
  const height = window.innerHeight || 640;
  const landscape = width > height;
  if (layoutMode === 'fullscreen') {
    osmd.EngravingRules.NewSystemAtXMLNewSystemAttribute = true;
    osmd.EngravingRules.NewSystemAtXMLNewPageAttribute = false;
    osmd.EngravingRules.StretchLastSystemLine = false;
    osmd.Zoom = landscape ? 0.55 : 0.38;
    return;
  }
  osmd.EngravingRules.NewSystemAtXMLNewSystemAttribute = false;
  osmd.EngravingRules.NewSystemAtXMLNewPageAttribute = false;
  osmd.EngravingRules.StretchLastSystemLine = false;
  if (width < 380) {
    osmd.Zoom = 0.5;
  } else if (width < 520) {
    osmd.Zoom = 0.62;
  } else {
    osmd.Zoom = 0.75;
  }
}
`;
