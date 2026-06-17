#!/usr/bin/env bash
# Install Audiveris on WSL/Ubuntu for TuneScribe OMR (PDF → MusicXML).
# Run from repo root: bash scripts/install-audiveris-wsl.sh
#
# Uses the official .deb release (no generic tarball). If sudo is unavailable,
# extracts Audiveris to ~/audiveris and installs a portable Temurin JRE 17.

set -euo pipefail

AUDIVERIS_VERSION="${AUDIVERIS_VERSION:-5.6.2}"
INSTALL_DIR="${AUDIVERIS_INSTALL_DIR:-$HOME/audiveris}"
JRE_DIR="${JAVA_HOME:-$HOME/.local/share/temurin-jre-17}"
UBUNTU_VERSION="${UBUNTU_VERSION:-ubuntu22.04}"
DOWNLOAD_URL="https://github.com/Audiveris/audiveris/releases/download/${AUDIVERIS_VERSION}/Audiveris-${AUDIVERIS_VERSION}-${UBUNTU_VERSION}-x86_64.deb"
JRE_URL="https://github.com/adoptium/temurin17-binaries/releases/download/jdk-17.0.18%2B8/OpenJDK17U-jre_x64_linux_hotspot_17.0.18_8.tar.gz"

install_java_apt() {
  echo "Installing Java 17 via apt..."
  sudo apt-get update
  sudo apt-get install -y openjdk-17-jre-headless curl
}

install_jre_portable() {
  if [[ -x "$JRE_DIR/bin/java" ]]; then
    echo "Portable JRE already present at $JRE_DIR"
    return
  fi

  echo "Installing portable Temurin JRE 17 to $JRE_DIR..."
  tmpdir="$(mktemp -d)"
  trap 'rm -rf "$tmpdir"' EXIT
  curl -L "$JRE_URL" -o "$tmpdir/jre.tar.gz"
  rm -rf "$JRE_DIR"
  mkdir -p "$(dirname "$JRE_DIR")"
  tar -xzf "$tmpdir/jre.tar.gz" -C "$(dirname "$JRE_DIR")"
  extracted="$(find "$(dirname "$JRE_DIR")" -maxdepth 1 -type d -name 'jdk-*-jre' | head -1)"
  mv "$extracted" "$JRE_DIR"
}

install_audiveris_deb_extract() {
  echo "Downloading Audiveris ${AUDIVERIS_VERSION} (${UBUNTU_VERSION})..."
  tmpdir="$(mktemp -d)"
  trap 'rm -rf "$tmpdir"' EXIT
  curl -L "$DOWNLOAD_URL" -o "$tmpdir/audiveris.deb"
  rm -rf "$INSTALL_DIR"
  mkdir -p "$INSTALL_DIR"
  dpkg-deb -x "$tmpdir/audiveris.deb" "$tmpdir/extract"
  mv "$tmpdir/extract/opt/audiveris/"* "$INSTALL_DIR/"
}

install_audiveris_deb_sudo() {
  echo "Installing Audiveris ${AUDIVERIS_VERSION} via dpkg..."
  tmpdir="$(mktemp -d)"
  trap 'rm -rf "$tmpdir"' EXIT
  curl -L "$DOWNLOAD_URL" -o "$tmpdir/audiveris.deb"
  sudo apt-get install -y "$tmpdir/audiveris.deb"
  INSTALL_DIR="/opt/audiveris"
}

if command -v java >/dev/null 2>&1; then
  echo "Java already installed: $(java -version 2>&1 | head -1)"
elif sudo -n true 2>/dev/null; then
  install_java_apt
else
  install_jre_portable
fi

if [[ -x "$INSTALL_DIR/bin/Audiveris" ]]; then
  echo "Audiveris already installed at $INSTALL_DIR"
elif sudo -n true 2>/dev/null && command -v apt-get >/dev/null 2>&1; then
  install_audiveris_deb_sudo
else
  install_audiveris_deb_extract
fi

AUDIVERIS_BIN="$INSTALL_DIR/bin/Audiveris"
if [[ -x "$JRE_DIR/bin/java" ]]; then
  export JAVA_HOME="$JRE_DIR"
  export PATH="$JAVA_HOME/bin:$PATH"
fi

echo
echo "Verify:"
"$AUDIVERIS_BIN" -help | head -3 || true

cat <<EOF

Audiveris installed to: $INSTALL_DIR

Add to your backend environment (shell profile or before starting uvicorn):

  export AUDIVERIS_BIN="$AUDIVERIS_BIN"
EOF

if [[ -x "$JRE_DIR/bin/java" ]]; then
  cat <<EOF
  export JAVA_HOME="$JRE_DIR"
  export PATH="\$JAVA_HOME/bin:\$PATH"
EOF
fi

cat <<EOF

Restart the backend, then check GET /transpose/settings → audiveris_available: true

EOF
