#!/usr/bin/env bash
# build-bundle.sh
# Packages bundle/ into bundle/riverraid.jsdos (a zip js-dos v8 can load).
#
# js-dos v8 bundle format:
#   .jsdos/dosbox.conf  — DOSBox config
#   GWBASIC.EXE         — DOS programs at root
#   RIVER.BAS
#
# Before running: drop GWBASIC.EXE into bundle/ — see README.md.

set -e
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR/bundle"

if [ ! -f GWBASIC.EXE ]; then
  echo "ERROR: bundle/GWBASIC.EXE missing. See README.md for where to get it." >&2
  exit 1
fi

# Clean previous build
rm -f riverraid.jsdos
rm -rf .jsdos

# Stage the .jsdos config dir that js-dos v8 expects
mkdir -p .jsdos
# Convert dosbox.conf to CRLF for DOSBox + strip BOMs
awk '{ sub(/\r$/,""); printf "%s\r\n", $0 }' dosbox.conf > .jsdos/dosbox.conf

# Stage RIVER.BAS with DOS line endings (GW-BASIC's source line buffer
# is 255 bytes; LF-only files look like one giant line and overflow it)
mkdir -p .stage
awk '{ sub(/\r$/,""); printf "%s\r\n", $0 }' RIVER.BAS > .stage/RIVER.BAS
cp GWBASIC.EXE .stage/GWBASIC.EXE

# Build the bundle: preserve directory structure (-r), exclude OS junk
zip -r riverraid.jsdos .jsdos -x "*.DS_Store" -x "__MACOSX/*"
( cd .stage && zip -r ../riverraid.jsdos GWBASIC.EXE RIVER.BAS \
  -x "*.DS_Store" -x "__MACOSX/*" )

# Clean staging dirs
rm -rf .jsdos .stage

echo "Built: bundle/riverraid.jsdos"
ls -lh riverraid.jsdos
unzip -l riverraid.jsdos
