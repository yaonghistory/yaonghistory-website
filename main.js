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

  function maxScrollY() {
    return Math.max(0, document.documentElement.scrollHeight - window.innerHeight);
  }

  function getTargetY(el) {
    const rect = el.getBoundingClientRect();
    const y =
      (window.pageYOffset || document.documentElement.scrollTop || 0) +
      rect.top -
      getHeaderOffset();
    return clamp(y, 0, maxScrollY());
  }

  function smoothScrollToY(targetY) {
    const startY = window.pageYOffset || document.documentElement.scrollTop || 0;
    const endY = clamp(targetY, 0, maxScrollY());

    if (prefersReducedMotion) {
      window.scrollTo(0, endY);
      return;
    }

    const duration = 520;
    const startT = performance.now();
    const easeOutCubic = (t) => 1 - Math.pow(1 - t, 3);

    function tick(now) {
      const t = clamp((now - startT) / duration, 0, 1);
      const y = startY + (endY - startY) * easeOutCubic(t);
      window.scrollTo(0, y);
      if (t < 1) requestAnimationFrame(tick);
    }

    requestAnimationFrame(tick);
  }

  function smoothToEl(el) {
    if (!el) return;
    smoothScrollToY(getTargetY(el));
  }

  function snapToEl(el) {
    if (!el) return;
    window.scrollTo(0, getTargetY(el));
  }

  // ---------- Contact image prime (레이아웃 흔들림 줄이기) ----------
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

  // ---------- "떨림" 방지용: 보정 스로틀 + 조건 ----------
  function needsFix(el) {
    const r = el.getBoundingClientRect();
    const topLimit = getHeaderOffset() + 6;
    // 10~12px 이내 오차는 무시(미세 진동 방지)
    return Math.abs(r.top - topLimit) > 12;
  }

  // ---------- Guaranteed scroll (B: 도달 우선) ----------
  // 전략:
  // 1) smooth는 1번만 실행
  // 2) 이후 보정은 "스냅"으로만 (진동 최소)
  // 3) 이벤트(폰트/이미지/resize/vv.resize) 때는 스로틀 걸어 조건부 스냅
  function scrollToElGuaranteed(el, opts = {}) {
    if (!el) return;

    const maxMs = typeof opts.maxMs === "number" ? opts.maxMs : 5200;
    const snapAtEnd = opts.snapAtEnd !== false;

    if (scrollToElGuaranteed._kill) scrollToElGuaranteed._kill();
    scrollToElGuaranteed._kill = null;

    let done = false;
    const start = performance.now();

    let lastFixAt = 0;
    const FIX_COOLDOWN = 160; // ms (너무 자주 보정하면 떨림)

    const maybeFix = (force = false) => {
      if (done) return;
      const now = performance.now();
      if (!force && now - lastFixAt < FIX_COOLDOWN) return;
      if (force || needsFix(el)) {
        lastFixAt = now;
        snapToEl(el);
      }
    };

    const finalize = () => {
      if (done) return;
      done = true;
      if (snapAtEnd) snapToEl(el);
      cleanupAll();
    };

    const cleanupFns = [];
    const cleanupAll = () => {
      cleanupFns.splice(0).forEach((fn) => {
        try { fn(); } catch (_) {}
      });
    };

    // 1) 첫 이동: smooth 1회
    smoothToEl(el);

    // 2) 다음 프레임, 다음 틱에 스냅 1~2회로 정착
    requestAnimationFrame(() => maybeFix(true));
    setTimeout(() => maybeFix(true), 120);
    setTimeout(() => maybeFix(true), 260);

    // 3) 폰트 로딩 완료 시 보정(스로틀)
    if (document.fonts && document.fonts.ready) {
      document.fonts.ready.then(() => maybeFix(false)).catch(() => {});
    }

    // 4) 섹션 내부 이미지 로딩/디코드 시 보정(스로틀)
    const imgs = $$("img", el);
    if (imgs.length) {
      imgs.forEach((img) => {
        if (img.complete) return;

        const handler = () => maybeFix(false);
        img.addEventListener("load", handler, { passive: true, once: true });
        img.addEventListener("error", handler, { passive: true, once: true });
        cleanupFns.push(() => {
          try { img.removeEventListener("load", handler); } catch (_) {}
          try { img.removeEventListener("error", handler); } catch (_) {}
        });

        if (img.decode) img.decode().then(handler).catch(() => {});
      });
    }

    // 5) iOS 주소창/뷰포트 변화: visualViewport "resize"만 사용(스크롤 이벤트는 떨림 원인이라 금지)
    const vv = window.visualViewport;
    if (vv && vv.addEventListener) {
      const vvHandler = () => maybeFix(false);
      vv.addEventListener("resize", vvHandler, { passive: true });
      cleanupFns.push(() => {
        try { vv.removeEventListener("resize", vvHandler); } catch (_) {}
      });
    }

    // 6) resize/orientationchange 때 보정(스로틀)
    const winHandler = () => maybeFix(false);
    window.addEventListener("resize", winHandler, { passive: true });
    window.addEventListener("orientationchange", winHandler, { passive: true });
    cleanupFns.push(() => {
      try { window.removeEventListener("resize", winHandler); } catch (_) {}
      try { window.removeEventListener("orientationchange", winHandler); } catch (_) {}
    });

    // 7) 타임박스 루프: 도달할 때까지(또는 maxMs) 일정 간격으로 체크/보정
    let t = 0;
    const loop = () => {
      if (done) return;

      if (!needsFix(el)) {
        finalize();
        return;
      }

      const elapsed = performance.now() - start;
      if (elapsed > maxMs) {
        maybeFix(true);
        finalize();
        return;
      }

      maybeFix(false);
      t = setTimeout(loop, 220);
    };
    t = setTimeout(loop, 220);

    scrollToElGuaranteed._kill = () => {
      done = true;
      try { clearTimeout(t); } catch (_) {}
      cleanupAll();
    };
  }

  function getNavType() {
    try {
      const nav = performance.getEntriesByType && performance.getEntriesByType("navigation");
      return nav && nav[0] && nav[0].type ? nav[0].type : null;
    } catch (_) {
      return null;
    }
  }

  // ---------- Anchors ----------
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

  // ---------- Reveal ----------
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

  // ---------- Mail ----------
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

  // ---------- Init ----------
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