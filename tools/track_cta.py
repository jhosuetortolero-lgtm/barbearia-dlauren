"""Rastreia o botão "AGENDE SEU CORTE" gravado nos últimos frames do vídeo da logo.

Gera as linhas da constante CTA_TRACK de assets/js/site.js:
    [frame (base 0), centroX, centroY, largura, altura]  em coordenadas do frame 1280×720.

Uso (na raiz do projeto, depois de extrair os frames):
    python tools/track_cta.py
    python tools/track_cta.py --frames public/frames-logo --start 188 --step 4

Como funciona: em cada frame localiza o texto (letras claras e pouco saturadas alinhadas
numa mesma linha) e converte a caixa do texto na caixa da pílula usando a proporção medida
no último frame, onde o contorno dourado é detectado diretamente.
Os frames antes do texto ficar legível (entrada do botão) ficam de fora; o site mantém a
primeira posição detectada antes disso. Requer Pillow e NumPy.
"""
import argparse
import sys
from collections import deque
from pathlib import Path

import numpy as np
from PIL import Image

X0, Y0, X1, Y1 = 330, 520, 960, 720  # região onde o botão aparece


def load(folder, n):
    return np.asarray(Image.open(Path(folder) / f"frame_{n:04d}.webp").convert("RGB")).astype(np.int16)


def components(mask):
    h, w = mask.shape
    seen = np.zeros((h, w), bool)
    boxes = []
    for y0, x0 in zip(*np.nonzero(mask)):
        if seen[y0, x0]:
            continue
        seen[y0, x0] = True
        queue = deque([(y0, x0)])
        ys, xs = [], []
        while queue:
            y, x = queue.popleft()
            ys.append(y)
            xs.append(x)
            for dy in (-1, 0, 1):
                for dx in (-1, 0, 1):
                    a, b = y + dy, x + dx
                    if 0 <= a < h and 0 <= b < w and mask[a, b] and not seen[a, b]:
                        seen[a, b] = True
                        queue.append((a, b))
        boxes.append((min(xs), min(ys), max(xs), max(ys), len(xs)))
    return boxes


def text_box(frame):
    region = frame[Y0:Y1, X0:X1]
    lo, hi = region.min(2), region.max(2)
    threshold = max(70, np.percentile(lo, 99.0) * 0.6)
    mask = (lo > threshold) & (hi - lo < 90)  # claro e pouco saturado (creme)
    boxes = [c for c in components(mask) if c[4] >= 15]
    best = None
    for c in boxes:
        height = c[3] - c[1]
        if not 8 <= height <= 70:
            continue
        mid = (c[1] + c[3]) / 2
        row = [d for d in boxes
               if abs((d[1] + d[3]) / 2 - mid) < height * 0.35 and 0.6 < (d[3] - d[1]) / max(height, 1) < 1.5]
        if best is None or len(row) > len(best):
            best = row
    if not best or len(best) < 8:
        return None
    return (min(d[0] for d in best) + X0, min(d[1] for d in best) + Y0,
            max(d[2] for d in best) + X0, max(d[3] for d in best) + Y0)


def main():
    if hasattr(sys.stdout, "reconfigure"):
        sys.stdout.reconfigure(encoding="utf-8")  # acentos corretos no terminal do Windows
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--frames", default="public/frames-logo")
    ap.add_argument("--start", type=int, default=188, help="primeiro frame (base 1) a analisar")
    ap.add_argument("--step", type=int, default=4, help="intervalo entre keyframes impressos")
    args = ap.parse_args()

    last = len(list(Path(args.frames).glob("frame_*.webp")))
    final = load(args.frames, last)

    # Pílula no último frame: contorno dourado
    region = final[540:690, 380:900]
    gold = region.max(2) > 120
    rows = gold.sum(1)
    top = int(np.argmax(rows[:40]))
    bottom = int(40 + np.argmax(rows[40:]))
    cols = np.nonzero(gold[(top + bottom) // 2])[0]
    pill = (380 + cols.min(), 540 + top, 380 + cols.max(), 540 + bottom)
    text = text_box(final)
    tw = text[2] - text[0]
    pw, ph = pill[2] - pill[0], pill[3] - pill[1]
    off_x = (pill[0] + pill[2]) / 2 - (text[0] + text[2]) / 2
    off_y = (pill[1] + pill[3]) / 2 - (text[1] + text[3]) / 2

    keys = []
    for n in range(args.start, last + 1):
        box = text_box(load(args.frames, n))
        if box is None:
            continue
        s = (box[2] - box[0]) / tw
        keys.append((n - 1, (box[0] + box[2]) / 2 + off_x * s, (box[1] + box[3]) / 2 + off_y * s, pw * s, ph * s))

    if not keys:
        raise SystemExit("botão não encontrado nos frames analisados")
    picked = keys[::args.step]
    if picked[-1] != keys[-1]:
        picked.append(keys[-1])
    print(f"// {len(keys)} frames com o botão legível; primeiro: {keys[0][0]}, último: {keys[-1][0]}")
    print("const CTA_TRACK = [")
    for k in picked:
        print(f"  [{k[0]}, {k[1]:.1f}, {k[2]:.1f}, {k[3]:.1f}, {k[4]:.1f}],")
    print("];")


if __name__ == "__main__":
    main()
