/** OSMD score display + polyphonic highlight sync. Audio is played natively in React Native. */

import { OSMD_LAYOUT_SETUP } from '@/components/osmdLayout';
import { insertSystemBreaks } from '@/components/osmdLayoutLogic';
import { themes, type ThemeId } from '@/constants/theme';

export type SheetPlayerVariant = 'compact' | 'fullscreen';

const PAPER = '#f7f4ea';

export function buildSheetMusicPlayerHtml(
  musicxml: string,
  midiBase64: string | null,
  themeId: ThemeId = 'violet',
  variant: SheetPlayerVariant = 'fullscreen'
): string {
  const theme = themes[themeId];
  const escapedMidi = midiBase64
    ? midiBase64.replace(/\\/g, '\\\\').replace(/`/g, '\\`').replace(/\$/g, '\\$')
    : '';

  const compact = variant === 'compact';
  const layoutMode = compact ? 'compact' : 'fullscreen';
  const scoreXml = layoutMode === 'fullscreen' ? insertSystemBreaks(musicxml, 3) : musicxml;
  const escapedScoreXml = scoreXml
    .replace(/\\/g, '\\\\')
    .replace(/`/g, '\\`')
    .replace(/\$/g, '\\$');
  const viewport = compact
    ? 'width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no'
    : 'width=device-width, initial-scale=1.0, minimum-scale=1.0, maximum-scale=4.0, user-scalable=yes';

  return `<!DOCTYPE html>
<html>
<head>
  <meta name="viewport" content="${viewport}">
  <script src="https://unpkg.com/opensheetmusicdisplay@1.8.9/build/opensheetmusicdisplay.min.js"></script>
  <script src="https://unpkg.com/@tonejs/midi@2.0.28/build/Midi.js"></script>
  <style>
    html, body { height: 100%; }
    * { box-sizing: border-box; }
    body { margin: 0; padding: 0; background: ${PAPER}; font-family: -apple-system, sans-serif; color: #1a1a1a; }
    #toolbar {
      display: none;
      gap: 8px;
      padding: 8px;
      background: ${theme.surfaceElevated};
      border-bottom: 1px solid ${theme.border};
      position: sticky;
      top: 0;
      z-index: 5;
    }
    .tb-btn {
      flex: 1;
      border: none;
      border-radius: 8px;
      padding: 10px 8px;
      font-size: 14px;
      font-weight: 700;
      color: #fff;
      background: #27ae60;
    }
    .tb-btn.pause { background: #f39c12; flex: 0.9; }
    .tb-btn.stop { background: #95a5a6; flex: 0.8; color: #fff; }
    .tb-btn:disabled { opacity: 0.45; }
    #score { width: 100%; min-height: 200px; padding: 8px; background: ${PAPER}; ${compact ? '' : 'touch-action: pan-x pan-y pinch-zoom;'} }
    #status { display: ${compact ? 'none' : 'block'}; font-size: 12px; color: ${theme.textMuted}; padding: 0 10px 8px; min-height: 16px; }
    .note-highlight path, .note-highlight ellipse, .note-highlight rect {
      fill: ${theme.primary} !important;
      stroke: ${theme.primaryMuted} !important;
    }
  </style>
</head>
<body>
  <div id="toolbar">
    <button id="ts-play" class="tb-btn" type="button">▶ Play</button>
    <button id="ts-pause" class="tb-btn pause" type="button" disabled>⏸ Pause</button>
    <button id="ts-stop" class="tb-btn stop" type="button" disabled>■ Stop</button>
  </div>
  <div id="score"></div>
  <div id="status">Loading score...</div>
  <script>
    ${OSMD_LAYOUT_SETUP}

    const musicXml = \`${escapedScoreXml}\`;
    const midiBase64 = ${midiBase64 ? `\`${escapedMidi}\`` : 'null'};

    let osmd = null;
    let osmdReady = false;
    let highlighted = [];
    let playbackMode = 'stopped';
    let noteSchedule = [];
    let graphicNoteMap = [];

    const layoutMode = '${layoutMode}';

    const statusEl = document.getElementById('status');
    const playBtn = document.getElementById('ts-play');
    const pauseBtn = document.getElementById('ts-pause');
    const stopBtn = document.getElementById('ts-stop');

    function postMessage(payload) {
      const json = JSON.stringify(payload);
      if (window.ReactNativeWebView) {
        window.ReactNativeWebView.postMessage(json);
      }
    }

    function setStatus(text) {
      statusEl.textContent = text;
    }

    function updateToolbar() {
      const playing = playbackMode === 'playing';
      const paused = playbackMode === 'paused';
      playBtn.textContent = paused ? '▶ Resume' : '▶ Play';
      playBtn.disabled = playing || !osmdReady;
      pauseBtn.disabled = !playing;
      stopBtn.disabled = playbackMode === 'stopped';
    }

    function setPlaybackMode(mode) {
      playbackMode = mode;
      updateToolbar();
    }

    function applyHighlight(graphicNote) {
      const group = graphicNote.getSVGGElement && graphicNote.getSVGGElement();
      if (!group) return;
      group.classList.add('note-highlight');
      group.querySelectorAll('path, ellipse, rect').forEach((el) => {
        el.dataset.origFill = el.style.fill || '';
        el.dataset.origStroke = el.style.stroke || '';
        el.style.fill = '#3b82f6';
        el.style.stroke = '#2563eb';
      });
      highlighted.push(graphicNote);
    }

    function clearHighlights() {
      highlighted.forEach((note) => {
        const group = note.getSVGGElement && note.getSVGGElement();
        if (!group) return;
        group.querySelectorAll('path, ellipse, rect').forEach((el) => {
          if (el.dataset.origFill !== undefined) el.style.fill = el.dataset.origFill;
          if (el.dataset.origStroke !== undefined) el.style.stroke = el.dataset.origStroke;
        });
        group.classList.remove('note-highlight');
      });
      highlighted = [];
    }

    function iteratorDone(iterator) {
      return iterator.EndReached || iterator.endReached;
    }

    function getBpm() {
      return (osmd.Sheet && osmd.Sheet.DefaultStartTempoInBpm) || 120;
    }

    function iteratorTimeSeconds(iterator) {
      const stamp = iterator.currentTimeStamp;
      const quarter = stamp && stamp.realValue != null ? stamp.realValue * 4 : 0;
      return quarter * (60 / getBpm());
    }

    function extractNotesFromMidi(b64) {
      if (!b64 || !window.Midi) return [];
      try {
        const binary = atob(b64);
        const bytes = new Uint8Array(binary.length);
        for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
        const midi = new Midi(bytes.buffer);
        const events = [];
        midi.tracks.forEach((track) => {
          track.notes.forEach((note) => {
            const duration = Math.max(0.05, note.duration);
            events.push({
              midi: note.midi,
              start: note.time,
              end: note.time + duration,
              duration,
            });
          });
        });
        events.sort((a, b) => a.start - b.start || a.midi - b.midi);
        return events;
      } catch (err) {
        return [];
      }
    }

    function extractNotesFromOsmd() {
      if (!osmd || !osmd.cursor) return [];
      const cursor = osmd.cursor;
      cursor.reset();
      const iterator = cursor.Iterator || cursor.iterator;
      if (!iterator) return [];

      const secPerQuarter = 60 / getBpm();
      const extracted = [];

      while (!iteratorDone(iterator)) {
        const time = iteratorTimeSeconds(iterator);
        const entries = iterator.CurrentVoiceEntries || [];
        for (const entry of entries) {
          const entryNotes = entry.Notes || entry.notes || [];
          for (const note of entryNotes) {
            const isRest = note.isRest && note.isRest();
            if (!note || isRest || note.halfTone === 0) continue;
            const lengthQuarter = (note.Length && note.Length.realValue) || 0.25;
            const duration = lengthQuarter * secPerQuarter;
            extracted.push({
              midi: note.halfTone + 12,
              start: time,
              end: time + Math.max(0.08, duration),
              duration: Math.max(0.08, duration),
            });
          }
        }
        if (iterator.moveToNext) iterator.moveToNext();
        else break;
      }

      cursor.reset();
      return extracted;
    }

    function buildGraphicNoteMap() {
      if (!osmd || !osmd.cursor) return [];
      const cursor = osmd.cursor;
      cursor.reset();
      const iterator = cursor.Iterator || cursor.iterator;
      if (!iterator) return [];

      const mapped = [];
      while (!iteratorDone(iterator)) {
        const time = iteratorTimeSeconds(iterator);
        const graphicNotes = cursor.GNotesUnderCursor ? cursor.GNotesUnderCursor() : [];
        graphicNotes.forEach((graphicNote) => {
          const source = graphicNote.sourceNote;
          if (!source || (source.isRest && source.isRest())) return;
          mapped.push({
            pitch: source.halfTone + 12,
            start: time,
            graphicNote,
          });
        });
        if (iterator.moveToNext) iterator.moveToNext();
        else break;
      }

      cursor.reset();
      return mapped;
    }

    function prepareNoteSchedule() {
      let notes = midiBase64 ? extractNotesFromMidi(midiBase64) : [];
      let source = 'midi';
      if (!notes.length) {
        notes = extractNotesFromOsmd();
        source = 'sheet';
      }
      noteSchedule = notes;
      return { notes, source };
    }

    function maxSimultaneous(schedule) {
      const events = [];
      schedule.forEach((note) => {
        events.push([note.start, 1]);
        events.push([note.end, -1]);
      });
      events.sort((a, b) => a[0] - b[0] || b[1] - a[1]);
      let active = 0;
      let peak = 0;
      events.forEach(([, delta]) => {
        active += delta;
        peak = Math.max(peak, active);
      });
      return peak;
    }

    function findGraphicMatch(activeNote) {
      const tolerance = 0.18;
      let best = null;
      let bestDelta = tolerance;
      graphicNoteMap.forEach((entry) => {
        if (entry.pitch !== activeNote.midi) return;
        const delta = Math.abs(entry.start - activeNote.start);
        if (delta <= bestDelta) {
          best = entry.graphicNote;
          bestDelta = delta;
        }
      });
      return best;
    }

    function syncCursorToTime(t) {
      if (!osmd || !osmd.cursor) return;
      const cursor = osmd.cursor;
      const iterator = cursor.Iterator || cursor.iterator;
      if (!iterator) return;

      cursor.reset();
      cursor.show();
      while (!iteratorDone(iterator)) {
        const time = iteratorTimeSeconds(iterator);
        if (time + 0.03 >= t) break;
        if (iterator.moveToNext) iterator.moveToNext();
        else break;
      }
      if (cursor.update) cursor.update();
    }

    window.tunescribeSyncTime = function(t) {
      if (!osmdReady) return;
      clearHighlights();

      const active = noteSchedule.filter((note) => note.start - 0.02 <= t && t < note.end);
      const used = new Set();
      active.forEach((activeNote) => {
        const graphic = findGraphicMatch(activeNote);
        if (graphic && !used.has(graphic)) {
          used.add(graphic);
          applyHighlight(graphic);
        }
      });

      syncCursorToTime(t);
    };

    window.tunescribeResetCursor = function() {
      if (!osmd || !osmd.cursor) return;
      osmd.cursor.reset();
      osmd.cursor.hide();
      clearHighlights();
    };

    function sendCommand(action) {
      postMessage({ type: 'command', action });
    }

    playBtn.addEventListener('click', () => sendCommand(playbackMode === 'paused' ? 'resume' : 'play'));
    pauseBtn.addEventListener('click', () => sendCommand('pause'));
    stopBtn.addEventListener('click', () => sendCommand('stop'));

    osmd = new opensheetmusicdisplay.OpenSheetMusicDisplay('score', {
      autoResize: layoutMode !== 'fullscreen',
      drawTitle: false,
      backend: 'svg',
      cursorsOptions: [{ type: 0, color: '#3b82f6', alpha: 0.18, follow: true }],
    });

    let lastLayoutWidth = 0;
    let lastLayoutHeight = 0;
    function relayoutScore() {
      if (!osmdReady || !osmd) return;
      const width = window.innerWidth;
      const height = window.innerHeight;
      if (Math.abs(width - lastLayoutWidth) < 12 && Math.abs(height - lastLayoutHeight) < 12) return;
      lastLayoutWidth = width;
      lastLayoutHeight = height;
      configureOsmdLayout(osmd, layoutMode);
      osmd.render();
      if (playbackMode !== 'playing' && osmd.cursor && osmd.cursor.hide) osmd.cursor.hide();
    }

    osmd.load(musicXml).then(() => {
      configureOsmdLayout(osmd, layoutMode);
      osmd.render();
      lastLayoutWidth = window.innerWidth;
      lastLayoutHeight = window.innerHeight;
      if (osmd.cursor && osmd.cursor.hide) osmd.cursor.hide();
      osmdReady = true;
      graphicNoteMap = buildGraphicNoteMap();
      if (osmd.cursor && osmd.cursor.hide) osmd.cursor.hide();
      const { notes, source } = prepareNoteSchedule();
      const peak = maxSimultaneous(notes);
      const polyHint = peak > 1 ? ' · up to ' + peak + ' notes together' : '';
      setStatus('Ready (' + notes.length + ' notes' + polyHint + ')');
      postMessage({
        type: 'ready',
        noteCount: notes.length,
        maxSimultaneous: peak,
        source,
        timings: notes,
      });
      updateToolbar();
    }).catch((err) => {
      setStatus('Failed to load score');
      postMessage({ type: 'error', message: String(err && err.message ? err.message : err) });
      updateToolbar();
    });

    window.addEventListener('resize', relayoutScore);
    window.addEventListener('orientationchange', () => {
      setTimeout(relayoutScore, 250);
    });

    window.tunescribeSetPlaybackMode = setPlaybackMode;
  </script>
</body>
</html>`;
}
