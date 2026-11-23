/* Fuera de campo — la app: marco, navegación con transiciones y estado compartido */
(function () {
  'use strict';
  var phone = document.getElementById('phone');

  /* ---------- estado que comparten las pantallas ---------- */
  var store = {
    get: function (k, d) { try { var v = localStorage.getItem('fdc2.' + k); return v === null ? d : JSON.parse(v); } catch (e) { return d; } },
    set: function (k, v) { try { localStorage.setItem('fdc2.' + k, JSON.stringify(v)); } catch (e) {} }
  };
  var S = {
    name: store.get('name', ''), mail: store.get('mail', ''),
    interrupt: store.get('interrupt', [false, false, false]),
    saved: store.get('saved', []), location: store.get('location', false),
    start: null, end: null, entry: null, mood: null, speed: 60
  };
  function save(k) { store.set(k, S[k]); }

  /* ---------- escala ---------- */
  function fit() {
    var w = window.innerWidth, h = window.innerHeight, mobile = w < 560, k, ph;
    document.body.classList.add('mobile');
    if (mobile) { k = w / 393; ph = Math.max(640, Math.round(h / k)); }
    else { k = Math.min(1.25, h / 852); ph = Math.max(640, Math.round(h / k)); }
    document.documentElement.style.setProperty('--k', k);
    document.documentElement.style.setProperty('--ph', ph);
  }
  window.addEventListener('resize', fit); fit();
  var fsb = document.getElementById('fs');
  if (fsb) fsb.addEventListener('click', function () {
    var el = document.documentElement;
    try {
      if (document.fullscreenElement) document.exitFullscreen();
      else if (el.requestFullscreen) el.requestFullscreen().catch(function () { toast('tu navegador no deja: probá con F11'); });
      else if (el.webkitRequestFullscreen) el.webkitRequestFullscreen();
    } catch (e) { toast('tu navegador no deja: probá con F11'); }
  });
  document.addEventListener('fullscreenchange', function () { setTimeout(fit, 50); });

  /* ---------- utilidades ---------- */
  var toastT;
  function toast(t) { var el = document.getElementById('toast'); el.textContent = t; el.classList.add('on'); clearTimeout(toastT); toastT = setTimeout(function () { el.classList.remove('on'); }, 2300); }
  function vib(p) { try { if (navigator.vibrate) navigator.vibrate(p); } catch (e) {} }

  /* ---------- pantallas ---------- */
  var ROUTES = {};
  ['Onboarding', 'Cuenta', 'Ubicacion', 'Avisos', 'Listo', 'Home', 'Menu', 'Mapa', 'Sombra', 'Recorrido', 'Vecinos', 'Animo',
   'Retos', 'Guardado', 'Reto', 'Historial', 'Desconexiones', 'Perfil', 'Historia', 'Llegaste', 'Zonas', 'ResumenLugar', 'ResumenReto',
   'Fuera', 'Volviste', 'Mientras', 'Esperado', 'Sentiste', 'ComoFue'].forEach(function (n) { ROUTES[n.toLowerCase()] = n; });
  var cache = {};
  function load(name) {
    if (cache[name]) return Promise.resolve(cache[name]);
    var t = window.PANTALLAS && window.PANTALLAS[ROUTES[name]]; if (!t) return Promise.reject(new Error('falta ' + name)); cache[name] = t; return Promise.resolve(t);
  }
  // precarga suave
  setTimeout(function () { Object.keys(ROUTES).forEach(function (n) { load(n).catch(function () {}); }); }, 800);

  var hist = [], cur = null, busy = false, lastTap = { x: 196, y: 426 };
  phone.addEventListener('pointerdown', function (e) {
    var b = phone.getBoundingClientRect(), k = b.width / 393;
    lastTap = { x: (e.clientX - b.left) / k, y: (e.clientY - b.top) / k };
    var t = e.target.closest && e.target.closest('a, button');
    lastRect = null;
    if (t) {
      var r = t.getBoundingClientRect(), g = [(r.left - b.left) / k, (r.top - b.top) / k, r.width / k, r.height / k];
      if (g[2] >= 150 && g[3] >= 44 && g[3] <= 320 && g[1] > 110 && g[2] * g[3] < 70000) lastRect = g;
    }
  }, true);
  var lastRect = null;
  if (window.FX) window.FX.bindTouch(phone, function () { return phone.classList.contains('sb-dark'); });

  function hrefToRoute(href) {
    var m = /([A-Za-z0-9]+)\.dc\.html/.exec(href);
    if (!m) return href;
    for (var k in ROUTES) if (ROUTES[k] === m[1]) return k;
    return null;
  }

  function go(name, tr, params, replace) {
    if (busy) return;
    if (!ROUTES[name]) { toast('esta parte la estoy armando · tanda siguiente'); return; }
    tr = tr || 'push';
    var rect = null;
    if (tr === 'push' && lastRect && !replace) { tr = 'expand'; rect = lastRect; }
    lastRect = null;
    if (cur && !replace) hist.push({ name: cur.name, params: cur.params, rect: rect, tr: tr });
    show(name, tr, params || {}, rect);
  }
  function back(tr) {
    var p = hist.pop();
    var t2 = tr || 'back';
    if (p && (!tr || tr === 'back')) t2 = p.rect ? 'collapse' : p.tr === 'morph' ? 'morph' : 'back';
    if (p) show(p.name, t2, p.params, p.rect); else show('home', 'fade', {});
  }
  function home() { hist = []; show('home', 'fade', {}); }

  function show(name, tr, params, rect, opt2) {
    busy = true;
    load(name).then(function (src) {
      var el = document.createElement('div');
      el.className = 'scr';
      var host = document.createElement('div'); host.className = 'host'; el.appendChild(host);
      var api = {
        go: go, back: back, home: home, toast: toast, vib: vib, S: S, save: save, params: params,
        tap: function () { return lastTap; }, el: el
      };
      var inst;
      try {
        inst = window.mountDC(src, host, {
          props: { app: api },
          onNav: function (href, a) {
            var trn = a.getAttribute('data-tr') || 'push';
            if (href === 'back') return back(a.getAttribute('data-tr') || 'back');
            if (href === 'home') return home();
            var r = hrefToRoute(href);
            if (r === 'home') { hist = []; return show('home', 'back', {}); }
            var MAPG = ['mapa', 'sombra', 'recorrido', 'vecinos', 'animo'];
            // mi recorrido <-> todos los vecinos: la isla es la misma, solo cambia lo que hay encima
            if (r && cur && /^(recorrido|vecinos)$/.test(r) && /^(recorrido|vecinos)$/.test(cur.name)) return go(r, 'swap', {}, true);
            if (r && MAPG.indexOf(r) >= 0 && cur && MAPG.indexOf(cur.name) >= 0) return go(r, 'tab', {}, true);
            if (r) go(r, trn); else if (/^https?:/.test(href)) window.open(href, '_blank', 'noopener');
          }
        });
      } catch (err) { console.error(err); busy = false; toast('no pude abrir esta pantalla'); return; }
      var old = cur, pairs = null;
      phone.insertBefore(el, document.getElementById('fxl'));
      if (opt2 && opt2.scroll) el.scrollTop = opt2.scroll;
      // si las dos pantallas comparten un título o un dato grande, se transforman una en la otra
      if (tr === 'push' && old && window.FX) {
        pairs = window.FX.heroes(old.el, el);
        var strong = pairs.some(function (p) { return p.b.fs >= 22 && (Math.abs(p.a.x - p.b.x) + Math.abs(p.a.y - p.b.y) > 8 || Math.abs(p.a.fs - p.b.fs) > 2); });
        if (strong) { tr = 'morph'; if (hist.length) hist[hist.length - 1].tr = 'morph'; }
      }
      var custom = { expand: 1, collapse: 1, morph: 1, swipe: 1, dismiss: 1, swap: 1 };
      if (!custom[tr]) animate(el, old && old.el, tr);
      else { el.classList.add('t-in'); if (tr === 'expand') el.style.zIndex = 2; }
      if (window.FX && tr !== 'tab') try { window.FX.enter(el, old && old.el, tr, { rect: rect, pairs: pairs, dx: opt2 && opt2.dx, dy: opt2 && opt2.dy }); } catch (err) { console.error(err); }
      cur = { name: name, params: params, el: el, inst: inst };
      setTimeout(function () {
        if (old) { old.inst.destroy(); old.el.remove(); }
        el.classList.remove('t-in'); el.style.zIndex = ''; busy = false;
      }, DUR[tr] || 420);
      phone.classList.toggle('sb-dark', name === 'fuera' || name === 'volviste');
      try { history.replaceState(null, '', '#' + name); } catch (e) {}
    }).catch(function (e) { console.error(e); busy = false; toast('no pude cargar la pantalla'); });
  }

  var DUR = { tab: 700, push: 460, back: 460, fade: 520, up: 520, down: 480, reveal: 820, menu: 520, expand: 700, collapse: 640, morph: 780, swipe: 360, swap: 340, dismiss: 480, none: 10 };
  function animate(el, old, tr) {
    if (tr === 'tab') {
      // paralaje: lo que está más abajo entra más tarde y desde más lejos
      var root = el.querySelector('.host > div'); if (!root) return;
      var base = el.getBoundingClientRect(), k = base.width / 393 || 1, picked = [];
      (function walk(n, depth) {
        Array.prototype.forEach.call(n.children, function (c) {
          if (c.localName === 'style' || c.localName === 'defs') return;
          var r = c.getBoundingClientRect(), top = (r.top - base.top) / k, h = r.height / k;
          if (h === 0 && r.width === 0) return;
          if (top + h <= 165) return; // encabezado: queda quieto
          if ((h > 330 || top < 160) && c.children.length && depth < 6 && c.localName !== 'svg') return walk(c, depth + 1);
          picked.push([c, Math.max(160, top)]);
        });
      })(root, 0);
      picked.forEach(function (p) {
        var c = p[0], top = p[1], d = Math.min(0.55, (top - 160) / 1000), dy = 18 + Math.min(80, (top - 160) / 8);
        var prev = c.style.animation;
        c.style.setProperty('--dy', dy + 'px');
        c.style.animation = 'tabIn .85s cubic-bezier(.2,.8,.2,1) ' + d.toFixed(2) + 's both';
        setTimeout(function () { c.style.animation = prev; }, 1500);
      });
      if (old) old.classList.add('t-out', 'out-tab');
      return;
    }
    el.classList.add('t-in', 'tr-' + tr);
    if (tr === 'reveal') {
      el.style.clipPath = 'circle(0px at ' + lastTap.x + 'px ' + lastTap.y + 'px)';
      el.getBoundingClientRect();
      el.style.transition = 'clip-path .8s cubic-bezier(.65,0,.35,1)';
      el.style.clipPath = 'circle(1100px at ' + lastTap.x + 'px ' + lastTap.y + 'px)';
      setTimeout(function () { el.style.clipPath = ''; el.style.transition = ''; }, 820);
    }
    if (old) { old.classList.add('t-out', 'out-' + tr); }
  }

  // reiniciar: tocar 3 veces la hora de la barra, o abrir el link con #reiniciar
  function reset() {
    try { Object.keys(localStorage).forEach(function (k) { if (k.indexOf('fdc2.') === 0) localStorage.removeItem(k); }); } catch (e) {}
    S.name = ''; S.mail = ''; S.interrupt = [false, false, false]; S.saved = []; S.start = null; S.end = null; S.entry = null;
    hist = []; busy = false; show('onboarding', 'fade', {});
  }


  /* gestos: deslizar desde el borde izquierdo para volver (como iOS) y bajar una tarjeta abierta para cerrarla */
  (function () {
    var g = null;
    phone.addEventListener('pointerdown', function (e) {
      if (busy || !cur || !hist.length) return;
      var b = phone.getBoundingClientRect(), k = b.width / 393, x = (e.clientX - b.left) / k, y = (e.clientY - b.top) / k;
      var top = hist[hist.length - 1];
      if (x < 26) g = { kind: 'edge', x0: e.clientX, y0: e.clientY, k: k };
      else if (top.rect && y < 150 && cur.el.scrollTop < 4) g = { kind: 'pull', x0: e.clientX, y0: e.clientY, k: k };
      else g = null;
    }, true);
    phone.addEventListener('pointermove', function (e) {
      if (!g || busy) return;
      var dx = (e.clientX - g.x0) / g.k, dy = (e.clientY - g.y0) / g.k;
      if (!g.on) {
        if (g.kind === 'edge' && dx > 10 && Math.abs(dy) < dx) g.on = true;
        else if (g.kind === 'pull' && dy > 10 && Math.abs(dx) < dy) g.on = true;
        else if (Math.abs(dx) > 14 || Math.abs(dy) > 14) { g = null; return; }
        if (g && g.on) { cur.el.style.transition = 'none'; cur.el.style.zIndex = 3; try { phone.setPointerCapture(e.pointerId); } catch (x) {} }
      }
      if (!g || !g.on) return;
      e.preventDefault();
      if (g.kind === 'edge') { g.d = Math.max(0, dx); cur.el.style.translate = g.d + 'px 0'; cur.el.style.boxShadow = '-18px 0 40px rgba(0,0,0,' + (0.12 * (1 - g.d / 393)) + ')'; }
      else { g.d = Math.max(0, dy); var s = 1 - g.d / 1400; cur.el.style.translate = '0 ' + g.d + 'px'; cur.el.style.scale = String(s); cur.el.style.borderRadius = Math.min(36, g.d / 4) + 'px'; }
    }, { passive: false });
    function end() {
      if (!g || !g.on) { g = null; return; }
      var d = g.d || 0, kind = g.kind; g = null;
      var el = cur.el;
      if ((kind === 'edge' && d > 110) || (kind === 'pull' && d > 120)) {
        var p = hist.pop();
        el.style.translate = ''; el.style.scale = ''; el.style.borderRadius = ''; el.style.boxShadow = '';
        vib(8);
        show(p.name, kind === 'edge' ? 'swipe' : 'dismiss', p.params, null, kind === 'edge' ? { dx: d } : { dy: d });
      } else {
        el.style.transition = 'translate .35s cubic-bezier(.2,.8,.2,1), scale .35s cubic-bezier(.2,.8,.2,1), border-radius .35s';
        el.style.translate = ''; el.style.scale = ''; el.style.borderRadius = ''; el.style.boxShadow = '';
        setTimeout(function () { el.style.transition = ''; el.style.zIndex = ''; }, 380);
      }
    }
    phone.addEventListener('pointerup', end); phone.addEventListener('pointercancel', end);
  })();

  window.FDC = { go: go, back: back, home: home, S: S, toast: toast, vib: vib, reset: reset, current: function () { return cur && cur.name; }, store: store };
  var startAt = (location.hash || '').replace('#', '');
  if (startAt === 'reiniciar') { try { Object.keys(localStorage).forEach(function (k) { if (k.indexOf('fdc2.') === 0) localStorage.removeItem(k); }); } catch (e) {} S.name = ''; S.mail = ''; S.saved = []; startAt = 'onboarding'; }
  var qs = /[?&]s=([a-z]+)/.exec(location.search); if (qs) startAt = qs[1];
  show(ROUTES[startAt] ? startAt : (store.get('onboarded', false) ? 'home' : 'onboarding'), 'fade', {});
})();
