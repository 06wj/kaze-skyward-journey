export interface GameSettings {
  volume: number;
  quality: "high" | "balanced";
  invertY: boolean;
  reducedMotion: boolean;
  timeOfDay: "morning" | "sunset";
}

export interface UIActions {
  onStart(mode: "journey" | "free", route: number): void;
  onResume(): void;
  onRestart(): void;
  onMenu(): void;
  onSettings(settings: GameSettings): void;
  onPause?(): void;
}

export interface HUDData {
  score: number;
  speed: number;
  stamina: number;
  elapsed: number;
  checkpoint: number;
  total: number;
  routeName: string;
  combo: number;
  altitude: number;
  integrity: number;
  mode: "journey" | "free";
  targetDistance: number;
  timeRemaining?: number;
}

export interface ResultData {
  success: boolean;
  score: number;
  time: number;
  rings: number;
  total: number;
  medal: string;
  routeName: string;
  best: boolean;
}

type RecordData = Record<
  string,
  { score: number; time: number; medal: string }
>;
type Screen = "menu" | "playing" | "paused" | "result";
type Modal = "routes" | "settings" | "help";

const feather = `<svg viewBox="0 0 32 32" fill="none" aria-hidden="true"><path d="M8 26C9 17 13 8 26 5c-1 12-7 19-16 17M7 27 22 10M12 20l-1-6m6 1 6-1" stroke="currentColor" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
const arrow = `<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M4 12h15m-6-6 6 6-6 6" stroke="currentColor" stroke-width="1.4"/></svg>`;
const sound = `<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="m11 5-5 4H3v6h3l5 4V5ZM15 8a6 6 0 0 1 0 8m3-11a10 10 0 0 1 0 14" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
const muted = `<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="m11 5-5 4H3v6h3l5 4V5Zm5 4 5 6m0-6-5 6" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
const expand = `<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M8 3H3v5m13-5h5v5M3 16v5h5m13-5v5h-5" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/></svg>`;
const close = `<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="m6 6 12 12M18 6 6 18" stroke="currentColor" stroke-width="1.4"/></svg>`;
const ROUTES = [
  {
    name: "晴空启程",
    en: "THE FIRST WIND",
    area: "湾岸 · 南风街区",
    level: "初翔",
    description: "掠过海湾与屋顶，在城市的呼吸里找到第一缕风。",
    icon: "01",
  },
  {
    name: "天际回响",
    en: "ABOVE THE CITY",
    area: "都心 · 天际走廊",
    level: "进阶",
    description: "沿着高楼之间的气流攀升，让每一次转向都轻盈。",
    icon: "02",
  },
  {
    name: "暮色逐风",
    en: "CHASE THE HORIZON",
    area: "远空 · 环城航线",
    level: "挑战",
    description: "从繁华街区奔向远方，用一场自由的飞行回应天空。",
    icon: "03",
  },
];

function formatTime(seconds: number): string {
  const value = Math.max(0, Math.floor(Number.isFinite(seconds) ? seconds : 0));
  return `${Math.floor(value / 60)
    .toString()
    .padStart(2, "0")}:${(value % 60).toString().padStart(2, "0")}`;
}

function escapeHTML(value: unknown): string {
  return String(value).replace(
    /[&<>"']/g,
    (char) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        char
      ]!,
  );
}

function loadSettings(): GameSettings {
  const defaults: GameSettings = {
    volume: 0.55,
    quality: "high",
    invertY: false,
    reducedMotion: window.matchMedia("(prefers-reduced-motion: reduce)")
      .matches,
    timeOfDay: "sunset",
  };
  try {
    const value = JSON.parse(localStorage.getItem("kaze-settings-v1") || "{}");
    return {
      volume:
        typeof value.volume === "number"
          ? Math.min(1, Math.max(0, value.volume))
          : defaults.volume,
      quality: value.quality === "balanced" ? "balanced" : "high",
      invertY: value.invertY === true,
      reducedMotion:
        typeof value.reducedMotion === "boolean"
          ? value.reducedMotion
          : window.matchMedia("(prefers-reduced-motion: reduce)").matches,
      timeOfDay: value.timeOfDay === "morning" ? "morning" : "sunset",
    };
  } catch {
    return defaults;
  }
}

