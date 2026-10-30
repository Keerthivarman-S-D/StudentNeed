# StudentNeed accessibility and LCP fixes

## Accessibility contrast
- Replaced the low-contrast muted text token `#717870` with `#555d56` throughout the application source.
- Darkened the StudentNeed wordmark accent from `#19bf96` to `#0b7355`.
- Updated the shared muted and teal design tokens and browser theme color.
- Updated the UI regression assertions to require the accessible muted text token.

Measured WCAG contrast ratios against the landing-page warm background (`#f7f6f2`):
- `#555d56`: 6.29:1 (passes WCAG AA for normal text).
- `#0b7355`: 5.40:1 (passes WCAG AA for normal text).

## Largest Contentful Paint
- Converted `hero-handoff.jpg` (186,021 bytes) to `hero-handoff.webp` (66,810 bytes), approximately 64% smaller.
- Added an early, route-aware image preload in `index.html` for the landing and authentication routes.
- Set the hero image to eager loading with high fetch priority and asynchronous decoding.
- Added intrinsic image dimensions (1200 × 896) to reduce layout-shift risk.
- Updated both the landing and authentication layouts to use the optimized WebP asset.

## Validation
- Added `test_accessibility_performance.ts` and wired it into `npm test`.
- The new accessibility/LCP regression test passes all 9 assertions.
- Existing static UI, notification, production-build-separation, and security-rule suites were run successfully in this environment.
- A full `npm ci` / Vite production build could not be completed here because dependency installation timed out; run `npm ci`, `npm test`, and `npm run build` locally before deployment.
