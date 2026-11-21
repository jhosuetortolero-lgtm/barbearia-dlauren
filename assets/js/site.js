/* ==========================================================================
   Barbearia D’Lauren — Desde 2017
   Scroll-scrubbing duplo em <canvas> · GSAP + ScrollTrigger + Lenis
   ========================================================================== */

// ---- Configuração ---------------------------------------------------------
const HERO_TOTAL_FRAMES = 94;
const CLOSING_TOTAL_FRAMES = 240;
const WHATSAPP_NUMBER = "5581986802197";

// Altura total (em vh) de cada seção pinada, contando a primeira tela.
const HERO_SECTION_VH = 250;
const CLOSING_SECTION_VH = 320;

const heroFrameSrc = (i) => `./public/frames-barber/frame_${String(i + 1).padStart(4, '0')}.webp`;
const closingFrameSrc = (i) => `./public/frames-logo/frame_${String(i + 1).padStart(4, '0')}.webp`;

// Celular em pé: os mesmos frames recortados ao centro (mesma nitidez, ~45% menos memória).
const heroFrameSrcMobile = (i) => `./public/frames-barber-mobile/frame_${String(i + 1).padStart(4, '0')}.webp`;
const closingFrameSrcMobile = (i) => `./public/frames-logo-mobile/frame_${String(i + 1).padStart(4, '0')}.webp`;

