# Lordicon icons and animations

All interface icons use the shared Lordicon components in `components/ui/icons.tsx` and `components/ui/lord-icon.tsx`. The old Lucide imports, fallbacks, and CSS imitation animations have been removed.

## Playback

- The official `@lordicon/react` player renders the actual Lottie animation.
- Hovering or focusing the containing button, link, menu item, or navigation row replays the icon. Touch presses also play it.
- An explicit `targetId` can connect an icon to a larger interaction target.
- Active navigation icons play once; busy indicators loop while mounted.
- Player code and animation data load on demand, with requests cached across icons.
- Reduced-motion preferences keep the static Lordicon visible. Background tabs pause animations. Lite UI mode still permits interaction animations.

## Appearance and assets

Static SVGs and animated JSON live in `public/lordicon`, so runtime playback requires no external CDN. The static Lordicon stays visible during loading or a failed request. Both versions inherit the control's text color, including the brighter sidebar treatment.

The asset map uses free Lordicon System Solid and Wired Outline icons, with shared equivalents where appropriate. Source links and license attribution are in `public/lordicon/NOTICE.md`. The sidebar includes the visible Lordicon credit.

Reference: [Lordicon React player](https://lordicon.com/docs/react).
