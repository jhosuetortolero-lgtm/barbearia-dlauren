"""Extrai a logo D’Lauren (PNG transparente) do vídeo do encerramento.

Uso (na raiz do projeto):
    python tools/extract_logo.py
    python tools/extract_logo.py --video source/videos/Barbeiro02.mp4 --out public/logo-dlauren.png --width 360 --full source/logo-dlauren-680.png

Como funciona:
  1. Lê os frames 172–192 do vídeo (antes do botão gravado aparecer).
  2. Escolhe o quadro com menos partículas soltas sobre a logo.
  3. Mantém só os traços da logo: componentes conectados grandes e os pequenos dentro do anel.
  4. Recupera a transparência "descompondo" a imagem do fundo preto (cor = pixel / alfa).

Requer: ffmpeg no PATH, Pillow e NumPy.
"""
import argparse
import sys
import subprocess
import tempfile
from collections import deque
from pathlib import Path

import numpy as np
from PIL import Image, ImageFilter

FIRST, LAST = 172, 192          # frames (base 1) antes do CTA gravado
BOX = (300, 0, 980, 720)        # área de busca no frame 1280×720


def components(mask):
    h, w = mask.shape
    labels = np.zeros((h, w), np.int32)
    sizes = [0]
    current = 0
    for y0, x0 in zip(*np.nonzero(mask)):
        if labels[y0, x0]:
            continue
        current += 1
        labels[y0, x0] = current
        queue = deque([(y0, x0)])
        count = 0
        while queue:
            y, x = queue.popleft()
            count += 1
            for dy in (-1, 0, 1):
                for dx in (-1, 0, 1):
                    ny, nx = y + dy, x + dx
                    if 0 <= ny < h and 0 <= nx < w and mask[ny, nx] and not labels[ny, nx]:
                        labels[ny, nx] = current
                        queue.append((ny, nx))
        sizes.append(count)
    return labels, np.array(sizes)


def main():
    if hasattr(sys.stdout, "reconfigure"):
        sys.stdout.reconfigure(encoding="utf-8")  # acentos corretos no terminal do Windows
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--video", default="source/videos/Barbeiro02.mp4")
    ap.add_argument("--out", default="public/logo-dlauren.png")
    ap.add_argument("--width", type=int, default=360, help="largura final do PNG do site")
    ap.add_argument("--full", default=None, help="opcional: salva também a versão em resolução cheia")
    args = ap.parse_args()

    with tempfile.TemporaryDirectory() as tmp:
        subprocess.run([
            "ffmpeg", "-hide_banner", "-loglevel", "error", "-y", "-i", args.video,
            "-vf", f"select='between(n\\,{FIRST - 1}\\,{LAST - 1})'", "-fps_mode", "passthrough",
            str(Path(tmp) / "raw_%02d.png"),
        ], check=True)

        best = None
        for i in range(1, LAST - FIRST + 2):
            rgb = np.asarray(Image.open(Path(tmp) / f"raw_{i:02d}.png").convert("RGB")).astype(np.float32)
            rgb = rgb[BOX[1]:BOX[3], BOX[0]:BOX[2]]
            labels, sizes = components(rgb.max(2) > 70)
            specks = int(((sizes > 0) & (sizes < 60)).sum())
            if best is None or specks < best[0]:
                best = (specks, FIRST + i - 1, rgb, labels, sizes)

    _, frame_no, rgb, labels, sizes = best
    print(f"usando o frame {frame_no}")

    # Anel externo: estimado pelo topo e pela largura dos componentes grandes
    big = np.isin(labels, np.nonzero(sizes >= 2000)[0]) & (labels > 0)
    ys, xs = np.nonzero(big)
    y_top = ys.min()
    cx = xs[ys <= y_top + 2].mean()
    d = 120
    half = cx - np.nonzero(big[y_top + d])[0].min()
    radius = (half ** 2 + d ** 2) / (2 * d)
    cy = y_top + radius

    keep_ids = []
    for lab in np.nonzero(sizes >= 60)[0]:
        if lab == 0:
            continue
        if sizes[lab] >= 1500:
            keep_ids.append(lab)
            continue
        py, px = np.nonzero(labels == lab)
        if np.hypot(px.mean() - cx, py.mean() - cy) < radius - 6:
            keep_ids.append(lab)
    keep = np.isin(labels, keep_ids)

    soft = Image.fromarray((keep * 255).astype(np.uint8)).filter(ImageFilter.MaxFilter(5)).filter(ImageFilter.GaussianBlur(1.2))
    soft = np.asarray(soft).astype(np.float32) / 255.0

    alpha = np.clip((rgb.max(2) / 255.0 - 0.04) / 0.96, 0, 1) * soft
    color = np.clip(rgb / np.maximum(rgb.max(2, keepdims=True), 1) * 255.0, 0, 255)
    rgba = np.dstack([color, alpha * 255]).astype(np.uint8)

    ys, xs = np.where(rgba[..., 3] > 10)
    rgba = rgba[max(ys.min() - 6, 0):ys.max() + 7, max(xs.min() - 6, 0):xs.max() + 7]
    full = Image.fromarray(rgba, "RGBA")
    if args.full:
        full.save(args.full, optimize=True)
        print("resolução cheia:", args.full, full.size)

    small = full.resize((args.width, round(full.height * args.width / full.width)), Image.LANCZOS)
    small.save(args.out, optimize=True)
    print("logo do site:", args.out, small.size)


if __name__ == "__main__":
    main()
