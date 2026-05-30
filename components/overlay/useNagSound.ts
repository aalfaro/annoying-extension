// A short two-note "ding" via Web Audio. Best-effort: if the page hasn't been interacted
// with yet the AudioContext may be suspended and the sound is silently skipped.
let ctx: AudioContext | null = null;

export function playChime(): void {
  try {
    const Ctor = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctor) return;
    ctx = ctx ?? new Ctor();
    if (ctx.state === 'suspended') void ctx.resume();
    const now = ctx.currentTime;
    [880, 1320].forEach((freq, i) => {
      const osc = ctx!.createOscillator();
      const gain = ctx!.createGain();
      osc.type = 'sine';
      osc.frequency.value = freq;
      const t0 = now + i * 0.12;
      gain.gain.setValueAtTime(0, t0);
      gain.gain.linearRampToValueAtTime(0.12, t0 + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.18);
      osc.connect(gain);
      gain.connect(ctx!.destination);
      osc.start(t0);
      osc.stop(t0 + 0.2);
    });
  } catch {
    /* ignore audio failures */
  }
}