export class GameUI {
  private readonly root: HTMLElement;
  private readonly actions: UIActions;
  private screen: Screen = "menu";
  private modal: Modal | null = null;
  private settings: GameSettings = loadSettings();
  private records: RecordData = {};
  private selectedRoute = 0;
  private notificationTimer: ReturnType<typeof setTimeout> | undefined;
  private previousFocus: HTMLElement | null = null;
  private currentResult: ResultData | null = null;
  private lastVolume = 0.55;
  private readonly nodes: Record<string, HTMLElement> = {};

  constructor(root: HTMLElement, callbacks: UIActions) {
    this.root = root;
    this.actions = callbacks;
    root.className = "kaze-ui";
    root.dataset.screen = "menu";
    root.innerHTML = `
      <div class="menu-vignette" aria-hidden="true"></div>
      <div class="world-mark menu-only" aria-hidden="true"><span class="world-mark-line"></span> A LITTLE BIRD. AN ENDLESS SKY.</div>
      <header class="masthead menu-only">
        <div class="studio-sign"><span class="studio-emblem">${feather}</span><span>KAZE<span class="studio-jp">風の便り</span></span></div>
        <div class="masthead-tools">
          <div class="day-toggle" role="group" aria-label="选择城市时分"><button data-action="time-morning" aria-pressed="false">清晨</button><button data-action="time-sunset" aria-pressed="true">黄昏</button></div>
          <button class="text-tool" data-action="help"><span class="tiny-diamond"></span> 飞行指南</button>
          <span class="tool-divider"></span>
          <button class="icon-tool sound-toggle" data-action="sound" aria-label="静音" title="声音">${sound}</button>
          <button class="icon-tool fullscreen-toggle" data-action="fullscreen" aria-label="全屏显示" title="全屏">${expand}</button>
          <a class="github-link" href="https://github.com/06wj/kaze-skyward-journey" target="_blank" rel="noopener noreferrer" aria-label="在新标签页打开 GitHub 仓库"><svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M12 .75a11.25 11.25 0 0 0-3.558 21.923c.563.104.77-.244.77-.542 0-.267-.01-.975-.015-1.914-3.13.68-3.79-1.509-3.79-1.509-.512-1.3-1.25-1.646-1.25-1.646-1.022-.7.078-.686.078-.686 1.13.08 1.725 1.16 1.725 1.16 1.005 1.722 2.637 1.225 3.28.937.102-.728.393-1.225.715-1.507-2.498-.284-5.124-1.249-5.124-5.561 0-1.229.439-2.234 1.16-3.021-.116-.284-.503-1.429.11-2.979 0 0 .945-.303 3.094 1.154a10.79 10.79 0 0 1 5.625 0c2.149-1.457 3.093-1.154 3.093-1.154.614 1.55.227 2.695.111 2.979.722.787 1.159 1.792 1.159 3.021 0 4.323-2.63 5.274-5.136 5.553.404.349.766 1.034.766 2.084 0 1.505-.014 2.719-.014 3.088 0 .3.203.651.774.54A11.25 11.25 0 0 0 12 .75Z"/></svg><span>GitHub</span><span aria-hidden="true">↗</span></a>
        </div>
      </header>

      <main class="main-menu menu-only">
        <div class="chapter-kicker"><span class="red-seal">空<br>の旅</span><span>向着天空的另一端<span class="kicker-rule"></span></span></div>
        <h1>风见之羽<span class="title-dot">。</span></h1>
        <p class="english-title">KAZE <span>—</span> A SKYWARD JOURNEY</p>
        <p class="menu-tagline">沿着风，飞过这座城市。</p>
        <div class="menu-actions">
          <button class="primary-start" data-action="start"><span><span class="primary-button-label">开始飞行</span><span class="primary-button-en">LET YOUR JOURNEY BEGIN</span></span><span class="start-arrow">${arrow}</span></button>
          <div class="secondary-row"><button class="secondary-button" data-action="free">自由漫游 <span>FREE FLIGHT</span></button><span class="secondary-separator"></span><button class="secondary-button route-button" data-action="routes">选择航线 <span class="route-open">↗</span></button></div>
        </div>
        <button class="selected-route" data-action="routes"><span class="selected-route-number">01</span><span class="selected-route-copy"><span class="selected-route-name">晴空启程</span><span class="selected-route-meta">湾岸 · 南风街区</span></span><span class="selected-route-line"></span><span class="selected-route-chev">⌁</span></button>
      </main>

      <aside class="scene-caption menu-only" aria-hidden="true"><span class="caption-jp">風は、自由だ。</span><span class="caption-line"></span><span class="caption-en">THE CITY IS YOUR SKY.</span></aside>
      <footer class="menu-footer menu-only"><div class="weather-mark"><span class="sun-icon">☀</span><span>夕凪市 <i>/</i> YUNAGI CITY</span><span class="weather-divider"></span><span id="weather-time">17:42 <i>夕风 3.2 m/s</i></span></div><div class="footer-right"><span class="edition" id="edition-label">VOL. 01 — AN EVENING ABOVE THE CITY</span><button class="footer-settings" data-action="settings" aria-label="打开设置"><svg viewBox="0 0 20 20" fill="none" aria-hidden="true"><path d="M3 5h14M3 10h14M3 15h14M7 3v4m6 1v4m-6 1v4" stroke="currentColor" stroke-width="1.2"/></svg><span>设置</span></button></div></footer>

      <section class="flight-hud" aria-label="飞行状态">
        <div class="objective-block"><div class="hud-kicker"><span class="hud-live-dot"></span><span id="hud-mode">SKYWARD JOURNEY</span></div><div class="objective-title"><span id="hud-route">晴空启程</span><span class="hud-route-rule"></span><span id="hud-checkpoint">01 <i>/ 12</i></span></div><div class="objective-sub"><span id="hud-objective">穿越下一道风环</span><span id="hud-distance">120 m</span></div><div class="hud-progress-track"><span id="hud-route-progress"></span></div><div class="hud-stats"><span><small>SCORE</small><strong id="hud-score">000000</strong></span><span class="hud-stat-rule"></span><span><small id="hud-clock-label">FLIGHT TIME</small><strong id="hud-time">00:00</strong></span><span id="hud-combo" class="hud-combo"></span></div></div>
        <button class="pause-button" data-action="pause" aria-label="暂停游戏"><span class="pause-icon"><i></i><i></i></span><span>暂停 <small>ESC</small></span></button>
        <div class="speed-cluster"><div class="altitude"><span>ALTITUDE</span><strong id="hud-altitude">42</strong><small>m</small></div><div class="speed-value"><span id="hud-speed">42</span><small>km/h</small></div><div class="stamina-track"><span id="hud-stamina"></span></div><div class="speed-bottom"><span class="boost-label">疾风 <kbd>SHIFT</kbd></span><span class="integrity" id="hud-integrity" aria-label="剩余体力"><i></i><i></i><i></i><i></i></span></div></div>
        <div class="flight-controls" id="flight-controls"><span><kbd>W</kbd><kbd>S</kbd> 升降</span><span><kbd>A</kbd><kbd>D</kbd> 转向</span><span><kbd>SHIFT</kbd> 加速</span><span><kbd>SPACE</kbd> 减速</span></div>
        <div class="touch-controls"><div id="touch-stick" role="application" aria-label="拖动控制小鸟方向"><span class="touch-stick-knob"></span><span class="touch-stick-label">方向</span></div><button id="touch-boost" aria-label="按住加速"><svg viewBox="0 0 30 30" fill="none" aria-hidden="true"><path d="m17 3-9 13h7l-2 11 10-15h-8l2-9Z" stroke="currentColor" stroke-width="1.4" stroke-linejoin="round"/></svg><span>疾风</span></button></div>
      </section>

      <section class="pause-screen overlay-screen" aria-label="游戏已暂停"><div class="pause-card"><span class="overline">A MOMENT IN THE WIND</span><h2>让风，等一会儿。</h2><p class="pause-subtitle">你的天空，就在这里。</p><button class="ink-button" data-action="resume"><span>继续飞行</span>${arrow}</button><button class="simple-row" data-action="restart"><span>重新出发</span><span>↺</span></button><button class="simple-row" data-action="settings"><span>游戏设置</span><span>＋</span></button><button class="simple-row" data-action="help"><span>飞行指南</span><span>？</span></button><button class="simple-row subdued" data-action="menu"><span>返回起点</span><span>←</span></button><p class="pause-footnote">按 <kbd>ESC</kbd> 继续飞行</p></div></section>

      <section class="result-screen overlay-screen" aria-label="飞行结果"><div class="result-card"><div class="result-medal" id="result-medal">${feather}</div><span class="overline" id="result-kicker">JOURNEY COMPLETE</span><h2 id="result-title">把风，留在羽翼间。</h2><p class="result-route" id="result-route">晴空启程 · 航线完成</p><div class="result-stats"><div><span>飞行得分</span><strong id="result-score">0</strong><small id="result-best">本次旅程</small></div><div><span>飞行用时</span><strong id="result-time">00:00</strong><small>FLIGHT TIME</small></div><div><span>收集风环</span><strong id="result-rings">0/0</strong><small>WIND RINGS</small></div></div><div class="result-actions"><button class="ink-button" data-action="result-primary"><span id="result-primary-label">下一段旅程</span>${arrow}</button><button class="result-secondary" data-action="restart">再飞一次</button><button class="result-secondary" data-action="menu">返回起点</button></div></div></section>

      <div class="modal-backdrop" data-modal-backdrop hidden><section class="modal-panel" role="dialog" aria-modal="true" aria-labelledby="modal-title" tabindex="-1"><button class="modal-close icon-tool" data-action="close-modal" aria-label="关闭">${close}</button><div id="modal-content"></div></section></div>
      <div class="notification" role="status" aria-live="polite"><span class="notification-diamond"></span><span id="notification-text"></span></div>
      <div class="loading-screen"><div class="loading-emblem">${feather}</div><span class="loading-wordmark">风见之羽</span><span class="loading-caption">正在唤醒这座城市</span><div class="loading-track"><span id="loading-progress"></span></div><span class="loading-percent" id="loading-percent">0%</span></div>
    `;
    for (const el of root.querySelectorAll<HTMLElement>("[id]"))
      this.nodes[el.id] = el;
    this.lastVolume = this.settings.volume || 0.55;
    this.applySettings();
    root.addEventListener("click", this.handleClick);
    root.addEventListener("input", this.handleInput);
    root.addEventListener("change", this.handleInput);
    window.addEventListener("keydown", this.handleKeydown, true);
  }

