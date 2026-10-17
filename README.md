# Random Theme

Applies a different community theme every day, whether it is installed or not.

## How it works

- The plugin picks one theme from the official community theme list. The pick is seeded by the date, so it is stable for the whole rotation period.
- If the theme is not installed, the plugin downloads `theme.css` and `manifest.json` into `.obsidian/themes/<name>/`, then applies it.

## Theme states

Every theme is **Love**, **Okay** (default), or **Skip**.

- **Love**: kept by Clear cache; the pool for **Loved only**.
- **Skip**: never picked again. Marking the active theme Skip does not change it; it only leaves future picks.

## Commands

- **Pick another theme**: rerolls now. A notice shows the theme name.
- **Mark current theme: Love / Okay / Skip**

## Settings

- **Rotation**: Off, Every startup, Daily, or Weekly.
- **Loved only**: pick only from loved themes.
- **Match light/dark mode**: pick only themes that support the current mode.
- **No repeats for (days)**: skip recently used themes.
- **Show ribbon icon**: a dice icon that rerolls.
- **Show status bar label**: the current theme name with ♥ (Love) or ⊘ (Skip). Click it to cycle Okay → Love → Skip.
- **Clear cache**: deletes downloaded themes that are not loved and not active. Themes you installed yourself are never touched.
- A list of downloaded themes with a Love/Okay/Skip dropdown, and a list of skipped themes.

Mode and no-repeat filters are skipped when they would leave nothing to pick.

## Network use

This plugin makes network requests to:

- `raw.githubusercontent.com/obsidianmd/obsidian-releases` to read the community theme list.
- `raw.githubusercontent.com/<theme repo>` to download the chosen theme's CSS and manifest.

No other data is sent or collected.

## Notes

- Downloaded themes stay in `.obsidian/themes` until you clear the cache.

## Install

Copy `main.js` and `manifest.json` into `<vault>/.obsidian/plugins/random-theme/`, then enable **Random Theme** in **Settings → Community plugins**.