(() => {
  'use strict';

  const root = document.documentElement;
  const hasGSAP = typeof window.gsap !== 'undefined' && typeof window.ScrollTrigger !== 'undefined';
  const hasLenis = typeof window.Lenis === 'function';
  // Sem GSAP (CDN bloqueado): modo estático com o mesmo conteúdo.
  const staticMode = !hasGSAP;
  // "Reduzir movimento" do sistema: o filme continua respondendo à rolagem (o usuário controla
  // cada quadro), mas saem a rolagem suave, os deslizamentos e as animações automáticas.
  const calm = !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);

  const BG = '#0A0A0B';
  const BG_CLEAR = 'rgba(10, 10, 11, 0)';
  const useMobileFrames = window.innerWidth < 768 && window.innerHeight > window.innerWidth;
  const HERO_SET = useMobileFrames
    ? { src: heroFrameSrcMobile, size: { w: 640, h: 1080 } }    // recorte x 610–1250 do 1920×1080
    : { src: heroFrameSrc, size: { w: 1920, h: 1080 } };
  const CLOSING_SET = useMobileFrames
    ? { src: closingFrameSrcMobile, size: { w: 760, h: 720, offsetX: 260 } } // recorte x 260–1020
    : { src: closingFrameSrc, size: { w: 1280, h: 720, offsetX: 0 } };

  // Funcionamento (Recife, UTC−3 sem horário de verão). Índice = getDay(): 0 = domingo.
  const HOURS = { 0: [9, 12], 1: [14, 19.5], 2: [9, 19.5], 3: [9, 19.5], 4: [9, 19.5], 5: [9, 19.5], 6: [9, 19.5] };
  const DAY_NAMES = ['domingo', 'segunda-feira', 'terça-feira', 'quarta-feira', 'quinta-feira', 'sexta-feira', 'sábado'];

  // Botão "Agende seu Corte" gravado no vídeo da logo: posição rastreada quadro a quadro
  // [frame (escala de 240), centroX, centroY, largura, altura] em coordenadas 1280×720.
  // O CTA real em HTML cobre esse botão, acompanhando o leve movimento de câmera.
  const CTA_TRACK = [
    [192, 640.0, 680.5, 496.0, 93.4],
    [201, 642.0, 653.5, 487.0, 91.9],
    [205, 639.5, 641.5, 483.1, 91.2],
    [209, 639.5, 632.0, 475.5, 89.8],
    [213, 639.5, 624.5, 470.4, 88.8],
    [217, 639.5, 620.0, 465.3, 87.8],
    [221, 639.5, 617.5, 462.8, 87.4],
    [225, 639.5, 614.5, 457.7, 86.4],
    [229, 639.5, 612.5, 455.2, 85.9],
    [234, 639.5, 609.0, 450.1, 85.0],
    [239, 639.5, 606.0, 445.0, 84.0],
  ];
  const CTA_PAD_X = 30;   // folga para cobrir contorno e brilho do botão gravado
  const CTA_PAD_Y = 18;
  const CTA_SHIFT_Y = 3;

  const $ = (s, c = document) => c.querySelector(s);
  const $$ = (s, c = document) => Array.from(c.querySelectorAll(s));
  const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
  const lerp = (a, b, t) => a + (b - a) * t;
  const range = (n) => Array.from({ length: n }, (_, i) => i);
  const pad = (n) => String(n).padStart(2, '0');
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));
  const capitalize = (s) => s.charAt(0).toUpperCase() + s.slice(1);

  const recifeNow = () => {
    const d = new Date(Date.now() - 3 * 3600 * 1000);
    return { y: d.getUTCFullYear(), m: d.getUTCMonth(), d: d.getUTCDate(), day: d.getUTCDay(), h: d.getUTCHours() + d.getUTCMinutes() / 60 };
  };
  const fmtHour = (h) => {
    const hh = Math.floor(h);
    const mm = Math.round((h - hh) * 60);
    return mm ? `${pad(hh)}h${pad(mm)}` : `${pad(hh)}h`;
  };
  const fmtClock = (h) => `${pad(Math.floor(h))}:${pad(Math.round((h % 1) * 60))}`;

  let lenis = null;
  let hero = null;
  let closing = null;

  // ==========================================================================
  // Sequência de frames em canvas (DPR, cover/contain customizado, cache)
  // ==========================================================================
  class FrameSequence {
    constructor({ canvas, count, src, size, fit, blend = false, onRender = null }) {
      this.canvas = canvas;
      this.count = count;
      this.src = src;
      this.size = size;
      this.fit = fit;
      this.blend = blend;
      this.onRender = onRender;
      this.ctx = canvas.getContext('2d', { alpha: false });
      this.images = new Array(count);
      this.ready = new Uint8Array(count);
      this.requested = new Uint8Array(count);
      this.target = 0;
      this.drawnKey = null;
      this.layout = null;
      this.dpr = 1;
      this.resize = this.resize.bind(this);
      if ('ResizeObserver' in window) new ResizeObserver(this.resize).observe(canvas);
      else window.addEventListener('resize', this.resize);
      this.resize();
    }

    load(indices, { concurrency = 6, onProgress = null } = {}) {
      const queue = indices.filter((i) => !this.requested[i]);
      queue.forEach((i) => { this.requested[i] = 1; });
      const total = queue.length;
      if (!total) { if (onProgress) onProgress(1); return Promise.resolve(); }
      let cursor = 0;
      let active = 0;
      let done = 0;
      return new Promise((resolve) => {
        const next = () => {
          while (active < concurrency && cursor < total) {
            const i = queue[cursor++];
            active++;
            this.fetch(i).then(() => {
              active--;
              done++;
              if (onProgress) onProgress(done / total);
              if (done === total) resolve(); else next();
            });
          }
        };
        next();
      });
    }

    fetch(i) {
      return new Promise((resolve) => {
        const img = new Image();
        img.decoding = 'async';
        img.onload = () => {
          const finish = () => { this.images[i] = img; this.ready[i] = 1; this.render(); resolve(); };
          if (img.decode) img.decode().then(finish, finish); else finish();
        };
        img.onerror = () => resolve();
        img.src = this.src(i);
      });
    }

    nearest(i) {
      if (this.ready[i]) return i;
      for (let d = 1; d < this.count; d++) {
        const a = i - d;
        const b = i + d;
        if (a >= 0 && this.ready[a]) return a;
        if (b < this.count && this.ready[b]) return b;
        if (a < 0 && b >= this.count) break;
      }
      return -1;
    }

    resize() {
      const w = this.canvas.clientWidth;
      const h = this.canvas.clientHeight;
      if (!w || !h) return;
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const W = Math.round(w * dpr);
      const H = Math.round(h * dpr);
      if (this.canvas.width !== W || this.canvas.height !== H) {
        this.canvas.width = W;
        this.canvas.height = H;
      }
      this.dpr = dpr;
      this.layout = this.fit(this.size.w, this.size.h, w, h);
      this.render(true);
    }

    set(frame) {
      this.target = clamp(frame, 0, this.count - 1);
      this.render();
    }

    render(force = false) {
      if (!this.layout) return;
      const want = Math.round(this.target);
      const idx = this.nearest(want);
      const key = idx >= 0 ? idx : -1 - want;
      if (!force && key === this.drawnKey) return;
      this.drawnKey = key;

      const { ctx, dpr } = this;
      const { s, x, y } = this.layout;
      ctx.globalCompositeOperation = 'source-over';
      ctx.fillStyle = BG;
      ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
      if (idx >= 0) {
        // "lighten" funde o preto puro dos frames com o #0A0A0B da página, sem emenda.
        if (this.blend) ctx.globalCompositeOperation = 'lighten';
        ctx.drawImage(this.images[idx], x * dpr, y * dpr, this.size.w * s * dpr, this.size.h * s * dpr);
        ctx.globalCompositeOperation = 'source-over';
        this.feather();
      }
      if (this.onRender) this.onRender(idx >= 0 ? idx : want, this.layout);
    }

    // Quando o frame não cobre a tela inteira (closing no celular), dissolve as bordas.
    feather() {
      const { ctx, dpr } = this;
      const { s, x, y } = this.layout;
      const W = this.canvas.width;
      const H = this.canvas.height;
      const dx = x * dpr;
      const dy = y * dpr;
      const dw = this.size.w * s * dpr;
      const dh = this.size.h * s * dpr;
      if (dy > 0.5) {
        const f = Math.min(150 * dpr, dh * 0.24);
        let g = ctx.createLinearGradient(0, dy, 0, dy + f);
        g.addColorStop(0, BG); g.addColorStop(1, BG_CLEAR);
        ctx.fillStyle = g; ctx.fillRect(0, dy - 1, W, f + 1);
        g = ctx.createLinearGradient(0, dy + dh - f, 0, dy + dh);
        g.addColorStop(0, BG_CLEAR); g.addColorStop(1, BG);
        ctx.fillStyle = g; ctx.fillRect(0, dy + dh - f, W, f + 1);
      }
      if (dx > 0.5) {
        const f = Math.min(150 * dpr, dw * 0.14);
        let g = ctx.createLinearGradient(dx, 0, dx + f, 0);
        g.addColorStop(0, BG); g.addColorStop(1, BG_CLEAR);
        ctx.fillStyle = g; ctx.fillRect(dx - 1, 0, f + 1, H);
        g = ctx.createLinearGradient(dx + dw - f, 0, dx + dw, 0);
        g.addColorStop(0, BG_CLEAR); g.addColorStop(1, BG);
        ctx.fillStyle = g; ctx.fillRect(dx + dw - f, 0, f + 1, H);
      }
    }
  }

  const coverFit = (fx = 0.5, fy = 0.5) => (iw, ih, cw, ch) => {
    const s = Math.max(cw / iw, ch / ih);
    return { s, x: (cw - iw * s) * fx, y: (ch - ih * s) * fy };
  };

  // Recorte vertical do hero (celular): cover em pé; se o aparelho girar, mostra a faixa inteira
  // na altura da tela e as laterais se dissolvem no fundo.
  const heroMobileFit = (iw, ih, cw, ch) => {
    const s = cw > ch ? ch / ih : Math.max(cw / iw, ch / ih);
    return { s, x: (cw - iw * s) / 2, y: (ch - ih * s) / 2 };
  };
  const heroFit = useMobileFrames ? heroMobileFit : coverFit(0.48, 0.5);

  // Logo inteira sempre visível: no desktop quase cover; no celular limitada pela largura.
  // 720 px = largura da logo no auge do zoom do vídeo (coordenadas do frame 1280×720).
  const closingFit = (iw, ih, cw, ch) => {
    const cover = Math.max(cw / iw, ch / ih);
    const s = Math.min(cover, (ch * 0.9) / ih, (cw * 0.96) / 720);
    return { s, x: (cw - iw * s) / 2, y: (ch - ih * s) / 2 };
  };

  // ==========================================================================
  // CTA do showcase
  // ==========================================================================
  const ctaAnchor = $('#showcase-anchor');

  function ctaRectAt(frameIdx) {
    const f = frameIdx * (239 / Math.max(1, CLOSING_TOTAL_FRAMES - 1));
    if (f <= CTA_TRACK[0][0]) return CTA_TRACK[0];
    for (let k = 1; k < CTA_TRACK.length; k++) {
      if (f <= CTA_TRACK[k][0]) {
        const a = CTA_TRACK[k - 1];
        const b = CTA_TRACK[k];
        const t = (f - a[0]) / (b[0] - a[0]);
        return a.map((v, j) => lerp(v, b[j], t));
      }
    }
    return CTA_TRACK[CTA_TRACK.length - 1];
  }

  function placeCTA(frameIdx, layout) {
    if (!ctaAnchor) return;
    const [, cx, cy, w, h] = ctaRectAt(frameIdx);
    const { s, x, y } = layout;
    const W = (w + CTA_PAD_X) * s;
    const H = (h + CTA_PAD_Y) * s;
    const L = x + (cx - CLOSING_SET.size.offsetX) * s - W / 2;
    const T = y + (cy + CTA_SHIFT_Y) * s - H / 2;
    ctaAnchor.style.width = `${W.toFixed(1)}px`;
    ctaAnchor.style.height = `${H.toFixed(1)}px`;
    ctaAnchor.style.transform = `translate3d(${L.toFixed(1)}px, ${T.toFixed(1)}px, 0)`;
    ctaAnchor.style.setProperty('--cta-fs', `${clamp(H * 0.24, 12, 30).toFixed(1)}px`);
  }

  // ==========================================================================
  // Rolagem suave + âncoras
  // ==========================================================================
  const navHeight = () => ($('#nav') ? $('#nav').offsetHeight : 0);

  let closingRequested = false;
  function loadClosing() {
    if (closingRequested || !closing) return;
    closingRequested = true;
    closing.load(range(CLOSING_TOTAL_FRAMES), { concurrency: 6 });
  }

  function scrollToTarget(el, onComplete) {
    const isTop = el.id === 'topo';
    if (!isTop) loadClosing();
    if (lenis) {
      lenis.scrollTo(isTop ? 0 : el, {
        offset: isTop ? 0 : -navHeight(),
        duration: 1.8,
        easing: (t) => 1 - Math.pow(1 - t, 4),
        onComplete,
      });
    } else {
      if (isTop) window.scrollTo(0, 0); else el.scrollIntoView({ block: 'start' });
      if (onComplete) setTimeout(onComplete, 60);
    }
  }

  function initAnchors() {
    document.addEventListener('click', (e) => {
      const a = e.target.closest('a[href^="#"]');
      if (!a) return;
      const id = a.getAttribute('href');
      if (id.length < 2) return;
      const el = document.getElementById(id.slice(1));
      if (!el) return;
      e.preventDefault();
      setMenu(false);
      scrollToTarget(el);
    });
  }

  // ==========================================================================
  // Menu mobile
  // ==========================================================================
  const toggle = $('.nav__toggle');
  const menu = $('#menu-mobile');

  function setMenu(open) {
    if (!toggle || !menu) return;
    const isOpen = toggle.getAttribute('aria-expanded') === 'true';
    if (open === isOpen) return;
    toggle.setAttribute('aria-expanded', String(open));
    $('.nav__toggle-label', toggle).textContent = open ? 'Fechar' : 'Menu';
    menu.hidden = !open;
    document.body.style.overflow = open ? 'hidden' : '';
    if (open) {
      if (lenis) lenis.stop();
      if (hasGSAP && !calm) {
        gsap.fromTo($$('.mobile-menu__links a, .mobile-menu__foot', menu),
          { y: 28, autoAlpha: 0 },
          { y: 0, autoAlpha: 1, duration: 0.9, ease: 'power3.out', stagger: 0.06 });
      }
      $('a', menu).focus();
    } else if (lenis) {
      lenis.start();
    }
  }

  function initMenu() {
    if (!toggle || !menu) return;
    toggle.addEventListener('click', () => setMenu(toggle.getAttribute('aria-expanded') !== 'true'));
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && !menu.hidden) { setMenu(false); toggle.focus(); }
    });
    const desktop = window.matchMedia('(min-width: 1024px)');
    const onDesktop = (e) => { if (e.matches) setMenu(false); };
    // Safari < 14 só conhece addListener
    if (desktop.addEventListener) desktop.addEventListener('change', onDesktop); else desktop.addListener(onDesktop);
  }

  // ==========================================================================
  // Horários e status "aberto agora"
  // ==========================================================================
  function updateOpenStatus() {
    const n = recifeNow();
    $$('.hours tr').forEach((tr) => tr.classList.toggle('is-today', Number(tr.dataset.day) === n.day));
    const status = $('#open-status');
    if (!status) return;
    const [o, c] = HOURS[n.day];
    let text;
    let open = false;
    if (n.h >= o && n.h < c) { open = true; text = `Aberto agora · fecha às ${fmtHour(c)}`; }
    else if (n.h < o) text = `Fechado agora · abre hoje às ${fmtHour(o)}`;
    else text = `Fechado agora · abre amanhã às ${fmtHour(HOURS[(n.day + 1) % 7][0])}`;
    status.classList.toggle('is-open', open);
    $('.status__text', status).textContent = text;
  }

  // ==========================================================================
  // Agendamento → WhatsApp
  // ==========================================================================
  function openExternal(url) {
    const a = document.createElement('a');
    a.href = url;
    a.target = '_blank';
    a.rel = 'noopener';
    document.body.appendChild(a);
    a.click();
    a.remove();
  }

  function initBooking() {
    const form = $('#booking-form');
    if (!form) return;
    const nome = $('#f-nome');
    const servico = $('#f-servico');
    const data = $('#f-data');
    const horario = $('#f-horario');
    const notice = $('#f-notice');
    const error = $('#f-error');
    const success = $('#f-success');
    const hint = $('#f-servico-hint');
    const selectButtons = $$('.menu__select');

    const now = recifeNow();
    const todayISO = `${now.y}-${pad(now.m + 1)}-${pad(now.d)}`;
    data.min = todayISO;
    data.max = new Date(Date.UTC(now.y, now.m, now.d + 90)).toISOString().slice(0, 10);

    const parseISO = (v) => { const [y, m, d] = v.split('-').map(Number); return new Date(Date.UTC(y, m - 1, d)); };
    const toHours = (v) => { const [h, m] = v.split(':').map(Number); return h + m / 60; };

    function slotsFor(iso) {
      const day = parseISO(iso).getUTCDay();
      const [o, c] = HOURS[day];
      let list = [];
      for (let t = o; t <= c - 0.5 + 1e-9; t += 0.5) list.push(t);
      if (iso === todayISO) {
        const h = recifeNow().h;
        list = list.filter((t) => t >= h + 0.5);
      }
      return { day, o, c, list };
    }

    function updateNotice() {
      const iso = data.value;
      notice.classList.remove('notice--busy');
      if (!iso || !/^\d{4}-\d{2}-\d{2}$/.test(iso)) {
        notice.textContent = 'Selecione o dia para ver os horários de atendimento.';
        return;
      }
      const { day, o, c, list } = slotsFor(iso);
      const t = /^\d/.test(horario.value) ? toHours(horario.value) : null;
      notice.textContent = '';
      const strong = document.createElement('strong');
      strong.textContent = capitalize(DAY_NAMES[day]);
      notice.append(strong, `: atendimento das ${fmtHour(o)} às ${fmtHour(c)}.`);
      if (!list.length) {
        notice.append(' Os horários deste dia já se encerraram. Escolha outra data.');
        return;
      }
      let busy = '';
      if (day === 5) busy = 'Sexta é um dos dias de maior procura';
      else if (day === 4 && (t === null || t >= 12)) busy = 'Quinta à tarde é um dos períodos de maior procura';
      if (busy) {
        const b = document.createElement('strong');
        b.textContent = busy;
        notice.append(' ', b, ' — se puder, agende com antecedência.');
        notice.classList.add('notice--busy');
      }
    }

    function renderSlots() {
      const iso = data.value;
      horario.innerHTML = '';
      if (!iso) {
        horario.disabled = true;
        horario.add(new Option('Escolha o dia primeiro', ''));
        updateNotice();
        return;
      }
      const { list } = slotsFor(iso);
      if (!list.length) {
        horario.disabled = true;
        horario.add(new Option('Sem horários neste dia', ''));
        updateNotice();
        return;
      }
      horario.disabled = false;
      horario.add(new Option('Primeiro horário disponível', 'Primeiro horário disponível'));
      [['Manhã', (t) => t < 12], ['Tarde', (t) => t >= 12 && t < 18], ['Noite', (t) => t >= 18]].forEach(([label, test]) => {
        const items = list.filter(test);
        if (!items.length) return;
        const group = document.createElement('optgroup');
        group.label = label;
        items.forEach((t) => group.appendChild(new Option(fmtClock(t), fmtClock(t))));
        horario.appendChild(group);
      });
      updateNotice();
    }

    function syncServiceButtons() {
      selectButtons.forEach((b) => {
        const on = b.dataset.service === servico.value;
        b.setAttribute('aria-pressed', String(on));
        b.textContent = on ? 'Selecionado' : 'Selecionar';
      });
      hint.hidden = servico.value !== 'Corte Infantil';
    }

    const clearInvalid = (el) => el.removeAttribute('aria-invalid');
    [nome, servico, data].forEach((el) => el.addEventListener('input', () => { clearInvalid(el); error.textContent = ''; }));
    data.addEventListener('change', renderSlots);
    horario.addEventListener('change', updateNotice);
    servico.addEventListener('change', () => { clearInvalid(servico); syncServiceButtons(); });

    selectButtons.forEach((btn) => btn.addEventListener('click', () => {
      servico.value = btn.dataset.service;
      clearInvalid(servico);
      syncServiceButtons();
      scrollToTarget($('#agendamento'), () => nome.focus({ preventScroll: true }));
    }));

    $$('[data-pick-pro]').forEach((link) => link.addEventListener('click', () => {
      const radio = form.querySelector(`input[name="profissional"][value="${link.dataset.pickPro}"]`);
      if (radio) radio.checked = true;
    }));

    form.addEventListener('submit', (e) => {
      e.preventDefault();
      [nome, servico, data].forEach(clearInvalid);
      error.textContent = '';
      success.hidden = true;

      const name = nome.value.trim().replace(/\s+/g, ' ');
      const problems = [];
      if (name.length < 2) problems.push([nome, 'Informe o seu nome.']);
      if (!servico.value) problems.push([servico, 'Escolha o serviço desejado.']);
      if (!data.value) problems.push([data, 'Escolha o dia do atendimento.']);
      else if (data.value < todayISO) problems.push([data, 'Escolha uma data a partir de hoje.']);
      else if (!slotsFor(data.value).list.length) problems.push([data, 'Não há mais horários neste dia. Escolha outra data.']);

      if (problems.length) {
        problems.forEach(([el]) => el.setAttribute('aria-invalid', 'true'));
        error.textContent = problems.map((p) => p[1]).join(' ');
        problems[0][0].focus();
        return;
      }

      const checked = form.querySelector('input[name="profissional"]:checked');
      const pro = checked ? checked.value : 'Qualquer disponível';
      const dt = parseISO(data.value);
      const dateLabel = `${DAY_NAMES[dt.getUTCDay()]}, ${pad(dt.getUTCDate())}/${pad(dt.getUTCMonth() + 1)}/${dt.getUTCFullYear()}`;
      const time = horario.value || 'Primeiro horário disponível';

      const message = [
        'Olá, Barbearia D’Lauren! Gostaria de agendar um horário.',
        '',
        `*Nome:* ${name}`,
        `*Serviço:* ${servico.value}`,
        `*Profissional:* ${pro}`,
        `*Data:* ${dateLabel}`,
        `*Horário:* ${time}`,
        '',
        'Aguardo a confirmação. (Mensagem enviada pelo site)',
      ].join('\n');

      const url = `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(message)}`;
      openExternal(url);

      success.textContent = 'Abrimos o WhatsApp com a sua mensagem pronta — é só tocar em enviar. Não abriu? ';
      const link = document.createElement('a');
      link.href = url;
      link.target = '_blank';
      link.rel = 'noopener';
      link.className = 'link-underline';
      link.textContent = 'Abrir o WhatsApp';
      success.append(link, '.');
      success.hidden = false;
    });

    renderSlots();
    syncServiceButtons();
  }

  function initStatic() {
    const waText = encodeURIComponent('Olá! Vim pelo site da Barbearia D’Lauren.');
    $$('[data-wa]').forEach((a) => { a.href = `https://wa.me/${WHATSAPP_NUMBER}?text=${waText}`; });
    $$('[data-year]').forEach((el) => { el.textContent = String(new Date().getFullYear()); });
    updateOpenStatus();
    setInterval(updateOpenStatus, 60 * 1000);
    // Cada parte isolada: um erro num navegador antigo não pode impedir o filme de iniciar.
    [initMenu, initAnchors, initBooking].forEach((fn) => {
      try { fn(); } catch (err) { console.error('[D’Lauren]', fn.name, err); }
    });
  }

  // ==========================================================================
  // Modo estático (só quando GSAP não carrega, ou se a animação falhar)
  // ==========================================================================
  function bootStatic() {
    root.classList.add('rm');
    root.classList.remove('is-loading');
    const heroStill = Math.round((HERO_TOTAL_FRAMES - 1) * 0.6);
    if (!hero) {
      hero = new FrameSequence({
        canvas: $('#hero-canvas'), count: HERO_TOTAL_FRAMES, src: HERO_SET.src,
        size: HERO_SET.size, fit: heroFit,
      });
    }
    hero.set(heroStill);
    hero.load([heroStill]);

    if (!closing) {
      closing = new FrameSequence({
        canvas: $('#closing-canvas'), count: CLOSING_TOTAL_FRAMES, src: CLOSING_SET.src,
        size: CLOSING_SET.size, fit: closingFit, blend: true, onRender: placeCTA,
      });
    }
    closingRequested = true;
    closing.set(CLOSING_TOTAL_FRAMES - 1);
    closing.load([CLOSING_TOTAL_FRAMES - 1]);
    hero.resize();
    closing.resize();

    clearTimeout(window.__bootTimer);
    const pre = $('#preloader');
    if (pre) pre.remove();
  }

  // ==========================================================================
  // Modo cinematográfico
  // ==========================================================================
  function initLenis() {
    if (!hasLenis) return;
    lenis = new Lenis({ lerp: 0.09, smoothWheel: true, wheelMultiplier: 1 });
    lenis.on('scroll', ScrollTrigger.update);
    gsap.ticker.add((time) => lenis.raf(time * 1000));
    gsap.ticker.lagSmoothing(0);
    lenis.stop();
  }

  function storyIn(tl, block, shade, at) {
    tl.fromTo(shade, { autoAlpha: 0 }, { autoAlpha: 1, duration: 0.08 }, at - 0.01);
    tl.set(block, { autoAlpha: 1 }, at);
    tl.fromTo(block.children,
      { y: calm ? 0 : 64, autoAlpha: 0 },
      { y: 0, autoAlpha: 1, duration: 0.07, ease: 'power3.out', stagger: calm ? 0 : 0.012 }, at);
  }

  function storyOut(tl, block, shade, at) {
    tl.to(block.children, { y: calm ? 0 : -40, autoAlpha: 0, duration: 0.06, ease: 'power2.in', stagger: calm ? 0 : 0.008 }, at);
    tl.to(shade, { autoAlpha: 0, duration: 0.08 }, at + 0.005);
    tl.set(block, { autoAlpha: 0 }, at + 0.075);
  }

  function buildScenes() {
    // --- Hero: frames-barber ------------------------------------------------
    const heroState = { frame: 0 };
    const s1 = $('[data-story="1"]');
    const s2 = $('[data-story="2"]');
    const s3 = $('[data-story="3"]');

    const heroTl = gsap.timeline({
      defaults: { ease: 'none' },
      scrollTrigger: {
        trigger: '#topo',
        start: 'top top',
        end: () => `+=${window.innerHeight * (HERO_SECTION_VH / 100 - 1)}`,
        pin: true,
        scrub: 0.5,
        anticipatePin: 1,
        invalidateOnRefresh: true,
        onLeave: loadClosing,
      },
    });
    heroTl.to(heroState, { frame: HERO_TOTAL_FRAMES - 1, duration: 1, onUpdate: () => hero.set(heroState.frame) }, 0);
    heroTl.to('[data-cue]', { autoAlpha: 0, duration: 0.04 }, 0.01);
    // 0% → 28%
    heroTl.to(s1, { autoAlpha: 0, y: calm ? 0 : -56, duration: 0.08, ease: 'power2.in' }, 0.2);
    heroTl.to('[data-shade="center"]', { autoAlpha: 0, duration: 0.08 }, 0.2);
    // 35% → 62% (esquerda)
    storyIn(heroTl, s2, '[data-shade="left"]', 0.35);
    storyOut(heroTl, s2, '[data-shade="left"]', 0.55);
    // 68% → 95% (direita)
    storyIn(heroTl, s3, '[data-shade="right"]', 0.68);
    storyOut(heroTl, s3, '[data-shade="right"]', 0.88);
    heroTl.set({}, {}, 1);

    // --- Closing showcase: frames-logo -----------------------------------------
    const closeState = { frame: 0 };
    const closeTl = gsap.timeline({
      defaults: { ease: 'none' },
      scrollTrigger: {
        trigger: '#assinatura',
        start: 'top top',
        end: () => `+=${window.innerHeight * (CLOSING_SECTION_VH / 100 - 1)}`,
        pin: true,
        scrub: 0.5,
        anticipatePin: 1,
        invalidateOnRefresh: true,
        onEnter: loadClosing,
        onEnterBack: loadClosing,
      },
    });
    closeTl.to(closeState, { frame: CLOSING_TOTAL_FRAMES - 1, duration: 1, onUpdate: () => closing.set(closeState.frame) }, 0);
    // 72% → 100%: CTA surge sob a logo
    closeTl.fromTo('#showcase-cta', { autoAlpha: 0, y: calm ? 0 : 18 }, { autoAlpha: 1, y: 0, duration: 0.08, ease: 'power3.out' }, 0.72);
    closeTl.set({}, {}, 1);

    // Movimento reduzido: conteúdo editorial aparece pronto, sem deslizar nem contar.
    if (calm) { ScrollTrigger.sort(); return; }

    // --- Revelações editoriais ---------------------------------------------
    $$('[data-reveal]').forEach((el) => {
      gsap.from(el, {
        y: 48, autoAlpha: 0, duration: 1.3, ease: 'power3.out',
        scrollTrigger: { trigger: el, start: 'top 88%', once: true },
      });
    });
    $$('[data-reveal-group]').forEach((group) => {
      gsap.from(group.children, {
        y: 40, autoAlpha: 0, duration: 1.3, ease: 'power3.out', stagger: 0.09,
        scrollTrigger: { trigger: group, start: 'top 85%', once: true },
      });
    });

    $$('[data-count]').forEach((el) => {
      const end = parseFloat(el.dataset.count);
      const from = parseFloat(el.dataset.from || '0');
      const decimals = parseInt(el.dataset.decimals || '0', 10);
      const fmt = (v) => (decimals ? v.toFixed(decimals).replace('.', ',') : String(Math.round(v)));
      const real = document.createElement('span');
      real.className = 'sr-only';
      real.textContent = fmt(end);
      el.after(real);
      el.setAttribute('aria-hidden', 'true');
      // Trava a largura no valor final (em "em", acompanha o tamanho fluido) para os
      // algarismos proporcionais da Bodoni não fazerem o número "tremer" na contagem.
      const fontSize = parseFloat(getComputedStyle(el).fontSize) || 16;
      el.style.minWidth = `${(el.getBoundingClientRect().width / fontSize).toFixed(3)}em`;
      el.style.textAlign = 'right';
      const state = { v: from };
      el.textContent = fmt(from);
      gsap.to(state, {
        v: end, duration: 2.4, ease: 'power3.out',
        onUpdate: () => { el.textContent = fmt(state.v); },
        scrollTrigger: { trigger: el, start: 'top 90%', once: true },
      });
    });

    const parallax = $('[data-parallax]');
    if (parallax) {
      gsap.fromTo(parallax, { yPercent: -5 }, {
        yPercent: 5, ease: 'none',
        scrollTrigger: { trigger: parallax.closest('.casa__frame'), start: 'top bottom', end: 'bottom top', scrub: true },
      });
    }

    gsap.from('[data-mark]', {
      yPercent: 70, duration: 1.6, ease: 'power3.out',
      scrollTrigger: { trigger: '.footer__mark', start: 'top 96%', once: true },
    });

    ScrollTrigger.sort();
  }

  function revealSite() {
    const pre = $('#preloader');
    const hash = window.location.hash.slice(1);
    const target = hash && hash !== 'topo' ? document.getElementById(hash) : null;
    // Abre sempre no início do filme (o navegador pode restaurar a rolagem durante o carregamento).
    if (!target) {
      window.scrollTo(0, 0);
      if (lenis) lenis.scrollTo(0, { immediate: true, force: true });
      ScrollTrigger.update();
    }
    const unlock = () => {
      clearTimeout(window.__bootTimer);
      pre.remove();
      root.classList.remove('is-loading');
      if (lenis) lenis.start();
      ScrollTrigger.refresh();
      if (target) {
        loadClosing();
        if (lenis) lenis.scrollTo(target, { offset: -navHeight(), immediate: true, force: true });
        else target.scrollIntoView();
      }
    };

    if (calm) {
      gsap.timeline().to(pre, { autoAlpha: 0, duration: 0.5, ease: 'power2.out' }).add(unlock);
      return;
    }

    const tl = gsap.timeline();
    tl.to('.preloader__inner', { autoAlpha: 0, y: -12, duration: 0.6, ease: 'power2.in' })
      .to(pre, { yPercent: -100, duration: 1.15, ease: 'expo.inOut' }, '-=0.1')
      .add(unlock)
      .from('#nav', { yPercent: -100, autoAlpha: 0, duration: 1.1, ease: 'power3.out' }, '-=0.55')
      .from($('[data-story="1"]').children, { y: 44, autoAlpha: 0, duration: 1.4, ease: 'power3.out', stagger: 0.1 }, '-=0.95')
      .from('[data-cue]', { autoAlpha: 0, duration: 1 }, '-=0.7');
  }

  async function bootMotion() {
    gsap.registerPlugin(ScrollTrigger);
    ScrollTrigger.config({ ignoreMobileResize: true });
    if ('scrollRestoration' in history) history.scrollRestoration = 'manual';
    window.scrollTo(0, 0);
    if (!calm) initLenis();

    hero = new FrameSequence({
      canvas: $('#hero-canvas'), count: HERO_TOTAL_FRAMES, src: HERO_SET.src,
      size: HERO_SET.size, fit: heroFit,
    });
    hero.set(0);
    closing = new FrameSequence({
      canvas: $('#closing-canvas'), count: CLOSING_TOTAL_FRAMES, src: CLOSING_SET.src,
      size: CLOSING_SET.size, fit: closingFit, blend: true, onRender: placeCTA,
    });

    // Preloader: só os frames do hero entram na conta.
    const countEl = $('#preloader-count');
    const bar = $('#preloader-bar');
    let real = 0;
    let shown = 0;
    let finished;
    const reached = new Promise((r) => { finished = r; });
    const tick = () => {
      shown += (real - shown) * 0.12;
      if (real >= 1 && 1 - shown < 0.004) shown = 1;
      countEl.textContent = String(Math.round(shown * 100));
      bar.style.transform = `scaleX(${shown.toFixed(4)})`;
      if (shown >= 1) { gsap.ticker.remove(tick); finished(); }
    };
    gsap.ticker.add(tick);

    const frames = hero.load(range(HERO_TOTAL_FRAMES), { concurrency: 8, onProgress: (p) => { real = Math.max(real, p * 0.97); } });
    const fonts = document.fonts ? document.fonts.ready : Promise.resolve();
    await Promise.race([Promise.all([frames, fonts]), wait(15000)]);
    real = 1;
    await reached;

    buildScenes();
    ScrollTrigger.refresh();
    revealSite();
    window.addEventListener('load', () => ScrollTrigger.refresh(), { once: true });
  }

  // ==========================================================================
  initStatic();
  if (staticMode) bootStatic();
  else bootMotion().catch((err) => {
    console.error('[D’Lauren] Falha na animação, usando modo estático:', err);
    if (lenis) { lenis.destroy(); lenis = null; }
    if (hasGSAP) ScrollTrigger.getAll().forEach((t) => t.kill());
    bootStatic();
  });
})();
