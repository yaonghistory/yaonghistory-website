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

  function getHeaderOffset() {
    const root = document.documentElement;
    const cssVal = getComputedStyle(root).getPropertyValue("--header-offset").trim();
    const cssNum = cssVal ? parseInt(cssVal, 10) : NaN;
    const h = header ? Math.ceil(header.getBoundingClientRect().height) : 0;
    const base = Number.isFinite(cssNum) ? cssNum : h + 10;
    return Math.max(60, base);
  }

  const clamp = (n, min, max) => Math.max(min, Math.min(max, n));
  const nowY = () => window.pageYOffset || document.documentElement.scrollTop || 0;
  const maxScrollY = () =>
    Math.max(0, document.documentElement.scrollHeight - window.innerHeight);

  function getTargetY(el) {
    const rect = el.getBoundingClientRect();
    const y = nowY() + rect.top - getHeaderOffset();
    return clamp(y, 0, maxScrollY());
  }

  // =========================
  // Single-run smooth scroll (CANCELABLE)
  // =========================
  let activeAnim = { id: 0, raf: 0, running: false };

  function cancelScrollAnim() {
    activeAnim.id += 1;
    activeAnim.running = false;
    if (activeAnim.raf) cancelAnimationFrame(activeAnim.raf);
    activeAnim.raf = 0;
  }

  // 부드러운 이징(더 자연스럽게)
  const easeInOutQuint = (t) =>
    t < 0.5 ? 16 * t * t * t * t * t : 1 - Math.pow(-2 * t + 2, 5) / 2;

  function smoothScrollToY(targetY, duration = 720) {
    const startY = nowY();
    const endY = clamp(targetY, 0, maxScrollY());

    if (prefersReducedMotion) {
      cancelScrollAnim();
      window.scrollTo(0, endY);
      return;
    }

    cancelScrollAnim();
    activeAnim.running = true;
    const myId = activeAnim.id;
    const startT = performance.now();

    function tick(tNow) {
      if (myId !== activeAnim.id) return; // canceled
      const t = clamp((tNow - startT) / duration, 0, 1);
      const y = startY + (endY - startY) * easeInOutQuint(t);
      window.scrollTo(0, y);

      if (t < 1) {
        activeAnim.raf = requestAnimationFrame(tick);
      } else {
        activeAnim.running = false;
        activeAnim.raf = 0;
      }
    }

    activeAnim.raf = requestAnimationFrame(tick);
  }

  function snapToEl(el) {
    if (!el) return;
    cancelScrollAnim(); // 스냅은 즉시 확정
    window.scrollTo(0, getTargetY(el));
  }

  // =========================
  // Contact image prime (layout shift 줄이기)
  // =========================
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

  // =========================
  // Guaranteed scroll (NO multi-smooth; fixes are snap-only)
  // =========================
  function needsFix(el) {
    const r = el.getBoundingClientRect();
    const topLimit = getHeaderOffset() + 6;
    return Math.abs(r.top - topLimit) > 10; // 너무 민감하면 떨림
  }

  function isGood(el) {
    const r = el.getBoundingClientRect();
    const topLimit = getHeaderOffset() + 6;
    const bottomLimit = window.innerHeight - 12;
    return r.top >= topLimit && r.top <= bottomLimit;
  }

  function scrollToElGuaranteed(el, opts = {}) {
    if (!el) return;

    const maxMs = typeof opts.maxMs === "number" ? opts.maxMs : 5200;

    // 이전 실행 종료
    if (scrollToElGuaranteed._kill) scrollToElGuaranteed._kill();
    scrollToElGuaranteed._kill = null;

    let done = false;
    const startT = performance.now();

    // 보정 스로틀
    let lastFixAt = 0;
    const FIX_COOLDOWN = 220;

    // 핵심: 스크롤 중(애니메이션 running)에는 보정 예약만 하고,
    // 애니메이션이 끝난 뒤에만 snap 보정을 수행한다.
    let pendingFix = false;
    const scheduleFix = () => {
      if (done) return;
      pendingFix = true;
    };

    const applyFixIfPossible = (force = false) => {
      if (done) return;
      const t = performance.now();
      if (!force && t - lastFixAt < FIX_COOLDOWN) return;

      if (!pendingFix && !force) return;
      if (activeAnim.running && !force) return; // 달리는 중에는 건드리지 않음

      pendingFix = false;

      if (force || needsFix(el)) {
        lastFixAt = t;
        // 마지막 보정은 snap (중첩 smooth 금지)
        window.scrollTo(0, getTargetY(el));
      }
    };

    const cleanupFns = [];
    const cleanupAll = () => {
      cleanupFns.splice(0).forEach((fn) => {
        try { fn(); } catch (_) {}
      });
    };

    const finalize = () => {
      if (done) return;
      done = true;
      // 끝에서 한 번 확정 스냅
      snapToEl(el);
      cleanupAll();
    };

    // 1) 최초 이동: smooth는 딱 1번만
    smoothScrollToY(getTargetY(el), 760);

    // 2) 애니메이션 종료 직후에 스냅 보정 1~2회
    setTimeout(() => scheduleFix(), 140);
    setTimeout(() => scheduleFix(), 320);
    setTimeout(() => scheduleFix(), 520);

    // 3) 폰트/이미지/뷰포트 변화는 "보정 예약"만
    if (document.fonts && document.fonts.ready) {
      document.fonts.ready.then(scheduleFix).catch(() => {});
    }

    const imgs = $$("img", el);
    if (imgs.length) {
      imgs.forEach((img) => {
        if (img.complete) return;
        const handler = () => scheduleFix();
        img.addEventListener("load", handler, { passive: true, once: true });
        img.addEventListener("error", handler, { passive: true, once: true });
        cleanupFns.push(() => {
          try { img.removeEventListener("load", handler); } catch (_) {}
          try { img.removeEventListener("error", handler); } catch (_) {}
        });
        if (img.decode) img.decode().then(handler).catch(() => {});
      });
    }

    const vv = window.visualViewport;
    if (vv && vv.addEventListener) {
      const vvHandler = () => scheduleFix();
      vv.addEventListener("resize", vvHandler, { passive: true });
      cleanupFns.push(() => {
        try { vv.removeEventListener("resize", vvHandler); } catch (_) {}
      });
    }

    const winHandler = () => scheduleFix();
    window.addEventListener("resize", winHandler, { passive: true });
    window.addEventListener("orientationchange", winHandler, { passive: true });
    cleanupFns.push(() => {
      try { window.removeEventListener("resize", winHandler); } catch (_) {}
      try { window.removeEventListener("orientationchange", winHandler); } catch (_) {}
    });

    // 4) 체크 루프: pendingFix를 애니메이션 끝난 타이밍에만 적용
    let tmr = 0;
    const loop = () => {
      if (done) return;

      // 보정 적용(가능할 때만)
      applyFixIfPossible(false);

      // 충분히 도달했으면 종료
      if (isGood(el) || !needsFix(el)) {
        finalize();
        return;
      }

      // 타임아웃이면 강제로 1회 보정 후 종료
      const elapsed = performance.now() - startT;
      if (elapsed > maxMs) {
        applyFixIfPossible(true);
        finalize();
        return;
      }

      tmr = setTimeout(loop, 180);
    };
    tmr = setTimeout(loop, 180);

    scrollToElGuaranteed._kill = () => {
      done = true;
      try { clearTimeout(tmr); } catch (_) {}
      cleanupAll();
    };
  }

  // =========================
  // Navigation type
  // =========================
  function getNavType() {
    try {
      const nav = performance.getEntriesByType && performance.getEntriesByType("navigation");
      return nav && nav[0] && nav[0].type ? nav[0].type : null;
    } catch (_) {
      return null;
    }
  }

  // =========================
  // Anchors
  // =========================
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
          scrollToElGuaranteed(target);

          try {
            history.replaceState(null, "", location.pathname + location.search);
          } catch (_) {}
        },
        { passive: false }
      );
    });
  }

  // =========================
  // Reveal
  // =========================
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

  // =========================
  // Mail
  // =========================
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

  // =========================
  // Init
  // =========================
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
      if (el) setTimeout(() => scrollToElGuaranteed(el), 0);
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();