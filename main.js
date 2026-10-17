const { Plugin, PluginSettingTab, Setting, Notice, requestUrl } = require("obsidian");

const LIST_URL = "https://raw.githubusercontent.com/obsidianmd/obsidian-releases/HEAD/community-css-themes.json";

/** dayKey(new Date(2026, 9, 17)) === "20261017" */
const dayKey = (d = new Date()) =>
  `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, "0")}${String(d.getDate()).padStart(2, "0")}`;

/** Same day → same index; seeds differ day to day (FNV-1a). */
const pick = (key, n) => {
  let h = 2166136261;
  for (const c of key) h = Math.imul(h ^ c.charCodeAt(0), 16777619);
  return (h >>> 0) % n;
};

module.exports = class RandomTheme extends Plugin {
  async onload() {
    this.data = Object.assign({ downloaded: [], favorites: [], showRibbon: false }, await this.loadData());
    this.ribbon = this.addRibbonIcon("dice", "Pick another theme for today", () => this.applyToday(true));
    this.ribbon.toggle(this.data.showRibbon);
    this.app.workspace.onLayoutReady(() => this.applyToday());
    this.registerInterval(window.setInterval(() => this.applyToday(), 10 * 60 * 1000));
    this.addCommand({ id: "reroll", name: "Pick another theme for today", callback: () => this.applyToday(true) });
    this.addCommand({ id: "favorite", name: "Toggle favorite for current theme", callback: () => this.toggleFavorite() });
    this.addSettingTab(new RandomThemeSettings(this));
  }

  save() {
    return this.saveData(this.data);
  }

  themeDir(name) {
    return `${this.app.vault.configDir}/themes/${name}`;
  }

  async applyToday(reroll = false) {
    const today = dayKey();
    if (!reroll && this.data.day === today) return;
    try {
      const themes = (await requestUrl(LIST_URL)).json.sort((a, b) => a.name.localeCompare(b.name));
      const theme = themes[pick(reroll ? today + Date.now() : today, themes.length)];
      await this.ensureInstalled(theme);
      this.app.customCss.setTheme(theme.name);
      Object.assign(this.data, { day: today, theme: theme.name });
      await this.save();
      new Notice(`Theme of the day: ${theme.name} by ${theme.author}`);
    } catch (e) {
      console.error("random-theme", e);
    }
  }

  async ensureInstalled({ name, repo }) {
    const adapter = this.app.vault.adapter;
    const dir = this.themeDir(name);
    if (await adapter.exists(`${dir}/theme.css`)) return;
    const raw = (f) => requestUrl(`https://raw.githubusercontent.com/${repo}/HEAD/${f}`);
    const css = await raw("theme.css").catch(() => raw("obsidian.css"));
    const manifest = await raw("manifest.json").catch(() => null);
    await adapter.mkdir(dir);
    await adapter.write(`${dir}/theme.css`, css.text);
    if (manifest) await adapter.write(`${dir}/manifest.json`, manifest.text);
    this.data.downloaded.push(name);
    await this.app.customCss.readThemes?.();
  }

  async toggleFavorite(name = this.app.customCss.theme) {
    if (!name) return new Notice("No community theme is active");
    const favs = this.data.favorites;
    const on = !favs.includes(name);
    this.data.favorites = on ? [...favs, name] : favs.filter((f) => f !== name);
    await this.save();
    new Notice(`${on ? "Favorited" : "Unfavorited"}: ${name}`);
  }

  /** Removes plugin-downloaded themes that are neither favorite nor active. Returns removed names. */
  async clearCache() {
    const keep = new Set([...this.data.favorites, this.app.customCss.theme]);
    const removed = this.data.downloaded.filter((n) => !keep.has(n));
    for (const name of removed) {
      const dir = this.themeDir(name);
      if (await this.app.vault.adapter.exists(dir)) await this.app.vault.adapter.rmdir(dir, true);
    }
    this.data.downloaded = this.data.downloaded.filter((n) => keep.has(n));
    await this.save();
    await this.app.customCss.readThemes?.();
    return removed;
  }
};

class RandomThemeSettings extends PluginSettingTab {
  constructor(plugin) {
    super(plugin.app, plugin);
    this.plugin = plugin;
  }

  display() {
    const { containerEl, plugin } = this;
    const { downloaded, favorites } = plugin.data;
    const current = this.app.customCss.theme;
    containerEl.empty();

    new Setting(containerEl)
      .setName("Show ribbon icon")
      .setDesc("Show a dice icon in the ribbon that picks another theme for today.")
      .addToggle((t) =>
        t.setValue(plugin.data.showRibbon).onChange(async (on) => {
          plugin.data.showRibbon = on;
          plugin.ribbon.toggle(on);
          await plugin.save();
        })
      );

    new Setting(containerEl)
      .setName("Clear cache")
      .setDesc("Delete downloaded themes that are not favorites and not active. Themes you installed yourself are never touched.")
      .addButton((b) =>
        b.setButtonText("Clear cache").setWarning().onClick(async () => {
          const removed = await plugin.clearCache();
          new Notice(`Removed ${removed.length} theme(s)`);
          this.display();
        })
      );

    new Setting(containerEl).setName(`Downloaded themes (${downloaded.length})`).setHeading();
    if (!downloaded.length) containerEl.createEl("p", { text: "No themes downloaded yet." });
    for (const name of downloaded) {
      const fav = favorites.includes(name);
      new Setting(containerEl)
        .setName(name)
        .setDesc([name === current && "Active", fav && "Favorite"].filter(Boolean).join(" · "))
        .addExtraButton((b) =>
          b.setIcon(fav ? "star-off" : "star").setTooltip(fav ? "Unfavorite" : "Favorite").onClick(async () => {
            await plugin.toggleFavorite(name);
            this.display();
          })
        );
    }
  }
}