  public setScreen(screen: Screen): void {
    this.screen = screen;
    this.root.dataset.screen = screen;
    this.closeModal();
    if (screen !== "playing") {
      clearTimeout(this.notificationTimer);
      this.root.querySelector(".notification")!.classList.remove("is-visible");
    }
    if (screen === "playing") {
      if (document.activeElement instanceof HTMLElement)
        document.activeElement.blur();
      this.nodes["flight-controls"].classList.remove("is-faded");
      setTimeout(
        () => this.nodes["flight-controls"].classList.add("is-faded"),
        11000,
      );
    }
  }

  public update(data: HUDData): void {
    const n = this.nodes;
    n["hud-mode"].textContent =
      data.mode === "free" ? "FREE AS THE WIND" : "SKYWARD JOURNEY";
    n["hud-route"].textContent =
      data.mode === "free" ? "自由漫游" : data.routeName;
    n["hud-checkpoint"].innerHTML =
      data.mode === "free"
        ? "∞"
        : `${Math.min(data.checkpoint, data.total).toString().padStart(2, "0")} <i>/ ${data.total.toString().padStart(2, "0")}</i>`;
    n["hud-objective"].textContent =
      data.mode === "free" ? "随风飞行，探索这座城市" : "穿越下一道风环";
    n["hud-distance"].textContent =
      data.mode === "free"
        ? ""
        : `${Math.max(0, Math.round(data.targetDistance))} m`;
    n["hud-route-progress"].style.width =
      data.mode === "free"
        ? "100%"
        : `${Math.max(0, Math.min(100, (data.checkpoint / Math.max(1, data.total)) * 100))}%`;
    n["hud-score"].textContent = Math.max(0, Math.round(data.score))
      .toString()
      .padStart(6, "0");
    const remaining =
      data.mode === "journey" && typeof data.timeRemaining === "number";
    n["hud-clock-label"].textContent = remaining ? "TIME LEFT" : "FLIGHT TIME";
    n["hud-time"].textContent = formatTime(
      remaining ? Math.ceil(data.timeRemaining!) : data.elapsed,
    );
    n["hud-time"].classList.toggle(
      "time-low",
      remaining && data.timeRemaining! <= 20,
    );
    n["hud-combo"].textContent = data.combo > 1 ? `×${data.combo} 连击` : "";
    n["hud-speed"].textContent = Math.round(data.speed).toString();
    n["hud-altitude"].textContent = Math.round(data.altitude).toString();
    n["hud-stamina"].style.transform =
      `scaleX(${Math.max(0, Math.min(1, data.stamina / 100))})`;
    n["hud-stamina"].classList.toggle("is-low", data.stamina < 20);
    const life = Math.max(0, Math.min(4, (data.integrity / 100) * 4));
    n["hud-integrity"]
      .querySelectorAll("i")
      .forEach((item, index) =>
        item.classList.toggle("is-empty", index >= Math.ceil(life)),
      );
    n["hud-integrity"].setAttribute(
      "aria-label",
      `剩余体力 ${Math.ceil(life)} 格`,
    );
  }

