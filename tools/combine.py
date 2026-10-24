# Put images side by side, two per row, on a magenta background.
#   python3 tools/combine.py out.png a.png b.png c.png ...   (needs Pillow)
import sys
from PIL import Image

out, files = sys.argv[1], sys.argv[2:]
ims = [Image.open(f).convert('RGB') for f in files]
cols = 2 if len(ims) > 2 else len(ims)
rows = (len(ims) + cols - 1) // cols
w = max(i.width for i in ims)
h = max(i.height for i in ims)
o = Image.new('RGB', (cols * w + (cols - 1) * 6, rows * h + (rows - 1) * 6), (255, 0, 255))
for k, im in enumerate(ims):
    o.paste(im, ((k % cols) * (w + 6), (k // cols) * (h + 6)))
o.save(out)
