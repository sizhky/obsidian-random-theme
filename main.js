const { Plugin, PluginSettingTab, Setting, Notice, requestUrl } = require("obsidian");

const LIST_URL = "https://raw.githubusercontent.com/obsidianmd/obsidian-releases/HEAD/community-css-themes.json";
const DAY_MS = 24 * 60 * 60 * 1000;

const DEFAULTS = {
  downloaded: [],
  loved: [],
  skipped: [],
  history: [],
  rotation: "daily",
  lovedOnly: false,
  matchMode: true,
  noRepeatDays: 7,
  showRibbon: false,
  showStatusBar: true,
};

/** dayKey(new Date(2026, 9, 17)) === "20261017" */
const dayKey = (d = new Date()) =>
  `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, "0")}${String(d.getDate()).padStart(2, "0")}`;

/** periodKey("weekly", new Date(2026, 9, 17)) === "20261012" (that week's Monday) */
const periodKey = (rotation, d = new Date()) =>
  rotation === "weekly" ? dayKey(new Date(d.getFullYear(), d.getMonth(), d.getDate() - ((d.getDay() + 6) % 7))) : dayKey(d);

/** Status bar click order: Okay → Love → Skip → Okay. */
const NEXT = { okay: "love", love: "skip", skip: "okay" };
const MARK = { love: " ♥", okay: "", skip: " ⊘" };

/** Same key → same index (FNV-1a). */
const pick = (key, n) => {
  let h = 2166136261;
  for (const c of key) h = Math.imul(h ^ c.charCodeAt(0), 16777619);
  return (h >>> 0) % n;
};

/** Applies each filter in order; a filter that would empty the pool is skipped. */
const softFilter = (pool, ...filters) =>
  filters.reduce((p, f) => {
    const next = p.filter(f);
    return next.length ? next : p;
  }, pool);

