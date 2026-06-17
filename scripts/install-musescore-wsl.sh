#!/usr/bin/env bash
# Install MuseScore CLI on WSL/Ubuntu for TuneScribe PDF export (MusicXML → PDF).
# Run from repo root: bash scripts/install-musescore-wsl.sh
#
# Tries apt (musescore3 + xvfb) when sudo is available; otherwise installs a
# portable MuseScore 3 AppImage under ~/musescore and a user-local xvfb if needed.

set -euo pipefail

MUSESCORE_VERSION="${MUSESCORE_VERSION:-3.6.2.548021370}"
INSTALL_DIR="${MUSESCORE_INSTALL_DIR:-$HOME/musescore}"
APPIMAGE_URL="https://github.com/musescore/MuseScore/releases/download/v3.6.2/MuseScore-${MUSESCORE_VERSION}-x86_64.AppImage"

install_apt() {
  echo "Installing MuseScore 3 and xvfb via apt..."
  sudo apt-get update
  sudo apt-get install -y musescore3 xvfb libnss3
}

install_portable() {
  echo "Installing portable MuseScore 3 to $INSTALL_DIR..."
  tmpdir="$(mktemp -d)"
  trap 'rm -rf "$tmpdir"' EXIT

  curl -L "$APPIMAGE_URL" -o "$tmpdir/MuseScore.AppImage"
  chmod +x "$tmpdir/MuseScore.AppImage"

  rm -rf "$INSTALL_DIR"
  mkdir -p "$INSTALL_DIR"
  (cd "$INSTALL_DIR" && "$tmpdir/MuseScore.AppImage" --appimage-extract >/dev/null)

  if [[ -x "$INSTALL_DIR/squashfs-root/usr/bin/mscore" ]]; then
    ln -sf "$INSTALL_DIR/squashfs-root/usr/bin/mscore" "$INSTALL_DIR/mscore"
  elif [[ -x "$INSTALL_DIR/squashfs-root/AppRun" ]]; then
    ln -sf "$INSTALL_DIR/squashfs-root/AppRun" "$INSTALL_DIR/mscore"
  else
    echo "Could not find MuseScore binary after AppImage extract."
    exit 1
  fi

  if ! command -v xvfb-run >/dev/null 2>&1; then
    if sudo -n true 2>/dev/null; then
      sudo apt-get update
      sudo apt-get install -y xvfb libnss3
    else
      echo "Warning: xvfb-run not found. Install with: sudo apt-get install -y xvfb"
      echo "PDF export may fail on headless WSL without a virtual display."
    fi
  fi
}

find_mscore() {
  local candidate
  for candidate in \
    "${MUSESCORE_BIN:-}" \
    "$INSTALL_DIR/mscore" \
    "$(command -v musescore3 2>/dev/null || true)" \
    "$(command -v mscore 2>/dev/null || true)" \
    "$(command -v musescore 2>/dev/null || true)" \
    "$(command -v MuseScore4 2>/dev/null || true)" \
    /usr/bin/musescore3 \
    /usr/bin/mscore; do
    if [[ -n "$candidate" && -x "$candidate" ]]; then
      echo "$candidate"
      return 0
    fi
  done
  return 1
}

if [[ "${FORCE_APT:-}" == "1" ]] && command -v apt-get >/dev/null 2>&1; then
  install_apt
elif find_mscore >/dev/null 2>&1 && [[ "${FORCE_APT:-}" != "1" ]]; then
  echo "MuseScore already available (set FORCE_APT=1 to reinstall via apt)."
elif command -v apt-get >/dev/null 2>&1; then
  install_apt
else
  install_portable
fi

MSCORE_BIN="$(find_mscore)"
echo "MuseScore binary: $MSCORE_BIN"

tmpdir="$(mktemp -d)"
trap 'rm -rf "$tmpdir"' EXIT
cat >"$tmpdir/test.musicxml" <<'XML'
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE score-partwise PUBLIC "-//Recordare//DTD MusicXML 3.1 Partwise//EN" "http://www.musicxml.org/dtds/partwise.dtd">
<score-partwise version="3.1">
  <part-list>
    <score-part id="P1"><part-name>Test</part-name></score-part>
  </part-list>
  <part id="P1">
    <measure number="1">
      <attributes><divisions>1</divisions><key><fifths>0</fifths></key><time><beats>4</beats><beat-type>4</beat-type></time></attributes>
      <note><pitch><step>C</step><octave>4</octave></pitch><duration>1</duration><type>quarter</type></note>
      <note><pitch><step>D</step><octave>4</octave></pitch><duration>1</duration><type>quarter</type></note>
      <note><pitch><step>E</step><octave>4</octave></pitch><duration>1</duration><type>quarter</type></note>
      <note><pitch><step>F</step><octave>4</octave></pitch><duration>1</duration><type>quarter</type></note>
    </measure>
  </part>
</score-partwise>
XML

pdf_out="$tmpdir/output.pdf"
echo "Testing PDF export..."
if command -v xvfb-run >/dev/null 2>&1; then
  xvfb-run -a "$MSCORE_BIN" -o "$pdf_out" "$tmpdir/test.musicxml"
elif [[ -n "${DISPLAY:-}" ]]; then
  "$MSCORE_BIN" -o "$pdf_out" "$tmpdir/test.musicxml"
else
  echo "No DISPLAY and no xvfb-run — install xvfb: sudo apt-get install -y xvfb"
  exit 1
fi

if [[ -f "$pdf_out" && -s "$pdf_out" ]]; then
  echo "PDF export OK ($(wc -c <"$pdf_out") bytes)"
else
  echo "MuseScore ran but did not create a PDF."
  echo "Try: sudo apt-get install -y xvfb"
  exit 1
fi

cat <<EOF

MuseScore is ready for TuneScribe PDF export.

Add to your shell profile or backend start script:

  export MUSESCORE_BIN="$MSCORE_BIN"
  export PATH="\$(dirname "$MSCORE_BIN"):\$PATH"

Restart the backend, then transcribe or transpose again. New jobs will include output.pdf.
Existing projects: tap Download PDF on the project screen.

EOF
