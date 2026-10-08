// VerseBase account-lite — Session-Anzeige für ALLE Seiten außerhalb von
// /account/ (dort läuft das volle supabase-js).
// Bewusst SDK-frei (~4 KB): liest die supabase-js-Session aus localStorage,
// refresht sie bei Bedarf über die Auth-REST-API im selben Speicherformat und
// reicht Session + PostgREST-Aufruf an Seiten-Skripte weiter (VBAccount). Die
// Schiffs-Favoriten (die Flotte) bedient assets/fleet.js. RLS schützt die
// Daten; der Publishable Key ist öffentlich.
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

  function usable(sess) {
    return expiresIn(sess) > 0 ? sess : null;
  }

  // Ein Refresh je Tab. Wer fragt, waehrend er laeuft, bekommt sein Ergebnis:
  // null hiesse fuer ein Seitenskript "abgemeldet", und das storage-Ereignis,
  // das den Irrtum aufloesen koennte, meldet der Browser nur ANDEREN Tabs.
  var refreshing = null;
  // Ein haengender Refresh hielte sonst jeden Aufrufer dieses Tabs fest
  // (Navigation, Heartbeat, Seitenskripte ohne eigene Frist). Landet er
  // spaeter doch, meldet vb-account-session die neue Sitzung.
  var REFRESH_MS = 15000;

  function announce() {
    try { dispatchEvent(new Event('vb-account-session')); } catch (e) { /* noop */ }
  }

  // Nur eine Ablehnung des Tokens (400/401/403) meldet ab. 5xx, 429 oder ein
  // fehlendes Netz lassen die Sitzung liegen, der naechste Versuch kann gelingen.
  function refresh(sess) {
    return fetch(SB_URL + '/auth/v1/token?grant_type=refresh_token', {
      method: 'POST',
      headers: { apikey: SB_KEY, 'Content-Type': 'application/json' },
      body: JSON.stringify({ refresh_token: sess.refresh_token }),
    })
      .then(function (r) {
        if (r.status === 400 || r.status === 401 || r.status === 403) return swap(sess, null);
        if (!r.ok) return unchanged();
        return r.json().then(function (fresh) {
          if (!fresh || !fresh.access_token) return unchanged();
          if (!fresh.expires_at) fresh.expires_at = Math.floor(Date.now() / 1000) + (fresh.expires_in || 3600);
          return swap(sess, fresh);
        });
      })
      .catch(unchanged);
  }

  // Schreibt dieser Refresh nichts, bekommen seine Aufrufer, was jetzt
  // gespeichert ist: ein anderer Tab kann waehrenddessen erneuert haben.
  function unchanged() {
    return { sess: usable(readRaw()), changed: false };
  }

  // Eine Antwort gilt nur, solange noch die Sitzung gespeichert ist, fuer die
  // gefragt wurde. Wer inzwischen geschrieben hat, schrieb einen neueren Stand:
  // ein anderer Tab oder /account/ hat dieselbe Sitzung erneuert, oder der
  // Besucher hat sich ab- oder neu angemeldet (beim Abmelden loescht GoTrue die
  // Sitzung, die spaete Antwort ist dann 400 oder eine Sitzung von vorher).
  function swap(sent, next) {
    var stored = readRaw();
    if (!stored || stored.refresh_token !== sent.refresh_token) return unchanged();
    if (next) { try { localStorage.setItem(STORE, JSON.stringify(next)); } catch (e) { /* noop */ } }
    else clearSession();
    return { sess: next, changed: true };
  }

  // Refresht die Session, wenn sie (fast) abgelaufen ist. Die Sperre haelt 10 s
  // lang jeden weiteren Refresh zurueck, auch in diesem Tab; die Frist gibt die
  // Aufrufer nach 15 s frei. Danach darf dasselbe Token noch einmal gehen: das
  // ist der Weg aus einem verlorenen Refresh. GoTrue v2.197.0 gibt fuer das
  // Eltern-Token des aktiven Tokens das aktive zurueck, ohne Zeitgrenze
  // (internal/tokens/service.go; gilt fuer v1-Tokens, die diese Anlage am
  // 08.10.2026 ausschliesslich hatte). Abgelehnt wird erst ein aelteres Token
  // nach Ablauf der Wiederverwendungsfrist.
  function ensureSession() {
    var sess = readRaw();
    if (!sess || !sess.refresh_token) return Promise.resolve(null);
    if (expiresIn(sess) > 60) return Promise.resolve(sess);
    if (refreshing) return refreshing;

    var now = Date.now();
    var lock = 0;
    try { lock = +localStorage.getItem(LOCK) || 0; } catch (e) { /* noop */ }
    if (now - lock < 10000) return Promise.resolve(usable(sess));
    try { localStorage.setItem(LOCK, String(now)); } catch (e) { /* noop */ }

    var mine = refreshing = new Promise(function (resolve) {
      var timer = setTimeout(function () { resolve(usable(readRaw())); }, REFRESH_MS);
      refresh(sess).then(function (out) {
        clearTimeout(timer);
        resolve(out.sess);
        if (out.changed) announce();
      });
    });
    mine.then(function () { if (refreshing === mine) refreshing = null; });
    return mine;
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
    /**
     * Gültige Session oder null. Refresht bei Bedarf; wer während eines Refreshs
     * fragt, wartet auf dessen Ergebnis. Nach einem Refresh in diesem Tab kommt
     * vb-account-session wie nach einem Wechsel in einem anderen Tab.
     */
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
      el.title = uname || '';
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

  // ---- Rollen-basierter Zugriffs-Guard (user_roles Tabelle) ----------------
  // Fragt die user_roles Tabelle via PostgREST ab und merkt sich die Antwort
  // fuenf Minuten im sessionStorage. Eine gescheiterte Abfrage (401 bei
  // abgelaufenem Token, 5xx) gilt als "user", wird aber nicht gemerkt: sie
  // sagt nichts ueber die Rolle.
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
      .then(function (r) { return r.ok ? r.json() : Promise.reject(r.status); })
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

  // Die Sitzung, die die Nav gerade zeigt. Antworten zu Name und Rolle gelten
  // nur fuer sie: nach dem Abmelden oder einem Kontowechsel zeichnet eine
  // spaete Antwort nichts mehr.
  var shown = null;

  function show(sess) {
    shown = sess;
    paintNav(sess);
    if (sess) {
      startHeartbeat();
      fetchUsername(sess).then(function (uname) {
        if (uname && shown === sess) paintNav(sess, uname);
      });
      fetchUserRole(sess).then(function (role) {
        if (shown === sess) applyRole(role);
      });
    } else {
      applyRole(null);
    }
  }

  function boot() {
    ensureSession().then(function (sess) {
      show(sess);
      // Meldet ein Refresh DIESES Tabs danach an oder ab (etwa einer, der erst
      // nach der Frist landet), kommt nur vb-account-session: storage meldet
      // der Browser nur anderen Tabs. Gezeichnet wird nur der Wechsel zwischen
      // an- und abgemeldet. Ein neues Token derselben Sitzung aendert nichts,
      // und Wechsel aus anderen Tabs zeigt schon der storage-Hoerer.
      addEventListener('vb-account-session', function () {
        var now = readRaw();
        if (!!now !== !!shown) show(now);
      });
    });

    // Login/Logout in einem anderen Tab -> Nav nachziehen
    addEventListener('storage', function (e) {
      if (e.key !== STORE) return;
      // Role-Cache invalidieren bei Session-Wechsel
      try { sessionStorage.removeItem(ROLE_CACHE_KEY); } catch (ex) { /* noop */ }
      show(readRaw());
      // Seiten-Apps (crafting-app.js …) ziehen ihren Konto-Zustand nach.
      announce();
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