  public showResult(result: ResultData): void {
    this.currentResult = result;
    this.nodes["result-kicker"].textContent = result.success
      ? "JOURNEY COMPLETE"
      : "THE SKY IS STILL WAITING";
    this.nodes["result-title"].textContent = result.success
      ? "把风，留在羽翼间。"
      : "再一次，向着天空。";
    this.nodes["result-route"].textContent =
      `${result.routeName} · ${result.success ? "航线完成" : "旅程暂歇"}`;
    this.nodes["result-score"].textContent = Math.round(
      result.score,
    ).toLocaleString();
    this.nodes["result-time"].textContent = formatTime(result.time);
    this.nodes["result-rings"].textContent = `${result.rings}/${result.total}`;
    this.nodes["result-best"].textContent = result.best
      ? "✦ 新的最佳纪录"
      : result.success
        ? this.medalLabel(result.medal)
        : "风会记得每一次勇敢";
    this.nodes["result-best"].classList.toggle("new-best", result.best);
    const medal = result.medal.toLowerCase();
    this.nodes["result-medal"].dataset.medal = !result.success
      ? "none"
      : medal.includes("银") || medal === "silver"
        ? "silver"
        : medal.includes("铜") || medal === "bronze"
          ? "bronze"
          : "gold";
    this.nodes["result-primary-label"].textContent =
      result.success && this.selectedRoute < ROUTES.length - 1
        ? "下一段旅程"
        : result.success
          ? "自在漫游"
          : "再次启程";
    this.setScreen("result");
  }

