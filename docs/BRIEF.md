# The brief

Everything the author asked for while the piece was built (October 2026), verbatim and in order,
followed by notes on the inspiration photos and the themes that run through the feedback. This is
the reference for what the piece should be; `docs/HISTORY.md` describes what was built for each
request, and `docs/DEVELOPMENT.md` how it works.

## 1 — the core piece (1 Oct 2026)

> Create an interactive art piece that runs in the browser (one single html file): a small folded
> paper bird gliding over a vast sea of clouds at golden hour, steered by the viewer. It is not a
> game with goals or scores. It is a calm, beautiful experience, and the world should look as
> realistic as possible. Every frame should look like a photograph taken from an airplane window
> just before sunset.
>
> The clouds are the heart of the piece. Below the bird lies an endless sea of soft, billowing
> clouds stretching to the horizon, broken up by enormous cloud towers rising high above it, so the
> bird can fly over the cloud sea and weave between the towers. The clouds should feel real: full
> and three-dimensional, with rounded tops, soft wispy edges that fray into the air, and a sense of
> enormous scale. Take the time to get them right.
>
> The light is golden hour. The sun sits low near the horizon. Cloud surfaces facing the sun glow
> warm gold and peach, their thin edges shine brightly where sunlight passes through them, and the
> shadowed sides fall into cool blue and violet. The sky fades from deep blue overhead to warm gold
> near the sun, and haze softens everything in the distance until the farthest clouds melt into
> the sky. Looking toward the sun should feel bright and dazzling.
>
> The paper bird is folded from slightly off-white paper, with crisp creases and a subtle paper
> texture. It is small against the huge landscape, and its wings flex slightly in the air. When the
> sun is behind it, light shines through the paper and makes it glow warmly.
>
> The viewer steers the bird, and the controls should feel intuitive on both phones and computers.
> The flight should feel like gliding: diving builds speed, climbing trades speed for height, and
> turning makes the bird bank gracefully. Steering should be smooth and forgiving, never twitchy.
> The bird cannot crash. It can skim the cloud tops and fly into clouds, where it is briefly
> surrounded by drifting mist, but it is gently kept from sinking deep into the cloud sea.
>
> The camera follows behind the bird with a slight, natural lag, swinging wide on turns and leaning
> into them, so the flight feels fluid and cinematic. Speed should be tangible when diving, with
> nearby clouds rushing past while distant ones barely move.
>
> Keep the screen clean: no score, no menus, just a short hint on how to steer that fades away
> after a few seconds. The whole experience should feel peaceful, vast, and quietly magical. Beauty
> and realism are the priority, but the flight must stay smooth, because stuttering breaks the
> spell. It should have a good amount of FPS.
>
> Go all out for this art piece, it should really impress the user.
> Plan before you start working.
> This is the core version of the piece, later on it will get more additions.

## 2 — towers and floating clouds (1 Oct)

> The cloud towers need work, and I'd like to add clouds that float freely in the air.
>
> Right now the cloud towers look like soft blobs. Many have the same rounded gumdrop shape and a
> similar size, and they are spread evenly across the cloud sea, so the distant ones look like
> bushes planted in a field. Make them look like real towering clouds seen from an airplane at
> sunset.
>
> They should vary. Some are small humps barely rising above the cloud sea, many are medium-sized,
> and a few are enormous giants that dominate the view. They grow out of the cloud sea from broad
> bases that blend into it seamlessly. Their tops are made of lumpy, cauliflower-like bulges stacked
> on top of each other, each bulge catching its own light and shadow. Some lean slightly or are torn
> at the top by wind, and their thinnest edges fray into wisps rather than ending in smooth
> outlines. Their shaded sides should feel soft and luminous, with light glowing faintly through
> them in cool blue and violet tones, never a flat gray wall. Place them naturally, in loose
> clusters and lines with wide open stretches of cloud sea between them.
>
> Also add clouds that float freely in the air, not connected to the cloud sea, at many different
> heights. Most are smaller puffy clouds, with flatter undersides and rounded tops, and higher up
> there are a few thin, stretched layers catching the golden light. Some float at the bird's own
> altitude, so the viewer can fly past them, beside them, and right through them. Each one should
> look like a believable cloud with its own shape and lighting, never like a piece that broke off a
> tower, and the larger ones cast soft shadows onto the cloud sea below.

