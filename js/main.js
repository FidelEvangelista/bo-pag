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
    var SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbymks9Pa7FIxPy2wRFYJdNyhqUvoi_OLlGmfql2W-efU3GkPWVdlRYog5pHiLd0477_/exec';
    // =================================================================

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
        guests:    document.getElementById('rsvp-guests').value,
        meal:      document.getElementById('rsvp-meal').value,
        song:      document.getElementById('rsvp-song').value.trim(),
        note:      document.getElementById('rsvp-note').value.trim()
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

      fetch(SCRIPT_URL, {
        method: 'POST',
        mode: 'no-cors',
        body: JSON.stringify(formData)
      }).then(function () {
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
    var overlay = document.getElementById('welcomeOverlay');
    var welcomeBtn = document.getElementById('welcomeBtn');
    if (!btn || !audio) return;

    var playing = false;

    function playMusic() {
      audio.play().then(function () {
        playing = true;
      }).catch(function () {});
    }

    // Clic en "Entrar" del overlay → música + ocultar overlay
    if (welcomeBtn && overlay) {
      document.body.style.overflow = 'hidden';
      welcomeBtn.addEventListener('click', function () {
        playMusic();
        overlay.classList.add('is-hidden');
        document.body.style.overflow = '';
      });
    }

    // Botón play/pause manual
    btn.addEventListener('click', function (e) {
      e.stopPropagation();
      if (playing) {
        audio.pause();
      } else {
        audio.play().then(function () {
          playing = true;
        }).catch(function () {});
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
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})();
