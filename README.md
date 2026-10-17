# Random Theme

Applies a different community theme every day, whether it is installed or not.

## How it works

- On startup, the plugin picks one theme from the official community theme list. The pick is seeded by the date, so the theme stays the same all day.
- If the theme is not installed, the plugin downloads `theme.css` and `manifest.json` into `.obsidian/themes/<name>/`, then applies it.
- Every 10 minutes it checks for a new day.
- The dice icon in the ribbon, or the command **Pick another theme for today**, rerolls today's theme. A notice shows the theme name.

## Network use

This plugin makes network requests to:

- `raw.githubusercontent.com/obsidianmd/obsidian-releases` to read the community theme list.
- `raw.githubusercontent.com/<theme repo>` to download the chosen theme's CSS and manifest.

No other data is sent or collected.

## Notes

- Downloaded themes stay in `.obsidian/themes`. Remove unwanted ones from **Settings → Appearance → Themes**.
- Some themes support only dark or only light mode.

## Install

Copy `main.js` and `manifest.json` into `<vault>/.obsidian/plugins/random-theme/`, then enable **Random Theme** in **Settings → Community plugins**.
