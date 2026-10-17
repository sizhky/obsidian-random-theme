# Random Theme

Applies a different community theme every day, whether it is installed or not.

## How it works

- The plugin picks one theme from the official community theme list. The pick is seeded by the date, so it is stable for the whole rotation period.
- If the theme is not installed, the plugin downloads `theme.css` and `manifest.json` into `.obsidian/themes/<name>/`, then applies it.

## Love and Skip

Mark any theme **Love** or **Skip**, or leave it with no preference.

- **Love**: kept when you clear the cache, and used by **Loved themes only**.
- **Skip**: never chosen again. Its download is deleted at the next switch. Skipping the theme in use does not switch away from it.

## Commands

- **Switch to a random theme**
- **Love this theme**
- **Skip this theme in future**
- **Reset this theme (neither loved nor skipped)**

## Settings

- **Random theme**: a **Switch** button that changes the theme now.
- **Rotation**: off, every startup, daily, or weekly.
- **Loved themes only**: switch only between themes you love.
- **Match light/dark mode**: use only themes made for the mode you are in now.
- **Avoid repeats**: don't reuse a theme for this many days.
- **Show ribbon icon**: a dice button that switches to a random theme.
- **Show in status bar**: the theme name, with ♥ for Love and ⊘ for Skip. Click it to love, skip, or reset the theme.
- **Clear cache**: deletes downloaded themes you don't love. Keeps the theme in use and themes you installed yourself.
- **Downloaded themes**: use any of them now, or mark it Love or Skip.
- **Skipped themes**: stop skipping any of them.

If the mode or repeat rules would leave no theme to choose, they are ignored for that switch.

## Network use

This plugin makes network requests to:

- `raw.githubusercontent.com/obsidianmd/obsidian-releases` to read the community theme list.
- `raw.githubusercontent.com/<theme repo>` to download the chosen theme's CSS and manifest.

No other data is sent or collected.

## Notes

- Downloaded themes stay in `.obsidian/themes` until you clear the cache. Skipped themes are deleted at the next switch.

## Install

Copy `main.js`, `manifest.json`, and `styles.css` into `<vault>/.obsidian/plugins/random-theme/`, then enable **Random Theme** in **Settings → Community plugins**.