  public notify(message: string): void {
    const target = this.root.querySelector(".notification")!;
    this.nodes["notification-text"].textContent = message;
    target.classList.add("is-visible");
    clearTimeout(this.notificationTimer);
    this.notificationTimer = setTimeout(
      () => target.classList.remove("is-visible"),
      2800,
    );
  }

  public setLoading(progress: number): void {
    const normalized = Math.max(0, Math.min(1, progress / 100));
    this.nodes["loading-progress"].style.transform = `scaleX(${normalized})`;
    this.nodes["loading-percent"].textContent =
      `${Math.round(normalized * 100)}%`;
    this.root
      .querySelector(".loading-screen")!
      .classList.toggle("is-loaded", normalized >= 1);
  }

  public setRecords(records: RecordData): void {
    this.records = records;
    if (this.modal === "routes") this.renderModal("routes");
  }

  private medalLabel(medal: string): string {
    const value = medal.toLowerCase();
    if (value === "gold" || value === "金" || value === "金羽")
      return "金羽 · 完美翱翔";
    if (value === "silver" || value === "银" || value === "银羽")
      return "银羽 · 轻盈如风";
    if (value === "bronze" || value === "铜" || value === "铜羽")
      return "铜羽 · 初见天空";
    return medal || "旅程已完成";
  }

