# Crop the same region (fractions of the image) out of several images and stack the crops
# vertically, enlarged 2x when small: for comparing detail between versions.
#   python3 tools/crop.py out.png x0 y0 x1 y1 a.png b.png ...   (fractions 0..1; needs Pillow)
import sys
from PIL import Image

out = sys.argv[1]
fx0, fy0, fx1, fy1 = map(float, sys.argv[2:6])
crops = []
for f in sys.argv[6:]:
    a = Image.open(f).convert('RGB')
    w, h = a.size
    box = (int(w * fx0), int(h * fy0), int(w * fx1), int(h * fy1))
    s = 2 if (box[2] - box[0]) <= 600 else 1
    crops.append(a.crop(box).resize(((box[2] - box[0]) * s, (box[3] - box[1]) * s)))
o = Image.new('RGB', (crops[0].width, sum(c.height + 6 for c in crops) - 6), (255, 0, 255))
y = 0
for c in crops:
    o.paste(c, (0, y))
    y += c.height + 6
o.save(out)
