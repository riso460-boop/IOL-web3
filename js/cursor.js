(function () {
  'use strict';

  var w = window, d = document;
  if (w.matchMedia('(prefers-reduced-motion: reduce)').matches || !w.matchMedia('(pointer: fine)').matches) {
    return;
  }

  // =====================================================================
  // HLAVNÉ NASTAVENIA EFEKTU L-iek
  // =====================================================================
  var NASTAVENIA = {
    // --- 1. MNOŽSTVO A HUSTOTA ---
    krokPohybu: 250,          // Nové L-ko sa vytvorí po prekonaní tohto počtu pixelov (menej = hustejšie)

    // --- 2. VZDIALENOSŤ OD KURZORA ---
    vzdialenostMin: 5,        // Najmenšia vzdialenosť od stredu myši (px)
    vzdialenostMax: 350,      // Najväčšia vzdialenosť od stredu myši (px)

    // --- 3. VEĽKOSŤ L-IEK ---
    velkostMin: 50,           // Najmenšia povolená veľkosť L-ka (px)
    velkostMax: 76,           // Najväčšia povolená veľkosť L-ka (px)

    // --- 4. RÝCHLOSŤ A DOLET ---
    rychlostMin: 17,          // Minimálna rýchlosť vznášania / doletu
    rychlostMax: 68,          // Maximálna rýchlosť vznášania / doletu

    // --- 5. PRIEHĽADNOSŤ (OPACITY) ---
    priehladnostZaciatocna: 0.1,  // Ako silno svietia na začiatku (0.0 = neviditeľné, 1.0 = plná farba)
    priehladnostKonecna: 0.0,     // Priehľadnosť na konci (typicky 0, aby plynule zmizli)

    // --- 6. DĹŽKA ŽIVOTA (MIZNUTIE) ---
    casMiznutiaMs: 5000,      // Za koľko milisekúnd L-ko zmizne (1000 = 1 sekunda)

    // --- 7. NAD FOTOGRAFIOU ---
    // Na hero s fotografiou by sa farebné L-ká stratili, preto sa
    // prepnú na bielu a zosilnia. Jemný tieň ich oddelí od fotky
    // bez toho, aby ju prekryli.
    farbaNaFotke: '#ffffff',
    priehladnostNaFotke: 0.34,
    tienNaFotke: true,

    // --- 8. OHRANIČENIE ---
    // L-ká žijú výhradne vnútri úvodnej hlavičky a nemôžu z nej
    // vyletieť do textu pod ňou.
    okrajZdola: 110,          // Koľko px nad spodkom hlavičky sa už negenerujú
    okrajZdolaPas: 24,        // To isté pre nižšie fotografické pásy uprostred stránky

    // --- 9. EXTRA: ROTÁCIA ---
    nahodnaRotacia: false,    // Zmeň na "true", ak chceš aby lietali kadejako otočené
    maxNatocenie: 180         // O koľko stupňov max sa môžu vychýliť
  };
  // =====================================================================

  // L-ká lietajú nad každou plochou s fotografiou cez celú šírku
  // stránky — nad hero aj nad medzipásmi. Obrázky v referenciách,
  // galérii či na kartách sa ich netýkajú.
  var hlavicka = d.querySelector('.hero');
  var plochy = [].slice.call(d.querySelectorAll('.has-foto'));
  if (!plochy.length && hlavicka) { plochy = [hlavicka]; }
  if (!plochy.length) { return; }

  var naFotke = plochy[0].classList.contains('has-foto');

  // Zistenie farieb podľa témy stránky
  var theme = d.documentElement.getAttribute('data-theme') || 'holding';
  var colors;

  if (naFotke) {
    colors = [NASTAVENIA.farbaNaFotke];
  } else if (theme === 'tele') {
    colors = ['#0b6ddd'];
  } else if (theme === 'energy') {
    colors = ['#07935a'];
  } else if (theme === 'build') {
    colors = ['#e0431c'];
  } else {
    colors = ['#0b6ddd', '#07935a', '#e0431c'];
  }

  var priehladnost = naFotke
    ? NASTAVENIA.priehladnostNaFotke
    : NASTAVENIA.priehladnostZaciatocna;

  // Vytvorenie CSS štýlu priamo v JS
  var style = d.createElement('style');
  style.innerHTML =
    '.iol-cursor-vrstva {' +
    '  position: absolute;' +
    '  inset: 0;' +
    '  z-index: 0;' +          /* nad fotografiou, pod textom hlavičky */
    '  overflow: hidden;' +    /* L-ká nemôžu vyletieť pod hlavičku */
    '  pointer-events: none;' +
    '}' +
    '.iol-cursor-particle {' +
    '  position: absolute;' +
    '  pointer-events: none;' +
    '  transform: translate(-50%, -50%);' +
    '  animation: iol-float-particle var(--anim-time) cubic-bezier(0.2, 0.9, 0.4, 1) forwards;' +
    '}' +
    '.iol-cursor-particle.na-fotke {' +
    '  filter: drop-shadow(0 2px 10px rgba(8, 16, 24, .45));' +
    '}' +
    '@keyframes iol-float-particle {' +
    '  0% {' +
    '    transform: translate(-50%, -50%) scale(1);' +
    '    opacity: var(--start-opacity);' +
    '  }' +
    '  100% {' +
    '    transform: translate(calc(-50% + var(--tx)), calc(-50% + var(--ty))) scale(0.3);' +
    '    opacity: var(--end-opacity);' +
    '  }' +
    '}';
  d.head.appendChild(style);

  // Každá plocha má vlastnú vrstvu vnútri seba — posúva sa s ňou pri
  // scrollovaní a jej overflow: hidden udrží L-ká v jej hraniciach.
  var zony = plochy.map(function (el) {
    var vrstva = d.createElement('div');
    vrstva.className = 'iol-cursor-vrstva';
    el.appendChild(vrstva);
    return {
      prvok: el,
      vrstva: vrstva,
      jeHero: el.classList.contains('hero'),
      poslednyX: null,
      poslednyY: null
    };
  });

  var vrstvy = d.querySelectorAll('.hero-art g');
  var rAF_waiting = false;
  var mx = 0, my = 0;

  function kresliParalax() {
    rAF_waiting = false;
    var plocha = d.querySelector('.hero-art');
    if (plocha && vrstvy.length) {
      var pr = plocha.getBoundingClientRect();
      var vidno = pr.bottom > 0 && pr.top < w.innerHeight;
      var px = (mx - pr.left) / pr.width - 0.5;
      var py = (my - pr.top) / pr.height - 0.5;
      [].forEach.call(vrstvy, function (g) {
        var hlbka = parseFloat(g.getAttribute('data-depth')) || 1;
        g.style.transform = vidno
          ? 'translate(' + (px * hlbka * -30).toFixed(1) + 'px,' + (py * hlbka * -20).toFixed(1) + 'px)'
          : 'translate(0,0)';
      });
    }
  }

  function medzi(hodnota, min, max) {
    return Math.max(min, Math.min(max, hodnota));
  }

  function spawnParticle(vrstva, baseX, baseY, sirka, vyska, okraj) {
    var p = d.createElement('div');
    var color = colors[Math.floor(Math.random() * colors.length)];
    var maleVelkost = Math.min(NASTAVENIA.velkostMin, NASTAVENIA.velkostMax);
    var velkeVelkost = Math.max(NASTAVENIA.velkostMin, NASTAVENIA.velkostMax);
    var size = Math.floor(Math.random() * (velkeVelkost - maleVelkost + 1)) + maleVelkost;

    var spawnAngle = Math.random() * Math.PI * 2;
    var spawnRadius = Math.random() * (NASTAVENIA.vzdialenostMax - NASTAVENIA.vzdialenostMin) + NASTAVENIA.vzdialenostMin;

    // Držíme L-ká vnútri hlavičky, aby nezasahovali do textu pod ňou
    var startX = medzi(baseX + Math.cos(spawnAngle) * spawnRadius, size * 0.5, sirka - size * 0.5);
    var startY = medzi(baseY + Math.sin(spawnAngle) * spawnRadius,
                       size * 0.5, Math.max(size * 0.5, vyska - okraj));

    p.className = 'iol-cursor-particle' + (naFotke && NASTAVENIA.tienNaFotke ? ' na-fotke' : '');
    p.style.color = color;
    p.style.width = size + 'px';
    p.style.height = size + 'px';
    p.style.left = startX + 'px';
    p.style.top = startY + 'px';

    var rotStyle = '';
    if (NASTAVENIA.nahodnaRotacia) {
      var uhol = (Math.random() - 0.5) * 2 * NASTAVENIA.maxNatocenie;
      rotStyle = ' style="transform: rotate(' + uhol + 'deg); transform-origin: center;"';
    }

    p.innerHTML = '<svg viewBox="0 0 29 29" width="100%" height="100%"' + rotStyle + '><rect x="0" y="0" width="13" height="13" rx="2.6" fill="currentColor"/><rect x="0" y="16" width="13" height="13" rx="2.6" fill="currentColor"/><rect x="16" y="16" width="13" height="13" rx="2.6" fill="currentColor"/></svg>';

    var flightAngle = Math.random() * Math.PI * 2;
    var velocity = Math.random() * (NASTAVENIA.rychlostMax - NASTAVENIA.rychlostMin) + NASTAVENIA.rychlostMin;

    // Posielanie premenných do CSS animácie
    p.style.setProperty('--tx', (Math.cos(flightAngle) * velocity) + 'px');
    p.style.setProperty('--ty', (Math.sin(flightAngle) * velocity) + 'px');
    p.style.setProperty('--anim-time', NASTAVENIA.casMiznutiaMs + 'ms');
    p.style.setProperty('--start-opacity', priehladnost);
    p.style.setProperty('--end-opacity', NASTAVENIA.priehladnostKonecna);

    vrstva.appendChild(p);

    setTimeout(function () {
      if (p.parentNode) { p.parentNode.removeChild(p); }
    }, NASTAVENIA.casMiznutiaMs);
  }

  w.addEventListener('pointermove', function (e) {
    mx = e.clientX;
    my = e.clientY;

    if (vrstvy.length && !rAF_waiting) {
      rAF_waiting = true;
      requestAnimationFrame(kresliParalax);
    }

    zony.forEach(function (z) {
      var rect = z.prvok.getBoundingClientRect();
      var okraj = z.jeHero ? NASTAVENIA.okrajZdola : NASTAVENIA.okrajZdolaPas;

      // Mimo plochy (alebo v jej spodnom páse) sa negeneruje nič
      if (my > rect.bottom - okraj || my < rect.top ||
          mx < rect.left || mx > rect.right) {
        z.poslednyX = null;
        return;
      }

      // Súradnice prepočítané na vnútro plochy
      var targetX = mx - rect.left;
      var targetY = my - rect.top;

      if (z.poslednyX === null) {
        z.poslednyX = targetX;
        z.poslednyY = targetY;
        return;
      }

      var dx = targetX - z.poslednyX;
      var dy = targetY - z.poslednyY;
      var dist = Math.sqrt(dx * dx + dy * dy);

      // Kým je prekročená vzdialenosť (krokPohybu), generujeme L-ká
      while (dist >= NASTAVENIA.krokPohybu) {
        var ratio = NASTAVENIA.krokPohybu / dist;
        z.poslednyX += dx * ratio;
        z.poslednyY += dy * ratio;

        spawnParticle(z.vrstva, z.poslednyX, z.poslednyY, rect.width, rect.height, okraj);

        dx = targetX - z.poslednyX;
        dy = targetY - z.poslednyY;
        dist = Math.sqrt(dx * dx + dy * dy);
      }
    });

  }, { passive: true });

  w.addEventListener('scroll', function () {
    if (vrstvy.length && !rAF_waiting) {
      rAF_waiting = true;
      requestAnimationFrame(kresliParalax);
    }
  }, { passive: true });

})();