  private handleClick = (event: MouseEvent): void => {
    const target = (event.target as Element).closest<HTMLElement>(
      "[data-action]",
    );
    if (!target) {
      if ((event.target as HTMLElement).hasAttribute("data-modal-backdrop"))
        this.closeModal();
      return;
    }
    switch (target.dataset.action) {
      case "start":
        this.actions.onStart("journey", this.selectedRoute);
        break;
      case "free":
        this.actions.onStart("free", this.selectedRoute);
        break;
      case "resume":
        this.actions.onResume();
        break;
      case "restart":
        this.actions.onRestart();
        break;
      case "menu":
        this.actions.onMenu();
        break;
      case "pause":
        this.actions.onPause?.();
        break;
      case "routes":
        this.openModal("routes");
        break;
      case "settings":
        this.openModal("settings");
        break;
      case "help":
        this.openModal("help");
        break;
      case "close-modal":
        this.closeModal();
        break;
      case "select-route":
        this.selectRoute(Number(target.dataset.route));
        break;
      case "sound":
        this.settings.volume = this.settings.volume > 0 ? 0 : this.lastVolume;
        this.applySettings();
        break;
      case "time-morning":
        this.settings.timeOfDay = "morning";
        this.applySettings();
        break;
      case "time-sunset":
        this.settings.timeOfDay = "sunset";
        this.applySettings();
        break;
      case "fullscreen":
        this.toggleFullscreen();
        break;
      case "result-primary":
        if (!this.currentResult?.success) this.actions.onRestart();
        else if (this.selectedRoute < ROUTES.length - 1) {
          this.selectedRoute++;
          this.refreshSelectedRoute();
          this.actions.onStart("journey", this.selectedRoute);
        } else this.actions.onStart("free", this.selectedRoute);
        break;
    }
  };

  private handleInput = (event: Event): void => {
    const input = event.target as HTMLInputElement | HTMLSelectElement;
    if (!input.dataset.setting) return;
    switch (input.dataset.setting) {
      case "volume":
        this.settings.volume = Number(input.value);
        if (this.settings.volume > 0) this.lastVolume = this.settings.volume;
        break;
      case "quality":
        this.settings.quality =
          input.value === "balanced" ? "balanced" : "high";
        break;
      case "invertY":
        this.settings.invertY = (input as HTMLInputElement).checked;
        break;
      case "reducedMotion":
        this.settings.reducedMotion = (input as HTMLInputElement).checked;
        break;
      case "timeOfDay":
        this.settings.timeOfDay =
          input.value === "morning" ? "morning" : "sunset";
        break;
    }
    const volumeValue = this.root.querySelector("#volume-value");
    if (volumeValue)
      volumeValue.textContent = `${Math.round(this.settings.volume * 100)}%`;
    this.applySettings();
  };

  private handleKeydown = (event: KeyboardEvent): void => {
    if (!this.modal) return;
    event.stopImmediatePropagation();
    if (event.key === "Escape") {
      event.preventDefault();
      this.closeModal();
      return;
    }
    if (event.key === "Tab") {
      const panel = this.root.querySelector<HTMLElement>(".modal-panel")!;
      const focusable = [
        ...panel.querySelectorAll<HTMLElement>(
          'button:not([disabled]), input, select, [tabindex="0"]',
        ),
      ];
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (
        event.shiftKey &&
        (document.activeElement === first || document.activeElement === panel)
      ) {
        event.preventDefault();
        last?.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first?.focus();
      }
    }
  };

