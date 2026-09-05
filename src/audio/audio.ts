export class GameAudio {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private wind: GainNode | null = null;
  private filter: BiquadFilterNode | null = null;
  private volume = 0.45;
  private nextNote = 0;
  private noteIndex = 0;
  private active = false;
  async start() {
    if (!this.ctx) {
      this.ctx = new AudioContext();
      this.master = this.ctx.createGain();
      this.master.gain.value = this.volume * 0.3;
      this.master.connect(this.ctx.destination);
      const buffer = this.ctx.createBuffer(
          1,
          this.ctx.sampleRate * 3,
          this.ctx.sampleRate,
        ),
        data = buffer.getChannelData(0);
      let last = 0;
      for (let i = 0; i < data.length; i++) {
        last = (last + Math.random() * 0.03 - 0.015) / 1.02;
        data[i] = last * 3.5;
      }
      const source = this.ctx.createBufferSource();
      source.buffer = buffer;
      source.loop = true;
      this.filter = this.ctx.createBiquadFilter();
      this.filter.type = "lowpass";
      this.filter.frequency.value = 550;
      this.wind = this.ctx.createGain();
      this.wind.gain.value = 0.04;
      source.connect(this.filter);
      this.filter.connect(this.wind);
      this.wind.connect(this.master);
      source.start();
    }
    await this.ctx.resume();
    this.active = true;
  }
  setVolume(v: number) {
    this.volume = v;
    if (this.master && this.ctx)
      this.master.gain.setTargetAtTime(v * 0.3, this.ctx.currentTime, 0.12);
  }
  setActive(active: boolean) {
    this.active = active;
    if (this.wind && this.ctx)
      this.wind.gain.setTargetAtTime(
        active ? 0.055 : 0,
        this.ctx.currentTime,
        0.15,
      );
  }
  private note(freq: number, when: number, duration: number, gain = 0.1) {
    if (!this.ctx || !this.master) return;
    const osc = this.ctx.createOscillator(),
      amp = this.ctx.createGain();
    osc.type = "sine";
    osc.frequency.value = freq;
    const harmonic = this.ctx.createOscillator();
    harmonic.type = "sine";
    harmonic.frequency.value = freq * 2;
    const hg = this.ctx.createGain();
    hg.gain.value = 0.12;
    harmonic.connect(hg);
    hg.connect(amp);
    osc.connect(amp);
    amp.connect(this.master);
    amp.gain.setValueAtTime(0, when);
    amp.gain.linearRampToValueAtTime(gain, when + 0.014);
    amp.gain.exponentialRampToValueAtTime(0.0001, when + duration);
    osc.start(when);
    harmonic.start(when);
    osc.stop(when + duration);
    harmonic.stop(when + duration);
  }
  update(speed: number, boost: boolean) {
    if (!this.ctx || !this.active) return;
    const now = this.ctx.currentTime;
    if (this.wind)
      this.wind.gain.setTargetAtTime(
        0.055 + speed * 0.0025 + (boost ? 0.06 : 0),
        now,
        0.3,
      );
    if (this.filter)
      this.filter.frequency.setTargetAtTime(450 + speed * 25, now, 0.3);
    if (now > this.nextNote) {
      const scale = [
        293.66, 369.99, 440, 554.37, 493.88, 440, 369.99, 329.63, 246.94,
        329.63, 440, 493.88, 554.37, 440, 369.99, 329.63,
      ];
      const f = scale[this.noteIndex++ % scale.length];
      this.note(f, now, 0.95, 0.055);
      if (this.noteIndex % 4 === 1) {
        this.note(f / 2, now, 2.8, 0.045);
        this.note(f * 0.75, now, 2.5, 0.025);
      }
      this.nextNote = now + 0.82;
    }
  }
  ring(combo: number) {
    if (!this.ctx) return;
    const now = this.ctx.currentTime;
    [1, 1.25, 1.5].forEach((v, i) =>
      this.note(
        (440 + Math.min(combo, 5) * 30) * v,
        now + i * 0.065,
        0.65,
        0.18,
      ),
    );
  }
  hit() {
    if (!this.ctx) return;
    this.note(90, this.ctx.currentTime, 0.35, 0.25);
    this.note(120, this.ctx.currentTime + 0.05, 0.24, 0.15);
  }
  finish(success: boolean) {
    if (!this.ctx) return;
    const now = this.ctx.currentTime;
    (success
      ? [293.66, 369.99, 440, 587.33]
      : [329.63, 293.66, 246.94]
    ).forEach((f, i) => this.note(f, now + i * 0.2, 1.8, 0.24));
  }
}
