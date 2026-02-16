(() => {
  "use strict";

  if (window.__YAONG_MAIN_INIT__) return;
  window.__YAONG_MAIN_INIT__ = true;

  try {
    if ("scrollRestoration" in history) history.scrollRestoration = "manual";
  } catch (_) {}

  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

  const header = $(".site-header");
  const prefersReducedMotion =
    window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  const clamp = (n, min, max) => Math.max(min, Math.min(max, n));
  const nowY = () => window.pageYOffset || document.documentElement.scrollTop || 0;
  const maxScrollY = () =>
    Math.max(0, document.documentElement.scrollHeight - window.innerHeight);

  function getHeaderOffset() {
    const root = document.documentElement;
    const cssVal = getComputedStyle(root).getPropertyValue("--header-offset").trim();
    const cssNum = cssVal ? parseInt(cssVal, 10) : NaN;
    const h = header ? Math.ceil(header.getBoundingClientRect().height) : 0;
    const base = Number.isFinite(cssNum) ? cssNum : h + 10;
    return Math.max(60, base);
  }

  function getTargetY(el) {
    const rect = el.getBoundingClientRect();
    const y = nowY() + rect.top - getHeaderOffset();
    return clamp(y, 0, maxScrollY());
  }

  function getNavType() {
    try {
      const nav = performance.getEntriesByType && performance.getEntriesByType("navigation");
      return nav && nav[0] && nav[0].type ? nav[0].type : null;
    } catch (_) {
      return null;
    }
  }

  function clearHash() {
    try {
      history.replaceState(null, "", location.pathname + location.search);
    } catch (_) {}
  }

  let animToken = 0;
  let rafId = 0;

  function cancelScroll() {
    animToken += 1;
    if (rafId) cancelAnimationFrame(rafId);
    rafId = 0;
  }

  const easeInOutCubic = (t) =>
    t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;

  function smoothToY(targetY, duration = 740) {
    const endY = clamp(targetY, 0, maxScrollY());

    if (prefersReducedMotion) {
      cancelScroll();
      window.scrollTo(0, endY);
      return;
    }

    cancelScroll();
    const myToken = animToken;
    const startY = nowY();
    const startT = performance.now();

    function tick(tNow) {
      if (myToken !== animToken) return;

      const t = clamp((tNow - startT) / duration, 0, 1);
      const y = startY + (endY - startY) * easeInOutCubic(t);
      window.scrollTo(0, y);

      if (t < 1) rafId = requestAnimationFrame(tick);
      else rafId = 0;
    }

    rafId = requestAnimationFrame(tick);
  }

  function scrollToEl(el) {
    if (!el) return;
    smoothToY(getTargetY(el), 780);
    setTimeout(() => window.scrollTo(0, getTargetY(el)), 260);
  }

  function bindAnchors() {
    $$("[data-scroll]").forEach((a) => {
      a.addEventListener(
        "click",
        (e) => {
          const href = a.getAttribute("href") || "";
          if (!href.startsWith("#")) return;

          const target = $(href);
          if (!target) return;

          e.preventDefault();
          clearHash();
          scrollToEl(target);
        },
        { passive: false }
      );
    });
  }

  function isThumb(el) {
    return el && el.classList && el.classList.contains("thumb");
  }

  function applyState(el, next) {
    // ✅ 사진(thumb)은 한 번 보였으면(out/init로) 절대 흐려지지 않게 고정
    if (isThumb(el) && el.dataset.seen === "1" && next !== "in") next = "in";

    const cur = el.dataset.rv || "";
    if (cur === next) return;
    el.dataset.rv = next;

    if (next === "in") {
      el.classList.add("is-in");
      el.classList.remove("is-out");
      el.dataset.seen = "1";
      return;
    }
    if (next === "out") {
      el.classList.remove("is-in");
      el.classList.add("is-out");
      return;
    }
    el.classList.remove("is-in");
    el.classList.remove("is-out");
  }

  function staggerIn(list, stepMs = 80) {
    if (prefersReducedMotion) return;

    let idx = 0;
    for (const el of list) {
      if (el.dataset.stg === "1") continue;
      el.dataset.stg = "1";
      el.style.transitionDelay = `${idx * stepMs}ms`;
      idx += 1;
    }

    setTimeout(() => {
      list.forEach((el) => {
        el.style.transitionDelay = "";
        el.dataset.stg = "0";
      });
    }, Math.min(900, list.length * stepMs + 220));
  }

  function markBaseRevealTargets() {
    const selectors = [
      ".section .sec-head",
      ".hero .pill",
      ".hero-title",
      ".hero-sub",
      ".hero-copy",
      ".btn-row",
      ".stat",
      ".card",
      ".panel",
      ".step",
      ".place-list li",
      ".place-note",
      ".team-card",
      ".curr-item",
      ".teacher",
      ".fold-btn",
      ".form",
      ".footer-inner"
    ];

    const set = new Set();
    selectors.forEach((sel) => $$(sel).forEach((el) => set.add(el)));

    const targets = Array.from(set);
    targets.forEach((el) => el.classList.add("reveal"));
    return targets;
  }

  function createRevealObserver(onEnter) {
    if (prefersReducedMotion || !("IntersectionObserver" in window)) {
      return {
        observe: (els) => els.forEach((el) => applyState(el, "in")),
        refresh: () => {}
      };
    }

    let raf = 0;
    let queue = [];

    const process = () => {
      raf = 0;

      const entries = queue;
      queue = [];

      const offsetTop = getHeaderOffset() + 10;
      const viewBottom = window.innerHeight;

      for (const entry of entries) {
        const el = entry.target;

        if (entry.isIntersecting) {
          applyState(el, "in");
          if (typeof onEnter === "function") onEnter(el);
          continue;
        }

        // ✅ thumb는 seen 이후 out/init로 보내지 않음 (applyState에서 in으로 강제됨)
        if (el.dataset.seen !== "1") continue;

        const top =
          entry.boundingClientRect && typeof entry.boundingClientRect.top === "number"
            ? entry.boundingClientRect.top
            : el.getBoundingClientRect().top;

        if (top < offsetTop) {
          applyState(el, "out");
          continue;
        }

        if (top > viewBottom + 140) {
          applyState(el, "init");
        }
      }
    };

    const io = new IntersectionObserver(
      (entries) => {
        queue.push(...entries);
        if (!raf) raf = requestAnimationFrame(process);
      },
      {
        root: null,
        threshold: [0, 0.14, 0.28],
        rootMargin: `-${getHeaderOffset()}px 0px -12% 0px`
      }
    );

    const observe = (els) => {
      els.forEach((el) => {
        if (!el.classList.contains("reveal")) el.classList.add("reveal");
        applyState(el, "init");
        io.observe(el);
      });
    };

    const refresh = (allObservedEls) => {
      io.disconnect();
      allObservedEls.forEach((el) => io.observe(el));
    };

    return { observe, refresh };
  }

  function bindFoldGalleryReveal(reveal) {
    const detailsList = $$(".fold");
    if (!detailsList.length) return;

    detailsList.forEach((d) => {
      const thumbs = $$(".gallery .thumb", d);

      const enableThumbs = () => {
        thumbs.forEach((t) => t.classList.add("reveal"));
        staggerIn(thumbs, 80);
        reveal.observe(thumbs);
      };

      if (d.open) enableThumbs();

      d.addEventListener("toggle", () => {
        if (d.open) enableThumbs();
      });
    });
  }

  function bindMail() {
    const mailBtn = $("#mailBtn");
    const form = $("#contactForm");
    if (!mailBtn || !form) return;

    mailBtn.addEventListener("click", () => {
      const fd = new FormData(form);
      const parent = (fd.get("parent") || "").toString().trim();
      const phone = (fd.get("phone") || "").toString().trim();
      const people = (fd.get("people") || "").toString().trim();
      const schedule = (fd.get("schedule") || "").toString().trim();
      const message = (fd.get("message") || "").toString().trim();

      const subject = encodeURIComponent("야옹 역사 수업 문의");
      const body = encodeURIComponent(
        [
          `보호자 이름: ${parent}`,
          `휴대폰 번호: ${phone}`,
          `인원: ${people}`,
          `희망 장소/일정: ${schedule}`,
          ``,
          `문의 내용:`,
          `${message}`
        ].join("\n")
      );

      location.href = `mailto:yaonghistory@gmail.com?subject=${subject}&body=${body}`;
    });
  }

  function forceTopOnReloadOrBFCache() {
    const navType = getNavType();

    if (navType === "reload" || navType === "back_forward") {
      clearHash();
      cancelScroll();
      window.scrollTo(0, 0);
    }

    window.addEventListener(
      "pageshow",
      (e) => {
        if (e.persisted) {
          clearHash();
          cancelScroll();
          window.scrollTo(0, 0);
        }
      },
      { passive: true }
    );
  }

  function init() {
    forceTopOnReloadOrBFCache();
    bindAnchors();
    bindMail();

    const baseTargets = markBaseRevealTargets();

    const reveal = createRevealObserver((el) => {
      if (!isThumb(el)) return;
      const parent = el.closest(".gallery");
      if (!parent) return;
      staggerIn($$(".thumb", parent), 80);
    });

    reveal.observe(baseTargets);
    bindFoldGalleryReveal(reveal);

    if (!prefersReducedMotion && "IntersectionObserver" in window) {
      let raf = 0;
      const onResize = () => {
        if (raf) cancelAnimationFrame(raf);
        raf = requestAnimationFrame(() => reveal.refresh(baseTargets));
      };
      window.addEventListener("resize", onResize, { passive: true });
      window.addEventListener("orientationchange", onResize, { passive: true });
    }

    const navType = getNavType();
    if (location.hash && navType !== "reload" && navType !== "back_forward") {
      const el = $(location.hash);
      clearHash();
      if (el) setTimeout(() => scrollToEl(el), 0);
    } else {
      if (location.hash) clearHash();
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();