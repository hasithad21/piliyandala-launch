/*
 * Shared launch-page engine — Leo District 306 D2 / Project Web Weavers.
 *
 * Reads `window.LAUNCH_CONFIG` (set inline in each club's index.html) and
 * drives the whole reveal: a short synthesised fanfare (Web Audio API — no
 * external audio files, so every club can have a genuinely distinct cue
 * with nothing to fetch or license), a canvas confetti burst in the club's
 * own colours, and the post-launch CTA.
 *
 * Config shape:
 *   {
 *     name: 'Leo Club of X',
 *     themeLine: 'One sentence.',
 *     logo: '/path/to/logo.png' | null,
 *     initial: 'X',                 // fallback shown when logo is null
 *     visitUrl: 'https://...' | null,
 *     accent: '#rrggbb',            // used for the confetti palette
 *     accent2: '#rrggbb',
 *     music: {
 *       waveform: 'sine'|'triangle'|'square'|'sawtooth',
 *       root: 440,                  // Hz
 *       scale: [0, 4, 7, 12, 16],   // semitone offsets, played in sequence
 *       tempoMs: 150,               // ms between notes
 *       chordHold: 900,             // ms the final chord rings
 *     },
 *   }
 */
(function () {
  const cfg = window.LAUNCH_CONFIG;
  if (!cfg) return;

  const stage = document.querySelector('.stage');
  const launchBtn = document.querySelector('.launch-btn');
  const soundToggle = document.querySelector('.sound-toggle');
  const canvas = document.getElementById('burst');
  const ctx2d = canvas ? canvas.getContext('2d') : null;

  let muted = false;
  let launched = false;

  // ---------- Sound toggle ----------
  function renderSoundIcon() {
    if (!soundToggle) return;
    soundToggle.innerHTML = muted
      ? '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M11 5 6 9H2v6h4l5 4V5Z"/><line x1="23" y1="9" x2="17" y2="15"/><line x1="17" y1="9" x2="23" y2="15"/></svg>'
      : '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M11 5 6 9H2v6h4l5 4V5Z"/><path d="M15.5 8.5a5 5 0 0 1 0 7"/><path d="M18.5 5.5a9 9 0 0 1 0 13"/></svg>';
  }
  if (soundToggle) {
    renderSoundIcon();
    soundToggle.addEventListener('click', () => {
      muted = !muted;
      renderSoundIcon();
    });
  }

  // ---------- Web Audio fanfare ----------
  let audioCtx = null;
  function getAudioCtx() {
    if (!audioCtx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      audioCtx = new AC();
    }
    return audioCtx;
  }

  function playFanfare() {
    if (muted || !cfg.music) return;
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduced) return;

    const ac = getAudioCtx();
    if (ac.state === 'suspended') ac.resume();

    const { waveform = 'triangle', root = 440, scale = [0, 4, 7, 12], tempoMs = 140, chordHold = 900 } = cfg.music;
    const now = ac.currentTime;
    const noteLen = tempoMs / 1000;

    const master = ac.createGain();
    master.gain.value = 0.16;
    master.connect(ac.destination);

    // Ascending run through the scale.
    scale.forEach((semi, i) => {
      const freq = root * Math.pow(2, semi / 12);
      const osc = ac.createOscillator();
      const gain = ac.createGain();
      osc.type = waveform;
      osc.frequency.value = freq;
      const start = now + i * noteLen;
      gain.gain.setValueAtTime(0, start);
      gain.gain.linearRampToValueAtTime(1, start + 0.015);
      gain.gain.exponentialRampToValueAtTime(0.0001, start + noteLen * 1.8);
      osc.connect(gain).connect(master);
      osc.start(start);
      osc.stop(start + noteLen * 2);
    });

    // Final sustained chord (root + fifth + octave) to land the phrase.
    const chordStart = now + scale.length * noteLen;
    [0, 7, 12, 16].forEach((semi) => {
      const freq = root * Math.pow(2, semi / 12);
      const osc = ac.createOscillator();
      const gain = ac.createGain();
      osc.type = waveform === 'square' ? 'sawtooth' : waveform;
      osc.frequency.value = freq;
      gain.gain.setValueAtTime(0, chordStart);
      gain.gain.linearRampToValueAtTime(0.5, chordStart + 0.04);
      gain.gain.exponentialRampToValueAtTime(0.0001, chordStart + chordHold / 1000);
      osc.connect(gain).connect(master);
      osc.start(chordStart);
      osc.stop(chordStart + chordHold / 1000 + 0.05);
    });
  }

  // ---------- Confetti burst ----------
  function resizeCanvas() {
    if (!canvas) return;
    canvas.width = window.innerWidth * devicePixelRatio;
    canvas.height = window.innerHeight * devicePixelRatio;
    canvas.style.width = window.innerWidth + 'px';
    canvas.style.height = window.innerHeight + 'px';
  }

  function burst() {
    if (!ctx2d) return;
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    resizeCanvas();

    const colors = [cfg.accent || '#ffffff', cfg.accent2 || '#ffffff', '#ffffff'];
    const cx = canvas.width / 2;
    const cy = canvas.height * 0.42;
    const count = reduced ? 0 : 90;

    const particles = Array.from({ length: count }, () => {
      const angle = Math.random() * Math.PI * 2;
      const speed = (2 + Math.random() * 5) * devicePixelRatio;
      return {
        x: cx,
        y: cy,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed - 2 * devicePixelRatio,
        size: (3 + Math.random() * 4) * devicePixelRatio,
        color: colors[Math.floor(Math.random() * colors.length)],
        life: 1,
        spin: Math.random() * Math.PI,
        spinSpeed: (Math.random() - 0.5) * 0.3,
      };
    });

    let frame = 0;
    const maxFrames = 110;
    function tick() {
      ctx2d.clearRect(0, 0, canvas.width, canvas.height);
      particles.forEach((p) => {
        p.vy += 0.09 * devicePixelRatio;
        p.x += p.vx;
        p.y += p.vy;
        p.spin += p.spinSpeed;
        p.life -= 1 / maxFrames;
        ctx2d.save();
        ctx2d.globalAlpha = Math.max(p.life, 0);
        ctx2d.translate(p.x, p.y);
        ctx2d.rotate(p.spin);
        ctx2d.fillStyle = p.color;
        ctx2d.fillRect(-p.size / 2, -p.size / 2, p.size, p.size * 0.6);
        ctx2d.restore();
      });
      frame++;
      if (frame < maxFrames) requestAnimationFrame(tick);
      else ctx2d.clearRect(0, 0, canvas.width, canvas.height);
    }
    if (count > 0) requestAnimationFrame(tick);
  }

  window.addEventListener('resize', resizeCanvas);
  resizeCanvas();

  // ---------- Orchestration ----------
  function doLaunch() {
    if (launched) return;
    launched = true;
    playFanfare();
    burst();
    stage.classList.add('launched');
  }

  if (launchBtn) launchBtn.addEventListener('click', doLaunch);
})();