  private applySettings(emit = true): void {
    try {
      localStorage.setItem("kaze-settings-v1", JSON.stringify(this.settings));
    } catch {
      /* Storage can be unavailable in private mode. */
    }
    this.root.classList.toggle("reduced-motion", this.settings.reducedMotion);
    const soundButton =
      this.root.querySelector<HTMLButtonElement>(".sound-toggle")!;
    soundButton.innerHTML = this.settings.volume > 0 ? sound : muted;
    soundButton.setAttribute(
      "aria-label",
      this.settings.volume > 0 ? "静音" : "打开声音",
    );
    soundButton.setAttribute(
      "aria-pressed",
      String(this.settings.volume === 0),
    );
    this.root.dataset.time = this.settings.timeOfDay;
    this.root
      .querySelector('[data-action="time-morning"]')!
      .setAttribute(
        "aria-pressed",
        String(this.settings.timeOfDay === "morning"),
      );
    this.root
      .querySelector('[data-action="time-sunset"]')!
      .setAttribute(
        "aria-pressed",
        String(this.settings.timeOfDay === "sunset"),
      );
    this.nodes["weather-time"].innerHTML =
      this.settings.timeOfDay === "morning"
        ? "06:28 <i>晨风 3.2 m/s</i>"
        : "17:42 <i>夕风 3.2 m/s</i>";
    this.nodes["edition-label"].textContent =
      this.settings.timeOfDay === "morning"
        ? "VOL. 01 — A MORNING ABOVE THE CITY"
        : "VOL. 01 — AN EVENING ABOVE THE CITY";
    if (emit) this.actions.onSettings({ ...this.settings });
  }

  private async toggleFullscreen(): Promise<void> {
    try {
      if (document.fullscreenElement) await document.exitFullscreen();
      else if (document.documentElement.requestFullscreen)
        await document.documentElement.requestFullscreen();
      else this.notify("当前浏览器暂不支持全屏");
    } catch {
      this.notify("当前浏览器暂不支持全屏");
    }
  }

  private openModal(modal: Modal): void {
    this.previousFocus =
      document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null;
    this.modal = modal;
    this.renderModal(modal);
    this.root.querySelector<HTMLElement>("[data-modal-backdrop]")!.hidden =
      false;
    this.root.querySelector<HTMLElement>(".modal-panel")!.focus();
  }

  private closeModal(): void {
    if (!this.modal) return;
    this.modal = null;
    this.root.querySelector<HTMLElement>("[data-modal-backdrop]")!.hidden =
      true;
    this.previousFocus?.focus();
  }

  private selectRoute(route: number): void {
    if (!ROUTES[route]) return;
    this.selectedRoute = route;
    this.refreshSelectedRoute();
    this.closeModal();
  }

  private refreshSelectedRoute(): void {
    const route = ROUTES[this.selectedRoute];
    this.root.querySelector(".selected-route-number")!.textContent = route.icon;
    this.root.querySelector(".selected-route-name")!.textContent = route.name;
    this.root.querySelector(".selected-route-meta")!.textContent = route.area;
  }

