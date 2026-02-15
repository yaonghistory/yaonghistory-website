(() => {
  "use strict";

  /* =========================
     Scroll restoration 방지
  ========================= */
  try {
    if ("scrollRestoration" in history) {
      history.scrollRestoration = "manual";
    }
  } catch (_) {}

  /* =========================
     Helpers
  ========================= */
  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) =>
    Array.from(root.querySelectorAll(sel));

  const header = $(".site-header");
  const prefersReducedMotion =
    window.matchMedia &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  function getHeaderOffset() {
    const root = document.documentElement;
    const cssVal = getComputedStyle(root)
      .getPropertyValue("--header-offset")
      .trim();
    const cssNum = cssVal ? parseInt(cssVal, 10) : NaN;
    const h = header
      ? Math.ceil(header.getBoundingClientRect().height)
      : 0;
    const base = Number.isFinite(cssNum) ? cssNum : h + 10;
    return Math.max(60, base);
  }

  function clamp(n, min, max) {
    return Math.max(min, Math.min(max, n));
  }

  /* =========================
     Smooth Scroll (rAF)
  ========================= */
  function smoothScrollToY(targetY) {
    const startY =
      window.pageYOffset ||
      document.documentElement.scrollTop ||
      0;

    const maxY = Math.max(
      0,
      document.documentElement.scrollHeight -
        window.innerHeight
    );

    const endY = clamp(targetY, 0, maxY);

    if (prefersReducedMotion) {
      window.scrollTo(0, endY);
      return;
    }

    const duration = 480;
    const startT = performance.now();

    const easeOutCubic = (t) => 1 - Math.pow(1 - t, 3);

    function tick(now) {
      const t = clamp((now - startT) / duration, 0, 1);
      const eased = easeOutCubic(t);
      const y = startY + (endY - startY) * eased;
      window.scrollTo(0, y);
      if (t < 1) requestAnimationFrame(tick);
    }

    requestAnimationFrame(tick);
  }

  function scrollToEl(el) {
    const rect = el.getBoundingClientRect();
    const y =
      (window.pageYOffset ||
        document.documentElement.scrollTop ||
        0) +
      rect.top -
      getHeaderOffset();

    smoothScrollToY(y);
  }

  /* =========================
     Navigation Type 체크
  ========================= */
  function getNavType() {
    try {
      const nav =
        performance.getEntriesByType &&
        performance.getEntriesByType("navigation");
      if (nav && nav[0] && nav[0].type) {
        return nav[0].type;
      }
    } catch (_) {}
    return null;
  }

  /* =========================
     Anchor Smooth Scroll
  ========================= */
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
          scrollToEl(target);

          // 해시 제거
          try {
            history.replaceState(
              null,
              "",
              location.pathname + location.search
            );
          } catch (_) {}
        },
        { passive: false }
      );
    });
  }

  /* =========================
     Reveal Animation
  ========================= */
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
      ".team-card",
      ".curr-item",
      ".gallery .thumb",
      ".footer"
    ];

    const set = new Set();
    selectors.forEach((sel) =>
      $$(sel).forEach((el) => set.add(el))
    );

    set.forEach((el) => el.classList.add("reveal"));
    return Array.from(set);
  }

  function bindRevealObserver(targets) {
    if (!("IntersectionObserver" in window)) {
      targets.forEach((el) => el.classList.add("is-in"));
      return;
    }

    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          const el = entry.target;

          if (entry.isIntersecting) {
            el.classList.add("is-in");
            el.classList.remove("is-out");
          } else {
            const rect = el.getBoundingClientRect();

            if (rect.top < getHeaderOffset() + 10) {
              el.classList.remove("is-in");
              el.classList.add("is-out");
            }
          }
        });
      },
      {
        root: null,
        threshold: 0.15,
        rootMargin: `-${getHeaderOffset()}px 0px -10% 0px`
      }
    );

    targets.forEach((el) => io.observe(el));

    let raf = 0;
    const refresh = () => {
      if (raf) cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        io.disconnect();
        targets.forEach((el) => io.observe(el));
      });
    };

    window.addEventListener("resize", refresh, {
      passive: true
    });
    window.addEventListener("orientationchange", refresh, {
      passive: true
    });
  }

  /* =========================
     Mailto
  ========================= */
  function bindMail() {
    const mailBtn = $("#mailBtn");
    const form = $("#contactForm");
    if (!mailBtn || !form) return;

    mailBtn.addEventListener("click", () => {
      const fd = new FormData(form);

      const subject = encodeURIComponent(
        "야옹 역사 수업 문의"
      );

      const body = encodeURIComponent(
        `
보호자 이름: ${fd.get("parent") || ""}
휴대폰 번호: ${fd.get("phone") || ""}
인원: ${fd.get("people") || ""}
희망 장소/일정: ${fd.get("schedule") || ""}

문의 내용:
${fd.get("message") || ""}
        `
      );

      location.href = `mailto:yaonghistory@gmail.com?subject=${subject}&body=${body}`;
    });
  }

  /* =========================
     Init
  ========================= */
  function init() {
    const navType = getNavType();

    if (
      navType === "reload" ||
      navType === "back_forward"
    ) {
      try {
        history.replaceState(
          null,
          "",
          location.pathname + location.search
        );
      } catch (_) {}
      window.scrollTo(0, 0);
    }

    bindSmoothAnchors();

    const targets = markRevealTargets();
    bindRevealObserver(targets);

    bindMail();

    if (
      location.hash &&
      navType !== "reload" &&
      navType !== "back_forward"
    ) {
      const el = $(location.hash);
      if (el) {
        setTimeout(() => scrollToEl(el), 0);
      }
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();