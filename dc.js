/* Runtime de pantallas .dc.html: plantilla {{ }} + <sc-for>/<sc-if>, clase Component con
   state / setState / renderVals, re-render con morphdom y eventos delegados. */
(function () {
  'use strict';
  var EVTS = ['click', 'pointerdown', 'pointermove', 'pointerup', 'pointercancel', 'input', 'change', 'keydown', 'focusin', 'focusout'];

  window.mountDC = function (src, host, opts) {
    opts = opts || {};
    var doc = new DOMParser().parseFromString(src, 'text/html');
    var xdc = doc.querySelector('x-dc');
    var helmet = xdc.querySelector('helmet'), css = '';
    if (helmet) { helmet.querySelectorAll('style').forEach(function (s) { css += s.textContent; }); helmet.remove(); }
    var style = document.createElement('style');
    style.textContent = css.replace(/(^|\})\s*body\s*\{[^}]*\}/g, '$1');
    host.appendChild(style);
    var tpl = xdc.querySelector(':scope > div');
    var code = doc.querySelector('script[data-dc-script]').textContent;
    var inst, scheduled = false, handlers = [], root = null, dead = false;

    function DCLogic(props) { this.props = props || {}; this.state = {}; }
    DCLogic.prototype.setState = function (o) { if (dead) return; Object.assign(this.state, typeof o === 'function' ? o(this.state) : o); schedule(); };
    DCLogic.prototype.forceUpdate = function () { schedule(); };

    function schedule() { if (scheduled || dead) return; scheduled = true; Promise.resolve().then(function () { scheduled = false; if (!dead) render(); }); }
    function resolve(p, scope) {
      p = p.trim();
      if (p === 'true') return true; if (p === 'false') return false;
      if (/^-?\d+(\.\d+)?$/.test(p)) return Number(p);
      return p.split('.').reduce(function (o, k) { return o == null ? undefined : o[k]; }, scope);
    }
    function interp(s, scope) { return s.replace(/\{\{([^}]+)\}\}/g, function (_, p) { var v = resolve(p, scope); return v == null ? '' : String(v); }); }
    var whole = /^\s*\{\{([^}]+)\}\}\s*$/;
    function proc(node, scope) {
      if (node.nodeType === 3) { if (node.nodeValue.indexOf('{{') >= 0) node.nodeValue = interp(node.nodeValue, scope); return; }
      if (node.nodeType !== 1) return;
      var tag = node.localName, frag, m;
      if (tag === 'sc-for') {
        var list = resolve(whole.exec(node.getAttribute('list'))[1], scope) || [];
        var as = node.getAttribute('as');
        frag = node.ownerDocument.createDocumentFragment();
        list.forEach(function (item, i) {
          var sc = Object.assign({}, scope); sc[as] = item; sc.$index = i;
          Array.prototype.slice.call(node.childNodes).forEach(function (c) { var cl = c.cloneNode(true); frag.appendChild(cl); proc(cl, sc); });
        });
        node.replaceWith(frag); return;
      }
      if (tag === 'sc-if') {
        var v = resolve(whole.exec(node.getAttribute('value'))[1], scope);
        frag = node.ownerDocument.createDocumentFragment();
        if (v) Array.prototype.slice.call(node.childNodes).forEach(function (c) { frag.appendChild(c); proc(c, scope); });
        node.replaceWith(frag); return;
      }
      Array.prototype.slice.call(node.attributes).forEach(function (a) {
        if (a.name.indexOf('hint-') === 0) { node.removeAttribute(a.name); return; }
        if (/^on/i.test(a.name)) {
          m = whole.exec(a.value); node.removeAttribute(a.name);
          if (m) { var fn = resolve(m[1], scope); if (typeof fn === 'function') { handlers.push(fn); node.setAttribute('data-h-' + a.name.slice(2).toLowerCase(), String(handlers.length - 1)); } }
          return;
        }
        if (a.value.indexOf('{{') < 0) return;
        m = whole.exec(a.value);
        if (m) {
          var val = resolve(m[1], scope);
          if (val == null || typeof val === 'function' || typeof val === 'object' || val === false) node.removeAttribute(a.name);
          else node.setAttribute(a.name, String(val));
        } else node.setAttribute(a.name, interp(a.value, scope));
      });
      Array.prototype.slice.call(node.childNodes).forEach(function (c) { proc(c, scope); });
    }
    function build() {
      handlers = [];
      var vals = inst.renderVals();
      var el = document.importNode(tpl, true);
      var wrap = document.createElement('div'); wrap.appendChild(el);
      proc(el, vals);
      return el;
    }
    function render() {
      var next = build();
      if (!root) { root = next; host.appendChild(root); return; }
      window.morphdom(root, next, {
        onBeforeElUpdated: function (from, to) {
          if (from === document.activeElement && (from.localName === 'input' || from.localName === 'textarea')) {
            // no pisar lo que la persona está escribiendo
            Array.prototype.slice.call(to.attributes).forEach(function (a) { if (a.name !== 'value') from.setAttribute(a.name, a.value); });
            return false;
          }
          return !from.isEqualNode(to);
        }
      });
    }
    var Component = new Function('DCLogic', code + '\n;return Component;')(DCLogic);
    inst = new Component(opts.props || {});
    inst.props = opts.props || {};
    render();
    var listeners = EVTS.map(function (t) {
      var fn = function (e) {
        var el = e.target;
        while (el && el !== host) {
          if (el.nodeType === 1 && el.hasAttribute('data-h-' + t)) {
            var h = handlers[+el.getAttribute('data-h-' + t)];
            if (h) {
              var cur = el;
              var proxy = new Proxy(e, { get: function (tg, p) { if (p === 'currentTarget') return cur; var v = tg[p]; return typeof v === 'function' ? v.bind(tg) : v; } });
              h(proxy);
            }
            return;
          }
          if (t === 'click' && el.localName === 'a' && el.getAttribute('href')) {
            e.preventDefault();
            if (opts.onNav) opts.onNav(el.getAttribute('href'), el, e);
            return;
          }
          el = el.parentNode;
        }
      };
      host.addEventListener(t, fn);
      return [t, fn];
    });
    if (inst.componentDidMount) { try { inst.componentDidMount(); } catch (err) { console.error(err); } }
    return {
      inst: inst,
      destroy: function () {
        dead = true;
        listeners.forEach(function (l) { host.removeEventListener(l[0], l[1]); });
        try { if (inst.componentWillUnmount) inst.componentWillUnmount(); } catch (err) {}
      }
    };
  };
})();