  private renderModal(modal: Modal): void {
    const content = this.nodes["modal-content"];
    const panel = this.root.querySelector<HTMLElement>(".modal-panel")!;
    panel.dataset.modal = modal;
    if (modal === "routes") {
      content.innerHTML = `<span class="overline">YOUR NEXT CHAPTER</span><h2 id="modal-title">风，想带你去哪里？</h2><p class="modal-intro">三段旅程，一座值得慢慢飞过的城市。</p><div class="route-cards">${ROUTES.map(
        (route, index) => {
          const record =
            this.records[String(index)] || this.records[route.name];
          return `<button class="route-card ${index === this.selectedRoute ? "is-selected" : ""}" data-action="select-route" data-route="${index}" aria-pressed="${index === this.selectedRoute}"><div class="route-art route-art-${index}" aria-hidden="true"><span class="route-art-sun"></span><span class="route-art-cloud cloud-one"></span><span class="route-art-cloud cloud-two"></span><span class="route-art-building building-one"></span><span class="route-art-building building-two"></span><span class="route-art-building building-three"></span><span class="route-art-building building-four"></span><span class="route-art-building building-five"></span><span class="route-art-ring"></span><span class="route-art-number">${route.icon}</span><span class="route-level">${route.level}</span></div><div class="route-card-body"><span class="route-card-en">${route.en}</span><h3>${route.name}</h3><p>${route.description}</p><span class="route-card-record">${record ? `<span class="record-medal">✦</span> ${escapeHTML(this.medalLabel(record.medal))}<small>${record.score.toLocaleString()} PTS · ${formatTime(record.time)}</small>` : '<span class="empty-record">等待你的第一片羽毛</span>'}</span><span class="route-card-footer">${index === this.selectedRoute ? "当前航线" : "选择这段旅程"} ${arrow}</span></div></button>`;
        },
      ).join(
        "",
      )}</div><p class="modal-footnote">穿越风环积累连击，完成航线收获属于你的飞行勋章。</p>`;
    } else if (modal === "settings") {
      content.innerHTML = `<span class="overline">MAKE THE SKY YOUR OWN</span><h2 id="modal-title">偏好的风景</h2><p class="modal-intro">让这段旅程，恰好适合你。</p><div class="settings-list"><div class="setting-row"><label for="setting-time"><span>城市时分</span><small>看晨光或晚霞漫过屋顶</small></label><select id="setting-time" data-setting="timeOfDay"><option value="morning" ${this.settings.timeOfDay === "morning" ? "selected" : ""}>清晨 · 06:28</option><option value="sunset" ${this.settings.timeOfDay === "sunset" ? "selected" : ""}>黄昏 · 17:42</option></select></div><div class="setting-row volume-setting"><label for="setting-volume"><span>声音</span><small>环境声与飞行音效</small></label><span id="volume-value">${Math.round(this.settings.volume * 100)}%</span><input id="setting-volume" type="range" min="0" max="1" step="0.01" value="${this.settings.volume}" data-setting="volume" aria-label="音量"></div><div class="setting-row"><label for="setting-quality"><span>画面品质</span><small>平衡模式适合轻薄设备</small></label><select id="setting-quality" data-setting="quality"><option value="high" ${this.settings.quality === "high" ? "selected" : ""}>高品质</option><option value="balanced" ${this.settings.quality === "balanced" ? "selected" : ""}>流畅优先</option></select></div><div class="setting-row"><label for="setting-invert"><span>反转升降</span><small>交换向上与向下的操作</small></label><label class="toggle"><input id="setting-invert" type="checkbox" data-setting="invertY" ${this.settings.invertY ? "checked" : ""}><span></span></label></div><div class="setting-row"><label for="setting-motion"><span>减少动态效果</span><small>更平静的镜头与界面过渡</small></label><label class="toggle"><input id="setting-motion" type="checkbox" data-setting="reducedMotion" ${this.settings.reducedMotion ? "checked" : ""}><span></span></label></div></div><p class="modal-footnote">设置自动保存于此设备。</p>`;
    } else {
      content.innerHTML = `<span class="overline">A FIELD GUIDE TO FLIGHT</span><h2 id="modal-title">把自己，交给风。</h2><p class="modal-intro">你只需要一点勇气，天空会教你剩下的事。</p><div class="guide-controls"><div><span class="guide-keys"><kbd>W</kbd><kbd>S</kbd></span><span>上升与下降<small>轻点调整高度</small></span></div><div><span class="guide-keys"><kbd>A</kbd><kbd>D</kbd></span><span>向左与向右<small>转弯时自然倾斜</small></span></div><div><span class="guide-keys"><kbd class="wide-key">SHIFT</kbd></span><span>疾风加速<small>松开后逐渐恢复能量</small></span></div><div><span class="guide-keys"><kbd class="wide-key">SPACE</kbd></span><span>减速转弯<small>狭窄街区保持轻盈</small></span></div><div><span class="guide-keys"><kbd class="wide-key">ESC</kbd></span><span>暂停旅程<small>随时休息一下</small></span></div></div><div class="guide-notes"><p><span>01</span> 沿着发光的风环飞行，连续穿环获得更高得分。</p><p><span>02</span> 留意高楼，保持距离；碰撞会消耗飞行体力。</p><p><span>03</span> 自由漫游没有终点，去发现屋顶与海湾的风景。</p></div><p class="modal-footnote">触屏设备：拖动左下方摇杆控制方向，长按右下方按钮加速。</p>`;
    }
  }
}
