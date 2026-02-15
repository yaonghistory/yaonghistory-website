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

  function smoothScrollToY(targetY) {
    const startY = window.pageYOffset || document.documentElement.scrollTop || 0;
    const maxY = Math.max(0, document.documentElement.scrollHeight - window.innerHeight);
    const endY = clamp(targetY, 0, maxY);

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

  function getTargetY(el) {
    const rect = el.getBoundingClientRect();
    const y =
      (window.pageYOffset || document.documentElement.scrollTop || 0) +
      rect.top -
      getHeaderOffset();
    return y;
  }

  function scrollToElOnce(el) {
    if (!el) return;
    smoothScrollToY(getTargetY(el));
  }

  // ---------- Stabilizers ----------
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

  function isElInGoodView(el) {
    const r = el.getBoundingClientRect();
    const topLimit = getHeaderOffset() + 6;
    const bottomLimit = window.innerHeight - 10;
    return r.top >= topLimit && r.top <= bottomLimit;
  }

  // 핵심: 레이아웃 변동(이미지/폰트/주소창/뷰포트) 상황에 자동 재보정
  function scrollToElGuaranteed(el, opts = {}) {
    if (!el) return;

    const maxMs = typeof opts.maxMs === "number" ? opts.maxMs : 4500;
    const snapAtEnd = opts.snapAtEnd !== false;

    // 이전 보정 루프 정리
    if (scrollToElGuaranteed._t) clearTimeout(scrollToElGuaranteed._t);
    if (scrollToElGuaranteed._raf) cancelAnimationFrame(scrollToElGuaranteed._raf);
    scrollToElGuaranteed._t = 0;
    scrollToElGuaranteed._raf = 0;

    // 이벤트 리스너(임시)
    let done = false;
    const cleanups = [];

    const cleanupAll = () => {
      cleanups.splice(0).forEach((fn) => {
        try { fn(); } catch (_) {}
      });
    };

    const settleSnap = () => {
      if (!snapAtEnd) return;
      // 마지막에 한번 "정확 위치"로 스냅 (iOS 주소창 변화로 1~2px 흔들리는 케이스 방지)
      try {
        window.scrollTo(0, clamp(getTargetY(el), 0, document.documentElement.scrollHeight - window.innerHeight));
      } catch (_) {}
    };

    const start = performance.now();
    const tick = () => {
      if (done) return;

      if (isElInGoodView(el)) {
        done = true;
        settleSnap();
        cleanupAll();
        return;
      }

      const elapsed = performance.now() - start;
      if (elapsed > maxMs) {
        // 타임아웃 시에도 마지막으로 한 번 더
        scrollToElOnce(el);
        done = true;
        settleSnap();
        cleanupAll();
        return;
      }

      // 계속 현재 레이아웃 기준으로 목표값 재계산해서 이동
      scrollToElOnce(el);

      scrollToElGuaranteed._t = setTimeout(() => {
        scrollToElGuaranteed._raf = requestAnimationFrame(tick);
      }, 120);
    };

    // 1) 즉시 1회
    scrollToElOnce(el);

    // 2) 다음 프레임에서 1회(레이아웃 계산 안정)
    requestAnimationFrame(() => scrollToElOnce(el));

    // 3) 폰트 로딩 완료 시 1회(문단/줄바꿈 변화 대응)
    if (document.fonts && document.fonts.ready) {
      const onFonts = () => {
        if (done) return;
        scrollToElOnce(el);
      };
      document.fonts.ready.then(onFonts).catch(() => {});
    }

    // 4) contact 안 이미지 로딩/디코드 완료 시 1회(높이 변화 대응)
    const imgs = $$("img", el);
    if (imgs.length) {
      imgs.forEach((img) => {
        if (img.complete) return;

        const handler = () => {
          if (done) return;
          scrollToElOnce(el);
        };

        img.addEventListener("load", handler, { passive: true, once: true });
        img.addEventListener("error", handler, { passive: true, once: true });

        cleanups.push(() => {
          try { img.removeEventListener("load", handler); } catch (_) {}
          try { img.removeEventListener("error", handler); } catch (_) {}
        });

        // decode 지원 브라우저: 디코드 후에도 한번 더
        if (img.decode) {
          img.decode().then(handler).catch(() => {});
        }
      });
    }

    // 5) iOS 주소창/뷰포트 변화(visualViewport) 때 보정
    const vv = window.visualViewport;
    if (vv && vv.addEventListener) {
      const vvHandler = () => {
        if (done) return;
        scrollToElOnce(el);
      };
      vv.addEventListener("resize", vvHandler, { passive: true });
      vv.addEventListener("scroll", vvHandler, { passive: true });
      cleanups.push(() => {
        try { vv.removeEventListener("resize", vvHandler); } catch (_) {}
        try { vv.removeEventListener("scroll", vvHandler); } catch (_) {}
      });
    }

    // 6) 일반 resize/orientationchange 때도 보정
    const winHandler = () => {
      if (done) return;
      scrollToElOnce(el);
    };
    window.addEventListener("resize", winHandler, { passive: true });
    window.addEventListener("orientationchange", winHandler, { passive: true });
    cleanups.push(() => {
      try { window.removeEventListener("resize", winHandler); } catch (_) {}
      try { window.removeEventListener("orientationchange", winHandler); } catch (_) {}
    });

    // 7) 루프 시작
    scrollToElGuaranteed._t = setTimeout(() => {
      scrollToElGuaranteed._raf = requestAnimationFrame(tick);
    }, 180);
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