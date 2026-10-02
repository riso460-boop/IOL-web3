(function () {
  'use strict';

  // =====================================================================
  // NASTAVENIA
  // =====================================================================
  var NASTAVENIA = {
    // Google Tag Manager → ID kontajnera (GTM-…)
    // Google Analytics (G-…) a Google Ads (AW-…) sa NEvkladajú sem,
    // nastavujú sa ako značky vnútri Tag Managera.
    gtm: 'GTM-5Q7PMC5D',

    // Cookie, v ktorej si prehliadač pamätá voľbu návštevníka.
    // Zmazaním cookies v prehliadači sa lišta zobrazí znova.
    cookie: 'iol_suhlas',

    // Verzia lišty. Zvýšte ju (2, 3, …) vždy, keď zmeníte text lišty
    // alebo pridáte nový nástroj — všetkým sa lišta zobrazí znova.
    // Pri zmene zapíšte do Git histórie aj nové znenie (dôkaz súhlasu).
    verzia: 2,

    // Po koľkých dňoch sa súhlas pýta znova (odporúčanie: 12 mesiacov)
    platnostDni: 365
  };
  // =====================================================================
  //
  // Udalosti, ktoré stránka posiela do Tag Managera (dataLayer):
  //   suhlas_aktualizovany  — návštevník potvrdil voľbu v lište
  //   klik_telefon          — klik na telefónne číslo (tel:)
  //   klik_email            — klik na e-mailovú adresu (mailto:)
  // V GTM sa na ne naviažu spúšťače typu „Vlastná udalosť".

  var w = window, d = document;
  var skript = d.currentScript;
  var TEXTY = skript ? new URL('../texty/ochrana-sukromia.html', skript.src).href : 'assets/texty/ochrana-sukromia.html';

  if (!NASTAVENIA.gtm || NASTAVENIA.gtm.indexOf('XXXX') !== -1) { return; }

  /* ---------- režim súhlasu Google (Consent Mode v2) ---------- */
  w.dataLayer = w.dataLayer || [];
  function gtag() { w.dataLayer.push(arguments); }

  // kým návštevník nerozhodne, je všetko zakázané
  gtag('consent', 'default', {
    ad_storage: 'denied',
    ad_user_data: 'denied',
    ad_personalization: 'denied',
    analytics_storage: 'denied',
    functionality_storage: 'granted',
    security_storage: 'granted',
    wait_for_update: 500
  });

  /* voľba sa ukladá do cookie: {v: verzia lišty, a: analytika, r: reklama, t: dátum} */
  function nacitajVolbu() {
    var m = d.cookie.match(new RegExp('(?:^|; )' + NASTAVENIA.cookie + '=([^;]*)'));
    if (!m) { return null; }
    try {
      var v = JSON.parse(decodeURIComponent(m[1]));
      var vek = (Date.now() - new Date(v.t).getTime()) / 864e5;
      // iná verzia lišty alebo starší súhlas než platnosť = pýtame sa znova
      if (v.v !== NASTAVENIA.verzia || !(vek < NASTAVENIA.platnostDni)) { return null; }
      return { analytika: !!v.a, reklama: !!v.r, datum: v.t };
    } catch (e) { return null; }
  }
  function ulozVolbu(volba) {
    var hodnota = encodeURIComponent(JSON.stringify({
      v: NASTAVENIA.verzia, a: !!volba.analytika, r: !!volba.reklama, t: new Date().toISOString()
    }));
    d.cookie = NASTAVENIA.cookie + '=' + hodnota +
      '; max-age=' + (NASTAVENIA.platnostDni * 86400) + '; path=/; SameSite=Lax' +
      (w.location.protocol === 'https:' ? '; Secure' : '');
  }
  // upratanie po staršej verzii, ktorá voľbu držala v localStorage
  try { w.localStorage.removeItem('iol-suhlas-v1'); } catch (e) { /* nič */ }

  var nacitane = false;
  function spustiMeranie(volba) {
    gtag('consent', 'update', {
      analytics_storage: volba.analytika ? 'granted' : 'denied',
      ad_storage: volba.reklama ? 'granted' : 'denied',
      ad_user_data: volba.reklama ? 'granted' : 'denied',
      ad_personalization: volba.reklama ? 'granted' : 'denied'
    });
    w.dataLayer.push({ event: 'suhlas_aktualizovany', suhlas_analytika: !!volba.analytika, suhlas_reklama: !!volba.reklama, suhlas_verzia: NASTAVENIA.verzia });

    // Tag Manager načítame až po súhlase — do vtedy nejde na Google nič
    if (nacitane || (!volba.analytika && !volba.reklama)) { return; }
    nacitane = true;
    w.dataLayer.push({ 'gtm.start': new Date().getTime(), event: 'gtm.js' });
    var s = d.createElement('script');
    s.async = true;
    s.src = 'https://www.googletagmanager.com/gtm.js?id=' + NASTAVENIA.gtm;
    d.head.appendChild(s);
  }

  /* ---------- kliky na telefón a e-mail ---------- */
  d.addEventListener('click', function (e) {
    var odkaz = e.target.closest ? e.target.closest('a[href^="tel:"], a[href^="mailto:"]') : null;
    if (!odkaz || !nacitane) { return; }
    var jeTelefon = odkaz.getAttribute('href').indexOf('tel:') === 0;
    w.dataLayer.push({
      event: jeTelefon ? 'klik_telefon' : 'klik_email',
      odkaz: odkaz.getAttribute('href'),
      stranka: w.location.pathname
    });
  });

  /* ---------- lišta so súhlasom ---------- */
  var lista = null;

  function zatvorListu() {
    if (lista) { lista.hidden = true; }
  }

  function rozhodni(volba) {
    ulozVolbu(volba);
    zatvorListu();
    spustiMeranie(volba);
  }

  function ukazListu() {
    if (lista) {
      var ulozena = nacitajVolbu() || {};
      lista.querySelector('[name="analytika"]').checked = !!ulozena.analytika;
      lista.querySelector('[name="reklama"]').checked = !!ulozena.reklama;
      lista.hidden = false;
      lista.querySelector('.cookie-btn-all').focus();
      return;
    }
    lista = d.createElement('div');
    lista.className = 'cookie-lista';
    lista.setAttribute('role', 'dialog');
    lista.setAttribute('aria-live', 'polite');
    lista.setAttribute('aria-label', 'Súhlas s cookies');
    lista.innerHTML =
      '<div class="cookie-in">' +
        '<button type="button" class="cookie-info" aria-label="Zásady cookies a ochrany osobných údajov" title="Zásady cookies a ochrany osobných údajov">' +
          '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9.5"/><path d="M12 11v6"/><circle cx="12" cy="7.6" r=".6"/></svg>' +
        '</button>' +
        '<p class="cookie-text"><b class="cookie-stitok">Cookies</b> — <strong>Súkromie je vaša voľba, ktorú rešpektujeme.</strong> Kliknutím na Povoliť nám pomôžete zlepšiť web pre vás aj ďalších.</p>' +
        '<div class="cookie-akcie">' +
          '<button type="button" class="cookie-btn cookie-btn-all">Povoliť</button>' +
          '<button type="button" class="cookie-btn cookie-btn-none">Nie, ďakujem</button>' +
        '</div>' +
        '<details class="cookie-detail">' +
          '<summary>Nastavenie</summary>' +
          '<label><input type="checkbox" checked disabled> <span><b>Nevyhnutné</b> — zapamätanie tejto voľby</span></label>' +
          '<label><input type="checkbox" name="analytika"> <span><b>Štatistiky</b> — Google Analytics, návštevnosť webu</span></label>' +
          '<label><input type="checkbox" name="reklama"> <span><b>Reklama</b> — Google Ads, meranie účinnosti reklamy</span></label>' +
          '<button type="button" class="cookie-btn cookie-btn-save">Uložiť výber</button>' +
        '</details>' +
      '</div>';
    d.body.appendChild(lista);

    lista.querySelector('.cookie-info').addEventListener('click', function () { otvorZasady('cookies'); });
    lista.querySelector('.cookie-btn-all').addEventListener('click', function () {
      rozhodni({ analytika: true, reklama: true });
    });
    lista.querySelector('.cookie-btn-none').addEventListener('click', function () {
      rozhodni({ analytika: false, reklama: false });
    });
    lista.querySelector('.cookie-btn-save').addEventListener('click', function () {
      rozhodni({
        analytika: lista.querySelector('[name="analytika"]').checked,
        reklama: lista.querySelector('[name="reklama"]').checked
      });
    });
  }

  /* ---------- okno „Ochrana súkromia" s dvoma záložkami ----------
     Texty sú v assets/texty/ochrana-sukromia.html a načítajú sa až po otvorení. */
  var okno = null, vratFokusZasady = null, textyNacitane = false;

  function prepniZalozku(id) {
    [].forEach.call(okno.querySelectorAll('.zs-tab'), function (t) {
      var on = t.getAttribute('data-zalozka') === id;
      t.setAttribute('aria-selected', on ? 'true' : 'false');
      t.tabIndex = on ? 0 : -1;
    });
    [].forEach.call(okno.querySelectorAll('.zs-panel'), function (p) {
      p.hidden = p.getAttribute('data-zalozka') !== id;
    });
    okno.querySelector('.zs-obsah').scrollTop = 0;
  }

  function nacitajTexty(zalozka) {
    var obsah = okno.querySelector('.zs-obsah');
    fetch(TEXTY).then(function (r) {
      if (!r.ok) { throw new Error(r.status); }
      return r.text();
    }).then(function (html) {
      var t = d.createElement('template');
      t.innerHTML = html;
      var sekcie = t.content.querySelectorAll('section[data-zalozka]');
      var taby = okno.querySelector('.zs-taby');
      obsah.innerHTML = '';
      [].forEach.call(sekcie, function (sek) {
        var id = sek.getAttribute('data-zalozka');
        var tab = d.createElement('button');
        tab.type = 'button';
        tab.className = 'zs-tab';
        tab.setAttribute('role', 'tab');
        tab.setAttribute('data-zalozka', id);
        tab.id = 'zs-tab-' + id;
        tab.setAttribute('aria-controls', 'zs-panel-' + id);
        tab.textContent = sek.getAttribute('data-nazov');
        taby.appendChild(tab);
        var panel = d.createElement('div');
        panel.className = 'zs-panel';
        panel.id = 'zs-panel-' + id;
        panel.setAttribute('role', 'tabpanel');
        panel.setAttribute('aria-labelledby', tab.id);
        panel.setAttribute('data-zalozka', id);
        while (sek.firstChild) { panel.appendChild(sek.firstChild); }
        obsah.appendChild(panel);
      });
      textyNacitane = true;
      prepniZalozku(zalozka);
    }).catch(function () {
      obsah.innerHTML = '<p class="zs-chyba">Zásady sa nepodarilo načítať. Skúste to prosím znova, ' +
        'alebo nám napíšte na <a href="mailto:obchod@iol.sk">obchod@iol.sk</a>.</p>';
    });
  }

  function zavriZasady() {
    if (!okno || okno.hidden) { return; }
    okno.hidden = true;
    d.body.style.overflow = '';
    if (vratFokusZasady && vratFokusZasady.focus) { vratFokusZasady.focus(); }
  }

  function otvorZasady(zalozka) {
    vratFokusZasady = d.activeElement;
    if (!okno) {
      okno = d.createElement('div');
      okno.className = 'zs-okno';
      okno.setAttribute('role', 'dialog');
      okno.setAttribute('aria-modal', 'true');
      okno.setAttribute('aria-labelledby', 'zs-nadpis');
      okno.innerHTML =
        '<div class="zs-pozadie" data-zavri></div>' +
        '<div class="zs-box">' +
          '<div class="zs-hlava">' +
            '<p class="zs-nadpis" id="zs-nadpis">Ochrana súkromia</p>' +
            '<button type="button" class="zs-zavri" aria-label="Zavrieť" data-zavri>' +
              '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6 6 18"/></svg>' +
            '</button>' +
          '</div>' +
          '<div class="zs-taby" role="tablist" aria-label="Zásady"></div>' +
          '<div class="zs-obsah"><p class="zs-nacitavam">Načítavam…</p></div>' +
          '<div class="zs-paticka">' +
            '<button type="button" class="zs-nastavenia">Nastavenia cookies</button>' +
            '<button type="button" class="zs-ok" data-zavri>Zavrieť</button>' +
          '</div>' +
        '</div>';
      d.body.appendChild(okno);

      okno.addEventListener('click', function (e) {
        var prepni = e.target.closest('[data-prepni]');
        var tab = e.target.closest('.zs-tab');
        if (prepni) { e.preventDefault(); prepniZalozku(prepni.getAttribute('data-prepni')); }
        else if (tab) { prepniZalozku(tab.getAttribute('data-zalozka')); }
        else if (e.target.closest('[data-zavri]')) { zavriZasady(); }
        else if (e.target.closest('.zs-nastavenia')) { zavriZasady(); ukazListu(); }
      });
      okno.addEventListener('keydown', function (e) {
        if (e.key === 'Escape') { e.stopPropagation(); zavriZasady(); return; }
        var tab = e.target.closest('.zs-tab');
        if (tab && (e.key === 'ArrowRight' || e.key === 'ArrowLeft')) {
          var taby = [].slice.call(okno.querySelectorAll('.zs-tab'));
          var i = (taby.indexOf(tab) + (e.key === 'ArrowRight' ? 1 : -1) + taby.length) % taby.length;
          prepniZalozku(taby[i].getAttribute('data-zalozka'));
          taby[i].focus();
        }
      });
      nacitajTexty(zalozka);
    } else if (textyNacitane) {
      prepniZalozku(zalozka);
    }
    okno.hidden = false;
    d.body.style.overflow = 'hidden';
    okno.querySelector('.zs-zavri').focus();
  }

  /* ---------- odkaz „Nastavenia cookies" v pätičke ---------- */
  function pridajOdkazDoPaticky() {
    var paticka = d.querySelector('.footer-bottom');
    if (!paticka) { return; }
    var skupina = d.createElement('span');
    skupina.className = 'cookie-odkazy';
    function odkaz(text, akcia) {
      var b = d.createElement('button');
      b.type = 'button';
      b.className = 'cookie-odkaz';
      b.textContent = text;
      b.addEventListener('click', akcia);
      skupina.appendChild(b);
    }
    odkaz('Nastavenia cookies', ukazListu);
    odkaz('Ochrana súkromia', function () { otvorZasady('gdpr'); });
    paticka.appendChild(skupina);
  }

  function start() {
    pridajOdkazDoPaticky();
    var volba = nacitajVolbu();
    if (volba) { spustiMeranie(volba); } else { ukazListu(); }
  }

  if (d.readyState === 'loading') { d.addEventListener('DOMContentLoaded', start); } else { start(); }
})();