module.exports = class RandomTheme extends Plugin {
  async onload() {
    const saved = (await this.loadData()) || {};
    if (!saved.rotation && "dailyRotation" in saved) saved.rotation = saved.dailyRotation ? "daily" : "off";
    if (!saved.period && saved.day) saved.period = saved.day;
    if (saved.favorites) saved.loved = saved.favorites;
    if (saved.blocked) saved.skipped = saved.blocked;
    if ("favoritesOnly" in saved) saved.lovedOnly = saved.favoritesOnly;
    for (const k of ["dailyRotation", "day", "favorites", "blocked", "favoritesOnly"]) delete saved[k];
    this.data = Object.assign({}, DEFAULTS, saved);

    this.ribbon = this.addRibbonIcon("dice", "Pick another theme", () => this.rotate(true));
    this.ribbon.toggle(this.data.showRibbon);
    this.statusEl = this.addStatusBarItem();
    this.statusEl.addClass("mod-clickable");
    this.statusEl.setAttr("aria-label", "Click to cycle: Okay → Love → Skip");
    this.statusEl.onClickEvent(() => this.cycle());
    this.registerEvent(this.app.workspace.on("css-change", () => this.updateStatus()));
    this.updateStatus();

    this.app.workspace.onLayoutReady(() => this.rotate(this.data.rotation === "startup"));
    this.registerInterval(window.setInterval(() => this.rotate(), 10 * 60 * 1000));
    this.addCommand({ id: "reroll", name: "Pick another theme", callback: () => this.rotate(true) });
    for (const state of ["love", "okay", "skip"]) {
      const label = state[0].toUpperCase() + state.slice(1);
      this.addCommand({ id: state, name: `Mark current theme: ${label}`, callback: () => this.mark(state) });
    }
    this.addSettingTab(new RandomThemeSettings(this));
  }

  save() {
    return this.saveData(this.data);
  }

  themeDir(name) {
    return `${this.app.vault.configDir}/themes/${name}`;
  }

  updateStatus() {
    const name = this.app.customCss.theme;
    this.statusEl.toggle(this.data.showStatusBar && !!name);
    this.statusEl.setText(`🎨 ${name}${MARK[this.stateOf(name)]}`);
  }

  /** stateOf("Bureau") → "love" | "okay" | "skip" */
  stateOf(name) {
    return this.data.loved.includes(name) ? "love" : this.data.skipped.includes(name) ? "skip" : "okay";
  }

  /** Sets a theme's state. Skip only affects future picks; the active theme stays. */
  async mark(state, name = this.app.customCss.theme) {
    if (!name) return new Notice("No community theme is active");
    const without = (list) => list.filter((n) => n !== name);
    this.data.loved = state === "love" ? [...without(this.data.loved), name] : without(this.data.loved);
    this.data.skipped = state === "skip" ? [...without(this.data.skipped), name] : without(this.data.skipped);
    await this.save();
    this.updateStatus();
    new Notice(`${name}: ${state[0].toUpperCase() + state.slice(1)}`);
  }

  cycle(name = this.app.customCss.theme) {
    return this.mark(NEXT[this.stateOf(name)], name);
  }

  /** Candidate themes: loved or all, minus skipped; then mode and recent-repeat filters when possible. */
  candidates(themes) {
    const { loved, skipped, lovedOnly, matchMode, noRepeatDays, history } = this.data;
    const base = lovedOnly ? [...loved].sort().map((name) => themes.find((t) => t.name === name) || { name }) : themes;
    const mode = document.body.hasClass("theme-dark") ? "dark" : "light";
    const since = dayKey(new Date(Date.now() - noRepeatDays * DAY_MS));
    const recent = new Set([this.app.customCss.theme, ...history.filter((h) => h.day > since).map((h) => h.theme)]);
    return softFilter(
      base.filter((t) => !skipped.includes(t.name)),
      (t) => !matchMode || !t.modes || t.modes.includes(mode),
      (t) => !noRepeatDays || !recent.has(t.name)
    );
  }

  async rotate(reroll = false) {
    const key = periodKey(this.data.rotation);
    const scheduled = this.data.rotation === "daily" || this.data.rotation === "weekly";
    if (!reroll && (!scheduled || this.data.period === key)) return;
    try {
      const themes = (await requestUrl(LIST_URL)).json.sort((a, b) => a.name.localeCompare(b.name));
      const pool = this.candidates(themes);
      if (!pool.length) return new Notice("Random Theme: no themes to pick from");
      const theme = pool[pick(reroll ? key + Date.now() : key, pool.length)];
      await this.ensureInstalled(theme);
      this.app.customCss.setTheme(theme.name);
      this.data.period = key;
      this.data.history = [...this.data.history, { day: dayKey(), theme: theme.name }].slice(-100);
      await this.save();
      this.updateStatus();
      new Notice(`Theme: ${theme.name}${theme.author ? ` by ${theme.author}` : ""}`);
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

  /** Removes plugin-downloaded themes that are neither loved nor active. Returns removed names. */
  async clearCache() {
    const keep = new Set([...this.data.loved, this.app.customCss.theme]);
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
    const { downloaded, skipped } = plugin.data;
    const current = this.app.customCss.theme;
    containerEl.empty();

    const set = async (key, value) => {
      plugin.data[key] = value;
      await plugin.save();
    };
    const toggle = (name, desc, key, after = () => {}) =>
      new Setting(containerEl)
        .setName(name)
        .setDesc(desc)
        .addToggle((t) => t.setValue(plugin.data[key]).onChange(async (on) => (await set(key, on), after(on))));

    new Setting(containerEl)
      .setName("Rotation")
      .setDesc("When to pick a new theme. Rerolls work in every mode.")
      .addDropdown((d) =>
        d
          .addOptions({ off: "Off", startup: "Every startup", daily: "Daily", weekly: "Weekly" })
          .setValue(plugin.data.rotation)
          .onChange((v) => set("rotation", v))
      );
    toggle("Loved only", "Pick only from themes marked Love.", "lovedOnly");
    toggle("Match light/dark mode", "Pick only themes that support the current mode, when any exist.", "matchMode");
    new Setting(containerEl)
      .setName("No repeats for (days)")
      .setDesc("Skip themes used in this many recent days, when other themes exist. 0 turns this off.")
      .addSlider((s) =>
        s.setLimits(0, 60, 1).setValue(plugin.data.noRepeatDays).setDynamicTooltip().onChange((v) => set("noRepeatDays", v))
      );
    toggle("Show ribbon icon", "Show a dice icon in the ribbon that picks another theme.", "showRibbon", (on) =>
      plugin.ribbon.toggle(on)
    );
    toggle("Show status bar label", "Show the current theme in the status bar. Click it to cycle Okay → Love → Skip.", "showStatusBar", () =>
      plugin.updateStatus()
    );

    new Setting(containerEl)
      .setName("Clear cache")
      .setDesc("Delete downloaded themes that are not loved and not active. Themes you installed yourself are never touched.")
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
      const state = plugin.stateOf(name);
      new Setting(containerEl)
        .setName(`${name}${MARK[state]}`)
        .setDesc(name === current ? "Active" : "")
        .addDropdown((d) =>
          d
            .addOptions({ love: "Love", okay: "Okay", skip: "Skip" })
            .setValue(state)
            .onChange(async (v) => (await plugin.mark(v, name), this.display()))
        );
    }

    new Setting(containerEl).setName(`Skipped themes (${skipped.length})`).setHeading();
    if (!skipped.length) containerEl.createEl("p", { text: "No skipped themes." });
    for (const name of skipped) {
      new Setting(containerEl).setName(name).addExtraButton((b) =>
        b.setIcon("undo-2").setTooltip("Mark Okay").onClick(async () => (await plugin.mark("okay", name), this.display()))
      );
    }
  }
}
