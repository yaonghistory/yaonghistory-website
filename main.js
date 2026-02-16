(() => {
  "use strict";

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

  // -------------------------
  // Cancelable smooth scroll (1회만 실행)
  // -------------------------
  let animId = 0;
  let rafId = 0;

  function cancelSmooth() {
    animId += 1;
    if (rafId) cancelAnimationFrame(rafId);
    rafId = 0;
  }

  const easeInOutQuint = (t) =>
    t < 0.5 ? 16 * t * t * t * t * t : 1 - Math.pow(-2 * t + 2, 5) / 2;

  function smoothScrollToY(targetY, duration = 780) {
    const startY = nowY();
    const endY = clamp(targetY, 0, maxScrollY());

    if (prefersReducedMotion) {
      cancelSmooth();
      window.scrollTo(0, endY);
      return;
    }

    cancelSmooth();
    const myId = animId;
    const startT = performance.now();

    function tick(tNow) {
      if (myId !== animId) return;

      const t = clamp((tNow - startT) / duration, 0, 1);
      const y = startY + (endY - startY) * easeInOutQuint(t);
      window.scrollTo(0, y);

      if (t < 1) rafId = requestAnimationFrame(tick);
      else rafId = 0;
    }

    rafId = requestAnimationFrame(tick);
  }

  function snapToEl(el) {
    if (!el) return;
    cancelSmooth();
    window.scrollTo(0, getTargetY(el));
  }

  // -------------------------
  // Contact image prime
  // -------------------------
  let primed = false;
  function primeLazyImagesForContact() {
    if (primed) return;
    primed = true;
    $$('img[loading="lazy"]').forEach((img) => {
      try {
        img.loading = "eager";
        img.decoding = "async";
      } catch (_) {}
      try {
        img.setAttribute("fetchpriority", "high");
      } catch (_) {}
    });
  }

  // -------------------------
  // NAV: 단발 스무스 + 최대 2회 보정 (핑퐁 방지)
  // -------------------------
  let navLock = false;
  let navTimers = [];

  function clearNavTimers() {
    navTimers.forEach((t) => clearTimeout(t));
    navTimers = [];
  }

  function maybeCorrect(el) {
    if (!el) return;
    const yTarget = getTargetY(el);
    const diff = Math.abs(yTarget - nowY());

    // 아주 작은 오차는 무시(부드러움 유지)
    if (diff <= 6) return;

    // iOS 바닥 러버밴드 방지: 바닥 근처면 바닥으로 고정
    const m = maxScrollY();
    const top = yTarget >= m - 2 ? m : yTarget;

    // 여기서 "스무스" 금지 (추가 스무스가 핑퐁을 만듦)
    window.scrollTo(0, top);
  }

  function scrollToElOneShot(el) {
    if (!el) return;

    if (navLock) return;
    navLock = true;

    clearNavTimers();
    cancelSmooth();

    // 1) 부드러운 이동 1회
    smoothScrollToY(getTargetY(el), 820);

    // 2) 레이아웃 변화(주소창/이미지/폰트) 이후를 대비해
    //    "필요할 때만" 보정 2회
    navTimers.push(setTimeout(() => maybeCorrect(el), 320));
    navTimers.push(setTimeout(() => maybeCorrect(el), 900));

    // 3) 최종 확정(한 번)
    navTimers.push(
      setTimeout(() => {
        snapToEl(el);
        navLock = false;
      }, 1250)
    );
  }

  // -------------------------
  // Anchor bind
  // -------------------------
  function bindSmoothAnchors() {
    $$("[data-scroll]").forEach((a) => {
      a.addEventListener(
        "click",
        (e) => {
          const href = a.getAttribute("href") || "";
          if (!href.startsWith("#")) return;

          const target = $(href);
          if (!target) return;

          e.preventDefault();

          if (href === "#contact") primeLazyImagesForContact();
          scrollToElOneShot(target);

          try {
            history.replaceState(null, "", location.pathname + location.search);
          } catch (_) {}
        },
        { passive: false }
      );
    });
  }

  // -------------------------
  // Reveal (원래대로 유지)
  // -------------------------
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
      ".gallery .thumb",
      ".form",
      ".footer-inner"
    ];

    const set = new Set();
    selectors.forEach((sel) => $$(sel).forEach((el) => set.add(el)));
    set.forEach((el) => el.classList.add("reveal"));
    return Array.from(set);
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

      const offset = getHeaderOffset() + 10;
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

        if (top < offset) {
          applyState(el, "out");
          continue;
        }

        if (top > viewBottom + 140) applyState(el, "init");
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

  // -------------------------
  // Mail
  // -------------------------
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

  // -------------------------
  // Init
  // -------------------------
  function getNavType() {
    try {
      const nav = performance.getEntriesByType && performance.getEntriesByType("navigation");
      return nav && nav[0] && nav[0].type ? nav[0].type : null;
    } catch (_) {
      return null;
    }
  }

  function init() {
    const navType = getNavType();
    if (navType === "reload" || navType === "back_forward") {
      try {
        history.replaceState(null, "", location.pathname + location.search);
      } catch (_) {}
      window.scrollTo(0, 0);
    }

    bindSmoothAnchors();

    const targets = markRevealTargets();
    bindRevealObserver(targets);

    bindMail();

    if (location.hash && navType !== "reload" && navType !== "back_forward") {
      const el = $(location.hash);
      if (el) setTimeout(() => scrollToElOneShot(el), 0);
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();