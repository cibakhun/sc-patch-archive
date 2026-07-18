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
  function paintNav(sess) {
    var els = document.querySelectorAll('.js-nav-acct');
    if (!els.length) return;
    var loggedIn = !!sess;
    for (var i = 0; i < els.length; i++) {
      var el = els[i];
      el.href = loggedIn ? el.getAttribute('data-dash') : el.getAttribute('data-login');
      var txt = el.querySelector('.js-nav-acct-txt');
      if (txt) txt.textContent = loggedIn ? el.getAttribute('data-l-acct') : el.getAttribute('data-l-login');
      el.classList.toggle('is-authed', loggedIn);
    }
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

        rest(sess, 'GET', q)
          .then(function (r) { return r.ok ? r.json() : []; })
          .then(function (rows) {
            favId = rows && rows.length ? rows[0].id : null;
            paint(btn, !!favId);
            btn.removeAttribute('data-fav-wait');
          })
          .catch(function () { paint(btn, false); });

        btn.addEventListener('click', function () {
          if (busy) return;
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

  function boot() {
    ensureSession().then(function (sess) {
      paintNav(sess);
      initFavs(sess);
    });
    // Login/Logout in einem anderen Tab -> Nav nachziehen
    addEventListener('storage', function (e) {
      if (e.key === STORE) paintNav(readRaw());
    });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();
