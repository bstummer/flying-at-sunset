# Make a variant of a page for A/B experiments: apply exact text replacements, each of which must
# match exactly once (so a variant never silently misses its target).
#
#   python3 tools/variant.py index.html /tmp/variant.html edits.py
#
# edits.py defines E = [(old, new), ...]; it may build on another edit file:
#   exec(open('base_edits.py').read())
#   E += [("float crisp = smoothstep(250.0, 800.0, h - C.w);", "float crisp = 1.0;")]
# Render the variant with PAGE=/tmp/variant.html tools/render.sh ... and compare with crop.py.
import sys

base = open(sys.argv[1]).read()
ns = {}
exec(open(sys.argv[3]).read(), ns)
for old, new in ns['E']:
    n = base.count(old)
    if n != 1:
        raise SystemExit(f'{n} matches for: {old[:100]!r}')
    base = base.replace(old, new)
open(sys.argv[2], 'w').write(base)