Sent while that was being built:

> Are the clouds generated randomly? I don't want that you place them manually

## 3 — natural, random clouds; 3 inspiration photos attached (1 Oct)

> The cloud towers need a complete rework, because the scene still doesn't look like a real view
> above the clouds.
>
> The main problem is that the clouds look designed rather than natural. There are too many towers,
> they're similar in size and shape, and they're spread across the cloud sea as if they had been
> placed there. They stand on the cloud sea like narrow pillars or chess pieces on a board. Their
> surfaces are covered in small bumps that are all the similar size, like popcorn. Real clouds are
> random and irregular, and that randomness is what I'm after. No two clouds should look alike,
> and no shape, feature, or spacing should repeat in a way the eye can notice. Flying around, the
> world should keep surprising me.
>
> I've attached real photos taken from airplanes at sunset as inspiration. Use them to guide the
> shapes, sizes, and arrangement of the clouds, but don't copy them. The world should be its own,
> with clouds that feel just as natural. Don't change the lighting or colors for now, only the
> clouds.
>
> Keep the sea of clouds below the bird, but make it more like the one in the photos. It isn't a
> flat, even blanket. Its surface is thick and uneven, with big rolling mounds and deep, shadowed
> valleys between them, and it rises and falls across the landscape. In some places it heaps up
> into large billowing masses, and occasionally those grow into a tower, so there's no clear line
> between the sea and the towers; they're the same cloud, just piled higher.
>
> Towers are rare and huge. Most are broad, irregular heaps built from rising domes of different
> sizes, often wider than they are tall. Distant clouds are softened by haze, which shows how
> enormous they are.
>
> All of this should be random and irregular, as in nature. The descriptions above are a sense of
> what's possible, not a checklist. Don't give every cloud every feature, and don't spread any
> feature evenly across the world. No shape, feature, or spacing should repeat in a way the eye
> can notice, and flying around, the world should keep surprising me. Don't use a "building kit"
> of set clouds that you place, generate everything randomly.
>
> Remove the compact, round puffs floating high in the sky, since they look artificial.

## 4 — truly enormous towers, real 3D growth, endless world (2 Oct)

> The huge clouds that should grow out of the cloud sea are completely missing. Compare the scene
> with the 3 insipiration photos again (read them again). In them, massive towering clouds rise out
> of the cloud sea and dominate the view, their tops reaching as high as the airplane or higher. In
> the current scene, the biggest clouds are small lumps on the horizon, and the ones nearby are
> low, soft mounds. Keep the lighting, colors, and sky as they are, and focus on this.
>
> Add truly enormous towering clouds that grow out of the cloud sea. They should rise far above the
> height where the bird flies, so when the bird is near one, you have to look up to see its top,
> and even far away they should stand tall above the horizon. Wherever you fly, a few big towers
> should usually be in sight, some near and some far, with open stretches of cloud sea between
> them. If anything about how the clouds are made currently limits how tall or large they can be,
> change that. The towers have to be truly huge.
>
> Each tower is a massive heap of rising domes of different sizes, broad at the base where it swells
> up out of the cloud sea, with crisp, sharply sculpted, cauliflower-like edges and deep shadowed
> folds between the domes, like in the photos. They should look dense and solid, not like soft
> pillows. They vary freely in size, width, shape, and lean: some are lone giants, some merge into
> long walls or ranges, and a rare one far away spreads out at the top into a wide, flat anvil.
> Don't space them evenly, don't make them alike, and don't give every tower every feature. Don't
> use a "building kit", generate everything randomly.
>
> Step back and rethink how the clouds are generated. Right now they seem only able to rise upward
> from the cloud sea, like hills in a landscape, which can only ever make mounds and pillars. Real
> clouds grow in every direction. Domes bulge outward and hang over the parts below them, towers
> widen as they rise, tops spread sideways into flat anvils, and undersides sag and fray downward.
> Parts of a cloud overlap and fold over each other, leaving overhangs and gaps the bird could fly
> under. Choose whatever approach makes this possible, even if it means rebuilding the clouds from
> scratch, as long as it still runs smoothly.
>
> The cloud sea is also still too flat. Give it large-scale relief: broad swells and hills, deep
> valleys, and places where it heaps up higher and higher until it becomes a tower. Up close, its
> billows should be crisper and more defined, like in the photos, rather than smooth and blurry.
>
> All of this should be random and irregular, like in nature. Treat these descriptions as a sense
> of what's possible, not a checklist. Don't space the clouds evenly, don't make them alike, and
> don't give every cloud every feature. And I don't want the world repeating every 128km, the world
> should be generated randomly endlessly.

