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
    vzdialenostMin: 5,      // Najmenšia vzdialenosť od stredu myši (px)
    vzdialenostMax: 350,      // Najväčšia vzdialenosť od stredu myši (px)
    
    // --- 3. VEĽKOSŤ L-IEK ---
    velkostMin: 76,          // Najmenšia povolená veľkosť L-ka (px)
    velkostMax: 50,          // Najväčšia povolená veľkosť L-ka (px)
    
    // --- 4. RÝCHLOSŤ A DOLET ---
    rychlostMin: 17,         // Minimálna rýchlosť vznášania / doletu
    rychlostMax: 68,         // Maximálna rýchlosť vznášania / doletu
    
    // --- 5. PRIEHĽADNOSŤ (OPACITY) ---
    priehladnostZaciatocna: 0.1, // Ako silno svietia na začiatku (0.0 = neviditeľné, 1.0 = plná farba)
    priehladnostKonecna: 0.0,     // Priehľadnosť na konci (typicky 0, aby plynule zmizli)
    
    // --- 6. DĹŽKA ŽIVOTA (MIZNUTIE) ---
    casMiznutiaMs: 5000,     // Za koľko milisekúnd L-ko zmizne (1000 = 1 sekunda)
    
    // --- 7. SPRÁVANIE PRI SCROLLOVANÍ ---
    // 'obrazovka' = L-ká zostanú prilepené na monitore (text sa bude scrollovať za nimi)
    // 'dokument'  = L-ká zostanú na tom mieste v texte, kde vznikli (odscrollujú preč spolu s textom)
    uchytenie: 'dokument',

    // --- 8. EXTRA: ROTÁCIA ---
    nahodnaRotacia: false,   // Zmeň na "true", ak chceš aby lietali kadejako otočené
    maxNatocenie: 180        // O koľko stupňov max sa môžu vychýliť
  };
  // =====================================================================

  // Zistenie farieb podľa témy stránky
  var theme = d.documentElement.getAttribute('data-theme') || 'holding';
  var colors = [];
  
  if (theme === 'holding') {
    colors = ['#0f6fd1', '#0e8a55', '#cf4326'];
  } else if (theme === 'tele') {
    colors = ['#0f6fd1'];
  } else if (theme === 'energy') {
    colors = ['#0e8a55'];
  } else if (theme === 'build') {
    colors = ['#cf4326'];
  } else {
    colors = ['#0f6fd1', '#0e8a55', '#cf4326'];
  }

  // Vytvorenie CSS štýlu priamo v JS (odteraz netreba iol.css)
  var style = d.createElement('style');
  style.innerHTML = `
  .iol-cursor-particle {
    position: absolute;
    pointer-events: none;
    z-index: 1; /* Za textom */
    transform: translate(-50%, -50%);
    animation: iol-float-particle var(--anim-time) cubic-bezier(0.2, 0.9, 0.4, 1) forwards;
  }
  @keyframes iol-float-particle {
    0% {
      transform: translate(-50%, -50%) scale(1);
      opacity: var(--start-opacity);
    }
    100% {
      transform: translate(calc(-50% + var(--tx)), calc(-50% + var(--ty))) scale(0.3);
      opacity: var(--end-opacity);
    }
  }`;
  d.head.appendChild(style);

  var isDocument = NASTAVENIA.uchytenie === 'dokument';

  // Kontajner pre lietajúce L-ká
  var container = d.createElement('div');
  container.style.position = isDocument ? 'absolute' : 'fixed';
  container.style.top = '0';
  container.style.left = '0';
  container.style.width = '100%';
  container.style.height = '100%';
  container.style.pointerEvents = 'none';
  container.style.zIndex = '1';
  container.style.overflow = isDocument ? 'visible' : 'hidden';
  d.body.appendChild(container);

  var hlavicka = d.querySelector('.hero');
  var vrstvy = d.querySelectorAll('.hero-art g');
  var rAF_waiting = false;
  var mx = 0, my = 0;
  
  var lastSpawnX = null;
  var lastSpawnY = null;

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

  function spawnParticle(baseX, baseY) {
    var p = d.createElement('div');
    var color = colors[Math.floor(Math.random() * colors.length)];
    var size = Math.floor(Math.random() * (NASTAVENIA.velkostMax - NASTAVENIA.velkostMin + 1)) + NASTAVENIA.velkostMin;
    
    var spawnAngle = Math.random() * Math.PI * 2;
    var spawnRadius = Math.random() * (NASTAVENIA.vzdialenostMax - NASTAVENIA.vzdialenostMin) + NASTAVENIA.vzdialenostMin; 
    var startX = baseX + Math.cos(spawnAngle) * spawnRadius;
    var startY = baseY + Math.sin(spawnAngle) * spawnRadius;

    p.className = 'iol-cursor-particle';
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
    p.style.setProperty('--start-opacity', NASTAVENIA.priehladnostZaciatocna);
    p.style.setProperty('--end-opacity', NASTAVENIA.priehladnostKonecna);

    container.appendChild(p);

    setTimeout(function() { 
      if(p.parentNode) p.parentNode.removeChild(p); 
    }, NASTAVENIA.casMiznutiaMs);
  }

  w.addEventListener('pointermove', function(e) {
    mx = e.clientX; 
    my = e.clientY;

    var targetX = isDocument ? e.pageX : e.clientX;
    var targetY = isDocument ? e.pageY : e.clientY;

    if (vrstvy.length && !rAF_waiting) {
      rAF_waiting = true;
      requestAnimationFrame(kresliParalax);
    }

    if (hlavicka) {
      var rect = hlavicka.getBoundingClientRect();
      if (my > rect.bottom + 30) {
        lastSpawnX = null; 
        return;
      }
    }

    if (lastSpawnX === null) {
      lastSpawnX = targetX;
      lastSpawnY = targetY;
      return;
    }

    var dx = targetX - lastSpawnX;
    var dy = targetY - lastSpawnY;
    var dist = Math.sqrt(dx * dx + dy * dy);

    // Kým je prekročená vzdialenosť (krokPohybu), generujeme L-ká
    while (dist >= NASTAVENIA.krokPohybu) {
      var ratio = NASTAVENIA.krokPohybu / dist;
      lastSpawnX += dx * ratio;
      lastSpawnY += dy * ratio;
      
      spawnParticle(lastSpawnX, lastSpawnY);
      
      dx = targetX - lastSpawnX;
      dy = targetY - lastSpawnY;
      dist = Math.sqrt(dx * dx + dy * dy);
    }

  }, { passive: true });

  w.addEventListener('scroll', function() {
    if (vrstvy.length && !rAF_waiting) {
      rAF_waiting = true;
      requestAnimationFrame(kresliParalax);
    }
  }, { passive: true });

})();