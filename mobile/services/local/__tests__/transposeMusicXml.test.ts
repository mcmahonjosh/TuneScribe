import { describe, expect, it } from 'vitest';

import { transposeMusicXmlContent } from '@/services/local/transposeMusicXml';

const C_MAJOR_XML = `<?xml version="1.0"?>
<score-partwise>
  <part id="P1">
    <measure number="1">
      <attributes>
        <divisions>4</divisions>
        <key><fifths>0</fifths><mode>major</mode></key>
      </attributes>
      <note>
        <pitch><step>C</step><octave>4</octave></pitch>
        <duration>4</duration>
      </note>
      <note>
        <pitch><step>E</step><octave>4</octave></pitch>
        <duration>4</duration>
      </note>
    </measure>
  </part>
</score-partwise>`;

describe('transposeMusicXmlContent', () => {
  it('shifts pitches by the interval to the target key', () => {
    const { sourceKey, outputXml } = transposeMusicXmlContent(C_MAJOR_XML, {
      tonic: 'D',
      mode: 'major',
    });
    expect(sourceKey).toEqual({ tonic: 'C', mode: 'major' });
    expect(outputXml).toContain('<step>D</step>');
    expect(outputXml).toContain('<step>F</step>');
    expect(outputXml).toContain('<alter>1</alter>'); // F#
    expect(outputXml).toContain('<fifths>2</fifths>');
    expect(outputXml).toContain('<mode>major</mode>');
  });

  it('defaults source to C major when key is missing', () => {
    const bare = `<note><pitch><step>G</step><octave>4</octave></pitch><duration>4</duration></note>`;
    const { sourceKey, outputXml } = transposeMusicXmlContent(bare, {
      tonic: 'G',
      mode: 'major',
    });
    expect(sourceKey.tonic).toBe('C');
    expect(outputXml).toContain('<step>D</step>');
  });
});
