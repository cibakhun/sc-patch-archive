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

  function rest(sess, method, path, body) {
    return fetch(SB_URL + '/rest/v1/' + path, {
      method: method,
      headers: {
        apikey: SB_KEY,
        Authorization: 'Bearer ' + sess.access_token,
        'Content-Type': 'application/json',
        Prefer: method === 'POST' ? 'return=minimal' : 'count=none',
      },
      body: body ? JSON.stringify(body) : undefined,
    });
  }

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
            var login = (IS_DE ? '/de' : '') + '/account/login.html';
            location.href = login + '?next=' + encodeURIComponent(location.pathname + location.search);
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

  function applyRestrictions(role) {
    var isAdmin = role === 'admin';
    var doc = document.documentElement;
    doc.classList.toggle('is-admin', isAdmin);

    // Theme-Wahl ist Admin-only. Jetzt steht die echte Rolle fest -> Theme
    // angleichen: Nicht-Admins zurueck auf Dunkel zwingen (falls der frueh im
    // <head> gelesene Rollen-Cache noch kalt/veraltet war), Admins ihre
    // gespeicherte Wahl bzw. das OS-Theme geben. reconcile() lebt im Inline-
    // Script von Layout.astro (single source of truth fuers Painting).
    try { if (window.__vbReconcileTheme) window.__vbReconcileTheme(); } catch (e) { /* noop */ }

    // Archiv- und Patch-Seiten: nur fuer Admins sichtbar
    var path = location.pathname.toLowerCase();
    var isArchivePage = path.indexOf('/archiv') !== -1 || path.indexOf('/patches/') !== -1;
    var isAccountPage = (path.indexOf('/account') !== -1)
      && path.indexOf('/account/login') === -1
      && path.indexOf('/account/register') === -1
      && path.indexOf('/account/reset') === -1
      && path.indexOf('/account/update-password') === -1;

    if ((isArchivePage || isAccountPage) && !isAdmin) {
      if (document.body) document.body.style.display = 'none';
      var home = IS_DE ? '/de.html' : '/';
      location.replace(home);
    }

    // Nav-Links mit data-restricted ausblenden fuer Nicht-Admins
    var restricted = document.querySelectorAll('[data-restricted]');
    for (var i = 0; i < restricted.length; i++) {
      restricted[i].style.display = isAdmin ? '' : 'none';
    }
  }

  function boot() {
    ensureSession().then(function (sess) {
      paintNav(sess);
      initFavs(sess);

      if (sess) {
        // Parallel: Username + Rolle laden
        var unameP = fetchUsername(sess);
        var roleP = fetchUserRole(sess);

        unameP.then(function (uname) {
          if (uname) paintNav(sess, uname);
        });

        roleP.then(function (role) {
          applyRestrictions(role);
        });
      } else {
        // Nicht eingeloggt — prüfen ob geschuetzte Seite
        applyRestrictions(null);
      }
    });

    // Login/Logout in einem anderen Tab -> Nav nachziehen
    addEventListener('storage', function (e) {
      if (e.key !== STORE) return;
      // Role-Cache invalidieren bei Session-Wechsel
      try { sessionStorage.removeItem(ROLE_CACHE_KEY); } catch (ex) { /* noop */ }
      var sess = readRaw();
      paintNav(sess);
      if (sess) {
        fetchUsername(sess).then(function (uname) {
          if (uname) paintNav(sess, uname);
        });
        fetchUserRole(sess).then(function (role) {
          applyRestrictions(role);
        });
      } else {
        applyRestrictions(null);
      }
    });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();
