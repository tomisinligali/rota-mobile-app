# Onboarding illustrations

Flat-vector illustrations for the first-run walkthrough (`src/screens/IntroScreen.tsx`).

| PNG | Scene | Slide |
| --- | --- | --- |
| `onboarding-1-schedule.png` | Manager placing a shift block into a weekly board, with a floating calendar + wall clock | "Build schedules fast" |
| `onboarding-2-swap.png` | Two teammates exchanging an interlocking shift tile under a swap emblem | "Swap shifts easily" |
| `onboarding-3-notifications.png` | Relaxed teammate checking their phone under a bell with motion lines | "Keep everyone in sync" |

## Editing

The editable sources are the SVGs in `svg/`. After changing one, rasterize it back
to a 1024x1024 PNG (macOS Quick Look, no extra tooling required):

```sh
cd Frontend/assets/illustrations
mkdir -p _raw
qlmanage -t -s 1024 -o _raw svg/onboarding-1-schedule.svg
mv _raw/onboarding-1-schedule.svg.png onboarding-1-schedule.png
rmdir _raw
```

Notes:
- Each PNG is a full square canvas with a light-purple circular backdrop; the app
  clips the white corners with `borderRadius` so only the circle shows.
- `qlmanage` renders on an opaque white background, so keep the illustration inside
  the circular backdrop and rely on the app-side clipping for the round edge.
- Style guide: faceless stylized silhouettes, warm mustard/ochre accents, the
  design-system `primary` purple (`#6600CC`) for blocks/tiles/clothing, deep
  charcoal neutrals, clean white props, and warm skin tones, over a flat
  brand-purple circular backdrop.

## Color rule

The scene art uses the original warm illustration palette; the circular backdrop is a
vertical gradient from the light purple at the top (the `primaryContainer` composite)
down to a subtle light-purple tint at the bottom, so the circle edge stays visible
against the screen. The blocks/tiles/clothing use the app token `primary` (`#6600CC`),
keeping the art on-brand behind the slides. The remaining warm/neutral scene colors are
deliberately outside the UI token set because they are the illustration art direction.

| Role in illustration | Hex |
| --- | --- |
| Backdrop circle | vertical gradient: `#F1E9FB` top → `#EBE1F9` bottom (subtle light purple, circle edge stays visible) |
| Mustard / ochre accent | `#E0A62A` |
| Deep mustard (seat) | `#C98E2A` |
| Charcoal (trousers, hair, outline) | `#2E2B27` |
| Charcoal soft | `#3F3B33` |
| Blocks / tiles / emblem | `#6600CC` (token `primary`) |
| Skin tones | `#C68642` / `#8C5A3C` / `#B5793B` |
| Light neutral (desk legs) | `#EFE8DD` |
| Outfit top, all subjects | `#BFA0EE` |
| Outfit sleeve, all subjects | `#C9A7F0` |
| Card fill / card border | `#F0EAE0` / `#E4DACB` |
| Phone screen | `#7FD0FF` |
| Props | `#FFFFFF` |

The only pixels outside this set are anti-aliasing blends at shape edges.
