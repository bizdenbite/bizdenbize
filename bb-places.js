/* ============================================================
   BizdenBize — Städtesuche mit Places API (New).

   Warum es diese Datei gibt:
   Die alte Klasse google.maps.places.Autocomplete laesst sich in
   neuen Google-Cloud-Projekten nicht mehr freischalten. Die Konsole
   meldet dann LegacyApiNotActivatedMapError, und Google blendet
   "Google Maps kann auf dieser Seite nicht richtig geladen werden"
   ein. Die neue Schnittstelle (AutocompleteSuggestion) liefert nur
   die Vorschlaege; die Liste darunter zeichnen wir selbst.

   Ein Baustein fuer vier Seiten (profile, profil, onboarding,
   ev-takasi) statt vier Kopien, die auseinanderlaufen.

   Benutzung — bewusst so, dass die Seiten ihre bisherigen Handler
   behalten koennen:

     var ac = BBPlaces.attach(input, { onFehler: function () {...} });
     ac.onPlaceChanged(function () {
       var place = ac.getPlace();   // { name, address_components:[
     });                            //   { long_name, short_name, types } ] }

   Die Form von place entspricht dem Ergebnis der alten Klasse. Hat
   Google nur den Namen geliefert, fehlt address_components — die
   Handler der Seiten haben dafuer schon einen Pfad.

   Ehrlichkeit statt stillem Scheitern:
   - Der Hinweis unter dem Feld (#maps-hinweis) sagt "Öneriler Google
     Maps'ten geliyor." erst, wenn wirklich eine Antwort von Google
     angekommen ist — nicht schon, wenn das Skript geladen wurde.
   - Scheitert eine Anfrage (nicht freigegebene API, Abrechnung,
     Quota, Werbeblocker), steht dort, dass man die Stadt von Hand
     schreiben kann, und onFehler wird gerufen.

   Attribution: Google verlangt bei eigener Oberflaeche den Hinweis
   "Google Maps" im selben Kasten wie die Vorschlaege. Er steht als
   Fusszeile in der Liste.
   ============================================================ */
