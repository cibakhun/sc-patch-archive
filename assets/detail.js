/* SC Patch-Archiv — shared detail-page behavior (assets/detail.js)
   topbar scroll · cursor glow · scroll-reveal · click-to-load video ·
   lightbox (img / yt / info) · themed star canvas. Theme-agnostic:
   reads --accent/--accent-2 from the page for the starfield colors. */
(function(){
  var tb=document.getElementById('topbar');
  if(tb) addEventListener('scroll',function(){tb.classList.toggle('scrolled',scrollY>40);},{passive:true});
  addEventListener('pointermove',function(e){
    document.documentElement.style.setProperty('--mx',e.clientX+'px');
    document.documentElement.style.setProperty('--my',e.clientY+'px');
  },{passive:true});

  var io=new IntersectionObserver(function(es){es.forEach(function(e){if(e.isIntersecting){e.target.classList.add('in');io.unobserve(e.target);}});},{threshold:.12});
  document.querySelectorAll('.reveal').forEach(function(el){io.observe(el);});

  // Click-to-load video — the inner .play <button> is the keyboard-accessible trigger
  document.querySelectorAll('.video[data-yt]').forEach(function(v){
    var btn=v.querySelector('.play'), lbl=v.querySelector('.vlbl');
    if(btn&&lbl) btn.setAttribute('aria-label', lbl.textContent.trim()+' abspielen');
    function load(){
      var id=v.getAttribute('data-yt');
      v.innerHTML='<iframe src="https://www.youtube.com/embed/'+id+'?autoplay=1&rel=0" title="'+((lbl&&lbl.textContent.trim())||'Video')+'" allow="autoplay; encrypted-media; fullscreen; picture-in-picture" allowfullscreen></iframe>';
    }
    (btn||v).addEventListener('click',load,{once:true});
  });

  var lb=document.getElementById('lb');
  if(lb){
    var lbc=lb.querySelector('.lb__content'), lastTrigger=null;
    lb.setAttribute('role','dialog'); lb.setAttribute('aria-modal','true');
    function esc(s){return (s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');}
    function txtOf(el){
      var t=el.getAttribute('data-title');
      if(!t){var c=el.querySelector('figcaption,.vlbl,.lbl,h3,.tn');t=c?c.textContent:(el.textContent||'');}
      return (t||'').replace(/\s+/g,' ').trim();
    }
    function show(h){lbc.innerHTML=h;lb.classList.add('open');lb.setAttribute('aria-hidden','false');var x=lb.querySelector('.lb__x');if(x)x.focus();}
    function close(){lb.classList.remove('open');lbc.innerHTML='';lb.setAttribute('aria-hidden','true');if(lastTrigger){lastTrigger.focus();lastTrigger=null;}}
    function activable(el,handler){
      if(!el.matches('a,button')){el.setAttribute('role','button');if(!el.hasAttribute('tabindex'))el.setAttribute('tabindex','0');}
      el.addEventListener('click',handler);
      el.addEventListener('keydown',function(e){if(e.key==='Enter'||e.key===' '){e.preventDefault();handler();}});
    }
    document.querySelectorAll('[data-lb]').forEach(function(el){
      var isYt=(el.getAttribute('data-lb')||'').indexOf('yt:')===0;
      if(!el.getAttribute('aria-label'))el.setAttribute('aria-label',(isYt?'Video abspielen: ':'Bild öffnen: ')+txtOf(el));
      activable(el,function(){
        lastTrigger=el; var v=el.getAttribute('data-lb');
        if(isYt){show('<div class="ratio"><iframe src="https://www.youtube.com/embed/'+v.slice(3)+'?autoplay=1&rel=0" title="'+esc(txtOf(el)||'Video')+'" allow="autoplay; encrypted-media; fullscreen; picture-in-picture" allowfullscreen></iframe></div>');}
        else{show('<img src="'+v.slice(4)+'" alt="'+esc(txtOf(el)||'Bild')+'">');}
      });
    });
    document.querySelectorAll('[data-info]').forEach(function(el){
      var ti=el.getAttribute('data-title')||'';
      if(!el.getAttribute('aria-label'))el.setAttribute('aria-label','Info: '+ti);
      activable(el,function(){
        lastTrigger=el; var img=el.getAttribute('data-img'),t=esc(ti),tx=esc(el.getAttribute('data-text'));
        show('<div class="lb__info">'+(img?'<img src="'+img+'" alt="'+t+'">':'')+'<div class="lb__txt"><h3>'+t+'</h3><p>'+tx+'</p></div></div>');
      });
    });
    lb.addEventListener('click',function(e){if(e.target===lb||e.target.closest('.lb__x'))close();});
    addEventListener('keydown',function(e){
      if(!lb.classList.contains('open'))return;
      if(e.key==='Escape'){close();return;}
      if(e.key==='Tab'){
        var f=lb.querySelectorAll('button,a[href],iframe,[tabindex]:not([tabindex="-1"])');
        if(!f.length)return;
        var first=f[0],last=f[f.length-1];
        if(e.shiftKey&&document.activeElement===first){e.preventDefault();last.focus();}
        else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first.focus();}
      }
    });
  }

  var c=document.getElementById('stars');
  if(c){
    var x=c.getContext('2d'),w,h,st;
    var cs=getComputedStyle(document.documentElement);
    var A=(cs.getPropertyValue('--accent')||'#7fb2d9').trim(),A2=(cs.getPropertyValue('--accent-2')||'#d4af37').trim();
    var COL=[A,A2,'#ffffff','#9aa8c9'];
    function size(){w=c.width=innerWidth;h=c.height=Math.max(innerHeight,1);st=Array.from({length:Math.min(140,Math.floor(w/10))},function(){return {x:Math.random()*w,y:Math.random()*h,r:Math.random()*1.5+.3,a:Math.random(),s:Math.random()*.014+.004,c:COL[Math.floor(Math.random()*COL.length)]};});}
    function tick(){x.clearRect(0,0,w,h);for(var i=0;i<st.length;i++){var s=st[i];s.a+=s.s;var o=.25+Math.abs(Math.sin(s.a))*.7;x.globalAlpha=o;x.fillStyle=s.c;x.beginPath();x.arc(s.x,s.y,s.r,0,7);x.fill();}x.globalAlpha=1;requestAnimationFrame(tick);}
    size();addEventListener('resize',size);if(!matchMedia('(prefers-reduced-motion:reduce)').matches)tick();
  }

  var reduce=matchMedia('(prefers-reduced-motion:reduce)').matches;

  // Warm-accent test: embers are a fire/ember mood, so only warm-themed
  // pages (Pyro/Engineering/Onyx/gold) get them — cold pages (Nyx, Storm,
  // Server Meshing, Medical, Resource Drive …) would look off with rising "sparks".
  function accentIsWarm(){
    var v=(getComputedStyle(document.documentElement).getPropertyValue('--accent')||'').trim();
    var m=v.match(/^#?([0-9a-f]{6})$/i); if(!m) return true; // unknown → keep old behavior
    var n=parseInt(m[1],16),r=(n>>16&255)/255,g=(n>>8&255)/255,b=(n&255)/255;
    var mx=Math.max(r,g,b),mn=Math.min(r,g,b),d=mx-mn; if(d<.04) return false; // near-grey → no embers
    var hh; if(mx===r)hh=((g-b)/d)%6; else if(mx===g)hh=(b-r)/d+2; else hh=(r-g)/d+4;
    hh*=60; if(hh<0)hh+=360; return hh<=55||hh>=330; // red→amber/gold wedge
  }

  // ---- Ember / spark field (Pyro mood) — warm pages only ----
  if(!reduce && accentIsWarm()){
    var ec=document.createElement('canvas');ec.id='embers';document.body.appendChild(ec);
    var ex=ec.getContext('2d'),ew,eh,emb;
    var AC=(getComputedStyle(document.documentElement).getPropertyValue('--accent')||'#ff5a1f').trim();
    function mkE(){return {x:Math.random()*ew,y:eh+Math.random()*eh,r:Math.random()*2+.5,sp:Math.random()*.5+.18,dr:(Math.random()-.5)*.35,a:Math.random()*.55+.18,t:Math.random()*6.28};}
    function esize(){ew=ec.width=innerWidth;eh=ec.height=innerHeight;emb=Array.from({length:Math.min(70,Math.floor(ew/22))},mkE);}
    function etick(){ex.clearRect(0,0,ew,eh);for(var i=0;i<emb.length;i++){var e=emb[i];e.y-=e.sp;e.t+=.02;e.x+=e.dr+Math.sin(e.t)*.2;if(e.y<-12){emb[i]=mkE();emb[i].y=eh+12;}ex.globalAlpha=e.a*(.5+Math.abs(Math.sin(e.t))*.5);ex.fillStyle=AC;ex.beginPath();ex.arc(e.x,e.y,e.r,0,7);ex.fill();}ex.globalAlpha=1;requestAnimationFrame(etick);}
    esize();addEventListener('resize',esize);etick();
  }

  // ---- Parallax on tagged bg layers ----
  var pars=[].slice.call(document.querySelectorAll('[data-par]'));
  if(pars.length && !reduce){
    var pTicking=false;
    function ppos(){pars.forEach(function(el){var sp=parseFloat(el.getAttribute('data-par'))||.12;var p=el.parentElement.getBoundingClientRect();var off=(p.top+p.height/2)-innerHeight/2;el.style.transform='translateY('+(off*sp*-1).toFixed(1)+'px) scale(1.18)';});pTicking=false;}
    addEventListener('scroll',function(){if(!pTicking){requestAnimationFrame(ppos);pTicking=true;}},{passive:true});
    addEventListener('resize',ppos);ppos();
  }

  // ---- Animated counters ----
  var counters=[].slice.call(document.querySelectorAll('.count[data-to]'));
  if(counters.length){
    var cio=new IntersectionObserver(function(es){es.forEach(function(e){if(e.isIntersecting){animc(e.target);cio.unobserve(e.target);}});},{threshold:.6});
    counters.forEach(function(c){cio.observe(c);});
  }
  function animc(el){var to=parseFloat(el.getAttribute('data-to'))||0;var suf=el.getAttribute('data-suffix')||'';if(reduce){el.textContent=to+suf;return;}var dur=1200,t0=null;function step(ts){if(!t0)t0=ts;var p=Math.min((ts-t0)/dur,1);var v=Math.floor(to*(1-Math.pow(1-p,3)));el.textContent=v+suf;if(p<1)requestAnimationFrame(step);}requestAnimationFrame(step);}

  // ---- Scrollytelling ----
  [].slice.call(document.querySelectorAll('.scrolly')).forEach(function(sc){
    var steps=[].slice.call(sc.querySelectorAll('.sstep'));
    var frames=[].slice.call(sc.querySelectorAll('.scrolly__media .frame'));
    function setActive(i){steps.forEach(function(s,k){s.classList.toggle('active',k===i);});frames.forEach(function(f,k){f.classList.toggle('active',k===i);});}
    setActive(0);
    var sio=new IntersectionObserver(function(es){es.forEach(function(e){if(e.isIntersecting){var i=steps.indexOf(e.target);if(i>=0)setActive(i);}});},{rootMargin:'-45% 0px -45% 0px',threshold:0});
    steps.forEach(function(s){sio.observe(s);});
  });
})();
