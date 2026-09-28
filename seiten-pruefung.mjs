#!/usr/bin/env node
/**
 * BizdenBize — Seitenprüfung
 * =========================
 *
 * Sucht die Sorte Fehler, die niemand meldet, weil nichts abstürzt:
 * ein Knopf sieht bedienbar aus, man klickt, und es passiert nichts.
 *
 * Geprüft wird pro HTML-Seite:
 *
 *   1. Handler ohne Funktion
 *      onclick="machWas()" — und machWas gibt es nirgends. Der Knopf
 *      wirft einen Fehler in die Konsole, die niemand offen hat.
 *
 *   2. Doppelte IDs
 *      Zwei Elemente mit derselben id. getElementById nimmt das erste,
 *      der Rest ist unerreichbar.
 *
 *   3. Blockierte Komponenten
 *      Gemeinsame Bausteine beginnen oft mit
 *          if (document.getElementById('xyz')) return;
 *      Steht ein Element mit dieser id schon fest im HTML, bricht der
 *      Baustein ab — und hängt dabei seine Klick-Handler nicht an.
 *      Genau so war der İletişim-Knopf auf nachhilfe.html kaputt:
 *      das Fenster ging auf, die Knöpfe taten nichts.
 *
 *   4. Syntaxfehler in Inline-Skripten
 *
 * Aufruf:   node seiten-pruefung.mjs [repo-verzeichnis]
 * Vorher:   npm install acorn acorn-walk jsdom
 * Rückgabe: 0 = sauber, 1 = Befunde
 *
 * ── Fallstricke, die beim Bauen echte Fehlalarme erzeugt haben ──
 *
 *  • <script type="module"> muss als Modul geparst werden, sonst
 *    scheitert jedes import und die Datei gilt als leer. Dann sieht
 *    jede Funktion darin "undefiniert" aus. Deshalb: erst als Skript
 *    versuchen, bei Fehler als Modul.
 *
 *  • Ein Modul hat eigenen Gültigkeitsbereich. function x(){} darin
 *    ist NICHT global und aus onclick nicht erreichbar. Nur
 *    window.x = ... macht es global. Das ist kein Fehlalarm, sondern
 *    eine echte Falle — hier absichtlich so gewertet.
 *
 *  • In eine IIFE gewickelte Dateien — (function(){ ... })() —
 *    exportieren ebenfalls nur über window.
 *
 *  • site-footer.js lädt site-kesfet.js zur Laufzeit nach. Das steht
 *    in keinem <script src>, die Funktionen sind aber global. Ohne
 *    diesen Sonderfall meldet die Prüfung toggleKesfet & Co. auf
 *    zwanzig Seiten als fehlend. Alles falsch.
 *
 *  • rgba(), var(), calc() in style-Attributen sind keine
 *    Funktionsaufrufe. Ebenso wenig .setItem() oder .click() —
 *    Methoden an einem Objekt. Nur freistehende Bezeichner zählen.
 */

import fs from 'fs';
import path from 'path';
import * as acorn from 'acorn';
import * as walk from 'acorn-walk';
import { JSDOM } from 'jsdom';

const REPO = process.argv[2] || '.';

// ── Parsen: erst klassisches Skript, sonst Modul ──────────────────
function parseAny(src) {
  try {
    return { ast: acorn.parse(src, { ecmaVersion: 'latest', sourceType: 'script', allowReturnOutsideFunction: true }), isModule: false };
  } catch (e1) {
    try {
      return { ast: acorn.parse(src, { ecmaVersion: 'latest', sourceType: 'module' }), isModule: true };
    } catch (e2) {
      return { ast: null, isModule: false, error: e1.message };
    }
  }
}

/** Namen, die wirklich global werden. */
function globalNames(src, forceModuleScope) {
  const r = parseAny(src);
  if (!r.ast) return { names: new Set(), parseError: r.error };
  const names = new Set();

  // window.X = ... zählt immer, egal wie tief verschachtelt
  walk.simple(r.ast, {
    AssignmentExpression(n) {
      const l = n.left;
      if (l.type === 'MemberExpression' && !l.computed &&
          l.object.type === 'Identifier' && (l.object.name === 'window' || l.object.name === 'globalThis') &&
          l.property.type === 'Identifier') names.add(l.property.name);
    }
  });

  // Deklarationen auf oberster Ebene nur, wenn kein eigener Scope drumherum
  if (!(forceModuleScope || r.isModule)) {
    for (const n of r.ast.body) {
      if ((n.type === 'FunctionDeclaration' || n.type === 'ClassDeclaration') && n.id) names.add(n.id.name);
      if (n.type === 'VariableDeclaration')
        for (const d of n.declarations) if (d.id.type === 'Identifier') names.add(d.id.name);
    }
  }
  return { names, parseError: null };
}

/** Ist die ganze Datei in eine IIFE gewickelt? */
function isWrapped(src) {
  const r = parseAny(src);
  if (!r.ast) return false;
  const body = r.ast.body.filter(n => n.type !== 'EmptyStatement');
  if (body.length !== 1 || body[0].type !== 'ExpressionStatement') return false;
  const e = body[0].expression;
  return e.type === 'CallExpression' || (e.type === 'UnaryExpression' && e.argument.type === 'CallExpression');
}

