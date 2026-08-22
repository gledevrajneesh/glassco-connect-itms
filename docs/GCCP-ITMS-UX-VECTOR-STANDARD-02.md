# GCCP ITMS Vector and Icon Standard

Status: Locked

## Rule

All ITMS modules must use the shared `Icon` component for navigation, actions, status feedback, alerts, empty states and asset-related visual cues. Emoji, improvised Unicode symbols and unrelated thumbnails must not be introduced into product UI.

## Semantic use

- Navigation uses the icon matching the governed module.
- Create actions use `plus`; successful outcomes use `check`.
- Notifications use `bell`; email actions use `mail`; dismiss controls use `close`.
- Mobile navigation uses `menu`.
- Empty registers use the relevant domain icon, or `empty` when no more specific icon exists.
- Asset imagery must represent the applicable IT asset class and must not be decorative or random.

## Accessibility and layout

Icons supplement visible text and do not replace essential labels. Icon-only controls require an accessible name. All vectors inherit the current text colour and use the shared stroke, sizing and alignment conventions so they remain legible on desktop and mobile.

## Extension policy

New icons are added once to `src/components/Icon.tsx` and reused throughout the application. Feature modules must not embed isolated third-party icon packs or local SVG variants.