## 5 — grow the clouds from natural causes (2 Oct)

> Rework the cloud generation so the shapes come from a few natural causes instead of special-case
> features. Right now there are separate features for anvils, overhangs, and types of tower groups
> like lone giants, clusters, and walls. Remove these special cases. I want a general generator in
> which all of these and others appear on their own, the way they do in nature.
>
> Model how real clouds grow. Warm air rises from the cloud sea in bubbles, some much stronger than
> others. As they rise, they swell and push outward, crowding and bulging over each other. When a
> bubble runs out of strength, it stops and settles into a dome. High up there is a ceiling that
> rising air can't pass, so the strongest towers that reach it are forced to spread out sideways.
> Wind gets stronger with height, so tops drift, lean, and stretch downwind. Some areas have
> restless air where towers form, often near each other; other areas are calm, with only gentle
> rolling cloud sea. Anvils, overhangs, leaning towers, lone giants, clusters, and long walls should
> all emerge from this without being created on purpose.
>
> Ideally, the cloud sea and the towers are one continuous system.
>
> Keep what works now: the huge scale of the towers, the lighting, and the sky. If something from
> the photos doesn't appear or appears too often, adjust the natural causes rather than adding a
> feature for it. Reminder: I uploaded 3 inspiration images, but don't copy them exactly.
> And again: Don't take this prompt literally, just build what is best for the result!

## 6 — billowy sea, enormous towers, a lively start; 2 more photos attached (2 Oct)

A first version of this message was sent and then interrupted; it contained details the final one
leaves out, kept here because they describe what was seen:

> The new cloud generation based on natural causes is a good direction. But compared to the
> previous version, some things got worse. Keep the new approach and fix these.
>
> The cloud sea now looks like sand dunes: smooth, rounded hills. A real cloud sea is made of
> billows at every size: big rolling mounds covered in smaller bulges, covered in even smaller
> ones, with soft edges that never form sharp ridgelines. Bring back the billowy, cauliflower-like
> detail, crisp where sunlight catches it. I att[ached two images for inspiration.]
>
> The towers are two small. From the starting point, only small puffs are visible on the horizon,
> plus one large tower whose wide top sits on a narrow base like a mushroom. The towers should be
> enormous again, rising far above the bird, and at least one huge tower should be in view from
> the start. When a tower's top spreads out, the column beneath it should be massive and broad,
> never a thin stem.
>
> In the spawn point, there is too much open space. I want generally more
>
> Keep the generation based on natural causes. If something looks wrong, adjust the causes rather
> than adding special features.

The message as sent:

> The new cloud generation based on natural causes is a good direction. But compared to the
> previous version, some things got worse. Keep the new approach and fix these.
>
> The cloud sea now looks like sand dunes: smooth, rounded hills. A real cloud sea is made of
> billows at every size: big rolling mounds covered in smaller bulges, covered in even smaller
> ones, with soft edges that never form sharp ridgelines. Bring back a billowy, cauliflower-like
> detail, crisp where sunlight catches it. I attached two images for reference.
>
> The towers are too small. The towers should be enormous again, rising far above the bird.
>
> In the spawn point, there is too much open space. I want generally less of that.
>
> Keep the generation based on natural causes. If something looks wrong, adjust the causes rather
> than adding special features.

