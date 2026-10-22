/* =====================================================================
   Everly — template behaviour (vanilla JS, zero dependencies)
   ===================================================================== */
(function () {
  'use strict';

  var reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ---- Sticky header ------------------------------------------------ */
  function initHeader() {
    var header = document.getElementById('siteHeader');
    if (!header) return;
    var onScroll = function () {
      header.classList.toggle('is-stuck', window.scrollY > 40);
    };
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
  }

  /* ---- Mobile navigation -------------------------------------------- */
  function initMobileNav() {
    var toggle = document.getElementById('navToggle');
    var menu = document.getElementById('navMenu');
    var backdrop = document.getElementById('navBackdrop');
    if (!toggle || !menu) return;

    var open = function (state) {
      menu.classList.toggle('open', state);
      toggle.setAttribute('aria-expanded', state ? 'true' : 'false');
      toggle.setAttribute('aria-label', state ? 'Cerrar menú' : 'Abrir menú');
      if (backdrop) {
        backdrop.hidden = false;
        backdrop.classList.toggle('show', state);
      }
      document.body.style.overflow = state ? 'hidden' : '';
    };

    toggle.addEventListener('click', function () {
      open(!menu.classList.contains('open'));
    });
    if (backdrop) backdrop.addEventListener('click', function () { open(false); });
    menu.addEventListener('click', function (e) {
      if (e.target.closest('a')) open(false);
    });
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && menu.classList.contains('open')) open(false);
    });
    window.addEventListener('resize', function () {
      if (window.innerWidth > 767 && menu.classList.contains('open')) open(false);
    });
  }

  /* ---- Countdown ---------------------------------------------------- */
  function initCountdown() {
    var box = document.getElementById('countdown');
    if (!box) return;
    var target = new Date(box.getAttribute('data-date')).getTime();
    if (isNaN(target)) return;

    var els = {
      days: document.getElementById('cd-days'),
      hours: document.getElementById('cd-hours'),
      mins: document.getElementById('cd-mins'),
      secs: document.getElementById('cd-secs'),
      chip: document.getElementById('chipDays')
    };
    var pad = function (n) { return (n < 10 ? '0' : '') + n; };

    var tick = function () {
      var diff = target - Date.now();
      if (diff < 0) diff = 0;
      var d = Math.floor(diff / 86400000);
      var h = Math.floor((diff % 86400000) / 3600000);
      var m = Math.floor((diff % 3600000) / 60000);
      var s = Math.floor((diff % 60000) / 1000);
      if (els.days) els.days.textContent = d;
      if (els.hours) els.hours.textContent = pad(h);
      if (els.mins) els.mins.textContent = pad(m);
      if (els.secs) els.secs.textContent = pad(s);
      if (els.chip) els.chip.textContent = d;
    };
    tick();
    setInterval(tick, 1000);
  }

  /* ---- Scroll-spy active nav link ----------------------------------- */
  function initScrollSpy() {
    var links = Array.prototype.slice.call(document.querySelectorAll('.nav-menu a[href^="#"]'));
    if (!links.length || !('IntersectionObserver' in window)) return;
    var map = {};
    var sections = [];
    links.forEach(function (link) {
      var id = link.getAttribute('href').slice(1);
      var sec = document.getElementById(id);
      if (sec) { map[id] = link; sections.push(sec); }
    });

    var obs = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) {
          links.forEach(function (l) { l.classList.remove('active'); });
          var active = map[entry.target.id];
          if (active) active.classList.add('active');
        }
      });
    }, { rootMargin: '-45% 0px -50% 0px', threshold: 0 });

    sections.forEach(function (s) { obs.observe(s); });
  }

  /* ---- Reveal on scroll --------------------------------------------- */
  function initReveal() {
    var items = Array.prototype.slice.call(document.querySelectorAll('.reveal'));
    if (!items.length) return;
    if (reduceMotion || !('IntersectionObserver' in window)) {
      items.forEach(function (el) { el.classList.add('in'); });
      return;
    }
    var obs = new IntersectionObserver(function (entries, observer) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) {
          entry.target.classList.add('in');
          observer.unobserve(entry.target);
        }
      });
    }, { rootMargin: '0px 0px -8% 0px', threshold: 0.08 });
    items.forEach(function (el) { obs.observe(el); });
  }

  /* ---- RSVP form → Google Sheets ------------------------------------ */
  function initRsvp() {
    var form = document.getElementById('rsvpForm');
    var success = document.getElementById('rsvpSuccess');
    if (!form || !success) return;

    // ======================== CONFIGURACIÓN ========================
    // Pega aquí la URL de tu Google Apps Script desplegado.
    // Ejemplo: 'https://script.google.com/macros/s/AKfycxxxxxxx/exec'
    var SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbyjBubUkTONbwH_j_k0gGGdIRSCu9FOdP8MlQGXd8v4Ftohdt5_jHWdSy7s6_4BfT6g/exec';
    // =================================================================

    // Pases de la invitación: ya NO viajan en la URL. El link lleva el código
    // del invitado (?i=abc12345) y los pases se piden a la hoja de Google
    // (pestaña "Invitados"). Así los cambiás en la hoja y el link ya entregado
    // muestra el número nuevo, y nadie puede retipear el número en la barra.
    var codigoInvitado = (new URLSearchParams(window.location.search).get('i') || '').trim();
    var pasesAsignados = 0;

    // Los pases se muestran en la sección "Boletos Asignados" (id="boletos"),
    // que es una página propia antes del RSVP.
    var seccionBoletos = document.getElementById('boletos');
    var numeroBoletos  = document.getElementById('boletosNumero');

    function mostrarBoletos(cantidad) {
      if (!seccionBoletos || cantidad < 1) return;
      if (numeroBoletos) {
        numeroBoletos.textContent = cantidad + (cantidad === 1 ? ' Boleto' : ' Boletos');
      }
      seccionBoletos.hidden = false;
    }

    // Pide los pases de un invitado. Va con etiqueta <script> (JSONP) a
    // propósito: Apps Script no manda cabeceras CORS, así que un fetch()
    // normal no puede leer la respuesta.
    function pedirInvitado(codigo, cb) {
      var nombreCb = 'boletos_' + Date.now() + '_' + Math.floor(Math.random() * 1000);
      var terminado = false;
      var etiqueta = document.createElement('script');

      function terminar(datos) {
        if (terminado) return;
        terminado = true;
        try { delete window[nombreCb]; } catch (err) { window[nombreCb] = undefined; }
        if (etiqueta.parentNode) etiqueta.parentNode.removeChild(etiqueta);
        cb(datos);
      }

      window[nombreCb] = function (datos) { terminar(datos || null); };
      etiqueta.onerror = function () { terminar(null); };
      etiqueta.src = SCRIPT_URL + '?i=' + encodeURIComponent(codigo) +
        '&callback=' + nombreCb + '&t=' + Date.now();
      document.head.appendChild(etiqueta);
      setTimeout(function () { terminar(null); }, 8000);
    }

    // Atajo de vista previa para revisar el diseño en local: con #boletos al
    // final de la URL (ej. invitacion.html#boletos) se muestra un ejemplo.
    // Ojo: NO toca `pasesAsignados`, así que el formulario sigue mandando el
    // valor real de la hoja (y vacío si no hay ninguno).
    if (window.location.hash === '#boletos') mostrarBoletos(2);

    if (codigoInvitado) {
      var intentos = 0;
      (function pedir() {
        intentos++;
        pedirInvitado(codigoInvitado, function (datos) {
          if (datos && datos.ok && datos.p > 0) {
            pasesAsignados = datos.p;
            mostrarBoletos(datos.p);
          } else if (intentos < 2) {
            setTimeout(pedir, 2500); // un reintento: las redes móviles fallan
          }
        });
      })();
    }

    // La línea de cupo dentro del formulario (#rsvpCupo) quedó oculta para no
    // decir lo mismo dos veces en la misma página. Sigue en el HTML: para
    // volver a usarla, sacarle el atributo hidden y descomentar esto.
    //
    //   var cupo = document.getElementById('rsvpCupo');
    //   if (cupo && pasesAsignados > 0) {
    //     cupo.textContent = 'Esta invitación es válida para ' + pasesAsignados + (pasesAsignados === 1 ? ' persona' : ' personas');
    //     cupo.hidden = false;
    //   }

    form.addEventListener('submit', function (e) {
      e.preventDefault();
      if (!form.checkValidity()) {
        form.reportValidity();
        return;
      }

      var attending = form.querySelector('input[name="attending"]:checked');
      var formData = {
        name:      document.getElementById('rsvp-name').value.trim(),
        email:     document.getElementById('rsvp-email').value.trim(),
        attending: attending ? attending.value : '',
        song:      document.getElementById('rsvp-song').value.trim(),
        note:      document.getElementById('rsvp-note').value.trim(),
        // El Apps Script ya mapea datos.menu a su propia columna (línea 49 de
        // google-apps-script.js). Se usa ese nombre de campo para que la
        // restricción alimentaria caiga en su columna y no en el mensaje.
        menu:      document.getElementById('rsvp-food').value.trim(),
        pases:     pasesAsignados > 0 ? pasesAsignados : ''
      };

      var btn = form.querySelector('button[type="submit"]');
      var origText = btn.textContent;
      btn.disabled = true;
      btn.textContent = 'Enviando...';

      if (SCRIPT_URL === 'PEGA_TU_URL_AQUI') {
        console.warn('[RSVP] No se configuró la URL de Apps Script. Los datos NO se guardan.');
        showSuccess(formData.attending === 'no');
        btn.disabled = false;
        btn.textContent = origText;
        return;
      }

      // OJO con el contrato de datos: el Apps Script hace
      // JSON.parse(e.postData.contents), así que el cuerpo TIENE que ser JSON.
      // Cambiarlo a formulario rompe doPost entero.
      // El problema real es otro: fetch con mode:'no-cors' devuelve una
      // respuesta OPACA — el status NO es legible desde acá. Por eso este bloque
      // tampoco puede afirmar que se guardó. Lo que sí hace ahora es verificar
      // que el pedido salió, y no mostrar el agradecimiento si falló.
      fetch(SCRIPT_URL, {
        method: 'POST',
        mode: 'no-cors',
        headers: { 'Content-Type': 'text/plain;charset=UTF-8' },
        body: JSON.stringify(formData)
      }).then(function () {
        // Con no-cors la promesa resuelve cuando el pedido SALE, no cuando el
        // servidor confirma. Si llegó hasta acá, no hubo error de red.
        showSuccess(formData.attending === 'no');
      }).catch(function (err) {
        console.error('[RSVP] Error:', err);
        btn.disabled = false;
        btn.textContent = origText;
        alert('Hubo un error al enviar. Por favor intenta de nuevo.');
      });
    });

    function showSuccess(declined) {
      if (declined) {
        success.innerHTML = 'Gracias por avisarnos. Te extrañaremos. &#127870;';
      }
      form.style.display = 'none';
      success.classList.add('show');
      success.scrollIntoView({ behavior: reduceMotion ? 'auto' : 'smooth', block: 'center' });
    }
  }

  /* ---- Music toggle -------------------------------------------------- */
  function initMusic() {
    var btn = document.getElementById('musicToggle');
    var audio = document.getElementById('weddingMusic');
    if (!btn || !audio) return;

    var playing = false;
    var FADE_IN_MS = 15000;
    var TARGET_VOL = 0.9;
    var fadeTimer = null;

    // Reproducir con fade-in (volumen de menos a más)
    function playMusic() {
      if (fadeTimer) clearInterval(fadeTimer);
      audio.volume = 0;
      audio.play().then(function () {
        playing = true;
        var step = 0;
        fadeTimer = setInterval(function () {
          step += 1;
          audio.volume = Math.min(step / 100 * TARGET_VOL, TARGET_VOL);
          if (step >= 100) clearInterval(fadeTimer);
        }, FADE_IN_MS / 100);
      }).catch(function () {});
    }

    // Botón play/pause manual
    btn.addEventListener('click', function (e) {
      e.stopPropagation();
      if (playing) {
        if (fadeTimer) clearInterval(fadeTimer);
        audio.pause();
      } else {
        playMusic();
      }
    });

    audio.addEventListener('play', function () {
      playing = true;
      btn.classList.add('is-playing');
      btn.setAttribute('aria-pressed', 'true');
      btn.setAttribute('aria-label', 'Pausar música');
    });

    audio.addEventListener('pause', function () {
      playing = false;
      btn.classList.remove('is-playing');
      btn.setAttribute('aria-pressed', 'false');
      btn.setAttribute('aria-label', 'Activar música');
    });
  }

  /* ---- Bank modal ---------------------------------------------------- */
  function initBankModal() {
    var modal = document.getElementById('bankModal');
    var closeBtn = document.getElementById('bankModalClose');
    if (!modal) return;

    // Abrir modal
    var bankBtns = document.querySelectorAll('.registry-bank-btn');
    bankBtns.forEach(function (btn) {
      btn.addEventListener('click', function () {
        document.getElementById('bankBank').textContent = btn.getAttribute('data-bank');
        document.getElementById('bankAccount').textContent = btn.getAttribute('data-account');
        document.getElementById('bankAccount').setAttribute('data-val', btn.getAttribute('data-account'));
        document.getElementById('bankClabe').textContent = btn.getAttribute('data-clabe');
        document.getElementById('bankClabe').setAttribute('data-val', btn.getAttribute('data-clabe'));
        document.getElementById('bankName').textContent = btn.getAttribute('data-name');
        modal.classList.add('is-open');
        document.body.style.overflow = 'hidden';
      });
    });

    // Cerrar modal
    function closeModal() {
      modal.classList.remove('is-open');
      document.body.style.overflow = '';
    }
    if (closeBtn) closeBtn.addEventListener('click', closeModal);
    modal.addEventListener('click', function (e) {
      if (e.target === modal) closeModal();
    });
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && modal.classList.contains('is-open')) closeModal();
    });

    // Copiar al portapapeles
    var copyEls = modal.querySelectorAll('[data-copy]');
    copyEls.forEach(function (el) {
      el.addEventListener('click', function () {
        var val = el.getAttribute('data-val') || el.textContent;
        navigator.clipboard.writeText(val).then(function () {
          el.classList.add('copied');
          var original = el.textContent;
          el.textContent = '¡Copiado!';
          setTimeout(function () {
            el.textContent = original;
            el.classList.remove('copied');
          }, 1500);
        }).catch(function () {});
      });
    });
  }

  /* ---- Magic dust sparkles ------------------------------------------- */
  function initSparkles() {
    if (reduceMotion) return;
    var wrap = document.createElement('div');
    wrap.setAttribute('aria-hidden', 'true');
    document.body.appendChild(wrap);

    var palette = ['#D6C3A3', '#A67C38', '#F3EADC', '#F7EADD', '#FFFDF9'];
    var maxOnScreen = 55;

    function spawn(x, y, size, dur) {
      if (wrap.childElementCount >= maxOnScreen) wrap.firstElementChild.remove();
      var p = document.createElement('i');
      p.className = 'sparkle';
      p.style.left = x + 'px';
      p.style.top = y + 'px';
      p.style.width = size + 'px';
      p.style.height = size + 'px';
      p.style.background = palette[Math.floor(Math.random() * palette.length)];
      p.style.setProperty('--drift', (Math.random() * 70 - 35).toFixed(0) + 'px');
      p.style.setProperty('--dur', dur + 's');
      wrap.appendChild(p);
      p.addEventListener('animationend', function () { p.remove(); });
    }

    var lastMove = 0;
    window.addEventListener('pointermove', function (e) {
      var now = Date.now();
      if (now - lastMove < 40) return;
      lastMove = now;
      if (Math.random() < 0.55) {
        spawn(e.clientX, e.clientY, 5 + Math.random() * 6, 0.8 + Math.random() * 0.7);
      }
    }, { passive: true });

    window.addEventListener('pointerdown', function (e) {
      for (var i = 0; i < 12; i++) {
        setTimeout(function () {
          spawn(
            e.clientX + (Math.random() * 110 - 55),
            e.clientY + (Math.random() * 110 - 55),
            5 + Math.random() * 8,
            0.9 + Math.random() * 0.8
          );
        }, i * 35);
      }
    }, { passive: true });
  }

  /* ---- Boot --------------------------------------------------------- */
  function boot() {
    initHeader();
    initMobileNav();
    initCountdown();
    initScrollSpy();
    initReveal();
    initRsvp();
    initMusic();
    initBankModal();
    initSparkles();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})();
