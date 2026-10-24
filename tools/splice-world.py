# Replace the CPU world generator of a page (from the "world constants" marker to "==== WORLD END")
# with the one in another file, e.g. a generator developed separately in Node (tools/world/load.js
# loads such a file with WSRC=...).
#
#   python3 tools/splice-world.py world.js out.html [base.html]   (base defaults to index.html)
import os
import sys

here = os.path.dirname(os.path.abspath(__file__))
w = open(sys.argv[1]).read()
base = open(sys.argv[3] if len(sys.argv) > 3 else os.path.join(here, '..', 'index.html')).read()
A = '// ------------------------------------------------------------------ world constants'
B = '// ==== WORLD END'
a, b = base.index(A), base.index(B) + len(B)
wa, wb = w.index(A), w.index(B) + len(B)
open(sys.argv[2], 'w').write(base[:a] + w[wa:wb] + base[b:])