## 7 — preserve the knowledge (24 Oct)

> Commit all useful things that one might need. This chat will be deleted and after that the
> project will be restructured (split in multiple files, output is one file).

## 8 — split it up (24 Oct)

> One single file is very annoying for development. Split it up in a structure that makes sense.
> Commit it. Remove anything that is unnecessary and make sure the output game doesn't change
> through the splitting.

## The inspiration photos

Five photos were attached (three with request 3, two with request 6). They are not in this
repository: it is public and their rights are unknown. What they show:

1. **Portrait, from an airliner at sunset.** A dramatic orange-gold sky with layered, stratiform
   cloud bands above. Below, a deep sea of lumpy cumulus heaps in mauve and violet shade; near the
   horizon several towers stand up with bright sunlit tops whose bodies sink into haze (their tops
   seem to float). In the foreground, big billowing cumulus masses lit pinkish from the side.
2. **Portrait, into the sun.** A single huge cumulonimbus with a wide, flat anvil spreading far
   to both sides, almost black against the setting sun just left of it; the anvil's underside is
   dark and level. The cloud sea below lies in its shadow; at the bottom edge, billowy tops catch
   pink light.
3. **Portrait, sun on the horizon.** The sun sits in a narrow band of clear golden sky between a
   dark overcast deck above and a rugged sea of cumulus heaps below. The heaps are dark with
   brilliant golden rims where the low sun catches their edges (backlit); a tall turret on the right
   glows along its sunward side.
4. **Landscape, close up.** Massive cumulus at sunset filling the frame: big rounded lobes, each
   covered in smaller bulges and those in smaller ones, peach and pink in the light, blue-lavender
   in the shaded lower parts. The reference for "billows at every size".
5. **Landscape, daylight.** A field of white cumulus heaps with crisp cauliflower bulges at many
   scales against a blue-grey sky: sharp, bright sunlit edges, soft grey shade between the bulges.

## What the feedback keeps coming back to

Liked and to keep:
- The lighting and colours, and the sky (repeatedly: "keep the lighting, colors, and sky").
- The huge scale of the towers (round 4): tops far above the bird, looking up at them from near.
- Generation from natural causes (round 5) instead of special-case features.
- The calm, clean experience: no UI besides the fading hint; smooth flight.

Disliked (each was a complaint at some point):
- Anything that looks designed or placed: gumdrops of the same size, evenly spread towers ("bushes
  planted in a field", "chess pieces on a board", "narrow pillars"), a building kit of set shapes,
  hand-placed clouds, features spread evenly or every cloud having every feature, visible
  repetition (the world repeating every 128 km).
- Popcorn: small bumps of one size all over a surface.
- A flat or smooth cloud sea: an even blanket, then smooth "sand dunes" with sharp ridgelines.
- Towers too small or too low ("small lumps on the horizon", "low, soft mounds", "soft pillows").
- A wide top on a narrow base ("like a mushroom"); a spreading top needs a massive, broad column.
- Compact round puffs floating high in the sky (look artificial); fragments that look broken off.
- Too much open space around the start.

Wanted, in the author's words: random and irregular as in nature, surprising when flying around;
enormous towers rising far above the bird with at least one in view from the start; broad bases
that swell out of the sea, which itself heaps up into the towers (one continuous system); crisp,
sharply sculpted cauliflower domes with deep shadowed folds, dense and solid; billows at every
size, crisp where sunlight catches them, soft edges, never sharp ridgelines; leaning, sheared,
torn tops; overhangs and gaps to fly under; rare wide flat anvils far away; lone giants, walls,
clusters, open stretches of sea; haze showing the scale. "Don't take this prompt literally, just
build what is best for the result!"
