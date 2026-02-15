(() => {
  "use strict";

  /* =========================
     1. 스크롤 복원 방지 (iOS 포함)
  ========================= */
  try {
    if ("scrollRestoration" in history) {
      history.scrollRestoration = "manual";
    }
  } catch (_) {}

  /* =========================
     2. Helpers
  ========================= */
  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

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
    const h = header ? Math.ceil(header.getBoundingClientRect().height) : 0;
    const base = Number.isFinite(cssNum) ? cssNum : h + 10;
    return Math.max(60, base);
  }

  function clamp(n, min, max) {
    return Math.max(min, Math.min(max, n));
  }

  /* =========================
     3. 부드러운 스크롤 (rAF 기반)
  ========================= */
  function smoothScrollToY(targetY) {
    const startY =
      window.pageYOffset || document.documentElement.scrollTop || 0;

    const maxY =
      document.documentElement.scrollHeight - window.innerHeight;

    const endY = clamp(targetY, 0, maxY);

    if (prefersReducedMotion) {
      window.scrollTo(0, endY);
      return;
    }

    const duration = 520;
    const startT = performance.now();

    const ease = (t) => 1 - Math.pow(1 - t, 3);

    function tick(now) {
      const t = clamp((now - startT) / duration, 0, 1);
      const y = startY + (endY - startY) * ease(t);
      window.scrollTo(0, y);
      if (t < 1) requestAnimationFrame(tick);
    }

    requestAnimationFrame(tick);
  }

  function scrollToEl(el) {
    const rect = el.getBoundingClientRect();
    const y =
      (window.pageYOffset || document.documentElement.scrollTop || 0) +
      rect.top -
      getHeaderOffset();
    smoothScrollToY(y);
  }

  /* =========================
     4. Anchor Scroll (해시 제거)
  ========================= */
  function bindSmoothAnchors() {
    $$("[data-scroll]").forEach((a) => {
      a.addEventListener("click", (e) => {
        const href = a.getAttribute("href") || "";
        if (!href.startsWith("#")) return;

        const target = $(href);
        if (!target) return;

        e.preventDefault();
        scrollToEl(target);

        try {
          history.replaceState(
            null,
            "",
            location.pathname + location.search
          );
        } catch (_) {}
      });
    });
  }

  /* =========================
     5. Reveal 애니메이션 (더 부드럽게)
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
      ".panel",
      ".team-card",
      ".curr-item",
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

            if (rect.top < getHeaderOffset()) {
              el.classList.remove("is-in");
              el.classList.add("is-out");
            } else {
              el.classList.remove("is-out");
            }
          }
        });
      },
      {
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

    window.addEventListener("resize", refresh, { passive: true });
    window.addEventListener("orientationchange", refresh, { passive: true });
  }

  /* =========================
     6. 초기화
  ========================= */
  function init() {
    window.scrollTo(0, 0);

    bindSmoothAnchors();

    const targets = markRevealTargets();
    bindRevealObserver(targets);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();