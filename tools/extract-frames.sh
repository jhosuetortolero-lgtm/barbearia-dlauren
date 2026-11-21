#!/usr/bin/env bash
# Extrai os frames WebP usados no scroll-scrubbing do site.
# Rode na raiz do projeto (Git Bash, macOS ou Linux). Requer ffmpeg no PATH.
#
#   bash tools/extract-frames.sh [video-hero] [video-logo]
#
# Atenção: apaga e recria public/frames-barber/ e public/frames-logo/.
set -euo pipefail

HERO_SRC="${1:-source/videos/Barbeiro01.mp4}"
LOGO_SRC="${2:-source/videos/Barbeiro02.mp4}"
WEBP="-c:v libwebp -quality 82 -compression_level 6 -preset picture"

mkdir -p public/frames-barber public/frames-logo
rm -f public/frames-barber/*.webp public/frames-logo/*.webp

# Hero — barbeiro em atendimento (1920px)
ffmpeg -hide_banner -loglevel error -y -i "$HERO_SRC" \
  -vf "fps=24,scale=1920:-2:flags=lanczos" $WEBP public/frames-barber/frame_%04d.webp

# Encerramento — logo D’Lauren (resolução nativa 1280px)
ffmpeg -hide_banner -loglevel error -y -i "$LOGO_SRC" \
  -vf "fps=24,scale=1280:-2:flags=lanczos" $WEBP public/frames-logo/frame_%04d.webp

hero=$(ls public/frames-barber/*.webp | wc -l | tr -d ' ')
logo=$(ls public/frames-logo/*.webp | wc -l | tr -d ' ')
echo "frames-barber: $hero  -> HERO_TOTAL_FRAMES"
echo "frames-logo:   $logo  -> CLOSING_TOTAL_FRAMES"
