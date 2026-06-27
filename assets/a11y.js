/* Accessibility-Enhancement für Patch-Seiten — läuft NACH dem inline-Script,
   ergänzt Tastatur-Bedienbarkeit + Fokus-Management ohne die bestehenden
   Click-Handler zu ersetzen. (Topic-Seiten: gleiches Verhalten in detail.js.) */
(function(){
  // Bessere, eindeutige Namen für die Video-Play-Buttons (Button löst per Bubbling den vorhandenen Handler aus)
  document.querySelectorAll('.video[data-yt] .play').forEach(function(b){
    var v=b.closest('.video'), l=v&&v.querySelector('.vlbl');
    if(l) b.setAttribute('aria-label', l.textContent.trim()+' abspielen');
  });

  // Lightbox-/Info-Trigger fokussierbar + per Enter/Space bedienbar machen + benennen
  document.querySelectorAll('[data-lb],[data-info]').forEach(function(el){
    if(!el.matches('a,button')){ el.setAttribute('role','button'); if(!el.hasAttribute('tabindex')) el.setAttribute('tabindex','0'); }
    if(!el.getAttribute('aria-label')){
      var dt=el.getAttribute('data-title');
      if(!dt){ var c=el.querySelector('figcaption,.vlbl,.lbl,h3'); dt=c?c.textContent.replace(/\s+/g,' ').trim():''; }
      var isInfo=el.hasAttribute('data-info'), isYt=(el.getAttribute('data-lb')||'').indexOf('yt:')===0;
      el.setAttribute('aria-label',(isInfo?'Info: ':isYt?'Video abspielen: ':'Bild öffnen: ')+dt);
    }
    el.addEventListener('keydown',function(e){ if(e.key==='Enter'||e.key===' '){ e.preventDefault(); el.click(); } });
  });

  // Lightbox-Fokus: Auslöser merken, Fokus ins Modal / zurück, Tab im Modal fangen
  var lb=document.getElementById('lb');
  if(lb){
    lb.setAttribute('role','dialog'); lb.setAttribute('aria-modal','true');
    var last=null;
    document.querySelectorAll('[data-lb],[data-info]').forEach(function(el){ el.addEventListener('click',function(){ last=el; }); });
    new MutationObserver(function(){
      if(lb.classList.contains('open')){ var x=lb.querySelector('.lb__x'); if(x&&document.activeElement!==x) x.focus(); }
      else if(last){ last.focus(); last=null; }
    }).observe(lb,{attributes:true,attributeFilter:['class']});
    addEventListener('keydown',function(e){
      if(!lb.classList.contains('open')||e.key!=='Tab') return;
      var f=lb.querySelectorAll('button,a[href],iframe,[tabindex]:not([tabindex="-1"])');
      if(!f.length) return;
      var fi=f[0], la=f[f.length-1];
      if(e.shiftKey&&document.activeElement===fi){ e.preventDefault(); la.focus(); }
      else if(!e.shiftKey&&document.activeElement===la){ e.preventDefault(); fi.focus(); }
    });
  }
})();