// Globale Namen, die der Browser mitbringt — nie als fehlend melden
const BROWSER = new Set(['alert','confirm','prompt','fetch','setTimeout','setInterval','clearTimeout','clearInterval',
  'parseInt','parseFloat','encodeURIComponent','decodeURIComponent','isNaN','isFinite','Number','String','Boolean',
  'Array','Object','JSON','Math','Date','RegExp','Promise','Map','Set','Error','URL','URLSearchParams','FormData',
  'requestAnimationFrame','structuredClone','btoa','atob','open','close','print','scrollTo','getComputedStyle','Image']);

const ON_ATTR = /^on(click|change|submit|input|focus|blur|keyup|keydown|keypress|mouseover|mouseout|dblclick)$/i;

function auditPage(file) {
  const html = fs.readFileSync(path.join(REPO, file), 'utf8');
  const doc = new JSDOM(html).window.document;   // Skripte laufen bewusst NICHT
  const found = { file, dupIds: [], missing: [], blocked: [], parseErrors: [] };

  const seen = {};
  for (const el of doc.querySelectorAll('[id]')) seen[el.id] = (seen[el.id] || 0) + 1;
  found.dupIds = Object.entries(seen).filter(([, n]) => n > 1);

  const defined = new Set();

  for (const s of doc.querySelectorAll('script')) {
    const src = s.getAttribute('src');
    if (src) {
      if (/^https?:|^\/\//.test(src)) continue;          // CDN interessiert nicht
      const base = src.split('?')[0].replace(/^\.?\//, '');
      const p = path.join(REPO, base);
      if (!fs.existsSync(p)) { found.parseErrors.push(`${base}: Datei fehlt im Repo`); continue; }
      const js = fs.readFileSync(p, 'utf8');
      const declaredModule = (s.getAttribute('type') || '').includes('module');
      const { names, parseError } = globalNames(js, isWrapped(js) || declaredModule);
      if (parseError) found.parseErrors.push(`${base}: ${parseError}`);
      names.forEach(n => defined.add(n));

      // Baustein, der bei vorhandenem Markup abbricht
      for (const m of js.matchAll(/getElementById\(['"]([^'"]+)['"]\)\)\s*return/g))
        if (doc.getElementById(m[1])) found.blocked.push([base, m[1]]);
    } else {
      const body = s.textContent || '';
      if (!body.trim()) continue;
      const isModule = (s.getAttribute('type') || '').includes('module');
      const { names, parseError } = globalNames(body, isModule);
      if (parseError) found.parseErrors.push(`inline: ${parseError}`);
      names.forEach(n => defined.add(n));
    }
  }

  // site-footer.js zieht site-kesfet.js zur Laufzeit nach
  if (doc.querySelector('script[src*="site-footer.js"]') && fs.existsSync(path.join(REPO, 'site-kesfet.js'))) {
    const kjs = fs.readFileSync(path.join(REPO, 'site-kesfet.js'), 'utf8');
    globalNames(kjs, isWrapped(kjs)).names.forEach(n => defined.add(n));
  }

  // Aufrufe in den Handler-Attributen
  const called = new Map();
  for (const el of doc.querySelectorAll('*')) {
    for (const a of Array.from(el.attributes)) {
      if (!ON_ATTR.test(a.name)) continue;
      const r = parseAny(a.value);
      if (!r.ast) continue;
      walk.simple(r.ast, {
        CallExpression(n) {                              // nur freistehend, nicht obj.methode()
          if (n.callee.type === 'Identifier' && !BROWSER.has(n.callee.name) && !called.has(n.callee.name))
            called.set(n.callee.name, `<${el.tagName.toLowerCase()} ${a.name}>`);
        }
      });
    }
  }
  found.missing = [...called.keys()].filter(n => !defined.has(n)).sort().map(n => `${n} ${called.get(n)}`);
  return found;
}

// ── Lauf ──────────────────────────────────────────────────────────
const pages = fs.readdirSync(REPO).filter(f => f.endsWith('.html')).sort();
const hits = pages.map(auditPage)
  .filter(r => r.dupIds.length || r.missing.length || r.blocked.length || r.parseErrors.length);

console.log(`${pages.length} Seiten geprüft — ${hits.length} mit Befund\n`);
for (const r of hits) {
  console.log('── ' + r.file);
  if (r.blocked.length)     console.log('   Komponente blockiert  :', r.blocked.map(([f, i]) => `${f} wartet auf #${i}`).join(', '));
  if (r.dupIds.length)      console.log('   Doppelte ID           :', r.dupIds.map(([i, n]) => `${i} (${n}×)`).join(', '));
  if (r.missing.length)     console.log('   Handler ohne Funktion :', r.missing.join(', '));
  if (r.parseErrors.length) console.log('   Syntaxproblem         :', r.parseErrors.join(' | '));
}
if (!hits.length) console.log('Keine toten Handler, keine doppelten IDs, keine blockierten Bausteine.');
process.exit(hits.length ? 1 : 0);
