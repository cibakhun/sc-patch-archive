// VerseBase account-lite — Session-Anzeige + Favoriten für ALLE Seiten
// außerhalb von /account/ (dort läuft das volle supabase-js).
// Bewusst SDK-frei (~4 KB): liest die supabase-js-Session aus localStorage,
// refresht sie bei Bedarf über die Auth-REST-API im selben Speicherformat und
// spricht Favoriten direkt über PostgREST an. RLS schützt die Daten; der
// Publishable Key ist öffentlich.
(function () {
  'use strict';
  var SB_URL = 'https://trgjhmbnodoarnfmlcqx.supabase.co';
  var SB_KEY = 'sb_publishable_AN3O0va6kEsCmHr6zDcwRQ_8sT68W3J';
  var STORE = 'sb-trgjhmbnodoarnfmlcqx-auth-token';
  var LOCK = 'sb-lite-refresh-lock';
  // Eigener Riegel fuer mintGatePass() (WR-02) -- getrennt von LOCK oben.
  // Beide Riegel dienten vorher demselben Schluessel fuer zwei unabhaengige
  // Zwecke: mintGatePass() setzte LOCK, BEVOR es ensureSession() aufruft,
  // und ensureSession() haette den eigenen, gerade gesetzten Riegel dann als
  // "ein anderer Tab refresht schon" gelesen -- der faellige Refresh waere
  // uebersprungen worden. Zwei Schluessel koennen sich nicht mehr gegenseitig
  // blockieren.
  var GATE_MINT_LOCK = 'sb-lite-gate-mint-lock';
  var IS_DE = location.pathname === '/de.html' || location.pathname === '/de' || location.pathname.indexOf('/de/') === 0;

  function readRaw() {
    try {
      var raw = localStorage.getItem(STORE);
      return raw ? JSON.parse(raw) : null;
    } catch (e) { return null; }
  }

  function expiresIn(sess) {
    if (!sess || !sess.expires_at) return -1;
    return sess.expires_at - Math.floor(Date.now() / 1000);
  }

  function clearSession() {
    try { localStorage.removeItem(STORE); } catch (e) { /* noop */ }
  }

  // Refresht die Session, wenn sie (fast) abgelaufen ist. Lock verhindert
  // parallele Refreshes aus mehreren Tabs (GoTrue erlaubt Reuse ~10 s).
  function ensureSession() {
    var sess = readRaw();
    if (!sess || !sess.refresh_token) return Promise.resolve(null);
    if (expiresIn(sess) > 60) return Promise.resolve(sess);

    var now = Date.now();
    var lock = 0;
    try { lock = +localStorage.getItem(LOCK) || 0; } catch (e) { /* noop */ }
    if (now - lock < 10000) return Promise.resolve(expiresIn(sess) > 0 ? sess : null);
    try { localStorage.setItem(LOCK, String(now)); } catch (e) { /* noop */ }

    return fetch(SB_URL + '/auth/v1/token?grant_type=refresh_token', {
      method: 'POST',
      headers: { apikey: SB_KEY, 'Content-Type': 'application/json' },
      body: JSON.stringify({ refresh_token: sess.refresh_token }),
    })
      .then(function (r) { return r.ok ? r.json() : null; })
      .then(function (fresh) {
        if (!fresh || !fresh.access_token) { clearSession(); return null; }
        if (!fresh.expires_at) fresh.expires_at = Math.floor(Date.now() / 1000) + (fresh.expires_in || 3600);
        try { localStorage.setItem(STORE, JSON.stringify(fresh)); } catch (e) { /* noop */ }
        return fresh;
      })
      .catch(function () { return expiresIn(sess) > 0 ? sess : null; });
  }

  function rest(sess, method, path, body, prefer) {
    return fetch(SB_URL + '/rest/v1/' + path, {
      method: method,
      headers: {
        apikey: SB_KEY,
        Authorization: 'Bearer ' + sess.access_token,
        'Content-Type': 'application/json',
        Prefer: prefer || (method === 'POST' ? 'return=minimal' : 'count=none'),
      },
      body: body ? JSON.stringify(body) : undefined,
    });
  }

  // ---- Öffentliche Mini-API für Seiten-Skripte ----------------------------
  // Andere Seiten-Apps (crafting-app.js …) brauchen genau das, was hier schon
  // steht: eine gültige Session und einen authentifizierten PostgREST-Aufruf.
  // Statt Session-Format, Refresh-Lock und Keys ein zweites Mal zu
  // implementieren (zwei Wahrheiten = ein Bug), reichen wir sie hier durch.
  // Wird SOFORT gesetzt (nicht erst nach boot()), damit ein Skript, das nach
  // account-lite läuft, synchron darauf zugreifen kann; wer vorher lief, wartet
  // auf das Event.
  window.VBAccount = {
    /** Gespeicherte Session ohne Netz-Zugriff (evtl. abgelaufen) — nur für UI-Vorentscheidungen. */
    peek: readRaw,
    /** Gültige Session (refresht bei Bedarf) oder null. */
    session: ensureSession,
    /** Authentifizierter PostgREST-Aufruf: rest(sess, 'GET', 'tabelle?select=*'). */
    rest: rest,
    /** Login-Link inkl. Rücksprung auf die aktuelle Seite. */
    loginHref: function () {
      return (IS_DE ? '/de' : '') + '/account/login.html?next=' +
        encodeURIComponent(location.pathname + location.search);
    },
    isDE: IS_DE,
  };
  try { dispatchEvent(new Event('vb-account-ready')); } catch (e) { /* noop */ }

  // ---- Nav-Status (alle Elemente mit .js-nav-acct) -------------------------
  // uname optional: Anzeigename/Handle aus profiles — ersetzt das generische
  // "Konto"-Label, sobald der Zusatz-Request (fetchUsername) zurück ist.
  function paintNav(sess, uname) {
    var els = document.querySelectorAll('.js-nav-acct');
    if (!els.length) return;
    var loggedIn = !!sess;
    for (var i = 0; i < els.length; i++) {
      var el = els[i];
      el.href = loggedIn ? el.getAttribute('data-dash') : el.getAttribute('data-login');
      var txt = el.querySelector('.js-nav-acct-txt');
      if (txt) txt.textContent = loggedIn ? (uname || el.getAttribute('data-l-acct')) : el.getAttribute('data-l-login');
      if (loggedIn && uname) el.title = uname;
      el.classList.toggle('is-authed', loggedIn);
    }
  }

  // Anzeigename bevorzugt vor Handle (Handle ist optional/eindeutig, aber
  // der Anzeigename ist das, was der User selbst als "seinen Namen" versteht).
  function fetchUsername(sess) {
    if (!sess || !sess.user || !sess.user.id) return Promise.resolve(null);
    return rest(sess, 'GET', 'profiles?select=display_name,handle&id=eq.' + sess.user.id)
      .then(function (r) { return r.ok ? r.json() : []; })
      .then(function (rows) {
        var p = rows && rows[0];
        if (!p) return null;
        return p.display_name || (p.handle ? '@' + p.handle : null);
      })
      .catch(function () { return null; });
  }

  // ---- Favoriten-Buttons ([data-fav]) --------------------------------------
  function initFavs(sess) {
    var btns = document.querySelectorAll('[data-fav]');
    if (!btns.length) return;

    function paint(btn, on) {
      btn.classList.toggle('is-fav', on);
      btn.setAttribute('aria-pressed', on ? 'true' : 'false');
      var lbl = btn.getAttribute(on ? 'data-fav-on' : 'data-fav-off');
      var txt = btn.querySelector('.js-fav-txt');
      if (txt && lbl) txt.textContent = lbl;
    }

    if (!sess) {
      for (var i = 0; i < btns.length; i++) {
        (function (btn) {
          paint(btn, false);
          btn.addEventListener('click', function () {
            location.href = window.VBAccount.loginHref();
          });
        })(btns[i]);
      }
      return;
    }

    for (var j = 0; j < btns.length; j++) {
      (function (btn) {
        var kind = btn.getAttribute('data-fav-kind');
        var slug = btn.getAttribute('data-fav-slug');
        var label = btn.getAttribute('data-fav-label') || slug;
        var q = 'favorites?select=id&kind=eq.' + encodeURIComponent(kind) + '&slug=eq.' + encodeURIComponent(slug);
        var favId = null;
        var busy = false;
        // Hat der User schon geklickt? Dann darf das (evtl. langsamere) initiale
        // GET den vom Klick gesetzten Zustand NICHT mehr überschreiben — sonst
        // zeigte der Stern nach einem schnellen Klick den falschen Zustand.
        var touched = false;

        rest(sess, 'GET', q)
          .then(function (r) { return r.ok ? r.json() : []; })
          .then(function (rows) {
            if (touched) return;
            favId = rows && rows.length ? rows[0].id : null;
            paint(btn, !!favId);
          })
          .catch(function () { if (!touched) paint(btn, false); });

        btn.addEventListener('click', function () {
          if (busy) return;
          touched = true;
          busy = true;
          ensureSession().then(function (s) {
            if (!s) { busy = false; return; }
            if (favId) {
              rest(s, 'DELETE', 'favorites?id=eq.' + favId)
                .then(function (r) { if (r.ok) { favId = null; paint(btn, false); } })
                .finally(function () { busy = false; });
            } else {
              rest(s, 'POST', 'favorites', { kind: kind, slug: slug, label: label })
                .then(function (r) {
                  if (r.ok || r.status === 409) {
                    return rest(s, 'GET', q).then(function (r2) { return r2.ok ? r2.json() : []; })
                      .then(function (rows) { favId = rows && rows.length ? rows[0].id : null; paint(btn, !!favId); });
                  }
                })
                .finally(function () { busy = false; });
            }
          });
        });
      })(btns[j]);
    }
  }

  // ---- Rollen-basierter Zugriffs-Guard (user_roles Tabelle) ----------------
  // Fragt die user_roles Tabelle via PostgREST ab und cached das Ergebnis
  // fuer die Dauer der Session im sessionStorage.
  var ROLE_CACHE_KEY = 'vb_user_role';

  function fetchUserRole(sess) {
    if (!sess || !sess.user || !sess.user.id) return Promise.resolve(null);

    // Cache-Hit aus sessionStorage (vermeidet wiederholte DB-Abfragen pro Tab)
    try {
      var cached = sessionStorage.getItem(ROLE_CACHE_KEY);
      if (cached) {
        var parsed = JSON.parse(cached);
        if (parsed.uid === sess.user.id && parsed.ts > Date.now() - 300000) {
          return Promise.resolve(parsed.role);
        }
      }
    } catch (e) { /* noop */ }

    return rest(sess, 'GET', 'user_roles?select=role&user_id=eq.' + sess.user.id)
      .then(function (r) { return r.ok ? r.json() : []; })
      .then(function (rows) {
        var role = rows && rows[0] ? rows[0].role : 'user';
        try {
          sessionStorage.setItem(ROLE_CACHE_KEY, JSON.stringify({
            uid: sess.user.id, role: role, ts: Date.now()
          }));
        } catch (e) { /* noop */ }
        return role;
      })
      .catch(function () { return 'user'; });
  }

  // ---- Rolle anwenden ------------------------------------------------------
  // Setzt nur noch die Rollen-Klasse: das einzige verbliebene Admin-Recht ist die
  // Theme-Wahl. Archiv und Patch-Seiten waren bis 25.07.2026 admin-only (Body
  // versteckt + Redirect auf die Startseite); sie sind jetzt fuer alle offen —
  // sie standen ohnehin im Suchindex und in der Sitemap, echte Besucher wurden
  // also von genau den Seiten weggeleitet, die Google zu sehen bekam.
  // ---- Betreiber zaehlt nicht mit ------------------------------------------
  // Wer als Admin angemeldet ist, betreut die Seite und darf die eigene
  // Statistik nicht auffuellen — bei ~30 echten Besuchen am Tag verzerrt schon
  // ein Nachmittag Eigenarbeit jede Zahl. Frueher hing das an der IP; die ist
  // dynamisch und faellt nach jedem Router-Neustart aus. Am Konto haengt es
  // dauerhaft: einmal anmelden, auf jedem Geraet.
  // Das Cookie kennt die CSP (map in nginx/default.conf) und die WAF-Regel an
  // der Edge — damit bleiben BEIDE Zaehler still, auch der ueber Zaraz.
  // `=0` ist die bewusste Rueckkehr ueber den Knopf auf der Datenschutzseite
  // und wird hier nie ueberschrieben.
  function keepAnalyticsOptOut(isAdmin) {
    if (!isAdmin) return;
    if (/(?:^|;\s*)vb_noanalytics=0/.test(document.cookie)) return;
    try {
      document.cookie = 'vb_noanalytics=1; Max-Age=34560000; Path=/; SameSite=Lax; Secure';
    } catch (e) { /* noop */ }
  }

  function applyRole(role) {
    var isAdmin = role === 'admin';
    var doc = document.documentElement;
    doc.classList.toggle('is-admin', isAdmin);
    keepAnalyticsOptOut(isAdmin);

    // Theme-Wahl ist Admin-only. Jetzt steht die echte Rolle fest -> Theme
    // angleichen: Nicht-Admins zurueck auf Dunkel zwingen (falls der frueh im
    // <head> gelesene Rollen-Cache noch kalt/veraltet war), Admins ihre
    // gespeicherte Wahl bzw. das OS-Theme geben. reconcile() lebt im Inline-
    // Script von Layout.astro (single source of truth fuers Painting).
    try { if (window.__vbReconcileTheme) window.__vbReconcileTheme(); } catch (e) { /* noop */ }
  }

  // ---- Zwei-Signal-Präsenz-Heartbeat --------------------------------------
  // last_seen   = "Tab offen"-Ping: alle 30s, SOLANGE der Tab offen ist (auch
  //               idle oder versteckt). Stoppt erst beim Schließen/Abmelden.
  // last_active = letzte Interaktion (Maus/Taste/Scroll/…). Trennt online (aktiv)
  //               von away (untätig).
  // Die Views leiten daraus ab: Tab offen + idle >3min = away (NIE offline);
  // Tab zu -> nach ~1min away, nach 3min offline. Läuft auf ALLEN Seiten
  // (account-lite ist überall eingebunden), frische Session pro Write.
  var HB_MS = 30000, hbLastActivity = Date.now(), hbStarted = false;
  function hbMarkActivity() { hbLastActivity = Date.now(); }
  function hbWrite() {
    ensureSession().then(function (sess) {
      if (!sess || !sess.user || !sess.user.id) return;
      rest(sess, 'PATCH', 'profiles?id=eq.' + sess.user.id, {
        last_seen: new Date().toISOString(),
        last_active: new Date(hbLastActivity).toISOString()
      }).catch(function () { /* noop */ });
    }).catch(function () { /* noop */ });
  }
  function startHeartbeat() {
    if (hbStarted) return;
    hbStarted = true;
    ['mousemove', 'mousedown', 'keydown', 'scroll', 'touchstart', 'pointerdown', 'wheel'].forEach(function (ev) {
      addEventListener(ev, hbMarkActivity, { passive: true });
    });
    // Bei Rückkehr auf den Tab sofort pingen (schnelleres Zurück-auf-online)
    document.addEventListener('visibilitychange', function () {
      if (document.visibilityState === 'visible') { hbMarkActivity(); hbWrite(); }
    });
    hbWrite();                                                 // sofort beim Laden
    setInterval(hbWrite, HB_MS);                               // Ping alle 30s, solange Tab offen
  }

  function boot() {
    ensureSession().then(function (sess) {
      paintNav(sess);
      initFavs(sess);

      if (sess) {
        startHeartbeat();
        // Parallel: Username + Rolle laden
        var unameP = fetchUsername(sess);
        var roleP = fetchUserRole(sess);

        unameP.then(function (uname) {
          if (uname) paintNav(sess, uname);
        });

        roleP.then(function (role) {
          applyRole(role);
        });
      } else {
        // Nicht eingeloggt — prüfen ob geschuetzte Seite
        applyRole(null);
      }
    });

    // Login/Logout in einem anderen Tab -> Nav nachziehen
    addEventListener('storage', function (e) {
      if (e.key !== STORE) return;
      // Role-Cache invalidieren bei Session-Wechsel
      try { sessionStorage.removeItem(ROLE_CACHE_KEY); } catch (ex) { /* noop */ }
      var sess = readRaw();
      paintNav(sess);
      // Seiten-Apps (crafting-app.js …) ziehen ihren Konto-Zustand nach.
      try { dispatchEvent(new Event('vb-account-session')); } catch (ex) { /* noop */ }
      if (sess) {
        startHeartbeat();
        fetchUsername(sess).then(function (uname) {
          if (uname) paintNav(sess, uname);
        });
        fetchUserRole(sess).then(function (role) {
          applyRole(role);
        });
      } else {
        applyRole(null);
      }
    });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();

  // ---- Testpilot-Ausweis: stille Erneuerung (Phase 14 Plan 08, D-08) -------
  // Der Ausweis (Cookie vb_gate) laeuft nach fuenf Minuten ab (nginx/gate.js).
  // Existiert das Begleit-Cookie vb_gate_exp NICHT, ist dieser ganze Block ein
  // reines No-Op — auf der LIVE-Seite gibt es dieses Cookie nie ($vb_gate_on
  // steht dort fest auf "0", D-12), und diese Datei liegt unveraendert auf
  // beiden Seiten. Das ist der Schalter, der ohne eine zweite Konfiguration
  // auskommt: kein STAGING-Flag hier noetig, das Cookie selbst entscheidet.
  var GATE_EXP_COOKIE = 'vb_gate_exp';
  var GATE_RENEW_MARGIN_S = 60; // 60s vor dem im Cookie genannten Ablauf erneuern
  var gateRenewTimer = null;
  var gateRenewPausedByHidden = false;

  function gateExp() {
    var m = document.cookie.match(/(?:^|;\s*)vb_gate_exp=([^;]*)/);
    var n = m ? parseInt(m[1], 10) : NaN;
    return Number.isFinite(n) ? n : null;
  }

  // Stellt den Ausweis neu aus. Ergebnis ist eines von drei Zustaenden:
  //   'ok'      — gemintet, das Cookie traegt einen neuen Ablaufzeitpunkt.
  //   'locked'  — der eigene Riegel (GATE_MINT_LOCK, seit WR-02) griff, weil
  //               ein ANDERER Tab gerade ausstellt — kein Fehler, nur zu
  //               frueh. Eigener Schluessel, NICHT LOCK von ensureSession():
  //               sonst wuerde der von hier gesetzte Riegel ensureSession()
  //               im selben Umlauf faelschlich einen fremden Refresh
  //               vortaeuschen.
  //   'failed'  — echtes Scheitern (kein Token, 401/403/503, Netzfehler).
  // Die Unterscheidung entscheidet, ob spaeter neu geplant wird: ein
  // 'locked'-Ergebnis darf es (der andere Tab hat das Cookie vermutlich
  // laengst erneuert), ein 'failed'-Ergebnis darf es NICHT — "schlaegt das
  // Ausstellen fehl, nicht weiterprobieren", der naechste Seitenaufruf landet
  // dann auf der Torseite, die erklaert, was los ist.
  function mintGatePass() {
    var now = Date.now();
    var lock = 0;
    try { lock = +localStorage.getItem(GATE_MINT_LOCK) || 0; } catch (e) { /* noop */ }
    if (now - lock < 10000) return Promise.resolve('locked');
    try { localStorage.setItem(GATE_MINT_LOCK, String(now)); } catch (e) { /* noop */ }

    return ensureSession().then(function (sess) {
      if (!sess || !sess.access_token) return 'failed';
      return fetch('/_gate/mint', {
        method: 'POST',
        headers: { Authorization: 'Bearer ' + sess.access_token },
      })
        .then(function (r) { return r.ok ? 'ok' : 'failed'; })
        .catch(function () { return 'failed'; });
    }).catch(function () { return 'failed'; });
  }

  function scheduleGateRenewal() {
    if (gateRenewTimer) { clearTimeout(gateRenewTimer); gateRenewTimer = null; }
    var exp = gateExp();
    if (exp === null) return; // kein Ausweis-Cookie -> nichts zu tun, nichts zu melden
    if (document.visibilityState === 'hidden') {
      // Aussetzen, solange der Tab im Hintergrund liegt (sonst haette ein
      // drei Stunden verstecktes Tab 36-mal ausgestellt) — visibilitychange
      // unten holt GENAU EINMAL nach, sobald der Tab wieder sichtbar wird.
      gateRenewPausedByHidden = true;
      return;
    }
    var fireInMs = (exp - GATE_RENEW_MARGIN_S) * 1000 - Date.now();
    if (fireInMs < 0) fireInMs = 0;
    gateRenewTimer = setTimeout(function () {
      mintGatePass().then(function (result) {
        // 'ok' -> anhand des FRISCHEN Cookies neu planen. 'locked' -> ein
        // anderer Tab stellt gerade aus, spaeter erneut anhand des dann
        // (vermutlich schon erneuerten) Cookies pruefen. 'failed' -> NICHT
        // weiterprobieren, siehe Kommentar an mintGatePass().
        if (result === 'ok') scheduleGateRenewal();
        else if (result === 'locked') gateRenewTimer = setTimeout(scheduleGateRenewal, 2000);
      });
    }, fireInMs);
  }

  document.addEventListener('visibilitychange', function () {
    if (document.visibilityState === 'hidden') {
      if (gateRenewTimer) { clearTimeout(gateRenewTimer); gateRenewTimer = null; }
      if (gateExp() !== null) gateRenewPausedByHidden = true;
    } else if (document.visibilityState === 'visible' && gateRenewPausedByHidden) {
      gateRenewPausedByHidden = false;
      mintGatePass().then(function (result) {
        if (result === 'ok' || result === 'locked') scheduleGateRenewal();
        // 'failed': nichts weiter — naechster Seitenaufruf zeigt die Torseite.
      });
    }
  });

  scheduleGateRenewal();
})();
