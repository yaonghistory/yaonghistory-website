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

  // ---------- Inject CSS: nav 이동 중 reveal 강제 표시(빈 화면/깜빡임 방지) ----------
  function injectNavRevealCSS() {
    if (document.getElementById("navRevealFixStyle")) return;
    const s = document.createElement("style");
    s.id = "navRevealFixStyle";
    s.textContent = `
      body.nav-scrolling .reveal{
        opacity: 1 !important;
        transform: none !important;
      }
      body.nav-scrolling .reveal.is-out{
        opacity: 1 !important;
        transform: none !important;
      }
    `;
    document.head.appendChild(s);
  }

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
  const maxScrollY = () => Math.max(0, document.documentElement.scrollHeight - window.innerHeight);

  function getTargetY(el) {
    const rect = el.getBoundingClientRect();
    const y = nowY() + rect.top - getHeaderOffset();
    return clamp(y, 0, maxScrollY());
  }

  // =========================
  // Cancelable smooth scroll (중첩 애니메이션 제거)
  // =========================
  let anim = { id: 0, raf: 0, running: false };

  function cancelScrollAnim() {
    anim.id += 1;
    anim.running = false;
    if (anim.raf) cancelAnimationFrame(anim.raf);
    anim.raf = 0;
  }

  const easeInOutQuint = (t) =>
    t < 0.5 ? 16 * t * t * t * t * t : 1 - Math.pow(-2 * t + 2, 5) / 2;

  function smoothScrollToY(targetY, duration = 760) {
    const startY = nowY();
    const endY = clamp(targetY, 0, maxScrollY());

    if (prefersReducedMotion) {
      cancelScrollAnim();
      window.scrollTo(0, endY);
      return;
    }

    cancelScrollAnim();
    anim.running = true;
    const myId = anim.id;
    const startT = performance.now();

    function tick(tNow) {
      if (myId !== anim.id) return;

      const t = clamp((tNow - startT) / duration, 0, 1);
      const y = startY + (endY - startY) * easeInOutQuint(t);
      window.scrollTo(0, y);

      if (t < 1) {
        anim.raf = requestAnimationFrame(tick);
      } else {
        anim.running = false;
        anim.raf = 0;
      }
    }

    anim.raf = requestAnimationFrame(tick);
  }

  function snapToEl(el) {
    if (!el) return;
    cancelScrollAnim();
    window.scrollTo(0, getTargetY(el));
  }

  // =========================
  // Contact image prime (레이아웃 변동 완화)
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
  // Reveal freeze during nav scroll
  // =========================
  let revealFrozen = false;
  let navFreezeTimer = 0;

  function freezeRevealForNav(ms = 1400) {
    injectNavRevealCSS();
    revealFrozen = true;
    document.body.classList.add("nav-scrolling");
    clearTimeout(navFreezeTimer);
    navFreezeTimer = setTimeout(() => {
      revealFrozen = false;
      document.body.classList.remove("nav-scrolling");
    }, ms);
  }

  // =========================
  // Guaranteed scroll: 1 smooth + (필요 시) 스냅 보정
  // =========================
  function needsFix(el) {
    const r = el.getBoundingClientRect();
    const topLimit = getHeaderOffset() + 6;
    return Math.abs(r.top - topLimit) > 10;
  }

  function scrollToElGuaranteed(el) {
    if (!el) return;

    // 이동 중 reveal로 빈 화면 보이는 문제 방지
    freezeRevealForNav(1600);

    // 첫 이동: smooth 1회
    smoothScrollToY(getTargetY(el), 820);

    // 이벤트가 와도 smooth를 추가로 걸지 않고, "예약 후 스냅"만 한다
    let done = false;
    let pending = false;
    let lastSnapAt = 0;
    const SNAP_COOLDOWN = 220;

    const schedule = () => { pending = true; };

    const maybeSnap = (force = false) => {
      if (done) return;
      const t = performance.now();
      if (!force && t - lastSnapAt < SNAP_COOLDOWN) return;
      if (!force && (!pending || anim.running)) return;

      pending = false;
      if (force || needsFix(el)) {
        lastSnapAt = t;
        // 작은 오차는 스냅 생략(부드러움 유지)
        const r = el.getBoundingClientRect();
        const topLimit = getHeaderOffset() + 6;
        if (Math.abs(r.top - topLimit) > 6) {
          window.scrollTo(0, getTargetY(el));
        }
      }
    };

    // 폰트/이미지/뷰포트 변화는 "예약"만
    if (document.fonts && document.fonts.ready) {
      document.fonts.ready.then(schedule).catch(() => {});
    }

    const imgs = $$("img", el);
    imgs.forEach((img) => {
      if (img.complete) return;
      const h = () => schedule();
      img.addEventListener("load", h, { passive: true, once: true });
      img.addEventListener("error", h, { passive: true, once: true });
      if (img.decode) img.decode().then(h).catch(() => {});
    });

    const vv = window.visualViewport;
    if (vv && vv.addEventListener) {
      const h = () => schedule();
      vv.addEventListener("resize", h, { passive: true });
      setTimeout(() => {
        try { vv.removeEventListener("resize", h); } catch (_) {}
      }, 2200);
    }

    const wh = () => schedule();
    window.addEventListener("resize", wh, { passive: true });
    window.addEventListener("orientationchange", wh, { passive: true });
    setTimeout(() => {
      try { window.removeEventListener("resize", wh); } catch (_) {}
      try { window.removeEventListener("orientationchange", wh); } catch (_) {}
    }, 2400);

    // 타임박스 루프: 애니 끝난 뒤 예약된 보정만 스냅
    const start = performance.now();
    let timer = 0;

    const loop = () => {
      if (done) return;

      maybeSnap(false);

      // 충분히 맞으면 종료 + 마지막 확정 스냅
      if (!anim.running && !needsFix(el)) {
        done = true;
        snapToEl(el);
        // freeze는 남은 시간 후 풀림
        return;
      }

      // 최대 시간 지나면 강제 스냅하고 종료
      if (performance.now() - start > 5200) {
        done = true;
        maybeSnap(true);
        snapToEl(el);
        return;
      }

      timer = setTimeout(loop, 160);
    };

    // 초기: 몇 번 예약 걸어두기(주소창 접힘/레이아웃 변화 대비)
    setTimeout(schedule, 120);
    setTimeout(schedule, 320);
    setTimeout(schedule, 640);
    setTimeout(schedule, 980);

    timer = setTimeout(loop, 160);

    // 다음 클릭 시 이전 루프 정리
    if (scrollToElGuaranteed._kill) scrollToElGuaranteed._kill();
    scrollToElGuaranteed._kill = () => {
      done = true;
      clearTimeout(timer);
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

          cancelScrollAnim();
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
      if (revealFrozen) return; // 이동 중엔 reveal 상태 바꾸지 않음(깜빡 방지)

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
    injectNavRevealCSS();

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