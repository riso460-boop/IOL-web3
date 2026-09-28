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

  /* ---------- odkaz „Nastavenia cookies" v pätičke ---------- */
  function pridajOdkazDoPaticky() {
    var paticka = d.querySelector('.footer-bottom');
    if (!paticka) { return; }
    var odkaz = d.createElement('button');
    odkaz.type = 'button';
    odkaz.className = 'cookie-odkaz';
    odkaz.textContent = 'Nastavenia cookies';
    odkaz.addEventListener('click', ukazListu);
    paticka.appendChild(odkaz);
  }

  function start() {
    pridajOdkazDoPaticky();
    var volba = nacitajVolbu();
    if (volba) { spustiMeranie(volba); } else { ukazListu(); }
  }

  if (d.readyState === 'loading') { d.addEventListener('DOMContentLoaded', start); } else { start(); }
})();
