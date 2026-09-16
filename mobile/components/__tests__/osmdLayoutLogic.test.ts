import { describe, expect, it } from 'vitest';

import { insertSystemBreaks, osmdZoomForLayout } from '@/components/osmdLayoutLogic';

describe('insertSystemBreaks', () => {
  const sample = `
    <part id="P1">
      <measure number="1"><note><rest/><duration>16</duration></note></measure>
      <measure number="2"><note><rest/><duration>16</duration></note></measure>
      <measure number="3"><note><rest/><duration>16</duration></note></measure>
      <measure number="4"><note><rest/><duration>16</duration></note></measure>
      <measure number="5"><note><rest/><duration>16</duration></note></measure>
      <measure number="6"><note><rest/><duration>16</duration></note></measure>
      <measure number="7"><note><rest/><duration>16</duration></note></measure>
    </part>
  `;

  it('inserts new-system every N measures and preserves attributes', () => {
    const out = insertSystemBreaks(sample, 3);
    expect(out).toContain('<measure number="1">');
    expect(out).not.toMatch(/<measure number="1"><print/);
    expect(out).toContain('<measure number="4"><print new-system="yes"/>');
    expect(out).toContain('<measure number="7"><print new-system="yes"/>');
    expect(out.match(/new-system="yes"/g)?.length).toBe(2);
  });

  it('strips existing print elements before inserting', () => {
    const withPrint = sample.replace(
      '<measure number="2">',
      '<measure number="2"><print new-system="yes"/>'
    );
    const out = insertSystemBreaks(withPrint, 3);
    expect(out.match(/new-system="yes"/g)?.length).toBe(2);
    expect(out).not.toMatch(/<measure number="2"><print/);
  });

  it('returns input unchanged for empty or zero measuresPerSystem', () => {
    expect(insertSystemBreaks('', 3)).toBe('');
    expect(insertSystemBreaks(sample, 0)).toBe(sample);
  });
});

describe('osmdZoomForLayout', () => {
  it('uses lower zoom for fullscreen portrait than landscape', () => {
    expect(osmdZoomForLayout('fullscreen', 390, 844)).toBe(0.38);
    expect(osmdZoomForLayout('fullscreen', 844, 390)).toBe(0.55);
  });

  it('scales compact zoom by width', () => {
    expect(osmdZoomForLayout('compact', 320, 600)).toBe(0.5);
    expect(osmdZoomForLayout('compact', 400, 600)).toBe(0.62);
    expect(osmdZoomForLayout('compact', 600, 600)).toBe(0.75);
  });
});
