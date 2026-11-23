/* Fuera de campo — coreografía de transiciones y efectos al tocar.
   - cada pantalla entra por capas: el encabezado queda, el resto sube escalonado según su altura
   - los títulos grandes suben desde una máscara, los números grandes enfocan
   - una tarjeta tocada crece hasta ser la pantalla y vuelve a achicarse al volver
   - todo lo tocable se hunde y rebota, con una onda lima en el punto del toque */
(function () {
  'use strict';
  var EASE = 'cubic-bezier(.2,.8,.2,1)';
  var SPRING = EASE, SPRING_SOFT = EASE;
  try {
    if (CSS.supports('animation-timing-function', 'linear(0, 1)')) {
      // resortes (como iOS): pasan un poquito y vuelven
      SPRING = 'linear(0, 0.013 0.6%, 0.05 1.2%, 0.2 2.6%, 0.43 4.4%, 0.66 6.4%, 0.85 8.6%, 0.98 10.8%, 1.06 13%, 1.1 15.4%, 1.104 17.6%, 1.09 20.2%, 1.04 25.4%, 1.01 30%, 0.994 35%, 0.99 40%, 0.996 50%, 1)';
      SPRING_SOFT = 'linear(0, 0.06 2%, 0.24 5%, 0.5 9%, 0.76 14%, 0.93 19%, 1.02 24%, 1.045 29%, 1.04 34%, 1.015 44%, 1.0 55%, 0.998 70%, 1)';
    }
  } catch (e) {}
  var reduce = false;
  try { reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches; } catch (e) {}

  function rootOf(el) { return el.querySelector('.host > div') || el; }
  function geo(el, base, k) { var r = el.getBoundingClientRect(); return { x: (r.left - base.left) / k, y: (r.top - base.top) / k, w: r.width / k, h: r.height / k }; }

  /* bloques de la pantalla: baja por los contenedores grandes hasta encontrar piezas del tamaño de una tarjeta, un título, una fila */
  function blocks(el, headerY) {
    var root = rootOf(el), base = el.getBoundingClientRect(), k = base.width / 393 || 1, out = [];
    (function walk(n, depth) {
      Array.prototype.forEach.call(n.children, function (c) {
        var t = c.localName;
        if (t === 'style' || t === 'defs' || t === 'script' || t === 'helmet') return;
        var g = geo(c, base, k);
        if (g.w === 0 && g.h === 0) { if (c.children.length && depth < 6) walk(c, depth + 1); return; }
        if (g.y + g.h <= headerY) return;                         // encabezado: queda quieto
        if (g.y > 900) return;
        var big = g.h > 300 || (g.w >= 392 && g.h > 120);
        if (big && c.children.length && depth < 7 && t !== 'svg') return walk(c, depth + 1);
        var an = getComputedStyle(c).animationName;
        if (an && an !== 'none') return;                          // ya tiene su propia animación
        out.push({ el: c, g: g });
      });
    })(root, 0);
    return out;
  }

  /* opacidad real de un elemento (sumando la de sus padres): lo que está oculto a propósito no se anima */
  function ownOp(n) { var v = parseFloat(getComputedStyle(n).opacity); return isNaN(v) ? 1 : v; }
  function chainOp(n) { var v = 1; for (var p = n; p && p.nodeType === 1; p = p.parentNode) { v *= ownOp(p); if (p.classList && p.classList.contains('scr')) break; } return v; }
  var anims = [];
  function A(el, kf, o) { try { var a = el.animate(kf, o); anims.push(a); return a; } catch (e) { return null; } }

  /* entrada escalonada */
  function stagger(el, o) {
    if (reduce) return;
    o = o || {};
    var list = blocks(el, o.header == null ? 112 : o.header), d0 = o.delay || 0, dy = o.dy == null ? 26 : o.dy;
    var skip = o.skip || [];
    list = list.filter(function (b) { return !skip.some(function (h) { return b.el === h || b.el.contains(h); }); });
    var vh = el.clientHeight || 852, sc = el.scrollTop || 0;
    list.forEach(function (b) {
      if (b.g.y > vh + 20) return reveal(el, b);           // lo que está más abajo aparece al scrollear
      var y = Math.max(0, b.g.y - 110), d = d0 + Math.min(420, y * 0.55);
      var isSvg = b.el.localName === 'svg' || b.el.localName === 'img';
      var to = ownOp(b.el); if (chainOp(b.el) < 0.05) return;
      var big = b.g.w * b.g.h > 60000;
      A(b.el, [
        { opacity: 0, translate: '0 ' + (dy + Math.min(40, y / 14)) + 'px', scale: big || isSvg ? '0.97' : '1' },
        { opacity: to, translate: '0 0', scale: '1' }
      ], { duration: big ? 820 : 720, delay: d, easing: SPRING_SOFT, fill: 'backwards' });
    });
    titles(el, d0, skip);
    numbers(el, d0 + 160);
  }

  /* títulos Poppins grandes: suben desde una máscara */
  function titles(el, d0, skip) {
    skip = skip || [];
    var root = rootOf(el), base = el.getBoundingClientRect(), k = base.width / 393 || 1;
    Array.prototype.forEach.call(root.querySelectorAll('h1, div, span, p'), function (n) {
      if (n.children.length > 2) return;
      var t = (n.textContent || '').trim(); if (!t || t.length > 60) return;
      var cs = getComputedStyle(n), fs = parseFloat(cs.fontSize);
      if (fs < 30 || cs.fontFamily.indexOf('Poppins') < 0) return;
      for (var p = n; p && p !== root; p = p.parentElement) { var an = getComputedStyle(p).animationName; if (an && an !== 'none') return; }
      if (/^[\d\s.,:hm%°′″'"″+-]+$/.test(t)) return; // los números tienen su propio efecto
      var g = geo(n, base, k); if (g.y > 860 || g.y + g.h < 60) return;
      A(n, [
        { clipPath: 'inset(0 -10% 100% -10%)', translate: '0 ' + Math.round(fs * 0.7) + 'px' },
        { clipPath: 'inset(0 -10% -30% -10%)', translate: '0 0' }
      ], { duration: 820, delay: d0 + 60 + Math.max(0, g.y - 120) * 0.25, easing: 'cubic-bezier(.16,1,.3,1)', fill: 'backwards' });
    });
  }

  /* números grandes: enfocan desde borroso y chico */
  function numbers(el, d0) {
    var root = rootOf(el), base = el.getBoundingClientRect(), k = base.width / 393 || 1;
    Array.prototype.forEach.call(root.querySelectorAll('div, span, text'), function (n) {
      if (n.children.length) return;
      var t = (n.textContent || '').trim(); if (!t || t.length > 9 || !/\d/.test(t)) return;
      if (!/^[\d\s.,:hm%°′″'"″kmin]+$/.test(t)) return;
      var fs = parseFloat(n.getAttribute && n.getAttribute('font-size')) || parseFloat(getComputedStyle(n).fontSize);
      if (fs < 26) return;
      var g = geo(n, base, k); if (g.y > 860) return;
      if (chainOp(n) < 0.05) return;
      var to = ownOp(n);
      var isText = n.localName === 'text';
      if (isText) { n.style.transformBox = 'fill-box'; n.style.transformOrigin = 'center'; }
      A(n, [
        { opacity: 0, scale: '0.7', filter: 'blur(6px)' },
        { opacity: to, scale: '1.04', filter: 'blur(0)', offset: 0.7 },
        { opacity: to, scale: '1', filter: 'blur(0)' }
      ], { duration: 720, delay: d0 + Math.max(0, g.y - 120) * 0.3, easing: EASE, fill: 'backwards' });
    });
  }

  /* lo que está fuera de la pantalla aparece cuando llega al scroll */
  function reveal(el, b) {
    if (!('IntersectionObserver' in window)) return;
    b.el.style.opacity = 0;
    var io = new IntersectionObserver(function (es) {
      es.forEach(function (e) {
        if (!e.isIntersecting) return;
        io.disconnect(); b.el.style.opacity = '';
        if (chainOp(b.el) < 0.05) return;
        A(b.el, [{ opacity: 0, translate: '0 40px', scale: '0.98' }, { opacity: ownOp(b.el), translate: '0 0', scale: '1' }], { duration: 760, easing: SPRING_SOFT });
      });
    }, { root: el, threshold: 0.15 });
    io.observe(b.el);
  }

  /* elementos compartidos: el mismo texto en las dos pantallas viaja de un lugar al otro (como en iOS y Material) */
  function texts(scr) {
    var out = [], base = document.getElementById('phone').getBoundingClientRect(), k = base.width / 393 || 1;
    var root = rootOf(scr);
    Array.prototype.forEach.call(root.querySelectorAll('h1, h2, div, span, p, a, button, b'), function (n) {
      var own = '';
      for (var i = 0; i < n.childNodes.length; i++) { var c = n.childNodes[i]; if (c.nodeType === 3) own += c.textContent; else if (c.localName === 'br') own += ''; else return; }
      own = own.replace(/\s+/g, '').toLowerCase();
      if (own.length < 2 || own.length > 48) return;
      var cs = getComputedStyle(n); if (cs.visibility === 'hidden' || chainOp(n) < 0.05) return;
      var fs = parseFloat(cs.fontSize); if (fs < 15) return;
      var r = n.getBoundingClientRect(); if (!r.width || !r.height) return;
      var y = (r.top - base.top) / k; if (y < 40 || y > 860) return;
      out.push({ el: n, t: own, fs: fs, x: (r.left - base.left) / k, y: y, w: r.width / k, h: r.height / k });
    });
    return out;
  }
  function heroes(old, el) {
    if (!old || reduce) return [];
    var A0 = texts(old), B0 = texts(el), used = [], pairs = [];
    B0.sort(function (a, b) { return b.fs - a.fs; }).forEach(function (b) {
      var m = null;
      A0.forEach(function (a) { if (a.t === b.t && used.indexOf(a) < 0 && (!m || Math.abs(a.fs - b.fs) < Math.abs(m.fs - b.fs))) m = a; });
      if (!m) return;
      used.push(m); pairs.push({ a: m, b: b });
    });
    return pairs.slice(0, 8);
  }
  function fly(pairs, oldEl, dur, delay) {
    pairs.forEach(function (p) {
      var s = p.a.fs / p.b.fs, dx = p.a.x - p.b.x, dy = p.a.y - p.b.y;
      if (oldEl) A(p.a.el, [{ opacity: 0 }, { opacity: 0 }], { duration: dur + (delay || 0), fill: 'forwards' });
      if (Math.abs(dx) < 1 && Math.abs(dy) < 1 && Math.abs(s - 1) < 0.02) return;
      p.b.el.style.transformOrigin = '0 0';
      A(p.b.el, [{ translate: dx + 'px ' + dy + 'px', scale: String(s) }, { translate: '0 0', scale: '1' }], { duration: dur, delay: delay || 0, easing: SPRING, fill: 'backwards' });
    });
  }
  function morph(el, old, pairs) {
    if (old) A(old, [{ opacity: 1, scale: '1', filter: 'blur(0)' }, { opacity: 0, scale: '0.985', filter: 'blur(2px)' }], { duration: 300, easing: 'ease-out', fill: 'forwards' });
    A(el, [{ opacity: 0 }, { opacity: 1 }], { duration: 260, easing: 'ease-out', fill: 'backwards' });
    el.style.zIndex = 2;
    // los elementos que viajan quedan por encima de todo mientras se mueven
    fly(pairs, old, 760, 0);
    stagger(el, { delay: 140, dy: 30, header: 0, skip: pairs.map(function (p) { return p.b.el; }) });
  }

  /* la tarjeta crece hasta ser la pantalla */
  function expand(el, old, r) {
    var b = 'inset(' + r[1] + 'px ' + Math.max(0, 393 - r[0] - r[2]) + 'px ' + Math.max(0, 852 - r[1] - r[3]) + 'px ' + r[0] + 'px round 22px)';
    A(el, [{ clipPath: b }, { clipPath: 'inset(0px 0px 0px 0px round 0px)' }], { duration: 680, easing: 'cubic-bezier(.7,0,.2,1)', fill: 'backwards' });
    if (old) A(old, [{ scale: '1', opacity: 1, filter: 'brightness(1)' }, { scale: '0.94', opacity: 0.6, filter: 'brightness(.97)' }], { duration: 680, easing: 'cubic-bezier(.7,0,.2,1)', fill: 'forwards' });
    var pairs = heroes(old, el).filter(function (p) { return p.b.fs >= 18; });
    fly(pairs, old, 820, 40);
    stagger(el, { delay: 300, dy: 22, header: 0, skip: pairs.map(function (p) { return p.b.el; }) });
  }
  function collapse(el, old, r) {
    var b = 'inset(' + r[1] + 'px ' + Math.max(0, 393 - r[0] - r[2]) + 'px ' + Math.max(0, 852 - r[1] - r[3]) + 'px ' + r[0] + 'px round 22px)';
    if (old) {
      old.style.zIndex = 3;
      A(old, [{ clipPath: 'inset(0px 0px 0px 0px round 0px)', opacity: 1 }, { clipPath: b, opacity: 1, offset: 0.82 }, { clipPath: b, opacity: 0 }], { duration: 620, easing: 'cubic-bezier(.7,0,.2,1)', fill: 'forwards' });
    }
    A(el, [{ scale: '0.94', opacity: 0.6 }, { scale: '1', opacity: 1 }], { duration: 620, easing: 'cubic-bezier(.7,0,.2,1)', fill: 'backwards' });
  }

  /* ---------- efectos al tocar ---------- */
  function layer(phone) {
    var l = phone.querySelector('#fxl');
    if (!l) { l = document.createElement('div'); l.id = 'fxl'; phone.appendChild(l); }
    return l;
  }
  function wave(phone, x, y, dark) {
    var l = layer(phone);
    var d = document.createElement('span'); d.className = 'fx-dot' + (dark ? ' dk' : ''); d.style.left = x + 'px'; d.style.top = y + 'px';
    var r = document.createElement('span'); r.className = 'fx-ring' + (dark ? ' dk' : ''); r.style.left = x + 'px'; r.style.top = y + 'px';
    l.appendChild(d); l.appendChild(r);
    setTimeout(function () { d.remove(); r.remove(); }, 800);
  }
  function press(t) {
    var r = t.getBoundingClientRect(), ph = document.getElementById('phone').getBoundingClientRect(), k = ph.width / 393;
    var w = r.width / k, h = r.height / k;
    if (w * h > 70000) return;                      // zonas grandes transparentes (diales): solo onda
    var s = w * h > 15000 ? 0.975 : w < 60 && h < 60 ? 0.88 : 0.95;
    var a1 = t.animate([{ scale: '1' }, { scale: String(s) }], { duration: 110, easing: 'ease-out', fill: 'forwards' });
    a1.finished.then(function () {
      t.animate([{ scale: String(s) }, { scale: '1' }], { duration: 560, easing: SPRING });
      a1.cancel();
    }).catch(function () {});
  }

  function bindTouch(phone, isDark) {
    phone.addEventListener('pointerdown', function (e) {
      var b = phone.getBoundingClientRect(), k = b.width / 393;
      var x = (e.clientX - b.left) / k, y = (e.clientY - b.top) / k;
      var t = e.target.closest && e.target.closest('a, button, [role="button"], input');
      wave(phone, x, y, isDark());
      if (t && t.localName !== 'input' && !reduce) press(t);
    }, true);
    // al pasar el mouse, lo tocable se levanta un poco
    phone.addEventListener('pointerover', function (e) {
      if (e.pointerType !== 'mouse') return;
      var t = e.target.closest && e.target.closest('a, button');
      if (!t || t._lift) return;
      var r = t.getBoundingClientRect(); if (r.width * r.height > 60000) return;
      t._lift = 1; t.style.transition = (t.style.transition ? t.style.transition + ', ' : '') + 'translate .25s ' + EASE; t.style.translate = '0 -1.5px';
      t.addEventListener('pointerleave', function off() { t.style.translate = ''; t._lift = 0; t.removeEventListener('pointerleave', off); });
    });
  }

  window.FX = {
    enter: function (el, old, tr, o) {
      o = o || {};
      if (tr === 'swap') {
        // cambio quieto: la pantalla nueva aparece encima sin moverse
        el.style.zIndex = 2;
        A(el, [{ opacity: 0 }, { opacity: 1 }], { duration: 320, easing: 'ease-out', fill: 'backwards' });
        return;
      }
      if (tr === 'morph') return morph(el, old, o.pairs || heroes(old, el));
      if (tr === 'swipe') {
        if (old) A(old, [{ translate: (o.dx || 0) + 'px 0' }, { translate: '393px 0' }], { duration: 340, easing: 'cubic-bezier(.2,.8,.2,1)', fill: 'forwards' });
        A(el, [{ translate: (-118 + (o.dx || 0) * 0.3) + 'px 0', filter: 'brightness(.94)' }, { translate: '0 0', filter: 'brightness(1)' }], { duration: 340, easing: 'cubic-bezier(.2,.8,.2,1)', fill: 'backwards' });
        if (old) old.style.zIndex = 3;
        return;
      }
      if (tr === 'dismiss') {
        if (old) { old.style.zIndex = 3; A(old, [{ translate: '0 ' + (o.dy || 0) + 'px', scale: String(1 - (o.dy || 0) / 1400), borderRadius: '36px', opacity: 1 }, { translate: '0 ' + ((o.dy || 0) + 260) + 'px', scale: '0.7', borderRadius: '48px', opacity: 0 }], { duration: 420, easing: 'cubic-bezier(.3,.7,.3,1)', fill: 'forwards' }); }
        A(el, [{ scale: '0.94', opacity: 0.5 }, { scale: '1', opacity: 1 }], { duration: 460, easing: SPRING_SOFT, fill: 'backwards' });
        return;
      }
      if (tr === 'expand' && o.rect) return expand(el, old, o.rect);
      if (tr === 'collapse' && o.rect) return collapse(el, old, o.rect);
      if (tr === 'push') return stagger(el, { delay: 120, dy: 18 });
      if (tr === 'fade') return stagger(el, { delay: 40, dy: 30, header: 0 });
      if (tr === 'up') return stagger(el, { delay: 220, dy: 30, header: 0 });
      if (tr === 'reveal') return stagger(el, { delay: 280, dy: 30, header: 0 });
      if (tr === 'menu') return stagger(el, { delay: 120, dy: 34, header: 0 });
      if (tr === 'tab') return stagger(el, { delay: 40, dy: 26, header: 165 });
      if (tr === 'back' || tr === 'down') {
        if (!reduce) A(rootOf(el), [{ scale: '0.97', filter: 'brightness(.97)' }, { scale: '1', filter: 'brightness(1)' }], { duration: 460, easing: EASE, fill: 'backwards' });
      }
    },
    bindTouch: bindTouch, heroes: heroes, SPRING: SPRING
  };
})();
