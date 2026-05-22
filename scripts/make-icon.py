#!/usr/bin/env python3
"""Generate the Naplan Throughline app icon — an "NT" monogram in the design
palette (graphite circle, coral ring, linen lettering). Outputs a 1024x1024 PNG
that `tauri icon` expands into all platform sizes.

Usage: python3 scripts/make-icon.py [out.png]
Requires Pillow. The serif font path is macOS-specific (Georgia Bold).
"""
import sys
from PIL import Image, ImageDraw, ImageFont

GRAPHITE = (51, 53, 51, 255)   # #333533
CORAL = (255, 114, 71, 255)    # #ff7247
LINEN = (232, 237, 223, 255)   # #e8eddf
FONT_PATH = "/System/Library/Fonts/Supplemental/Georgia Bold.ttf"

SIZE = 1024
SS = 2  # supersample for smooth edges
S = SIZE * SS


def main(out: str) -> None:
    img = Image.new("RGBA", (S, S), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)

    margin = int(S * 0.06)
    ring_w = int(S * 0.045)
    # Coral ring (outer), then graphite fill inset by the ring width.
    d.ellipse([margin, margin, S - margin, S - margin], fill=CORAL)
    d.ellipse(
        [margin + ring_w, margin + ring_w, S - margin - ring_w, S - margin - ring_w],
        fill=GRAPHITE,
    )

    # "NT" centred.
    font = ImageFont.truetype(FONT_PATH, int(S * 0.40))
    text = "NT"
    bbox = d.textbbox((0, 0), text, font=font)
    tw, th = bbox[2] - bbox[0], bbox[3] - bbox[1]
    x = (S - tw) / 2 - bbox[0]
    y = (S - th) / 2 - bbox[1]
    d.text((x, y), text, font=font, fill=LINEN)

    img = img.resize((SIZE, SIZE), Image.LANCZOS)
    img.save(out)
    print(f"wrote {out} ({SIZE}x{SIZE})")


if __name__ == "__main__":
    main(sys.argv[1] if len(sys.argv) > 1 else "icon-source.png")