(function () {
  'use strict';

  // Feste Sprache: ohne sie antwortet Places in der Browsersprache,
  // und aus einer Stadt werden "Münih", "Munich" und "München".
  var SPRACHE = 'de';
  var REGION = 'de';
  var MIN_ZEICHEN = 2;
  var WARTE_MS = 250;
  // Gleiche Auswahl wie frueher "(cities)": Orte und Ortsteile mit
  // eigener Verwaltung. Nur Typen aus Tabelle A/B — maximal fuenf.
  var TYPEN = ['locality', 'administrative_area_level_3'];

  var TXT_AUSGEFALLEN = 'Şehir önerileri şu an çalışmıyor — şehrinizi elle yazabilirsiniz.';
  var TXT_LAEUFT = 'Öneriler Google Maps\'ten geliyor.';
  var TXT_LEER = 'Sonuç bulunamadı.';

  function hinweis(text) {
    var h = document.getElementById('maps-hinweis');
    if (h) h.textContent = text;
  }

  var zaehler = 0;

  function attach(input, opts) {
    opts = opts || {};
    if (!input || input._bbPlaces) return input && input._bbPlaces;

    var api = {
      _place: null,
      _cb: null,
      getPlace: function () { return this._place; },
      onPlaceChanged: function (f) { this._cb = f; }
    };
    input._bbPlaces = api;

    var lib = null;
    var token = null;
    var vorschlaege = [];
    var aktiv = -1;
    var anfrageNr = 0;
    var timer = null;
    var ausgefallen = false;
    var antwortGesehen = false;
    var offen = false;

    // ── Liste ──────────────────────────────────────────────
    var boxId = 'bb-places-liste-' + (++zaehler);
    var box = document.createElement('div');
    box.id = boxId;
    box.setAttribute('role', 'listbox');
    box.style.cssText =
      'position:fixed;display:none;z-index:2147483000;box-sizing:border-box;' +
      'background:#fff;color:#1c1a17;border:1px solid rgba(0,0,0,.18);' +
      'border-radius:10px;box-shadow:0 8px 24px rgba(0,0,0,.18);' +
      'overflow:hidden;font-size:14px;line-height:1.3;';
    document.body.appendChild(box);

    input.setAttribute('role', 'combobox');
    input.setAttribute('aria-autocomplete', 'list');
    input.setAttribute('aria-expanded', 'false');
    input.setAttribute('aria-controls', boxId);

    function positionieren() {
      var r = input.getBoundingClientRect();
      box.style.left = r.left + 'px';
      box.style.top = (r.bottom + 2) + 'px';
      box.style.width = r.width + 'px';
    }

    function schliessen() {
      offen = false;
      aktiv = -1;
      box.style.display = 'none';
      input.setAttribute('aria-expanded', 'false');
      input.removeAttribute('aria-activedescendant');
    }

    function markieren(i) {
      var zeilen = box.querySelectorAll('[role="option"]');
      for (var k = 0; k < zeilen.length; k++) {
        var an = (k === i);
        zeilen[k].style.background = an ? '#F3ECE0' : '#fff';
        zeilen[k].setAttribute('aria-selected', an ? 'true' : 'false');
        if (an) input.setAttribute('aria-activedescendant', zeilen[k].id);
      }
      aktiv = i;
    }

    function textVon(x) {
      if (!x) return '';
      return typeof x.text === 'string' ? x.text : String(x);
    }

    function zeigen(liste) {
      vorschlaege = liste.filter(function (s) { return s && s.placePrediction; });
      box.textContent = '';
      var meldung = null;
      if (!vorschlaege.length) {
        meldung = document.createElement('div');
        meldung.style.cssText = 'padding:12px 14px;color:#6B5E4E;';
        meldung.textContent = TXT_LEER;
        box.appendChild(meldung);
      }
      vorschlaege.forEach(function (s, i) {
        var pp = s.placePrediction;
        var z = document.createElement('div');
        z.id = boxId + '-' + i;
        z.setAttribute('role', 'option');
        z.setAttribute('aria-selected', 'false');
        // 44px: Antippen auf dem Handy.
        z.style.cssText = 'padding:10px 14px;min-height:44px;box-sizing:border-box;cursor:pointer;display:flex;flex-direction:column;justify-content:center;';
        var haupt = document.createElement('span');
        haupt.style.fontWeight = '600';
        haupt.textContent = textVon(pp.mainText) || textVon(pp.text);
        z.appendChild(haupt);
        var zweit = textVon(pp.secondaryText);
        if (zweit) {
          var s2 = document.createElement('span');
          s2.style.cssText = 'font-size:12px;color:#6B5E4E;';
          s2.textContent = zweit;
          z.appendChild(s2);
        }
        z.addEventListener('mouseenter', function () { markieren(i); });
        z.addEventListener('click', function () { waehlen(i); });
        box.appendChild(z);
      });
      var fuss = document.createElement('div');
      fuss.style.cssText = 'padding:6px 14px;font-size:11px;color:#6B5E4E;border-top:1px solid rgba(0,0,0,.08);text-align:right;';
      fuss.textContent = 'Google Maps';
      box.appendChild(fuss);
      positionieren();
      box.style.display = 'block';
      offen = true;
      aktiv = -1;
      input.setAttribute('aria-expanded', 'true');
    }

    // Fokus im Feld halten, wenn jemand die Liste antippt.
    box.addEventListener('mousedown', function (e) { e.preventDefault(); });

    // ── Bibliothek ─────────────────────────────────────────
    function bibliothek() {
      if (lib) return Promise.resolve(lib);
      var g = window.google && window.google.maps;
      if (!g) return Promise.reject(new Error('Maps nicht geladen'));
      var p = g.importLibrary ? g.importLibrary('places') : Promise.resolve(g.places);
      return p.then(function (L) {
        if (!L || !L.AutocompleteSuggestion) {
          throw new Error('Places (New) nicht verfuegbar');
        }
        lib = L;
        return L;
      });
    }

    function fehler(e) {
      if (window.console) console.warn('[BizdenBize] Ortssuche ausgefallen:', e);
      ausgefallen = true;
      schliessen();
      hinweis(TXT_AUSGEFALLEN);
      if (typeof opts.onFehler === 'function') {
        try { opts.onFehler(e); } catch (e2) { if (window.console) console.warn(e2); }
      }
    }

    // ── Suche ──────────────────────────────────────────────
    function suchen(text) {
      var nr = ++anfrageNr;
      bibliothek().then(function (L) {
        if (!token) token = new L.AutocompleteSessionToken();
        return L.AutocompleteSuggestion.fetchAutocompleteSuggestions({
          input: text,
          includedPrimaryTypes: TYPEN,
          language: SPRACHE,
          region: REGION,
          sessionToken: token
        });
      }).then(function (antwort) {
        if (nr !== anfrageNr) return;   // Eingabe hat sich inzwischen geaendert
        if (!antwortGesehen) {
          antwortGesehen = true;
          hinweis(TXT_LAEUFT);
        }
        zeigen((antwort && antwort.suggestions) || []);
      }).catch(function (e) {
        if (nr !== anfrageNr) return;
        fehler(e);
      });
    }

    function waehlen(i) {
      var s = vorschlaege[i];
      if (!s || !s.placePrediction) return;
      var pp = s.placePrediction;
      var name = textVon(pp.mainText) || textVon(pp.text);
      schliessen();
      anfrageNr++;   // laufende Anfragen verwerfen
      input.value = name;

      function fertig(place) {
        api._place = place;
        token = null;   // Sitzung beendet; die naechste bekommt ein neues Token
        if (api._cb) api._cb();
      }

      var details;
      try {
        var p = pp.toPlace();
        details = p.fetchFields({ fields: ['addressComponents', 'displayName'] }).then(function () {
          return {
            name: p.displayName || name,
            address_components: (p.addressComponents || []).map(function (c) {
              return { long_name: c.longText, short_name: c.shortText, types: c.types || [] };
            })
          };
        });
      } catch (e) {
        details = Promise.reject(e);
      }
      details.then(fertig, function (e) {
        // Details nicht erhalten: der Name allein reicht den Seiten.
        if (window.console) console.warn('[BizdenBize] Ortsdetails fehlen:', e);
        fertig({ name: name });
      });
    }

    // ── Eingabe ────────────────────────────────────────────
    input.addEventListener('input', function () {
      if (timer) clearTimeout(timer);
      var text = input.value.trim();
      if (ausgefallen) return;
      if (text.length < MIN_ZEICHEN) {
        anfrageNr++;
        schliessen();
        return;
      }
      timer = setTimeout(function () { suchen(text); }, WARTE_MS);
    });

    input.addEventListener('keydown', function (e) {
      if (!offen) return;
      var n = vorschlaege.length;
      if (e.key === 'ArrowDown' && n) {
        e.preventDefault();
        markieren(aktiv + 1 >= n ? 0 : aktiv + 1);
      } else if (e.key === 'ArrowUp' && n) {
        e.preventDefault();
        markieren(aktiv - 1 < 0 ? n - 1 : aktiv - 1);
      } else if (e.key === 'Enter' && aktiv >= 0) {
        e.preventDefault();
        waehlen(aktiv);
      } else if (e.key === 'Escape') {
        schliessen();
      }
    });

    input.addEventListener('blur', function () {
      setTimeout(schliessen, 200);
    });

    window.addEventListener('resize', function () { if (offen) positionieren(); });
    window.addEventListener('scroll', function () { if (offen) positionieren(); }, true);

    return api;
  }

  window.BBPlaces = { attach: attach };
})();
