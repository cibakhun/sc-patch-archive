/* Umami-Zaehler — gepinnte Kopie, NICHT von Hand aendern.
 *
 * Herkunft:   https://github.com/umami-software/umami
 * Fassung:    v3.4.1
 * Datei:      src/tracker/index.ts
 * Quelle-sha256: 0684f4c6896f53695fe6c0ae1122f70f0e12e6e8a3d1ea21ad2556653525d6a7
 * Umwandlung: Typen entfernt (esbuild 0.27.7, Ziel es2022),
 *             __COLLECT_API_HOST__ -> '', __COLLECT_API_ENDPOINT__ -> '/api/send'
 *             (wie rollup.tracker.config.js), nicht verkleinert.
 * Rumpf-sha256: d96700d1eccb3c8cc11edd79438a4e17f67ec662f4b1d1468fc1376eec03c6a3  (ueber LF-Zeilenenden)
 *
 * Erneuern: node scripts/vendor-umami.mjs <tag>, Diff lesen,
 * npm run build && npm run gate (verify:zaehler prueft diese Datei).
 *
 * MIT License — Copyright (c) 2022 Umami Software, Inc. <hello@umami.is>
 * Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this software and associated documentation files (the "Software"), to deal
 * in the Software without restriction, including without limitation the rights
 * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 * copies of the Software, and to permit persons to whom the Software is
 * furnished to do so, subject to the following conditions: The above copyright
 * notice and this permission notice shall be included in all copies or
 * substantial portions of the Software.
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
 * SOFTWARE.
 * --- Ende des Kopfes --- */
