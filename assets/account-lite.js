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

  function rest(sess, method, path, body, prefer, signal) {
    return fetch(SB_URL + '/rest/v1/' + path, {
      signal: signal || undefined,
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
    /**
     * Authentifizierter PostgREST-Aufruf: rest(sess, 'GET', 'tabelle?select=*').
     * Optional: prefer (Prefer-Header) und signal (AbortSignal, bricht fetch ab).
     */
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
  var navName = '';
  function paintNav(sess, uname) {
    var els = document.querySelectorAll('.js-nav-acct');
    navName = (sess && uname) || '';
    if (!els.length) return;
    var loggedIn = !!sess;
    for (var i = 0; i < els.length; i++) {
      var el = els[i];
      var txt = el.querySelector('.js-nav-acct-txt');
      if (txt) txt.textContent = loggedIn ? (uname || el.getAttribute('data-l-acct')) : el.getAttribute('data-l-login');
      el.classList.toggle('is-authed', loggedIn);
    }
    paintBadge();
  }

  // ---- Zahl am Konto-Knopf -------------------------------------------------
  // Offene Freundschaftsanfragen an mich + ungelesene Nachrichten von
  // Freunden, auf jeder Seite. Gezaehlt wird wie in der Freundesleiste der
  // Kontoseite (FriendsDock): Nachrichten eines Ex-Freundes bleiben lesbar,
  // stehen dort aber in keiner Liste mehr -- hier mitgezaehlt, liesse sich
  // die Zahl nie wegklicken. Steht eine Zahl, fuehrt der Knopf direkt in den
  // Bereich Freunde. Abgefragt beim Laden, alle 60 s bei sichtbarem Tab und
  // bei Rueckkehr auf den Tab; auf der Kontoseite melden Freundesliste und
  // Chat ihren Stand sofort (vb:friends, vb:chat-unread).
  var BADGE_MS = 60000;
  var badge = { req: 0, msg: 0 };
  var badgeTimer = null;
  // Je Konto eine laufende Abfrage. Ein Kontowechsel zaehlt badgeGen hoch:
  // die Abfrage fuers alte Konto haelt den Riegel dann nicht mehr fest.
  var badgeGen = 1;
  var badgeBusy = 0;

  function badgeSummary() {
    var parts = [];
    if (badge.req) parts.push(badge.req + (IS_DE ? (badge.req === 1 ? ' neue Freundschaftsanfrage' : ' neue Freundschaftsanfragen') : (badge.req === 1 ? ' friend request' : ' friend requests')));
    if (badge.msg) parts.push(badge.msg + (IS_DE ? (badge.msg === 1 ? ' ungelesene Nachricht' : ' ungelesene Nachrichten') : (badge.msg === 1 ? ' unread message' : ' unread messages')));
    return parts.join(' · ');
  }

  function badgeShort() {
    var parts = [];
    if (badge.req) parts.push(badge.req + (IS_DE ? (badge.req === 1 ? ' Anfrage' : ' Anfragen') : (badge.req === 1 ? ' request' : ' requests')));
    if (badge.msg) parts.push(badge.msg + (IS_DE ? (badge.msg === 1 ? ' Nachricht' : ' Nachrichten') : (badge.msg === 1 ? ' message' : ' messages')));
    return parts.join(' · ');
  }

  function paintBadge() {
    var loggedIn = !!shown;
    var n = loggedIn ? badge.req + badge.msg : 0;
    var label = n > 99 ? '99+' : String(n);
    var sum = n ? badgeSummary() : '';
    var dots = document.querySelectorAll('.js-nav-badge');
    for (var i = 0; i < dots.length; i++) {
      dots[i].textContent = n ? label : '';
      dots[i].hidden = !n;
    }
    var els = document.querySelectorAll('.js-nav-acct');
    for (var j = 0; j < els.length; j++) {
      var el = els[j];
      var dash = el.getAttribute('data-dash');
      el.href = loggedIn ? (n ? dash + '#friends' : dash) : el.getAttribute('data-login');
      el.title = [navName, sum].filter(Boolean).join(' · ');
      el.classList.toggle('has-badge', !!n);
      ariaWith(el, sum);
      // Im Menue steht unter dem Namen dann, was wartet, statt der Rubriken.
      var sub = el.querySelector('.snav-deck__sub');
      if (sub) {
        if (!sub.hasAttribute('data-sub0')) sub.setAttribute('data-sub0', sub.textContent);
        sub.textContent = n ? badgeShort() : sub.getAttribute('data-sub0');
      }
    }
    var menu = document.getElementById('snavMenuBtn');
    if (menu) ariaWith(menu, sum);
  }

  // Die Zahl selbst ist aria-hidden; Vorleser hoeren sie am Knopf mit.
  function ariaWith(el, sum) {
    if (!el.hasAttribute('data-aria0')) {
      if (!el.hasAttribute('aria-label')) return;
      el.setAttribute('data-aria0', el.getAttribute('aria-label'));
    }
    var base = el.getAttribute('data-aria0');
    el.setAttribute('aria-label', sum ? base + ' (' + sum + ')' : base);
  }

  function setBadge(req, msg) {
    if (req === badge.req && msg === badge.msg) return;
    badge.req = req;
    badge.msg = msg;
    paintBadge();
  }

  function rows(r) { return r && r.ok ? r.json() : Promise.reject(r && r.status); }

  // Eine gescheiterte Abfrage laesst die letzte Zahl stehen, statt sie zu
  // loeschen: lieber eine Minute alt als ein falsches "nichts Neues".
  function fetchBadge() {
    if (badgeBusy === badgeGen || !shown) return;
    var gen = badgeBusy = badgeGen;
    ensureSession().then(function (sess) {
      var me = userOf(sess);
      if (!me || me !== userOf(shown)) return null;
      return Promise.all([
        rest(sess, 'GET', 'friend_requests?select=id&receiver_id=eq.' + me + '&status=eq.pending&limit=100').then(rows),
        rest(sess, 'GET', 'direct_messages?select=sender_id&receiver_id=eq.' + me + '&read_at=is.null&limit=500').then(rows),
      ]).then(function (res) {
        var senders = res[1] || [];
        if (!senders.length) return [res[0].length, 0];
        return rest(sess, 'GET', 'friends?select=user_id,friend_id&limit=1000').then(rows).then(function (fr) {
          var mine = {};
          for (var i = 0; i < fr.length; i++) mine[fr[i].user_id === me ? fr[i].friend_id : fr[i].user_id] = 1;
          var n = 0;
          for (var j = 0; j < senders.length; j++) if (mine[senders[j].sender_id]) n++;
          return [res[0].length, n];
        });
      }).then(function (out) {
        if (out && gen === badgeGen && me === userOf(shown)) setBadge(out[0], out[1]);
      });
    }).catch(function () { /* naechster Takt */ }).then(function () { if (badgeBusy === gen) badgeBusy = 0; });
  }

  function startBadge() {
    if (badgeTimer) return;
    fetchBadge();
    badgeTimer = setInterval(function () {
      if (document.visibilityState === 'visible') fetchBadge();
    }, BADGE_MS);
  }

  function stopBadge() {
    if (badgeTimer) { clearInterval(badgeTimer); badgeTimer = null; }
    badgeGen++;
    badge.req = 0;
    badge.msg = 0;
  }

  document.addEventListener('visibilitychange', function () {
    if (document.visibilityState === 'visible' && badgeTimer) fetchBadge();
  });
  // Kontoseite: Freundesliste und Chat kennen den Stand zuerst (Annehmen,
  // Lesen, neue Nachricht per Realtime). Ihre Zahlen gelten sofort.
  document.addEventListener('vb:friends', function (e) {
    var d = e && e.detail;
    if (shown && d && d.incoming) setBadge(d.incoming.length, badge.msg);
  });
  document.addEventListener('vb:chat-unread', function (e) {
    var n = e ? Number(e.detail) : NaN;
    if (shown && n >= 0) setBadge(badge.req, n);
  });

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
  // im sessionStorage; nach fuenf Minuten fragt sie neu. Eine gescheiterte
  // Abfrage (401 bei abgelaufenem Token, 5xx) sagt nichts ueber die Rolle und
  // wird nicht gemerkt: es gilt die letzte echte Antwort fuer dieses Konto,
  // ohne eine "user". Das Kopfskript in Layout.astro malt das erste Bild aus
  // demselben Eintrag, ebenfalls nur fuer das Konto der gespeicherten Sitzung.
  var ROLE_CACHE_KEY = 'vb_user_role';

  function knownRole(sess) {
    try {
      var known = JSON.parse(sessionStorage.getItem(ROLE_CACHE_KEY));
      return known.uid === sess.user.id ? known : null;
    } catch (e) { return null; }
  }

  function fetchUserRole(sess) {
    if (!sess || !sess.user || !sess.user.id) return Promise.resolve(null);

    var known = knownRole(sess);
    if (known && known.ts > Date.now() - 300000) return Promise.resolve(known.role);

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
      .catch(function () {
        var last = knownRole(sess);
        return last ? last.role : 'user';
      });
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

  // Rich Presence: WAS man gerade macht, als 'art|Name' (Anzeige formt
  // src/lib/presence.ts formatActivity). Nur aus der Adresse und der Seite
  // selbst gelesen, kein Eingriff in Hangar- oder Loadout-Skripte: beide
  // tragen das Schiff in ?ship=. Sichtbar nur fuer Freunde (social_profiles).
  function shipName(slug) {
    if (!slug) return '';
    var t = String(slug).toLowerCase().split('-').filter(Boolean);
    if (t.length > 1 && /^[a-z]{3,4}$/.test(t[0])) t.shift();     // Herstellerkuerzel (aegs-, drak-, rsi-)
    return t.map(function (w) {
      if (/^(i|ii|iii|iv|v|vi)$/.test(w) || /^[a-z]+\d/.test(w)) return w.toUpperCase();
      return w.charAt(0).toUpperCase() + w.slice(1);
    }).join(' ').slice(0, 60);
  }
  function currentActivity() {
    var p = location.pathname.replace(/^\/de(?=\/)/, '');
    var ship = '';
    try { ship = new URLSearchParams(location.search).get('ship') || ''; } catch (e) { /* noop */ }
    if (p === '/hangar.html') return 'hangar|' + shipName(ship);
    if (p === '/hangar-loadout.html') return 'loadout|' + shipName(ship);
    var m = /^\/schiffe\/([a-z0-9-]+)\.html$/.exec(p);
    if (m) {
      var h1 = document.querySelector('h1');
      var name = h1 && h1.textContent ? h1.textContent.trim().replace(/\s+/g, ' ') : '';
      return 'ship|' + (name && name.length <= 60 ? name : shipName(m[1]));
    }
    if (/^\/(topics\/mining|mining|refinery)/.test(p)) return 'mining|';
    return null;
  }

  // Kennt die Datenbank activity (noch) nicht, antwortet PostgREST 400 --
  // dann ohne activity nachsenden und es in diesem Tab nicht mehr versuchen,
  // damit die Praesenz nie an der Zusatzangabe haengt.
  var hbActivityOk = true;
  // Schalter "Freunde sehen, was ich gerade mache" (profiles.share_activity):
  // ist er aus, schickt der Puls gar keine Angabe mit, statt sie nur vom View
  // verstecken zu lassen. Quelle: die Antwort des letzten Pulses, vorher der
  // Profil-Cache des Konto-Dashboards; unbekannt = an (Vorgabe der Spalte).
  var hbShare = null;
  function hbShareOf(uid) {
    if (hbShare !== null) return hbShare;
    try {
      var p = JSON.parse(localStorage.getItem('vb_profile_' + uid) || 'null');
      if (p && p.share_activity === false) return false;
    } catch (e) { /* noop */ }
    return true;
  }
  function hbWrite() {
    ensureSession().then(function (sess) {
      if (!sess || !sess.user || !sess.user.id) return;
      var base = {
        last_seen: new Date().toISOString(),
        last_active: new Date(hbLastActivity).toISOString()
      };
      var path = 'profiles?id=eq.' + sess.user.id;
      if (!hbActivityOk) { rest(sess, 'PATCH', path, base).catch(function () { /* noop */ }); return; }
      var act = hbShareOf(sess.user.id) ? currentActivity() : null;
      var body = { last_seen: base.last_seen, last_active: base.last_active, activity: act, activity_at: base.last_seen };
      rest(sess, 'PATCH', path + '&select=share_activity', body, 'return=representation').then(function (r) {
        if (r && r.status === 400) {
          hbActivityOk = false;
          return rest(sess, 'PATCH', path, base);
        }
        if (r && r.ok) {
          return r.json().then(function (rows) {
            if (rows && rows[0] && typeof rows[0].share_activity === 'boolean') hbShare = rows[0].share_activity;
          }).catch(function () { /* noop */ });
        }
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

  // Die Sitzung, die die Nav gerade zeigt. Name und Rolle gehoeren dem Konto,
  // nicht dem Token: eine spaete Antwort zeichnet nur, solange die Nav noch
  // dasselbe Konto zeigt. Nach dem Abmelden oder einem Kontowechsel zeichnet
  // sie nichts mehr, nach einem neuen Token desselben Kontos weiter.
  var shown = null;

  function userOf(sess) { return (sess && sess.user && sess.user.id) || null; }

  function show(sess) {
    var was = userOf(shown);
    shown = sess;
    if (!sess || userOf(sess) !== was) stopBadge();
    paintNav(sess);
    if (sess) {
      startHeartbeat();
      startBadge();
      fetchUsername(sess).then(function (uname) {
        if (uname && userOf(shown) === userOf(sess)) paintNav(sess, uname);
      });
      fetchUserRole(sess).then(function (role) {
        if (userOf(shown) === userOf(sess)) applyRole(role);
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

    // Login, Logout oder Kontowechsel in einem anderen Tab -> Nav nachziehen.
    // Ein neues Token desselben Kontos (der Refresh eines anderen Tabs, alle
    // rund 60 Minuten) aendert Name und Rolle nicht, wie im eigenen Tab: kein
    // Zwischenbild ohne Namen, und der Rollen-Cache bleibt, sonst nahm eine
    // gerade scheiternde Rollenabfrage einem Admin die Rolle.
    addEventListener('storage', function (e) {
      if (e.key === STORE) follow();
    });
    // Aus dem bfcache zurueck (Zurueck-Knopf): storage-Ereignisse, waehrend
    // die Seite dort lag, kamen nie an. Hat sich der Besucher inzwischen
    // anderswo ab- oder umgemeldet, zeigte die Nav sonst das alte Konto samt
    // Admin-Klasse, bis zum naechsten Seitenaufruf.
    addEventListener('pageshow', function (e) {
      if (e && e.persisted) follow();
    });
  }

  // Die gespeicherte Sitzung gilt: zeichnen, wenn sie einem anderen Konto
  // gehoert als dem gezeigten (oder keinem mehr), und den Seiten-Apps
  // (crafting-app.js, fleet.js …) melden, damit sie ihren Konto-Zustand
  // nachziehen.
  function follow() {
    var now = readRaw();
    if (userOf(now) !== userOf(shown)) {
      try { sessionStorage.removeItem(ROLE_CACHE_KEY); } catch (ex) { /* noop */ }
      show(now);
    }
    announce();
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
