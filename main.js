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
  // Contact image prime
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
  // Single "tracking" scroll animation (no flicker, no multi-animations)
  // =========================
  const scrollRunner = (() => {
    let raf = 0;
    let id = 0;
    let running = false;

    function cancel() {
      id += 1;
      running = false;
      if (raf) cancelAnimationFrame(raf);
      raf = 0;
    }

    // 스프링(임계감쇠에 가깝게)로 목표를 따라감
    // 목표가 스크롤 도중 변해도 계속 추적해서 100% 도달
    function runToEl(el, opts = {}) {
      if (!el) return;
      cancel();

      if (prefersReducedMotion) {
        window.scrollTo(0, getTargetY(el));
        return;
      }

      const myId = id;
      running = true;

      const maxMs = typeof opts.maxMs === "number" ? opts.maxMs : 5200;
      const startT = performance.now();

      // 튜닝값: 부드러움/도달 속도
      const stiffness = 0.018; // 작을수록 부드럽고 느림
      const damping = 0.78;    // 0~1, 클수록 덜 튐

      let v = 0; // velocity
      let stableFrames = 0;

      const step = () => {
        if (myId !== id) return; // canceled

        const y = nowY();
        const target = getTargetY(el);
        const err = target - y;

        // 목표가 거의 맞으면 안정 카운트
        if (Math.abs(err) < 1.2 && Math.abs(v) < 0.25) {
          stableFrames += 1;
        } else {
          stableFrames = 0;
        }

        // 스프링 업데이트(간단한 수치적분)
        v = v * damping + err * stiffness * 100; // 100은 체감 속도 스케일
        const nextY = y + v;

        window.scrollTo(0, clamp(nextY, 0, maxScrollY()));

        const elapsed = performance.now() - startT;

        // 1) 충분히 안정되면 종료 + 마지막 스냅(정확도 확보)
        if (stableFrames >= 8) {
          running = false;
          raf = 0;
          window.scrollTo(0, target);
          return;
        }

        // 2) 타임아웃이면 종료 + 스냅
        if (elapsed > maxMs) {
          running = false;
          raf = 0;
          window.scrollTo(0, target);
          return;
        }

        raf = requestAnimationFrame(step);
      };

      raf = requestAnimationFrame(step);
    }

    return { runToEl, cancel, get running() { return running; } };
  })();

  // 도달 판정(헤더 가림 방지)
  function isGood(el) {
    const r = el.getBoundingClientRect();
    const topLimit = getHeaderOffset() + 6;
    const bottomLimit = window.innerHeight - 12;
    return r.top >= topLimit && r.top <= bottomLimit;
  }

  // =========================
  // Guaranteed scroll wrapper
  // =========================
  function scrollToElGuaranteed(el) {
    if (!el) return;

    scrollRunner.runToEl(el, { maxMs: 5600 });

    // 이벤트가 많아도 "새 애니메이션 시작"은 절대 안 하고
    // 현재 애니메이션이 목표를 계속 추적하므로, 아래는 안전망(아주 가끔만)
    let t = 0;
    const start = performance.now();

    const safety = () => {
      const elapsed = performance.now() - start;
      if (elapsed > 5600) return;

      if (isGood(el)) return;

      // 목표가 크게 바뀐 케이스: 한번 더 추적 재시작(기존 애니메이션 취소 후 1개만 유지)
      scrollRunner.runToEl(el, { maxMs: 4200 });
      t = setTimeout(safety, 520);
    };

    t = setTimeout(safety, 520);

    // 정리용 핸들(다음 클릭 때 이전 안전망 제거)
    if (scrollToElGuaranteed._t) clearTimeout(scrollToElGuaranteed._t);
    scrollToElGuaranteed._t = t;
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

          // 기존 스크롤 취소 후 단일 추적 스크롤
          scrollRunner.cancel();
          scrollToElGuaranteed(target);

          // 해시 남기지 않기
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