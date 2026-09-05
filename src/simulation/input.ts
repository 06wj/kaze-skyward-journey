import type { FlightInput } from "./game";
export class Input {
  private keys = new Set<string>();
  private touch = { x: 0, y: 0, boost: false };
  private invert = false;
  private stickId: number | null = null;
  constructor(
    private pause: () => void,
    private restart: () => void,
  ) {
    window.addEventListener("keydown", (e) => {
      const target = e.target instanceof Element ? e.target : null;
      if (target?.matches("input,select,textarea")) return;
      if ((e.code === "Escape" || e.code === "KeyP") && !e.repeat) {
        this.pause();
        return;
      }
      if (target?.closest("button")) return;
      if (
        ["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", "Space"].includes(
          e.code,
        )
      )
        e.preventDefault();
      if (e.repeat) return;
      if (e.code === "KeyR") {
        this.restart();
        return;
      }
      this.keys.add(e.code);
    });
    window.addEventListener("keyup", (e) => this.keys.delete(e.code));
    window.addEventListener("blur", () => this.clear());
  }
  setInvert(value: boolean) {
    this.invert = value;
  }
  clear() {
    this.keys.clear();
    this.touch = { x: 0, y: 0, boost: false };
  }
  get(): FlightInput {
    let turn =
      (this.keys.has("KeyD") || this.keys.has("ArrowRight") ? 1 : 0) -
      (this.keys.has("KeyA") || this.keys.has("ArrowLeft") ? 1 : 0) +
      this.touch.x;
    let climb =
      (this.keys.has("KeyW") || this.keys.has("ArrowUp") ? 1 : 0) -
      (this.keys.has("KeyS") || this.keys.has("ArrowDown") ? 1 : 0) -
      this.touch.y;
    const gp = navigator.getGamepads?.()[0];
    if (gp) {
      turn += Math.abs(gp.axes[0]) > 0.12 ? gp.axes[0] : 0;
      climb -= Math.abs(gp.axes[1]) > 0.12 ? gp.axes[1] : 0;
    }
    return {
      turn: Math.max(-1, Math.min(1, turn)),
      climb: Math.max(-1, Math.min(1, climb)) * (this.invert ? -1 : 1),
      boost:
        this.keys.has("ShiftLeft") ||
        this.keys.has("ShiftRight") ||
        this.touch.boost ||
        !!gp?.buttons[0]?.pressed,
      brake: this.keys.has("Space") || !!gp?.buttons[1]?.pressed,
    };
  }
  bindTouch() {
    const stick = document.getElementById("touch-stick");
    const boost = document.getElementById("touch-boost");
    if (!stick || !boost) return;
    const move = (e: PointerEvent) => {
      if (this.stickId !== e.pointerId) return;
      const r = stick.getBoundingClientRect();
      let x = (e.clientX - r.left - r.width / 2) / (r.width * 0.36),
        y = (e.clientY - r.top - r.height / 2) / (r.height * 0.36);
      const l = Math.max(1, Math.hypot(x, y));
      x /= l;
      y /= l;
      this.touch.x = x;
      this.touch.y = y;
      const knob = stick.querySelector<HTMLElement>(".touch-stick-knob");
      if (knob) knob.style.transform = `translate(${x * 28}px,${y * 28}px)`;
    };
    const end = () => {
      this.stickId = null;
      this.touch.x = 0;
      this.touch.y = 0;
      const k = stick.querySelector<HTMLElement>(".touch-stick-knob");
      if (k) k.style.transform = "";
    };
    stick.addEventListener("pointerdown", (e) => {
      e.preventDefault();
      this.stickId = e.pointerId;
      stick.setPointerCapture(e.pointerId);
      move(e);
    });
    stick.addEventListener("pointermove", move);
    stick.addEventListener("pointerup", end);
    stick.addEventListener("pointercancel", end);
    boost.addEventListener("pointerdown", (e) => {
      e.preventDefault();
      boost.setPointerCapture(e.pointerId);
      this.touch.boost = true;
    });
    const stopBoost = () => (this.touch.boost = false);
    boost.addEventListener("pointerup", stopBoost);
    boost.addEventListener("pointercancel", stopBoost);
  }
}
