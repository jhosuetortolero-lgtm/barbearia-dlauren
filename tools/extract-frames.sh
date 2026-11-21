#!/usr/bin/env bash
# Extrai os frames WebP usados no scroll-scrubbing do site.
# Rode na raiz do projeto (Git Bash, macOS ou Linux). Requer ffmpeg no PATH.
#
#   bash tools/extract-frames.sh [video-hero] [video-logo]
#
# Atenção: apaga e recria public/frames-barber/, public/frames-logo/ e as versões -mobile.
set -euo pipefail

HERO_SRC="${1:-source/videos/Barbeiro01.mp4}"
LOGO_SRC="${2:-source/videos/Barbeiro02.mp4}"
WEBP="-c:v libwebp -quality 82 -compression_level 6 -preset picture"

mkdir -p public/frames-barber public/frames-logo public/frames-barber-mobile public/frames-logo-mobile
rm -f public/frames-barber/*.webp public/frames-logo/*.webp public/frames-barber-mobile/*.webp public/frames-logo-mobile/*.webp

# Hero — barbeiro em atendimento (1920px)
ffmpeg -hide_banner -loglevel error -y -i "$HERO_SRC" \
  -vf "fps=24,scale=1920:-2:flags=lanczos" $WEBP public/frames-barber/frame_%04d.webp

# Encerramento — logo D’Lauren (resolução nativa 1280px)
ffmpeg -hide_banner -loglevel error -y -i "$LOGO_SRC" \
  -vf "fps=24,scale=1280:-2:flags=lanczos" $WEBP public/frames-logo/frame_%04d.webp

# Celular em pé: os mesmos quadros recortados ao centro (site.js escolhe sozinho).
# Hero: faixa x 610–1250 do quadro 1920×1080. Logo: faixa x 260–1020 do quadro 1280×720.
ffmpeg -hide_banner -loglevel error -y -i "$HERO_SRC"   -vf "fps=24,scale=1920:-2:flags=lanczos,crop=640:1080:610:0" $WEBP public/frames-barber-mobile/frame_%04d.webp
ffmpeg -hide_banner -loglevel error -y -i "$LOGO_SRC"   -vf "fps=24,scale=1280:-2:flags=lanczos,crop=760:720:260:0" $WEBP public/frames-logo-mobile/frame_%04d.webp

hero=$(ls public/frames-barber/*.webp | wc -l | tr -d ' ')
logo=$(ls public/frames-logo/*.webp | wc -l | tr -d ' ')
echo "frames-barber: $hero  -> HERO_TOTAL_FRAMES"
echo "frames-logo:   $logo  -> CLOSING_TOTAL_FRAMES"
