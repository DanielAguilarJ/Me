#!/usr/bin/env python3
"""Genera una instancia estática de Unbounded 700 sin contornos superpuestos.

-webkit-text-stroke traza cada contorno del glifo por separado. Unbounded (la
fuente variable y también las estáticas de Google Fonts) dibuja muchas letras
con contornos que se cruzan, así que los textos con contorno muestran líneas
internas: la diagonal de la N, el travesaño de la A y la E, el 4, el 1... Esta
instancia une esos contornos con skia-pathops y se usa solo en los textos con
contorno (--font-outline en global.css). Las métricas y el kerning no cambian.

Requisitos: pip install fonttools brotli skia-pathops
Uso:        python3 scripts/fonts/build-outline-font.py
"""

from pathlib import Path

from fontTools.ttLib import TTFont
from fontTools.varLib.instancer import OverlapMode, instantiateVariableFont

ROOT = Path(__file__).resolve().parents[2]
SRC = ROOT / 'node_modules/@fontsource-variable/unbounded/files/unbounded-latin-wght-normal.woff2'
OUT = ROOT / 'src/assets/fonts/unbounded-outline-700.woff2'
WEIGHT = 700
FAMILY = 'Unbounded Outline'
STYLE = 'Bold'


def main() -> None:
    font = instantiateVariableFont(TTFont(SRC), {'wght': WEIGHT}, overlap=OverlapMode.REMOVE)

    # Versión modificada (OFL 1.1, sin Reserved Font Name): nombre propio para no
    # confundirla con la original. Se conservan copyright (0) y licencia (13, 14).
    name = font['name']
    name.removeNames(nameID=16)
    name.removeNames(nameID=17)
    names = {
        1: FAMILY,
        2: STYLE,
        3: f'{FAMILY.replace(" ", "")}-{STYLE};wght{WEIGHT};overlaps-removed',
        4: f'{FAMILY} {STYLE}',
        6: f'{FAMILY.replace(" ", "")}-{STYLE}',
    }
    for name_id, value in names.items():
        name.removeNames(nameID=name_id)
        name.setName(value, name_id, 3, 1, 0x409)
    font['OS/2'].usWeightClass = WEIGHT

    OUT.parent.mkdir(parents=True, exist_ok=True)
    font.flavor = 'woff2'
    font.save(OUT)
    print(f'{OUT.relative_to(ROOT)}  {OUT.stat().st_size / 1024:.1f} KB')


if __name__ == '__main__':
    main()
