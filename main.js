const { Plugin, Notice, requestUrl } = require("obsidian");

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
    this.app.workspace.onLayoutReady(() => this.applyToday());
    this.registerInterval(window.setInterval(() => this.applyToday(), 10 * 60 * 1000));
    this.addRibbonIcon("dice", "Random theme (debug)", () => this.applyToday(true));
    this.addCommand({ id: "reroll", name: "Pick another theme for today", callback: () => this.applyToday(true) });
  }

  async applyToday(reroll = false) {
    const today = dayKey();
    const data = (await this.loadData()) || {};
    if (!reroll && data.day === today) return;
    try {
      const themes = (await requestUrl(LIST_URL)).json.sort((a, b) => a.name.localeCompare(b.name));
      const theme = themes[pick(reroll ? today + Date.now() : today, themes.length)];
      await this.ensureInstalled(theme);
      this.app.customCss.setTheme(theme.name);
      await this.saveData({ day: today, theme: theme.name });
      new Notice(`Theme of the day: ${theme.name} by ${theme.author}`);
    } catch (e) {
      console.error("random-theme", e);
    }
  }

  async ensureInstalled({ name, repo }) {
    const adapter = this.app.vault.adapter;
    const dir = `${this.app.vault.configDir}/themes/${name}`;
    if (await adapter.exists(`${dir}/theme.css`)) return;
    const raw = (f) => requestUrl(`https://raw.githubusercontent.com/${repo}/HEAD/${f}`);
    const css = await raw("theme.css").catch(() => raw("obsidian.css"));
    const manifest = await raw("manifest.json").catch(() => null);
    await adapter.mkdir(dir);
    await adapter.write(`${dir}/theme.css`, css.text);
    if (manifest) await adapter.write(`${dir}/manifest.json`, manifest.text);
    await this.app.customCss.readThemes?.();
  }
};
