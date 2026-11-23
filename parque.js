/* Fuera de campo — el parque de verdad.
   Usa la ubicación del celular: cuando cruzás las rejas del Parque Centenario abre "llegaste",
   y si estabas fuera de campo y salís del parque, abre "volviste".
   El botón "Afuera del parque" de la home sigue sirviendo para probarlo desde cualquier lado. */
(function () {
  'use strict';
  var PARQUE = { lat: -34.60635, lng: -58.43565, r: 290 };   // centro y radio aproximado de las rejas (m)
  var MARGEN = 25;                                            // para que no salte justo en el borde
  var A = window.FDC; if (!A) return;
  var adentro = null, watch = null;

  function dist(a, b, c, d) {
    var R = 6371000, t = Math.PI / 180, x = (d - b) * t * Math.cos((a + c) / 2 * t), y = (c - a) * t;
    return Math.sqrt(x * x + y * y) * R;
  }
  function avisar(titulo, cuerpo) {
    if (document.visibilityState === 'visible') return;
    try {
      if ('Notification' in window && Notification.permission === 'granted' && navigator.serviceWorker) {
        navigator.serviceWorker.ready.then(function (r) { r.showNotification(titulo, { body: cuerpo, icon: 'icon-192.png', badge: 'icon-192.png', vibrate: [30, 60, 30], tag: 'fdc' }); });
      }
    } catch (e) {}
  }
  function enParque(p) {
    var d = dist(p.coords.latitude, p.coords.longitude, PARQUE.lat, PARQUE.lng);
    var ahora = adentro === null ? d < PARQUE.r : (adentro ? d < PARQUE.r + MARGEN : d < PARQUE.r - MARGEN);
    if (ahora === adentro) return;
    var antes = adentro; adentro = ahora;
    try { localStorage.setItem('fdc2.adentro', JSON.stringify(ahora)); } catch (e) {}
    if (antes === null && !ahora) return;
    var cur = A.current();
    if (ahora) {
      if (['fuera', 'llegaste', 'zonas', 'volviste', 'mientras', 'esperado', 'sentiste', 'comofue', 'onboarding', 'cuenta', 'ubicacion', 'avisos', 'listo'].indexOf(cur) >= 0) return;
      A.S.entry = Date.now(); A.vib([30, 60, 30]);
      A.go('llegaste', 'fade');
      avisar('llegaste al parque', '¿ya sabés qué hacer? Guardá el celular cuando quieras.');
    } else if (cur === 'fuera') {
      A.S.end = Date.now(); A.vib([200, 120, 200]);
      A.go('volviste', 'fade', {}, true);
      avisar('volviste', 'Mirá lo que pasó mientras no mirabas.');
    }
  }
  function empezar() {
    if (watch !== null || !navigator.geolocation) return;
    watch = navigator.geolocation.watchPosition(enParque, function () {}, { enableHighAccuracy: true, maximumAge: 15000, timeout: 30000 });
  }
  function pedirAvisos() { try { if ('Notification' in window && Notification.permission === 'default') Notification.requestPermission(); } catch (e) {} }

  // si ya dio permiso de ubicación, arrancar solo; si no, esperar a que lo dé en la pantalla de ubicación
  var ok = false; try { ok = JSON.parse(localStorage.getItem('fdc2.location')) === true; } catch (e) {}
  if (ok) empezar();
  if (navigator.permissions && navigator.permissions.query) {
    navigator.permissions.query({ name: 'geolocation' }).then(function (st) {
      if (st.state === 'granted') empezar();
      st.onchange = function () { if (st.state === 'granted') { empezar(); pedirAvisos(); } };
    }).catch(function () {});
  }
  document.addEventListener('click', function (e) {
    var b = e.target.closest && e.target.closest('.ub-a'); if (b) { setTimeout(function () { empezar(); pedirAvisos(); }, 600); }
  }, true);
  document.addEventListener('visibilitychange', function () { if (document.visibilityState === 'visible' && watch === null && ok) empezar(); });

  // la barra del celular acompaña las pantallas oscuras
  var meta = document.querySelector('meta[name="theme-color"]'), ph = document.getElementById('phone');
  new MutationObserver(function () { meta.setAttribute('content', ph.classList.contains('sb-dark') ? '#222222' : '#FFFFFF'); }).observe(ph, { attributes: true, attributeFilter: ['class'] });
})();