((window2) => {
  const {
    screen: { width, height },
    navigator: { language, doNotTrack: ndnt, msDoNotTrack: msdnt },
    location,
    document,
    history,
    top,
    doNotTrack
  } = window2;
  const { currentScript, referrer } = document;
  if (!currentScript) return;
  const { hostname, href, origin } = location;
  let localStorage;
  try {
    localStorage = href.startsWith("data:") ? void 0 : window2.localStorage;
  } catch {
  }
  const _data = "data-";
  const _false = "false";
  const _true = "true";
  const attr = currentScript.getAttribute.bind(currentScript);
  const config = (value) => attr(`${_data}${value}`);
  const website = config("website-id");
  const hostUrl = config("host-url");
  const beforeSend = config("before-send");
  const distinctId = config("distinct-id") || void 0;
  const tag = config("tag") || void 0;
  const autoTrack = config("auto-track") !== _false;
  const dnt = config("do-not-track") === _true;
  const excludeSearch = config("exclude-search") === _true;
  const excludeHash = config("exclude-hash") === _true;
  const domain = config("domains") || "";
  const credentials = config("fetch-credentials") || "omit";
  const perf = config("performance") === _true;
  const autoPageview = config("auto-pageview") !== _false;
  const domains = domain.split(",").map((n) => n.trim());
  const host = hostUrl || "" || currentScript.src.split("/").slice(0, -1).join("/");
  const endpoint = `${host.replace(/\/$/, "")}/api/send`;
  const screen = `${width}x${height}`;
  const eventRegex = /data-umami-event-([\w-_]+)/;
  const eventNameAttribute = `${_data}umami-event`;
  const delayDuration = 300;
  const normalize = (raw) => {
    if (!raw) return raw;
    try {
      const u = new URL(raw, location.href);
      if (excludeSearch) u.search = "";
      if (excludeHash) u.hash = "";
      return u.toString();
    } catch {
      return raw;
    }
  };
  const stripOrigin = (url) => url === origin || url?.startsWith(origin + "/") ? url.slice(origin.length) : url;
  const getPayload = () => ({
    website,
    screen,
    language,
    title: document.title,
    hostname,
    url: currentUrl,
    referrer: stripOrigin(currentRef),
    tag,
    id: identity ? identity : void 0
  });
  const hasDoNotTrack = () => {
    const dnt2 = doNotTrack || ndnt || msdnt;
    return dnt2 === 1 || dnt2 === "1" || dnt2 === "yes";
  };
  const handlePush = (_state, _title, url) => {
    if (!url) return;
    if (typeof flushPerformance === "function") {
      flushPerformance();
    }
    currentRef = currentUrl;
    currentUrl = normalize(url);
    if (currentUrl !== currentRef && autoPageview) {
      setTimeout(track, delayDuration);
    }
  };
  const handlePathChanges = () => {
    const hook = (_this, method, callback) => {
      const orig = _this[method];
      return (...args) => {
        const result = orig.apply(_this, args);
        callback.apply(null, args);
        return result;
      };
    };
    history.pushState = hook(history, "pushState", handlePush);
    history.replaceState = hook(history, "replaceState", handlePush);
  };
  const handleClicks = () => {
    const trackElement = async (el) => {
      const eventName = el.getAttribute(eventNameAttribute);
      if (eventName) {
        const eventData = {};
        el.getAttributeNames().forEach((name) => {
          const match = name.match(eventRegex);
          if (match) eventData[match[1]] = el.getAttribute(name);
        });
        return track(eventName, eventData);
      }
    };
    const onClick = (e) => {
      const el = e.target;
      const eventEl = el.closest(`[${eventNameAttribute}]`);
      if (!eventEl) return;
      if (eventEl.tagName === "A" && eventEl.href) {
        const { href: href2, target } = eventEl;
        const external = target === "_blank" || e.ctrlKey || e.shiftKey || e.metaKey || e.button && e.button === 1;
        if (!external) e.preventDefault();
        return trackElement(eventEl).finally(() => {
          if (!external) {
            (target === "_top" ? top.location : location).href = href2;
          }
        });
      }
      return trackElement(eventEl);
    };
    document.addEventListener("click", onClick, true);
  };
  const trackingDisabled = () => disabled || !website || localStorage?.getItem("umami.disabled") || domain && !domains.includes(hostname) || dnt && hasDoNotTrack();
  const send = async (payload, type = "event") => {
    if (trackingDisabled()) return;
    const callback = window2[beforeSend];
    if (typeof callback === "function") {
      payload = await Promise.resolve(callback(type, payload));
    }
    if (!payload) return;
    try {
      const res = await fetch(endpoint, {
        keepalive: true,
        method: "POST",
        body: JSON.stringify({ type, payload }),
        headers: {
          "Content-Type": "application/json",
          "x-umami-website-id": website,
          "x-umami-hostname": hostname,
          ...typeof cache !== "undefined" && { "x-umami-cache": cache }
        },
        credentials
      });
      const data = await res.json();
      if (data) {
        disabled = !!data.disabled;
        cache = data.cache;
      }
    } catch (_e) {
    }
  };
  const init = () => {
    if (!initialized) {
      initialized = true;
      if (autoPageview) track();
      handlePathChanges();
      handleClicks();
      if (perf) initPerformance();
    }
  };
  const track = (name, data) => {
    if (typeof name === "string") return send({ ...getPayload(), name, data });
    if (typeof name === "object") return send({ ...name });
    if (typeof name === "function") return send(name(getPayload()));
    return send(getPayload());
  };
  const identify = (id, data) => {
    const nextIdentity = typeof id === "string" ? id : id.id;
    if (nextIdentity !== void 0) {
      identity = nextIdentity;
    }
    cache = "";
    return send(
      {
        ...getPayload(),
        data: typeof id === "object" ? id : data
      },
      "identify"
    );
  };
  const initPerformance = () => {
    const metrics = {};
    let sent = false;
    let timeoutId;
    let isInitialLoad = true;
    let activationStart = 0;
    let pageStartTime = 0;
    const observe = (type, callback) => {
      try {
        const observer = new PerformanceObserver((list) => {
          list.getEntries().forEach(callback);
        });
        observer.observe({ type, buffered: true });
      } catch {
      }
    };
    observe("navigation", (entry) => {
      activationStart = entry.activationStart || 0;
      metrics.ttfb = Math.max(entry.responseStart - activationStart, 0);
    });
    observe("paint", (entry) => {
      if (entry.name === "first-contentful-paint") {
        metrics.fcp = Math.max(entry.startTime - activationStart, 0);
      }
    });
    observe("largest-contentful-paint", (entry) => {
      metrics.lcp = Math.max(entry.startTime - activationStart, 0);
    });
    let clsSessionValue = 0;
    let clsSessionEntries = [];
    observe("layout-shift", (entry) => {
      if (!entry.hadRecentInput) {
        const lastEntry = clsSessionEntries[clsSessionEntries.length - 1];
        const firstEntry = clsSessionEntries[0];
        if (lastEntry && entry.startTime - lastEntry.startTime - lastEntry.duration < 1e3 && entry.startTime - firstEntry.startTime < 5e3) {
          clsSessionValue += entry.value;
          clsSessionEntries.push(entry);
        } else {
          clsSessionValue = entry.value;
          clsSessionEntries = [entry];
        }
        if (clsSessionValue > (metrics.cls || 0)) {
          metrics.cls = clsSessionValue;
        }
      }
    });
    let interactions = {};
    let inpObserver;
    const recordInteractions = (entries) => {
      entries.forEach((entry) => {
        if (entry.interactionId) {
          const existing = interactions[entry.interactionId];
          if (!existing || entry.duration > existing) {
            interactions[entry.interactionId] = entry.duration;
          }
        }
      });
    };
    try {
      inpObserver = new PerformanceObserver((list) => recordInteractions(list.getEntries()));
      inpObserver.observe({
        type: "event",
        buffered: true,
        durationThreshold: 40
      });
    } catch {
    }
    const computeInp = () => {
      if (inpObserver) recordInteractions(inpObserver.takeRecords());
      const values = Object.values(interactions).sort((a, b) => b - a);
      if (values.length) {
        const p98Index = Math.floor(Math.max(values.length, 10) * 0.02);
        metrics.inp = values[Math.min(p98Index, values.length - 1)];
      }
    };
    const getEntriesByType = (type) => {
      try {
        return window2.performance?.getEntriesByType?.(type) || [];
      } catch {
        return [];
      }
    };
    const applyFallbackMetrics = () => {
      if (!isInitialLoad) return;
      if (metrics.ttfb === void 0) {
        const navigation = getEntriesByType("navigation")?.[0];
        if (navigation) {
          metrics.ttfb = Math.max(navigation.responseStart - (navigation.activationStart || 0), 0);
        }
      }
      if (metrics.fcp === void 0) {
        const fcpEntry = getEntriesByType("paint")?.find(
          (entry) => entry.name === "first-contentful-paint"
        );
        if (fcpEntry) {
          metrics.fcp = Math.max(fcpEntry.startTime - activationStart, 0);
        }
      }
      if (metrics.lcp === void 0) {
        const lcpEntries = getEntriesByType("largest-contentful-paint");
        const lcpEntry = lcpEntries?.[lcpEntries.length - 1];
        if (lcpEntry) {
          metrics.lcp = Math.max(lcpEntry.startTime - activationStart, 0);
        }
      }
    };
    const sendPerformance = () => {
      if (sent) return;
      applyFallbackMetrics();
      computeInp();
      metrics.duration = Math.round(performance.now() - pageStartTime);
      sent = true;
      if (timeoutId) clearTimeout(timeoutId);
      send({ ...getPayload(), ...metrics }, "performance");
    };
    flushPerformance = () => {
      sendPerformance();
      isInitialLoad = false;
      Object.keys(metrics).forEach((k) => {
        delete metrics[k];
      });
      activationStart = 0;
      pageStartTime = performance.now();
      clsSessionValue = 0;
      clsSessionEntries = [];
      interactions = {};
      sent = false;
      if (timeoutId) clearTimeout(timeoutId);
      timeoutId = setTimeout(sendPerformance, 1e4);
    };
    timeoutId = setTimeout(sendPerformance, 1e4);
    document.addEventListener("visibilitychange", () => {
      if (document.visibilityState === "hidden") sendPerformance();
    });
    window2.addEventListener("pagehide", sendPerformance);
  };
  if (!window2.umami) {
    window2.umami = {
      track,
      identify,
      getSession: () => ({ cache, website })
    };
  }
  let currentUrl = normalize(href);
  let currentRef = normalize(referrer);
  let initialized = false;
  let disabled = false;
  let cache;
  let identity = distinctId;
  let flushPerformance;
  if (distinctId) {
    void identify(distinctId);
  }
  if (autoTrack && !trackingDisabled()) {
    if (document.readyState === "complete") {
      init();
    } else {
      document.addEventListener("readystatechange", init, true);
    }
  }
})(window);
