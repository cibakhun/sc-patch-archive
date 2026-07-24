// Account-Dashboard-Logik — ausgelagert aus AccountDashboard.astro.
// Wird vom <script> der Komponente importiert; Astro bündelt es mit.

import { supabase, FAV_PATH } from '../lib/supabase';
  import { CITIZEN_ROLES, STATUS_STATES } from '../lib/profilePresets';

  const dash = document.getElementById('dash');
  if (dash) {
    const D = (dash as HTMLElement).dataset;
    const lang = D.lang === 'de' ? 'de' : 'en';
    const loadingEl = document.getElementById('dashLoading')!;
    const KINDS: Record<string, string> = JSON.parse(D.kinds || '{}');

    // Übersicht-Panel: trägt die dynamischen i18n-Templates als data-l-* Attribute
    const ovPanel = document.getElementById('tab-panel-overview');
    const ovTpl = (k: string) => (ovPanel && ovPanel.dataset[k]) || '';
    const escHtml = (s: string) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c] as string));
    const fmtAuec = (n: number) => {
      if (n >= 1_000_000) return (n / 1_000_000).toFixed(n >= 10_000_000 ? 0 : 1) + '<small>M aUEC</small>';
      if (n >= 1000) return Math.round(n / 1000) + '<small>k aUEC</small>';
      return Math.round(n) + '<small> aUEC</small>';
    };

    const favPath = (kind: string, slug: string) => {
      const tpl = FAV_PATH[kind] || '/index.html';
      const p = tpl.replace('%s', encodeURIComponent(slug).replace(/%2F/gi, '/'));
      return lang === 'de' ? '/de' + p : p;
    };

    const show = (el: HTMLElement, msg: string, ok = false) => {
      el.textContent = msg;
      el.classList.toggle('acx-status--ok', ok);
      el.hidden = false;
    };

    // Subtiler 3D-Tilt auf der Profilkarte (nur Desktop mit Maus, kein Reduced-Motion)
    const tiltCard = document.querySelector('.vp-card') as HTMLElement | null;
    const canHover = window.matchMedia('(hover: hover) and (pointer: fine)').matches;
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (tiltCard && canHover && !reducedMotion) {
      tiltCard.style.transition = 'transform 0.18s ease-out';
      tiltCard.addEventListener('mousemove', (e: MouseEvent) => {
        const r = tiltCard.getBoundingClientRect();
        const px = (e.clientX - r.left) / r.width - 0.5;
        const py = (e.clientY - r.top) / r.height - 0.5;
        tiltCard.style.transform =
          `perspective(1200px) rotateX(${(-py * 2.5).toFixed(2)}deg) rotateY(${(px * 2.5).toFixed(2)}deg)`;
      });
      tiltCard.addEventListener('mouseleave', () => {
        tiltCard.style.transform = 'perspective(1200px) rotateX(0deg) rotateY(0deg)';
      });
    }

    // Copy-Handle-Button (kopiert "@handle" ins Clipboard, kurzes ✓-Feedback)
    const btnCopyHandle = document.getElementById('pcCopyHandle');
    if (btnCopyHandle) {
      btnCopyHandle.addEventListener('click', async () => {
        const handleTxt = document.getElementById('pcHandle')?.textContent || '';
        try { await navigator.clipboard.writeText(handleTxt); } catch {}
        btnCopyHandle.classList.add('copied');
        setTimeout(() => btnCopyHandle.classList.remove('copied'), 1500);
      });
    }

    // Section-Navigation: Sidebar-Items (data-tab) schalten die Panels; die
    // Schnellsprung-Karten der Übersicht (data-tab-jump) springen in dieselben
    // Panels. Übersicht ist Default (im Markup aktiv/sichtbar gerendert).
    const navItems = document.querySelectorAll<HTMLElement>('.acnav__item[data-tab]');
    const tabPanels = document.querySelectorAll<HTMLElement>('.acx-tab-panel');
    const activateSection = (target: string | undefined) => {
      if (!target) return;
      navItems.forEach(b => b.classList.toggle('active', b.dataset.tab === target));
      tabPanels.forEach(p => { p.hidden = p.id !== `tab-panel-${target}`; });
      if (window.matchMedia('(max-width: 860px)').matches) {
        document.getElementById('main')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    };
    navItems.forEach(btn => btn.addEventListener('click', () => activateSection(btn.dataset.tab)));
    document.querySelectorAll<HTMLElement>('[data-tab-jump]').forEach(btn =>
      btn.addEventListener('click', () => activateSection(btn.dataset.tabJump)));

    const init = async () => {
      const { data } = await supabase.auth.getSession();
      const session = data.session;
      if (!session) {
        const here = location.pathname + location.search;
        location.replace(D.login! + '?next=' + encodeURIComponent(here));
        return;
      }

      const { data: userData, error: userErr } = await supabase.auth.getUser();
      if (userErr) {
        const st = (userErr as { status?: number }).status;
        if (st === 401 || st === 403) {
          await supabase.auth.signOut({ scope: 'local' });
          location.replace(D.login!);
          return;
        }
        throw userErr;
      }
      if (!userData.user) {
        await supabase.auth.signOut({ scope: 'local' });
        location.replace(D.login!);
        return;
      }
      const user = userData.user;

      // Header Identity
      document.getElementById('idEmail')!.textContent = user.email || '—';
      if (user.created_at) {
        const sinceTxt = new Date(user.created_at).toLocaleDateString(
          lang === 'de' ? 'de-DE' : 'en-US',
          { month: 'long', year: 'numeric' },
        );
        document.getElementById('idSince')!.textContent = sinceTxt;
        const statSinceEl = document.getElementById('pcStatSince');
        if (statSinceEl) statSinceEl.textContent = sinceTxt;
      }

      // Registry-ID: erste 8 Hex-Zeichen der User-ID (uppercase)
      const regEl = document.getElementById('pcRegistryId');
      if (regEl) {
        const hex = (user.id || '').replace(/[^a-f0-9]/gi, '').toUpperCase();
        regEl.textContent = 'VB-' + (hex.slice(0, 8) || '00000000');
      }

      // Profile State
      let profileState: Record<string, any> = {
        display_name: '',
        handle: '',
        bio: '',
        banner_url: '/assets/t-pyro-2.jpg',
        avatar_url: '',
        avatar_icon: '◆',
        avatar_color: '#2dd4ff',
        status_state: 'online',
        status_text: '',
        role: '',
        rsi_handle: '',
        rsi_verified: false,
        discord_tag: '',
        org_name: '',
      };

      // Zähler für den Stats-Readout (werden nach dem jeweiligen Load gesetzt)
      let favCount = 0;
      let friendCount = 0;

      // Load Profile from LocalStorage + Supabase with schema fault-tolerance
      const localKey = `vb_profile_${user.id}`;
      const savedLocal = localStorage.getItem(localKey);
      if (savedLocal) {
        try {
          const parsed = JSON.parse(savedLocal);
          delete parsed.rsi_verified;
          Object.assign(profileState, parsed);
        } catch {}
      }

      try {
        const { data: profile } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', user.id)
          .maybeSingle();

        if (profile) Object.assign(profileState, profile);
      } catch (err) {
        const { data: basicProfile } = await supabase
          .from('profiles')
          .select('display_name, handle, rsi_verified')
          .eq('id', user.id)
          .maybeSingle();
        if (basicProfile) Object.assign(profileState, basicProfile);
      }

      // Enforce DB value: rsi_verified is only true if explicitly boolean true in DB
      profileState.rsi_verified = profileState.rsi_verified === true;

      // Serverseitige RSI-Bio-Prüfung über die Supabase Edge Function
      // 'verify-rsi' — die Site ist statisch (Docker/nginx auf Coolify) und
      // kann selbst keinen Server-Code ausführen; Browser-Aufrufe auf RSI
      // werden von Cloudflare CORS/Bot-Protection blockiert. supabase-js hängt
      // das Session-JWT automatisch an; die Function persistiert das Ergebnis
      // serverseitig per Service Role (ein DB-Trigger verbietet Client-Writes
      // auf rsi_verified=true).
      // Rückgabe: { verified, error?, persisted? } oder null, wenn die
      // Function nicht erreicht werden konnte (dann darf NICHT revokiert
      // werden).
      const serverVerify = async (rHandle: string, rCode: string): Promise<{ verified: boolean; error?: string; persisted?: boolean } | null> => {
        try {
          const { data, error } = await supabase.functions.invoke('verify-rsi', {
            body: { rsi_handle: rHandle, rsi_code: rCode }
          });
          if (!error && data && typeof data.verified === 'boolean') {
            return { verified: data.verified, error: data.error, persisted: data.persisted };
          }
        } catch (efErr) {
          console.warn('verify-rsi edge function call failed:', efErr);
        }

        return null;
      };

      // Silent Re-verification check if user is marked verified (Auto-Revocation)
      if (profileState.rsi_verified === true && profileState.rsi_handle && profileState.rsi_code) {
        (async () => {
          try {
            const result = await serverVerify(profileState.rsi_handle, profileState.rsi_code);
            // Nur bei einem definitiv erfolgreichen Server-Check OHNE Code-Fund revokieren —
            // bei Netzwerk-/Server-Fehlern (result === null oder error gesetzt) bleibt das Badge.
            if (result && result.verified === false && !result.error) {
              console.warn('Re-verification failed: RSI bio code missing. Revoking badge.');
              profileState.rsi_verified = false;
              await supabase.from('profiles').update({ rsi_verified: false }).eq('id', user.id);
              updateCard();
            }
          } catch (reErr) { console.warn('Background re-verify check skipped:', reErr); }
        })();
      }

      // Populate Inputs
      const nameInput = document.getElementById('pfName') as HTMLInputElement;
      const handleInput = document.getElementById('pfHandle') as HTMLInputElement;
      const bioInput = document.getElementById('pfBio') as HTMLTextAreaElement;
      const bannerUrlInput = document.getElementById('pfBannerUrl') as HTMLInputElement;
      const avatarUrlInput = document.getElementById('pfAvatarUrl') as HTMLInputElement;
      const statusStateSelect = document.getElementById('pfStatusState') as HTMLSelectElement;
      const statusTextInput = document.getElementById('pfStatusText') as HTMLInputElement;
      const roleSelect = document.getElementById('pfRole') as HTMLSelectElement;
      const rsiHandleInput = document.getElementById('pfRsiHandle') as HTMLInputElement;
      const discordInput = document.getElementById('pfDiscord') as HTMLInputElement;
      const orgInput = document.getElementById('pfOrg') as HTMLInputElement;

      nameInput.value = profileState.display_name || '';
      handleInput.value = profileState.handle || '';
      bioInput.value = profileState.bio || '';
      bannerUrlInput.value = profileState.banner_url || '';
      avatarUrlInput.value = profileState.avatar_url || '';
      statusStateSelect.value = profileState.status_state || 'online';
      statusTextInput.value = profileState.status_text || '';
      roleSelect.value = profileState.role || '';
      rsiHandleInput.value = profileState.rsi_handle || '';
      discordInput.value = profileState.discord_tag || '';
      orgInput.value = profileState.org_name || '';

      // Visual Pickers Binding
      const bannerButtons = document.querySelectorAll('.banner-thumb-card');
      bannerButtons.forEach(btn => {
        btn.addEventListener('click', () => {
          bannerButtons.forEach(b => b.classList.remove('selected'));
          btn.classList.add('selected');
          const bUrl = (btn as HTMLElement).dataset.bannerUrl || '';
          bannerUrlInput.value = bUrl;
          profileState.banner_url = bUrl;
          updateCard();
        });
      });

      const avatarButtons = document.querySelectorAll('.avatar-thumb-card');
      avatarButtons.forEach(btn => {
        btn.addEventListener('click', () => {
          avatarButtons.forEach(a => a.classList.remove('selected'));
          btn.classList.add('selected');
          const icon = (btn as HTMLElement).dataset.avatarIcon || '◆';
          const defaultColor = (btn as HTMLElement).dataset.avatarColor || '#2dd4ff';
          profileState.avatar_icon = icon;
          profileState.avatar_color = defaultColor;
          // Icon gewählt → ein evtl. hochgeladenes/URL-Avatarbild weichen lassen,
          // damit das Icon sichtbar wird.
          avatarUrlInput.value = '';
          profileState.avatar_url = '';
          const avRemoveBtn = document.getElementById('pfAvatarRemove');
          if (avRemoveBtn) avRemoveBtn.hidden = true;
          // Farbschwatch-Highlight passend zur Icon-Standardfarbe mitziehen
          colorSwatches.forEach(s => s.classList.toggle('selected', ((s as HTMLElement).dataset.color || '').toLowerCase() === defaultColor.toLowerCase()));
          updateCard();
        });
      });

      const colorSwatches = document.querySelectorAll('.color-swatch');
      colorSwatches.forEach(sw => {
        sw.addEventListener('click', () => {
          colorSwatches.forEach(s => s.classList.remove('selected'));
          sw.classList.add('selected');
          const col = (sw as HTMLElement).dataset.color || '#2dd4ff';
          profileState.avatar_color = col;
          updateCard();
        });
      });

      // Live Profile Card Renderer
      const updateCard = () => {
        const dName = nameInput.value.trim() || user.email?.split('@')[0] || 'Citizen';
        const dHandle = handleInput.value.trim() ? `@${handleInput.value.trim()}` : '@citizen';

        document.getElementById('pcName')!.textContent = dName;
        document.getElementById('pcHandle')!.textContent = dHandle;
        
        // Avatar Icon & Accent Color
        const initial = profileState.avatar_icon || dName.trim().charAt(0).toUpperCase() || '◆';
        const avColor = profileState.avatar_color || '#2dd4ff';
        
        document.getElementById('idAvatar')!.textContent = dName.trim().charAt(0).toUpperCase() || '◆';
        const pcAvTxt = document.getElementById('pcAvatarText')!;
        pcAvTxt.textContent = initial;

        const pcAvBox = document.getElementById('pcAvatarBox')!;
        pcAvBox.style.color = avColor;
        pcAvBox.style.borderColor = avColor;
        pcAvBox.style.boxShadow = `0 0 25px ${avColor}55`;

        // Custom Avatar Image
        const avUrl = avatarUrlInput.value.trim();
        const pcAvImg = document.getElementById('pcAvatarImg') as HTMLImageElement;
        if (avUrl) {
          pcAvImg.src = avUrl;
          pcAvImg.hidden = false;
          pcAvTxt.hidden = true;
        } else {
          pcAvImg.hidden = true;
          pcAvTxt.hidden = false;
        }

        // Banner Image
        const bUrl = bannerUrlInput.value.trim() || profileState.banner_url || '/assets/t-pyro-2.jpg';
        const bannerImgEl = document.getElementById('pcBannerImg');
        if (bannerImgEl) bannerImgEl.style.backgroundImage = `url('${bUrl}')`;

        // Bio
        const bioTxt = bioInput.value.trim();
        const pcBioEl = document.getElementById('pcBio')!;
        if (bioTxt) {
          pcBioEl.textContent = bioTxt;
        } else {
          pcBioEl.innerHTML = `<em class="bio-empty">${lang === 'de' ? 'Noch keine Biografie angegeben.' : 'No bio provided yet.'}</em>`;
        }

        // Status Indicator
        const stState = statusStateSelect.value;
        const stInfo = (STATUS_STATES as any)[stState] || STATUS_STATES.online;
        const statusDot = document.getElementById('pcStatusDot')!;
        statusDot.style.background = stInfo.color;
        statusDot.style.boxShadow = `0 0 10px ${stInfo.color}`;
        statusDot.classList.toggle('pulse', !!stInfo.pulse);
        statusDot.title = `Status: ${lang === 'de' ? stInfo.labelDe : stInfo.labelEn}`;

        document.getElementById('pcStatusStateLabel')!.textContent = lang === 'de' ? stInfo.labelDe : stInfo.labelEn;
        const cStatusText = statusTextInput.value.trim();
        const customStatusEl = document.getElementById('pcStatusCustomText')!;
        const sepEl = document.getElementById('pcStatusSep')!;
        if (cStatusText) {
          customStatusEl.textContent = cStatusText;
          customStatusEl.hidden = false;
          sepEl.hidden = false;
        } else {
          customStatusEl.hidden = true;
          sepEl.hidden = true;
        }

        // Role Badge
        const selectedRoleKey = roleSelect.value;
        const roleObj = CITIZEN_ROLES.find(r => r.id === selectedRoleKey);
        const roleBadge = document.getElementById('pcRoleBadge')!;
        if (roleObj) {
          document.getElementById('pcRoleIcon')!.textContent = roleObj.symbol;
          document.getElementById('pcRoleText')!.textContent = lang === 'de' ? roleObj.labelDe : roleObj.labelEn;
          roleBadge.hidden = false;
        } else {
          roleBadge.hidden = true;
        }

        // RSI Verified Badge & Link
        const rsiHandle = rsiHandleInput.value.trim();
        const rsiBadge = document.getElementById('pcRsiVerified')!;
        const rsiLink = document.getElementById('pcLinkRsi') as HTMLAnchorElement;
        const rsiVerifyIndicator = document.getElementById('rsiVerifiedStatus')!;

        // Badge nur, wenn das eingetragene Handle dem serverseitig verifizierten
        // Handle entspricht (Handle-Wechsel entzieht das Badge; RSI-Handles sind
        // case-insensitiv, daher Case-frei vergleichen).
        const isVerified = profileState.rsi_verified === true && !!rsiHandle
          && rsiHandle.toLowerCase() === (profileState.rsi_handle || '').toLowerCase();
        rsiBadge.hidden = !isVerified;
        if (rsiVerifyIndicator) rsiVerifyIndicator.hidden = !isVerified;
        const rsiDot = document.getElementById('pcRsiDot');
        if (rsiDot) rsiDot.hidden = !isVerified;

        if (rsiHandle) {
          rsiLink.href = `https://robertsspaceindustries.com/citizens/${encodeURIComponent(rsiHandle)}`;
          document.getElementById('pcTxtRsi')!.textContent = rsiHandle;
          rsiLink.hidden = false;
        } else {
          rsiLink.hidden = true;
        }

        // Discord & Org Pills
        const discordTxt = discordInput.value.trim();
        const pillDiscord = document.getElementById('pcPillDiscord')!;
        if (discordTxt) {
          document.getElementById('pcTxtDiscord')!.textContent = discordTxt;
          pillDiscord.hidden = false;
        } else {
          pillDiscord.hidden = true;
        }

        const orgTxt = orgInput.value.trim();
        const pillOrg = document.getElementById('pcPillOrg')!;
        if (orgTxt) {
          document.getElementById('pcTxtOrg')!.textContent = orgTxt;
          pillOrg.hidden = false;
        } else {
          pillOrg.hidden = true;
        }

        // Stats-Readout: Freunde (echt aus der DB), Favoriten, Vollständigkeit
        const setStat = (id: string, val: string) => {
          const el = document.getElementById(id);
          if (el) el.textContent = val;
        };
        setStat('pcStatFriends', String(friendCount));
        setStat('pcStatFavs', String(favCount));

        const completeFields = [
          nameInput.value.trim(),
          handleInput.value.trim(),
          bioInput.value.trim(),
          bannerUrlInput.value.trim() || profileState.banner_url,
          avatarUrlInput.value.trim() || profileState.avatar_icon,
          roleSelect.value,
          rsiHandleInput.value.trim(),
          discordInput.value.trim(),
          orgInput.value.trim(),
          statusTextInput.value.trim(),
        ];
        const pct = Math.round(
          (completeFields.filter(v => !!v).length / completeFields.length) * 100,
        );
        setStat('pcStatComplete', pct + '%');
        const statBar = document.getElementById('pcStatBar') as HTMLElement | null;
        if (statBar) statBar.style.width = pct + '%';

        // ---- Übersicht spiegeln (identische Werte wie die Profilkarte) ----
        const ovTxt = (id: string, val: string) => { const el = document.getElementById(id); if (el) el.textContent = val; };
        ovTxt('ovHeadName', dName);
        ovTxt('ovName', dName);
        ovTxt('navWho', dName);
        ovTxt('ovHandle', dHandle);

        const ovBox = document.getElementById('ovAvatarBox') as HTMLElement | null;
        if (ovBox) { ovBox.style.color = avColor; ovBox.style.borderColor = avColor; ovBox.style.boxShadow = `0 0 25px ${avColor}55`; }
        const ovAvTxt = document.getElementById('ovAvatarText') as HTMLElement | null;
        const ovAvImg = document.getElementById('ovAvatarImg') as HTMLImageElement | null;
        if (ovAvTxt) ovAvTxt.textContent = initial;
        if (ovAvImg && ovAvTxt) {
          if (avUrl) { ovAvImg.src = avUrl; ovAvImg.hidden = false; ovAvTxt.hidden = true; }
          else { ovAvImg.hidden = true; ovAvTxt.hidden = false; }
        }
        // Sidebar-Mini-Avatar (Bild oder Initiale)
        const navMini = document.getElementById('idAvatar') as HTMLElement | null;
        if (navMini) {
          if (avUrl) { navMini.innerHTML = ''; const im = document.createElement('img'); im.src = avUrl; im.alt = ''; navMini.appendChild(im); }
          else { navMini.textContent = dName.trim().charAt(0).toUpperCase() || '◆'; navMini.style.color = avColor; navMini.style.borderColor = avColor; }
        }

        const ovBanner = document.getElementById('ovBanner') as HTMLElement | null;
        if (ovBanner) ovBanner.style.backgroundImage = `url('${bUrl}')`;

        const ovDot = document.getElementById('ovStatusDot') as HTMLElement | null;
        if (ovDot) { ovDot.style.background = stInfo.color; ovDot.classList.toggle('pulse', !!stInfo.pulse); }
        ovTxt('ovStatusLabel', (lang === 'de' ? stInfo.labelDe : stInfo.labelEn) + (cStatusText ? ' · ' + cStatusText : ''));

        const ovRolePill = document.getElementById('ovRolePill') as HTMLElement | null;
        if (ovRolePill) {
          ovRolePill.hidden = !roleObj;
          if (roleObj) { ovTxt('ovRoleIcon', roleObj.symbol); ovTxt('ovRoleText', lang === 'de' ? roleObj.labelDe : roleObj.labelEn); }
        }
        const ovVer = document.getElementById('ovVerified') as HTMLElement | null;
        if (ovVer) ovVer.hidden = !isVerified;
        const ovOrgPill = document.getElementById('ovOrgPill') as HTMLElement | null;
        if (ovOrgPill) { ovOrgPill.hidden = !orgTxt; if (orgTxt) ovTxt('ovOrgText', orgTxt); }

        // Vollständigkeits-Ring + Resttext
        ovTxt('ovComplete', pct + '%');
        const ovRing = document.getElementById('ovRing') as unknown as SVGCircleElement | null;
        if (ovRing) ovRing.style.strokeDashoffset = String(113 * (1 - pct / 100));
        const missing = completeFields.filter(v => !v).length;
        ovTxt('ovCompleteSub', missing === 0 ? ovTpl('lComplete')
          : missing === 1 ? ovTpl('lMissing1') : ovTpl('lMissing').replace('%n%', String(missing)));

        // RSI-Kachel
        const ovRsi = document.getElementById('ovRsi') as HTMLElement | null;
        if (ovRsi) {
          ovRsi.textContent = isVerified ? ('✓ ' + ovTpl('lRsiYes')) : ovTpl('lRsiNo');
          ovRsi.classList.toggle('no', !isVerified);
        }
        ovTxt('ovRsiSub', rsiHandle ? '@' + rsiHandle : '');
      };

      [nameInput, handleInput, bioInput, bannerUrlInput, avatarUrlInput, statusStateSelect, statusTextInput, roleSelect, rsiHandleInput, discordInput, orgInput].forEach(el => {
        el.addEventListener('input', updateCard);
        el.addEventListener('change', updateCard);
      });

      updateCard();

      // ---- Preset-Highlights an den geladenen Profil-Zustand angleichen ----
      // (früher hart auf idx===0; jetzt spiegeln sie den echten gespeicherten Wert)
      document.querySelectorAll('.banner-thumb-card').forEach(b =>
        b.classList.toggle('selected', (b as HTMLElement).dataset.bannerUrl === (profileState.banner_url || '')));
      document.querySelectorAll('.avatar-thumb-card').forEach(b =>
        b.classList.toggle('selected', (b as HTMLElement).dataset.avatarIcon === (profileState.avatar_icon || '')));
      colorSwatches.forEach(s =>
        s.classList.toggle('selected', ((s as HTMLElement).dataset.color || '').toLowerCase() === (profileState.avatar_color || '').toLowerCase()));

      // ---- Bild-Zuschnitt: Vorschau, Verschieben, Zoomen vor dem Upload ----
      // Der Rahmen zeigt exakt den spaeter sichtbaren Ausschnitt; beim Uebernehmen
      // wird genau dieser Bereich auf die Zielgroesse gerendert (WebP) und NUR der
      // zugeschnittene Blob hochgeladen — nicht das Original.
      const CROP_OUT: Record<string, { w: number; h: number }> = {
        avatar: { w: 512, h: 512 },
        banner: { w: 1600, h: 450 },
      };
      const cropModal = document.getElementById('cropModal') as HTMLDialogElement | null;
      const cropStage = document.getElementById('cropStage') as HTMLElement | null;
      const cropImg = document.getElementById('cropImg') as HTMLImageElement | null;
      const cropZoomEl = document.getElementById('cropZoom') as HTMLInputElement | null;
      const cropApplyBtn = document.getElementById('cropApply') as HTMLButtonElement | null;
      const cropCancelBtn = document.getElementById('cropCancel') as HTMLButtonElement | null;
      const cropResetBtn = document.getElementById('cropReset') as HTMLButtonElement | null;
      const cropTitleEl = document.getElementById('cropTitle');
      const cropPreviewsEl = document.getElementById('cropPreviews');
      const cropPvLg = document.getElementById('cropPvLg') as HTMLCanvasElement | null;
      const cropPvSm = document.getElementById('cropPvSm') as HTMLCanvasElement | null;
      const cropZoomVal = document.getElementById('cropZoomVal');
      const cropZoomIn = document.getElementById('cropZoomIn');
      const cropZoomOut = document.getElementById('cropZoomOut');
      const cropRotL = document.getElementById('cropRotL');
      const cropRotR = document.getElementById('cropRotR');
      const cropFlipBtn = document.getElementById('cropFlip');
      const cropInfoSrc = document.getElementById('cropInfoSrc');
      const cropInfoOut = document.getElementById('cropInfoOut');
      const cropInfoSize = document.getElementById('cropInfoSize');
      const cropWarn = document.getElementById('cropWarn');

      // Vorschau-Groessen je Art — gleiches Seitenverhaeltnis wie die Ausgabe
      const CROP_PV: Record<string, Array<{ w: number; h: number }>> = {
        avatar: [{ w: 96, h: 96 }, { w: 40, h: 40 }],
        banner: [{ w: 232, h: 65 }, { w: 116, h: 33 }],
      };

      const cropState = {
        nw: 0, nh: 0, sw: 0, sh: 0, base: 1, zoom: 1, tx: 0, ty: 0,
        rot: 0, flip: false, kind: 'avatar' as 'avatar' | 'banner',
      };

      // Sichtbare Bildmasse nach Drehung (bei 90/270 vertauscht)
      const cropEff = () => (cropState.rot % 180 === 0
        ? { w: cropState.nw, h: cropState.nh }
        : { w: cropState.nh, h: cropState.nw });

      // Zeichnet den aktuellen Ausschnitt in ein Canvas beliebiger Groesse und
      // spiegelt dabei exakt die CSS-Transform der Buehne — dadurch ist die
      // Vorschau garantiert identisch mit dem spaeteren Ergebnis.
      const cropDrawTo = (canvas: HTMLCanvasElement, ow: number, oh: number) => {
        if (!cropImg || !cropState.sw) return;
        canvas.width = ow; canvas.height = oh;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;
        const k = cropState.base * cropState.zoom;
        const s = ow / cropState.sw;
        ctx.clearRect(0, 0, ow, oh);
        ctx.imageSmoothingQuality = 'high';
        ctx.save();
        ctx.translate(ow / 2, oh / 2);
        ctx.scale(s, s);
        ctx.translate(cropState.tx, cropState.ty);
        ctx.rotate((cropState.rot * Math.PI) / 180);
        ctx.scale(cropState.flip ? -k : k, k);
        ctx.drawImage(cropImg, -cropState.nw / 2, -cropState.nh / 2, cropState.nw, cropState.nh);
        ctx.restore();
      };

      let cropSizeTimer = 0;
      const cropUpdateInfo = () => {
        const out = CROP_OUT[cropState.kind];
        if (cropInfoSrc) cropInfoSrc.textContent = cropState.nw ? `${cropState.nw} × ${cropState.nh}` : '—';
        if (cropInfoOut) cropInfoOut.textContent = `${out.w} × ${out.h}`;
        // Warnen, wenn der gewaehlte Ausschnitt kleiner ist als die Zielgroesse
        const k = cropState.base * cropState.zoom;
        const srcPx = k > 0 ? cropState.sw / k : 0;
        if (cropWarn) cropWarn.hidden = !(srcPx > 0 && srcPx < out.w * 0.9);
        // Dateigroesse verzoegert schaetzen — Encoding ist zu teuer fuer jeden Frame
        if (cropInfoSize) {
          cropInfoSize.textContent = D.cropCalc || '…';
          clearTimeout(cropSizeTimer);
          cropSizeTimer = window.setTimeout(() => {
            const c = document.createElement('canvas');
            cropDrawTo(c, out.w, out.h);
            c.toBlob((b) => {
              if (cropInfoSize) cropInfoSize.textContent = b ? `~ ${Math.max(1, Math.round(b.size / 1024))} KB` : '—';
            }, 'image/webp', 0.9);
          }, 450);
        }
      };

      const renderCrop = () => {
        if (!cropImg) return;
        const k = cropState.base * cropState.zoom;
        const eff = cropEff();
        // Verschiebung so begrenzen, dass nie ein Rand frei liegt
        const maxDx = Math.max(0, (eff.w * k - cropState.sw) / 2);
        const maxDy = Math.max(0, (eff.h * k - cropState.sh) / 2);
        cropState.tx = Math.min(maxDx, Math.max(-maxDx, cropState.tx));
        cropState.ty = Math.min(maxDy, Math.max(-maxDy, cropState.ty));
        cropImg.style.width = cropState.nw + 'px';
        cropImg.style.height = cropState.nh + 'px';
        cropImg.style.transform =
          `translate(-50%, -50%) translate(${cropState.tx}px, ${cropState.ty}px) ` +
          `rotate(${cropState.rot}deg) scale(${cropState.flip ? -k : k}, ${k})`;
        if (cropZoomVal) cropZoomVal.textContent = Math.round(cropState.zoom * 100) + '%';
        const pv = CROP_PV[cropState.kind];
        if (cropPvLg) cropDrawTo(cropPvLg, pv[0].w, pv[0].h);
        if (cropPvSm) cropDrawTo(cropPvSm, pv[1].w, pv[1].h);
        cropUpdateInfo();
      };

      const cropSetZoom = (z: number) => {
        cropState.zoom = Math.min(4, Math.max(1, z));
        if (cropZoomEl) cropZoomEl.value = String(cropState.zoom);
        renderCrop();
      };

      // Drehen: Basis-Zoom neu berechnen, da sich die effektiven Masse tauschen
      const cropRotate = (deg: number) => {
        cropState.rot = (((cropState.rot + deg) % 360) + 360) % 360;
        const eff = cropEff();
        if (cropState.sw && eff.w && eff.h) {
          cropState.base = Math.max(cropState.sw / eff.w, cropState.sh / eff.h);
        }
        cropState.tx = 0; cropState.ty = 0;
        renderCrop();
      };

      if (cropStage) {
        const pts = new Map<number, { x: number; y: number }>();
        let pinchStart = 0, pinchZoom = 1;

        cropStage.addEventListener('pointerdown', (e: PointerEvent) => {
          pts.set(e.pointerId, { x: e.clientX, y: e.clientY });
          cropStage.classList.add('dragging');
          try { cropStage.setPointerCapture(e.pointerId); } catch {}
          if (pts.size === 2) {
            const [a, b] = [...pts.values()];
            pinchStart = Math.hypot(a.x - b.x, a.y - b.y);
            pinchZoom = cropState.zoom;
          }
        });
        cropStage.addEventListener('pointermove', (e: PointerEvent) => {
          const prev = pts.get(e.pointerId);
          if (!prev) return;
          const cur = { x: e.clientX, y: e.clientY };
          pts.set(e.pointerId, cur);
          if (pts.size === 2) {
            const [a, b] = [...pts.values()];
            const dist = Math.hypot(a.x - b.x, a.y - b.y);
            if (pinchStart > 0) cropSetZoom(pinchZoom * (dist / pinchStart));
            return;
          }
          cropState.tx += cur.x - prev.x;
          cropState.ty += cur.y - prev.y;
          renderCrop();
        });
        const endDrag = (e: PointerEvent) => {
          pts.delete(e.pointerId);
          if (pts.size < 2) pinchStart = 0;
          if (pts.size === 0) cropStage.classList.remove('dragging');
          try { cropStage.releasePointerCapture(e.pointerId); } catch {}
        };
        cropStage.addEventListener('pointerup', endDrag);
        cropStage.addEventListener('pointercancel', endDrag);
        cropStage.addEventListener('wheel', (e: WheelEvent) => {
          e.preventDefault();
          cropSetZoom(cropState.zoom + (e.deltaY < 0 ? 0.12 : -0.12));
        }, { passive: false });
      }

      if (cropZoomEl) cropZoomEl.addEventListener('input', () => cropSetZoom(parseFloat(cropZoomEl.value) || 1));
      if (cropZoomIn) cropZoomIn.addEventListener('click', () => cropSetZoom(cropState.zoom + 0.15));
      if (cropZoomOut) cropZoomOut.addEventListener('click', () => cropSetZoom(cropState.zoom - 0.15));
      if (cropRotL) cropRotL.addEventListener('click', () => cropRotate(-90));
      if (cropRotR) cropRotR.addEventListener('click', () => cropRotate(90));
      if (cropFlipBtn) cropFlipBtn.addEventListener('click', () => { cropState.flip = !cropState.flip; renderCrop(); });
      if (cropResetBtn) {
        cropResetBtn.addEventListener('click', () => {
          cropState.rot = 0; cropState.flip = false;
          const eff = cropEff();
          if (cropState.sw && eff.w && eff.h) {
            cropState.base = Math.max(cropState.sw / eff.w, cropState.sh / eff.h);
          }
          cropState.tx = 0; cropState.ty = 0;
          cropSetZoom(1);
        });
      }

      // Tastatur: Pfeile verschieben (Shift = grosse Schritte), +/- zoomen, Enter uebernimmt
      if (cropModal) {
        cropModal.addEventListener('keydown', (e: KeyboardEvent) => {
          const step = e.shiftKey ? 20 : 6;
          if (e.key === 'ArrowLeft') { cropState.tx -= step; renderCrop(); e.preventDefault(); }
          else if (e.key === 'ArrowRight') { cropState.tx += step; renderCrop(); e.preventDefault(); }
          else if (e.key === 'ArrowUp') { cropState.ty -= step; renderCrop(); e.preventDefault(); }
          else if (e.key === 'ArrowDown') { cropState.ty += step; renderCrop(); e.preventDefault(); }
          else if (e.key === '+' || e.key === '=') { cropSetZoom(cropState.zoom + 0.15); e.preventDefault(); }
          else if (e.key === '-' || e.key === '_') { cropSetZoom(cropState.zoom - 0.15); e.preventDefault(); }
          else if (e.key === 'Enter') { cropApplyBtn?.click(); e.preventDefault(); }
        });
      }

      // Oeffnet den Zuschnitt-Dialog und loest mit dem fertigen Blob auf
      // (null = abgebrochen). Fehlt der Dialog, wird das Original durchgereicht.
      const openCropper = (file: File, kind: 'avatar' | 'banner'): Promise<Blob | null> =>
        new Promise((resolve) => {
          if (!cropModal || !cropStage || !cropImg || !cropApplyBtn || !cropCancelBtn) { resolve(file); return; }
          const out = CROP_OUT[kind];
          cropState.kind = kind;
          cropStage.dataset.shape = kind === 'avatar' ? 'circle' : 'wide';
          if (cropPreviewsEl) cropPreviewsEl.dataset.shape = kind === 'avatar' ? 'circle' : 'wide';
          if (cropTitleEl) cropTitleEl.textContent = (kind === 'avatar' ? D.cropTitleAvatar : D.cropTitleBanner) || '';
          const url = URL.createObjectURL(file);

          const finish = (blob: Blob | null) => {
            cropApplyBtn.removeEventListener('click', onApply);
            cropCancelBtn.removeEventListener('click', onCancel);
            cropModal.removeEventListener('cancel', onCancel);
            URL.revokeObjectURL(url);
            if (cropModal.open) cropModal.close();
            resolve(blob);
          };
          const onApply = () => {
            // Exakt dieselbe Zeichenfunktion wie die Live-Vorschau -> WYSIWYG
            const canvas = document.createElement('canvas');
            cropDrawTo(canvas, out.w, out.h);
            canvas.toBlob((b) => finish(b), 'image/webp', 0.9);
          };
          const onCancel = () => finish(null);

          cropApplyBtn.addEventListener('click', onApply);
          cropCancelBtn.addEventListener('click', onCancel);
          cropModal.addEventListener('cancel', onCancel);

          cropImg.onload = () => {
            const r = cropStage.getBoundingClientRect();
            cropState.nw = cropImg.naturalWidth;
            cropState.nh = cropImg.naturalHeight;
            cropState.sw = r.width;
            cropState.sh = r.height;
            cropState.rot = 0; cropState.flip = false;
            const eff0 = cropEff();
            cropState.base = Math.max(r.width / eff0.w, r.height / eff0.h);
            cropState.zoom = 1; cropState.tx = 0; cropState.ty = 0;
            if (cropZoomEl) cropZoomEl.value = '1';
            renderCrop();
          };
          cropModal.showModal();
          cropImg.src = url;
        });

      // ---- Echte Bild-Uploads (Avatar + Banner) zu Supabase Storage ----
      const UPLOAD_MAX: Record<string, number> = { avatar: 5 * 1024 * 1024, banner: 8 * 1024 * 1024 };
      const UPLOAD_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];

      const wireUpload = (o: {
        kind: 'avatar' | 'banner'; bucket: string;
        fileId: string; btnId: string; removeId: string; statusId: string;
        urlInput: HTMLInputElement; stateKey: 'avatar_url' | 'banner_url';
      }) => {
        const fileEl = document.getElementById(o.fileId) as HTMLInputElement | null;
        const btnEl = document.getElementById(o.btnId) as HTMLButtonElement | null;
        const removeEl = document.getElementById(o.removeId) as HTMLButtonElement | null;
        const statusEl = document.getElementById(o.statusId);
        if (!fileEl || !btnEl) return;

        const setStatus = (msg: string, cls = '') => {
          if (!statusEl) return;
          statusEl.textContent = msg;
          statusEl.className = 'acx-upload__status' + (cls ? ' ' + cls : '');
        };
        const syncRemove = () => { if (removeEl) removeEl.hidden = !o.urlInput.value.trim(); };
        syncRemove();

        const zone = btnEl.closest('.acx-upload') as HTMLElement | null;

        const handleFile = async (file: File | null | undefined) => {
          if (!file) return;
          if (!UPLOAD_TYPES.includes(file.type)) {
            setStatus(D.msgUploadBadtype || 'Invalid image type.', 'err');
            return;
          }
          const max = UPLOAD_MAX[o.kind];
          if (file.size > max) {
            setStatus((D.msgUploadToobig || 'Image too large.').replace('%max%', String(Math.round(max / 1024 / 1024))), 'err');
            return;
          }

          // Erst zuschneiden lassen — hochgeladen wird NUR der bestaetigte Ausschnitt
          setStatus('');
          const blob = await openCropper(file, o.kind);
          if (!blob) return; // abgebrochen

          btnEl.disabled = true;
          setStatus(D.msgUploading || 'Uploading …');
          try {
            // Stabiler Pfad je Nutzer+Art -> überschreibt (upsert), kein Datei-Wildwuchs.
            // Cache-Busting per ?v= im gespeicherten URL.
            const path = `${user.id}/${o.kind}`;
            const { error: upErr } = await supabase.storage.from(o.bucket).upload(path, blob, {
              upsert: true, contentType: blob.type || 'image/webp', cacheControl: '3600',
            });
            if (upErr) throw upErr;
            const { data: pub } = supabase.storage.from(o.bucket).getPublicUrl(path);
            const url = `${pub.publicUrl}?v=${Date.now()}`;
            o.urlInput.value = url;
            profileState[o.stateKey] = url;
            updateCard();
            syncRemove();
            setStatus('✓', 'ok');
            setTimeout(() => setStatus(''), 1600);
          } catch (err) {
            console.warn('image upload failed', err);
            setStatus(D.msgUploadErr || 'Upload failed.', 'err');
          } finally {
            btnEl.disabled = false;
          }
        };

        btnEl.addEventListener('click', () => fileEl.click());
        fileEl.addEventListener('change', async () => {
          await handleFile(fileEl.files && fileEl.files[0]);
          fileEl.value = '';
        });

        // Drag & Drop direkt auf den Upload-Bereich
        if (zone) {
          ['dragenter', 'dragover'].forEach((ev) =>
            zone.addEventListener(ev, (e: Event) => { e.preventDefault(); zone.classList.add('dragover'); }));
          ['dragleave', 'drop'].forEach((ev) =>
            zone.addEventListener(ev, (e: Event) => { e.preventDefault(); zone.classList.remove('dragover'); }));
          zone.addEventListener('drop', async (e: DragEvent) => {
            const f = e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files[0];
            if (f) await handleFile(f);
          });
        }

        if (removeEl) {
          removeEl.addEventListener('click', () => {
            o.urlInput.value = '';
            profileState[o.stateKey] = '';
            updateCard();
            syncRemove();
            setStatus('');
          });
        }
      };

      wireUpload({ kind: 'avatar', bucket: 'avatars', fileId: 'pfAvatarFile', btnId: 'pfAvatarUploadBtn', removeId: 'pfAvatarRemove', statusId: 'pfAvatarUploadStatus', urlInput: avatarUrlInput, stateKey: 'avatar_url' });
      wireUpload({ kind: 'banner', bucket: 'banners', fileId: 'pfBannerFile', btnId: 'pfBannerUploadBtn', removeId: 'pfBannerRemove', statusId: 'pfBannerUploadStatus', urlInput: bannerUrlInput, stateKey: 'banner_url' });

      // RSI Verification Modal Logic
      const rsiModal = document.getElementById('rsiModal') as HTMLDialogElement;
      const btnRsiVerifyModal = document.getElementById('btnRsiVerifyModal')!;
      const btnCloseRsiModal = document.getElementById('btnCloseRsiModal')!;
      const rsiCodeEl = document.getElementById('rsiVerifyCode')!;
      const btnCopyRsiCode = document.getElementById('btnCopyRsiCode')!;
      const btnCheckRsiNow = document.getElementById('btnCheckRsiNow')!;
      const rsiVerifyMsg = document.getElementById('rsiVerifyMsg')!;

      // Fester, eindeutiger Verifizierungscode pro Nutzer: DB-Wert hat Vorrang,
      // dann localStorage; ein neu generierter Code wird sofort serverseitig
      // persistiert, damit er geräteübergreifend und bei jedem Aufruf gleich bleibt.
      const codeFromDb = typeof profileState.rsi_code === 'string' && profileState.rsi_code.length > 0;
      let activeCode = codeFromDb ? profileState.rsi_code
        : (localStorage.getItem('vb_rsi_code') || `VERSEBASE-VERIFY-${Math.random().toString(36).substring(2, 8).toUpperCase()}`);
      try { localStorage.setItem('vb_rsi_code', activeCode); } catch {}
      profileState.rsi_code = activeCode;
      if (!codeFromDb) {
        supabase.from('profiles').upsert({ id: user.id, rsi_code: activeCode })
          .then(({ error }) => { if (error) console.warn('Could not persist rsi_code:', error); })
          .catch(() => {});
      }

      btnRsiVerifyModal.addEventListener('click', () => {
        const handle = rsiHandleInput.value.trim();
        const targetHandleEl = document.getElementById('rsiModalTargetHandle');
        const profileLinkEl = document.getElementById('rsiModalProfileLink') as HTMLAnchorElement;

        if (!handle) {
          show(pfStatus as HTMLElement, D.msgRsiEnterHandle!);
          return;
        }

        if (targetHandleEl) targetHandleEl.textContent = `@${handle}`;
        if (profileLinkEl) {
          profileLinkEl.href = `https://robertsspaceindustries.com/account/profile`;
        }

        rsiCodeEl.textContent = activeCode;
        rsiVerifyMsg.hidden = true;
        rsiVerifyMsg.className = 'acx-status';
        if (rsiModal.showModal) rsiModal.showModal();
      });

      btnCloseRsiModal.addEventListener('click', () => rsiModal.close());

      // Public Profile Preview Modal — befüllt eine statische Read-only-Kopie
      // der Karte aus den aktuellen updateCard()-Werten (eigene pv*-IDs, keine
      // Duplikate der echten Karten-IDs).
      const previewModal = document.getElementById('previewModal') as HTMLDialogElement | null;
      const btnPreviewModal = document.getElementById('btnPreviewModal');
      const btnClosePreviewModal = document.getElementById('btnClosePreviewModal');

      const fillPreview = () => {
        const copyTxt = (srcId: string, dstId: string) => {
          const s = document.getElementById(srcId);
          const d = document.getElementById(dstId);
          if (s && d) d.textContent = s.textContent;
        };
        copyTxt('pcName', 'pvName');
        copyTxt('pcHandle', 'pvHandle');
        copyTxt('pcRegistryId', 'pvRegistryId');
        copyTxt('pcBio', 'pvBio');

        // Rolle (Icon + Text zusammen)
        const roleBadgeEl = document.getElementById('pcRoleBadge');
        const pvRoleEl = document.getElementById('pvRole');
        if (roleBadgeEl && pvRoleEl) {
          pvRoleEl.hidden = roleBadgeEl.hidden;
          pvRoleEl.textContent =
            `${document.getElementById('pcRoleIcon')?.textContent || ''} ${document.getElementById('pcRoleText')?.textContent || ''}`.trim();
        }

        // Status-Zeile (State + optionaler Custom-Text)
        const pvStatusEl = document.getElementById('pvStatus');
        if (pvStatusEl) {
          const stateTxt = document.getElementById('pcStatusStateLabel')?.textContent || '';
          const custEl = document.getElementById('pcStatusCustomText');
          const custTxt = custEl && !custEl.hidden ? (custEl.textContent || '') : '';
          pvStatusEl.textContent = stateTxt + (custTxt ? ' · ' + custTxt : '');
        }

        // RSI-Verified-Badge
        const pcVerified = document.getElementById('pcRsiVerified');
        const pvVerifiedEl = document.getElementById('pvVerified');
        if (pcVerified && pvVerifiedEl) pvVerifiedEl.hidden = pcVerified.hidden;

        // Avatar (Icon/Farbe/Bild) inkl. Inline-Farbwerten der echten Karte
        const srcBox = document.getElementById('pcAvatarBox') as HTMLElement | null;
        const dstBox = document.getElementById('pvAvatarBox') as HTMLElement | null;
        if (srcBox && dstBox) {
          dstBox.style.color = srcBox.style.color;
          dstBox.style.borderColor = srcBox.style.borderColor;
          dstBox.style.boxShadow = srcBox.style.boxShadow;
        }
        const srcAvTxt = document.getElementById('pcAvatarText');
        const dstAvTxt = document.getElementById('pvAvatarText');
        if (srcAvTxt && dstAvTxt) {
          dstAvTxt.textContent = srcAvTxt.textContent;
          dstAvTxt.hidden = srcAvTxt.hidden;
        }
        const srcAvImg = document.getElementById('pcAvatarImg') as HTMLImageElement | null;
        const dstAvImg = document.getElementById('pvAvatarImg') as HTMLImageElement | null;
        if (srcAvImg && dstAvImg) {
          dstAvImg.hidden = srcAvImg.hidden;
          if (!srcAvImg.hidden) dstAvImg.src = srcAvImg.src;
        }

        // Banner
        const srcBanner = document.getElementById('pcBannerImg') as HTMLElement | null;
        const dstBanner = document.getElementById('pvBanner') as HTMLElement | null;
        if (srcBanner && dstBanner) dstBanner.style.backgroundImage = srcBanner.style.backgroundImage;

        // Social-Chips (Text + Sichtbarkeit + Link-Ziel)
        const copyChip = (srcId: string, dstId: string) => {
          const s = document.getElementById(srcId);
          const d = document.getElementById(dstId);
          if (!s || !d) return;
          d.hidden = s.hidden;
          d.textContent = (s.textContent || '').replace(/\s+/g, ' ').trim();
          if (d instanceof HTMLAnchorElement && s instanceof HTMLAnchorElement) d.href = s.href;
        };
        copyChip('pcLinkRsi', 'pvChipRsi');
        copyChip('pcPillDiscord', 'pvChipDiscord');
        copyChip('pcPillOrg', 'pvChipOrg');

        // Öffentliche Seite: /pilot/<handle> — nur mit gesetztem, gültigem
        // Handle (gleicher Regex wie beim Speichern). Ohne Handle stattdessen
        // der Aktivierungs-Hinweis.
        const pvPublicRow = document.getElementById('pvPublicRow');
        const pvPublicNoHandle = document.getElementById('pvPublicNoHandle');
        const pvPublicLink = document.getElementById('pvPublicLink') as HTMLAnchorElement | null;
        const pubHandle = /^[a-z0-9_]{3,24}$/.test(profileState.handle || '') ? profileState.handle : '';
        if (pvPublicRow && pvPublicNoHandle && pvPublicLink) {
          pvPublicRow.hidden = !pubHandle;
          pvPublicNoHandle.hidden = !!pubHandle;
          if (pubHandle) {
            const publicPath = (lang === 'de' ? '/de/pilot/' : '/pilot/') + pubHandle;
            pvPublicLink.href = publicPath;
            pvPublicLink.textContent = publicPath;
          }
        }
      };

      // Vorschau öffnen: Profilkarten-Button + die beiden Übersicht-Trigger
      [btnPreviewModal, document.getElementById('ovBtnShare'), document.getElementById('ovBtnShare2')].forEach((b) => {
        if (b && previewModal) b.addEventListener('click', () => {
          fillPreview();
          if (previewModal.showModal) previewModal.showModal();
        });
      });
      if (btnClosePreviewModal && previewModal) {
        btnClosePreviewModal.addEventListener('click', () => previewModal.close());
      }
      if (previewModal) {
        previewModal.addEventListener('click', (e: MouseEvent) => {
          if (e.target === previewModal) previewModal.close();
        });
      }

      // Copy-Link-Button der öffentlichen Seite (kopiert die absolute URL)
      const pvPublicCopy = document.getElementById('pvPublicCopy') as HTMLButtonElement | null;
      if (pvPublicCopy) {
        pvPublicCopy.addEventListener('click', async () => {
          const link = document.getElementById('pvPublicLink') as HTMLAnchorElement | null;
          const hrefVal = link?.getAttribute('href') || '';
          if (!hrefVal || hrefVal === '#') return;
          try { await navigator.clipboard.writeText(new URL(hrefVal, location.origin).href); } catch {}
          const lbl = pvPublicCopy.dataset.label || 'Copy link';
          pvPublicCopy.textContent = pvPublicCopy.dataset.done || 'Copied! ✓';
          setTimeout(() => { pvPublicCopy.textContent = lbl; }, 2000);
        });
      }

      btnCopyRsiCode.addEventListener('click', () => {
        navigator.clipboard.writeText(activeCode);
        btnCopyRsiCode.textContent = D.rsiCopied || 'Copied! ✓';
        setTimeout(() => btnCopyRsiCode.textContent = D.rsiCopy || 'Copy', 2000);
      });

      btnCheckRsiNow.addEventListener('click', async () => {
        const rsiHandle = rsiHandleInput.value.trim();
        if (!rsiHandle) {
          rsiVerifyMsg.textContent = D.msgRsiNoHandle!;
          rsiVerifyMsg.className = 'acx-status acx-status--err';
          rsiVerifyMsg.hidden = false;
          return;
        }

        btnCheckRsiNow.disabled = true;
        rsiVerifyMsg.className = 'acx-status';
        rsiVerifyMsg.textContent = D.msgRsiChecking!.replace('%handle%', rsiHandle);
        rsiVerifyMsg.hidden = false;

        try {
          // Ausschließlich serverseitige Prüfung (CF Function → Supabase Edge Function).
          // KEIN Client-Fallback: Browser-Fetches auf RSI werden von Cloudflare
          // CORS/Bot-Protection blockiert bzw. liefern gecachte Seiten ohne Bio.
          const result = await serverVerify(rsiHandle, activeCode);
          const verified = result?.verified === true;
          const errorMessage = result?.error || '';

          if (verified) {
            profileState.rsi_verified = true;
            profileState.rsi_handle = rsiHandle;

            // DB-Persistierung läuft ausschließlich serverseitig in der Edge
            // Function (mit Session-JWT) — der Client schreibt rsi_verified
            // NICHT selbst, ein DB-Trigger verbietet das.
            if (result && result.persisted === false) {
              console.warn('RSI verify: Edge Function konnte nicht persistieren (JWT/Service-Role prüfen).');
            }

            rsiVerifyMsg.textContent = '✓ ' + D.msgRsiSuccess!;
            rsiVerifyMsg.className = 'acx-status acx-status--ok';
            updateCard();

            setTimeout(() => {
              rsiModal.close();
              btnCheckRsiNow.disabled = false;
            }, 1200);
          } else {
            rsiVerifyMsg.textContent = result === null
              ? D.msgRsiServerErr!
              : (errorMessage || D.msgRsiNotFound!.replace('%code%', activeCode).replace('%handle%', rsiHandle));
            rsiVerifyMsg.className = 'acx-status acx-status--err';
            btnCheckRsiNow.disabled = false;
          }
        } catch (err: any) {
          rsiVerifyMsg.textContent = D.msgRsiServerErr! + ' (' + (err.message || err) + ')';
          rsiVerifyMsg.className = 'acx-status acx-status--err';
          btnCheckRsiNow.disabled = false;
        }
      });

      // Reset RSI Verification Handler
      const btnResetRsiVerify = document.getElementById('btnResetRsiVerify');
      if (btnResetRsiVerify) {
        btnResetRsiVerify.addEventListener('click', async () => {
          profileState.rsi_verified = false;
          updateCard();

          if (user) {
            try {
              await supabase.from('profiles').upsert({
                id: user.id,
                rsi_verified: false
              });
            } catch (e) { console.warn('Supabase reset error:', e); }
          }

          try {
            const saved = localStorage.getItem(localKey);
            let parsed = saved ? JSON.parse(saved) : {};
            parsed.rsi_verified = false;
            localStorage.setItem(localKey, JSON.stringify(parsed));
          } catch (e) {
            localStorage.removeItem(localKey);
          }

          show(pfStatus as HTMLElement, D.msgRsiResetOk!, true);
        });
      }

      // Save Profile Form
      const pfForm = document.getElementById('profileForm') as HTMLFormElement;
      const pfStatus = document.getElementById('pfStatus')!;
      const pfBtn = document.getElementById('pfBtn') as HTMLButtonElement;

      pfForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        pfStatus.hidden = true;
        const display_name = nameInput.value.trim() || null;
        const handle = handleInput.value.trim().toLowerCase() || null;
        if (handle && !/^[a-z0-9_]{3,24}$/.test(handle)) {
          show(pfStatus as HTMLElement, D.msgHandleFormat!);
          return;
        }

        // WICHTIG: rsi_verified wird hier NIEMALS mitgesendet — das Badge darf
        // ausschließlich nach erfolgreicher serverseitiger Prüfung (bzw. durch
        // Auto-Revocation auf false) gesetzt werden. Sonst wäre der Speichern-
        // Button ein manueller Bypass der Verifizierung.
        // Das RSI-Handle wird normal persistiert; weicht es vom verifizierten
        // Handle ab, erlischt die Verknüpfung (Revoke in Richtung false).
        const rsiHandleVal = rsiHandleInput.value.trim() || null;

        // Alle sichtbaren Profilfelder aus Inputs + Picker-State übernehmen,
        // damit DB-Persistenz UND der localStorage-Cache konsistent sind.
        // (avatar_icon/avatar_color liegen bereits im profileState via Picker.)
        Object.assign(profileState, {
          display_name: display_name || '',
          handle: handle || '',
          bio: bioInput.value.trim(),
          banner_url: bannerUrlInput.value.trim(),
          avatar_url: avatarUrlInput.value.trim(),
          status_state: statusStateSelect.value || 'online',
          status_text: statusTextInput.value.trim(),
          role: roleSelect.value,
          rsi_handle: rsiHandleVal || '',
          discord_tag: discordInput.value.trim(),
          org_name: orgInput.value.trim(),
        });

        const payload: Record<string, any> = {
          id: user.id,
          display_name,
          handle,
          bio: profileState.bio || null,
          banner_url: profileState.banner_url || null,
          avatar_url: profileState.avatar_url || null,
          avatar_icon: profileState.avatar_icon || null,
          avatar_color: profileState.avatar_color || null,
          status_state: profileState.status_state || null,
          status_text: profileState.status_text || null,
          role: profileState.role || null,
          discord_tag: profileState.discord_tag || null,
          org_name: profileState.org_name || null,
          rsi_handle: rsiHandleVal,
        };
        if (profileState.rsi_verified === true
          && (rsiHandleVal || '').toLowerCase() !== (profileState.rsi_handle || '').toLowerCase()) {
          payload.rsi_verified = false;
          profileState.rsi_verified = false;
          updateCard();
        }

        pfBtn.disabled = true;
        try { localStorage.setItem(localKey, JSON.stringify(profileState)); } catch {}

        try {
          const { error } = await supabase
            .from('profiles')
            .upsert(payload);
          pfBtn.disabled = false;

          if (error) {
            if (error.code === '23505') {
              show(pfStatus as HTMLElement, D.msgHandleTaken!);
              return;
            }
            await supabase.from('profiles').upsert({ id: user.id, display_name, handle });
          }
        } catch {
          await supabase.from('profiles').upsert({ id: user.id, display_name, handle });
          pfBtn.disabled = false;
        }

        show(pfStatus as HTMLElement, D.msgSaved!, true);
      });

      // Load Favorites
      const favList = document.getElementById('favList')!;
      const favEmpty = document.getElementById('favEmpty')!;
      const { data: favs } = await supabase
        .from('favorites')
        .select('id, kind, slug, label')
        .order('created_at', { ascending: false });

      const renderFavs = (rows: Array<{ id: number; kind: string; slug: string; label: string | null }>) => {
        favList.innerHTML = '';
        favEmpty.hidden = rows.length > 0;
        for (const f of rows) {
          const li = document.createElement('li');
          li.className = 'acx-fav';
          const kind = document.createElement('span');
          kind.className = 'acx-fav__kind';
          kind.textContent = KINDS[f.kind] || f.kind;
          const link = document.createElement('a');
          link.className = 'acx-fav__link';
          link.href = favPath(f.kind, f.slug);
          link.textContent = f.label || f.slug;
          const rm = document.createElement('button');
          rm.className = 'acx-fav__rm';
          rm.type = 'button';
          rm.textContent = D.favRemove || 'Remove';
          rm.addEventListener('click', async () => {
            rm.disabled = true;
            const { error } = await supabase.from('favorites').delete().eq('id', f.id);
            if (!error) {
              li.remove();
              favCount = Math.max(0, favCount - 1);
              const statFavsEl = document.getElementById('pcStatFavs');
              if (statFavsEl) statFavsEl.textContent = String(favCount);
            }
            else rm.disabled = false;
            if (!favList.children.length) favEmpty.hidden = false;
          });
          li.append(kind, link, rm);
          favList.appendChild(li);
        }
      };
      renderFavs(favs || []);
      favCount = (favs || []).length;

      // Echte Freundes-Anzahl aus der DB (ersetzt den frueheren localStorage-Zaehler)
      try {
        const { count: fc } = await supabase
          .from('friends')
          .select('id', { count: 'exact', head: true });
        friendCount = fc || 0;
      } catch {}
      updateCard();

      // ---- Übersicht: Kennzahlen, Sidebar-Badges, Aktivitäts-Feed ----
      const setBadge = (id: string, n: number) => { const el = document.getElementById(id); if (!el) return; el.textContent = String(n); el.hidden = n <= 0; };
      setBadge('navFavCount', favCount);
      setBadge('navFriendCount', friendCount);
      const ovFavsEl = document.getElementById('ovStatFavs'); if (ovFavsEl) ovFavsEl.textContent = String(favCount);
      const ovFriEl = document.getElementById('ovStatFriends'); if (ovFriEl) ovFriEl.textContent = String(friendCount);

      const activity: Array<{ g: string; html: string; ts: number }> = [];

      // Offene eingehende Freundschaftsanfragen (Zähler + Kachel-Unterzeile)
      let pendingCount = 0;
      try {
        const { count: pc } = await supabase.from('friend_requests')
          .select('id', { count: 'exact', head: true })
          .eq('receiver_id', user.id).eq('status', 'pending');
        pendingCount = pc || 0;
      } catch {}
      const pendingLbl = pendingCount === 1 ? ovTpl('lPending1') : ovTpl('lPending').replace('%n%', String(pendingCount));
      const ovFriendsSub = document.getElementById('ovFriendsSub');
      if (ovFriendsSub) ovFriendsSub.textContent = pendingCount <= 0 ? '' : pendingLbl;
      if (pendingCount > 0) activity.push({ g: '◈', html: pendingLbl, ts: Date.now() });

      // Refinery: Gesamtwert (verkauft, sonst geschätzt) + aktive Jobs
      try {
        const { data: rjobs } = await supabase.from('refinery_jobs')
          .select('station, method, status, est_value, sold_value, started_at')
          .order('started_at', { ascending: false });
        const jobs = rjobs || [];
        let total = 0, active = 0;
        for (const j of jobs) {
          const v = j.sold_value != null ? Number(j.sold_value) : (j.est_value != null ? Number(j.est_value) : 0);
          if (!Number.isNaN(v)) total += v;
          if (j.status === 'active') active++;
        }
        const ovRefValue = document.getElementById('ovRefValue');
        if (ovRefValue) ovRefValue.innerHTML = fmtAuec(total);
        const ovRefSub = document.getElementById('ovRefSub');
        if (ovRefSub) ovRefSub.textContent = active <= 0 ? ovTpl('lNoactive')
          : active === 1 ? ovTpl('lActive1') : ovTpl('lActive').replace('%n%', String(active));
        if (jobs[0]) activity.push({ g: '⬢', html: ovTpl('lActJob').replace('%x%', `<em>${escHtml((jobs[0].station || '') + ' · ' + (jobs[0].method || ''))}</em>`), ts: +new Date(jobs[0].started_at) });
      } catch {}

      // Neueste Favoriten (created_at nicht im Select → als aktuelle Ergänzungen)
      for (const f of (favs || []).slice(0, 3)) {
        activity.push({ g: '★', html: ovTpl('lActFav').replace('%x%', `<em>${escHtml(f.label || f.slug)}</em>`), ts: 0 });
      }

      // Aktivität rendern (ts absteigend; Einträge ohne ts ans Ende)
      const ovAct = document.getElementById('ovActivity');
      const ovActEmpty = document.getElementById('ovActEmpty');
      if (ovAct) {
        if (!activity.length) { if (ovActEmpty) ovActEmpty.hidden = false; }
        else {
          if (ovActEmpty) ovActEmpty.hidden = true;
          activity.sort((a, b) => (b.ts || 0) - (a.ts || 0));
          const fmtDate = (ts: number) => ts > 0 ? new Date(ts).toLocaleDateString(lang === 'de' ? 'de-DE' : 'en-US', { day: 'numeric', month: 'short' }) : '';
          ovAct.innerHTML = activity.slice(0, 5).map(it =>
            `<div class="ov-act__row"><span class="g" aria-hidden="true">${it.g}</span><div>${it.html}</div><span class="t">${fmtDate(it.ts)}</span></div>`
          ).join('');
        }
      }

      // Security Forms
      const emailForm = document.getElementById('emailForm') as HTMLFormElement;
      const emailStatus = document.getElementById('seEmailStatus')!;
      const emailBtn = document.getElementById('seEmailBtn') as HTMLButtonElement;
      emailForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        emailStatus.hidden = true;
        const email = (document.getElementById('seEmail') as HTMLInputElement).value.trim();
        if (!email || email === user.email) return;
        emailBtn.disabled = true;
        emailBtn.textContent = emailBtn.dataset.busy!;
        const { error } = await supabase.auth.updateUser(
          { email },
          { emailRedirectTo: location.origin + D.confirmRedirect! },
        );
        emailBtn.disabled = false;
        emailBtn.textContent = emailBtn.dataset.idle!;
        if (error) {
          const code = (error as { code?: string }).code || '';
          show(emailStatus as HTMLElement, code.includes('rate_limit') ? D.msgRate! : D.msgNet!);
          return;
        }
        show(emailStatus as HTMLElement, D.msgEmailSent!, true);
      });

      const passForm = document.getElementById('passForm') as HTMLFormElement;
      const passStatus = document.getElementById('sePassStatus')!;
      const passBtn = document.getElementById('sePassBtn') as HTMLButtonElement;
      passForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        passStatus.hidden = true;
        const p1 = (document.getElementById('sePass') as HTMLInputElement).value;
        const p2 = (document.getElementById('sePass2') as HTMLInputElement).value;
        if (p1.length < 8) { show(passStatus as HTMLElement, D.msgShort!); return; }
        if (p1 !== p2) { show(passStatus as HTMLElement, D.msgMatch!); return; }
        passBtn.disabled = true;
        passBtn.textContent = passBtn.dataset.busy!;
        const { error } = await supabase.auth.updateUser({ password: p1 });
        passBtn.disabled = false;
        passBtn.textContent = passBtn.dataset.idle!;
        if (error) {
          const code = (error as { code?: string }).code || '';
          show(passStatus as HTMLElement, code === 'same_password' ? D.msgSame! : D.msgNet!);
          return;
        }
        (document.getElementById('sePass') as HTMLInputElement).value = '';
        (document.getElementById('sePass2') as HTMLInputElement).value = '';
        show(passStatus as HTMLElement, D.msgPassSaved!, true);
      });

      // Logout
      document.getElementById('btnLogout')!.addEventListener('click', async () => {
        await supabase.auth.signOut({ scope: 'local' });
        location.href = D.home!;
      });

      // Delete Account
      const delForm = document.getElementById('deleteForm') as HTMLFormElement;
      const delConfirm = document.getElementById('delConfirm') as HTMLInputElement;
      const delBtn = document.getElementById('delBtn') as HTMLButtonElement;
      const delStatus = document.getElementById('delStatus')!;
      delConfirm.addEventListener('input', () => {
        delBtn.disabled = delConfirm.value.trim().toUpperCase() !== D.dangerWord!;
      });
      delForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        if (delBtn.disabled) return;
        delStatus.hidden = true;
        delBtn.disabled = true;
        delBtn.textContent = delBtn.dataset.busy!;
        try {
          const { error } = await supabase.functions.invoke('delete-account', { method: 'POST' });
          if (error) throw error;
          await supabase.auth.signOut({ scope: 'local' });
          location.href = D.home!;
        } catch {
          show(delStatus as HTMLElement, D.msgNet!);
          delBtn.textContent = delBtn.dataset.idle!;
          delBtn.disabled = false;
        }
      });

      // Show Dashboard
      loadingEl.hidden = true;
      (dash as HTMLElement).hidden = false;
    };

    init().catch((e) => {
      console.error('dashboard init failed', e);
      loadingEl.textContent = D.msgLoaderr || 'Could not load your account.';
      const retry = document.createElement('button');
      retry.type = 'button';
      retry.className = 'acx-submit acx-submit--ghost';
      retry.style.marginTop = '1.1rem';
      retry.textContent = D.retry || 'Reload';
      retry.addEventListener('click', () => location.reload());
      loadingEl.appendChild(document.createElement('br'));
      loadingEl.appendChild(retry);
    });
  }
