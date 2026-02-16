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

  function smoothToY(targetY, duration = 760) {
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
    smoothToY(getTargetY(el), 820);
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

  function applyState(el, next) {
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

  function markRevealTargets() {
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

  function bindRevealObserver(targets) {
    if (prefersReducedMotion) {
      targets.forEach((el) => applyState(el, "in"));
      return;
    }

    if (!("IntersectionObserver" in window)) {
      targets.forEach((el) => applyState(el, "in"));
      return;
    }

    targets.forEach((el) => applyState(el, "init"));

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
          continue;
        }

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

    targets.forEach((el) => io.observe(el));

    let raf2 = 0;
    const refresh = () => {
      if (raf2) cancelAnimationFrame(raf2);
      raf2 = requestAnimationFrame(() => {
        io.disconnect();
        targets.forEach((el) => io.observe(el));
      });
    };

    window.addEventListener("resize", refresh, { passive: true });
    window.addEventListener("orientationchange", refresh, { passive: true });
  }

  function staggerThumbs(thumbs, stepMs = 80) {
    if (prefersReducedMotion) return;

    thumbs.forEach((el, i) => {
      el.style.transitionDelay = `${i * stepMs}ms`;
    });

    setTimeout(() => {
      thumbs.forEach((el) => (el.style.transitionDelay = ""));
    }, Math.min(900, thumbs.length * stepMs + 240));
  }

  function bindFoldStagger() {
    const folds = $$(".fold");
    if (!folds.length) return;

    folds.forEach((d) => {
      const thumbs = $$(".gallery .thumb", d);
      const run = () => staggerThumbs(thumbs, 80);

      if (d.open) run();

      d.addEventListener("toggle", () => {
        if (d.open) run();
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
          `희망 팀 / 일정: ${schedule}`,
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

    const targets = markRevealTargets();
    bindRevealObserver(targets);

    bindFoldStagger();

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