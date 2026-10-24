# Reference images

Renders of the version of October 2026 (software GL, 960×540, test presets), for comparing after
changes. Regenerate with `tools/render.sh` (see `tools/README.md`).

| file | what |
|---|---|
| `start.jpg` | the start: toward the low sun, billowy sea, strong cells off to the right, lit from the side |
| `high.jpg` | from 5.2 km up (`preset=high2`): the cauliflower sea below, towers around |
| `away.jpg` | away from the sun (`preset=away`): front-lit sea, towers on the horizon |
| `giant.jpg` | the tallest tower within 70 km (`preset=giant`) |
| `tower.jpg` | a big sunlit tower from ~10 km (`preset=tower`) |
| `storm-against-sun.jpg` | a storm that spread at its ceiling, from 7 km up against the sun (`preset=anvil`) |
| `sea-round5-vs-round6.jpg` | the sea in round 5 (left: smooth "sand dunes") and round 6 (right: billows at every size), away and side views |
| `world-map-seed7.png` | 400 km of the default world from above (`tools/world/map.js`): grey = restless air, discs = towers coloured by top height (blue < 4 km < cyan < 6 < yellow < 9 < orange < 11.5 km < red), magenta cross = start, sun toward the top |
| `tower-catalog.png` | side views of the biggest towers around the start, large shapes only (`tools/world/catalog.js`): red tick = 1 km, dashed line = the ceiling |
