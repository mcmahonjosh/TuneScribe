/** Injected into OSMD WebView HTML to configure normal multi-measure layout. */
export const OSMD_LAYOUT_SETUP = `
function configureOsmdLayout(osmd) {
  if (!osmd || !osmd.EngravingRules) return;
  osmd.EngravingRules.NewSystemAtXMLNewSystemAttribute = false;
  osmd.EngravingRules.NewSystemAtXMLNewPageAttribute = false;
  osmd.EngravingRules.NewPageAtXMLNewPageAttribute = false;
  osmd.EngravingRules.RenderMeasureNumbersOnlyAtSystemStart = true;
  osmd.EngravingRules.RenderXMeasuresPerLineAkaSystem = 4;
  const width = document.getElementById('score')?.clientWidth || window.innerWidth || 360;
  if (width < 380) {
    osmd.Zoom = 0.5;
  } else if (width < 520) {
    osmd.Zoom = 0.62;
  } else {
    osmd.Zoom = 0.75;
  }
}
`;
