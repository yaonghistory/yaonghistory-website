(() => {
  "use strict";

  // =========================
  // Helpers
  // =========================
  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

  const header = $(".site-header");
  const prefersReducedMotion = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  function getHeaderOffset() {
    // CSS 변수(--header-offset) 우선, 없으면 실제 헤더 높이로 계산
    const root = document.documentElement;
    const cssVal = getComputedStyle(root).getPropertyValue("--header-offset").trim();
    const cssNum = cssVal ? parseInt(cssVal, 10) : NaN;
    const h = header ? Math.ceil(header.getBoundingClientRect().height) : 0;
    const base = Number.isFinite(cssNum) ? cssNum : (h + 10);
    return Math.max(60, base);
  }

  function clamp(n, min, max) {
    return Math.max(min, Math.min(max, n));
  }

  // requestAnimationFrame 기반 스무스 스크롤(인앱 브라우저 호환)
  function smoothScrollToY(targetY) {
    const startY = window.pageYOffset || document.documentElement.scrollTop || 0;
    const maxY = Math.max(0, document.documentElement.scrollHeight - window.innerHeight);
    const endY = clamp(targetY, 0, maxY);

    if (prefersReducedMotion) {
      window.scrollTo(0, endY);
      return;
    }

    const duration = 520; // ms
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
    const y = (window.pageYOffset || document.documentElement.scrollTop || 0) + rect.top - getHeaderOffset();
    smoothScrollToY(y);
  }

  // =========================
  // 1) Anchor smooth scroll with header offset
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
          scrollToEl(target);

          // URL hash는 유지(뒤로가기/공유에 도움)
          // 스크롤이 끝난 후에 넣는 게 이상적이지만, 인앱에서 튀는 경우가 있어 바로 처리
          history.replaceState(null, "", href);
        },
        { passive: false }
      );
    });
  }

  // =========================
  // 2) Reveal animations (fade-in/out)
  // =========================
  function markRevealTargets() {
    // 너무 과하지 않게 "덩어리" 단위로
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

  function bindRevealObserver(targets) {
    if (!("IntersectionObserver" in window)) {
      // 폴백: 전부 보이게
      targets.forEach((el) => el.classList.add("is-in"));
      return;
    }

    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          const el = entry.target;

          // 화면 안으로 들어오면 선명
          if (entry.isIntersecting) {
            el.classList.add("is-in");
            el.classList.remove("is-out");
          } else {
            // 지나간(위로 올라가서 사라진) 요소는 희미하게
            // 아래로 아직 안 온 요소는 그대로(0) 유지
            const rect = el.getBoundingClientRect();
            if (rect.top < (getHeaderOffset() + 10)) {
              el.classList.remove("is-in");
              el.classList.add("is-out");
            }
          }
        });
      },
      {
        root: null,
        threshold: [0, 0.08, 0.18, 0.35],
        rootMargin: `-${getHeaderOffset()}px 0px -15% 0px`
      }
    );

    targets.forEach((el) => io.observe(el));

    // 스크롤/리사이즈 때 오프셋이 바뀌면 rootMargin이 달라져야 해서 간단 재설정
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

  // =========================
  // 3) Mailto (문의 폼)
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
      const bodyLines = [
        `보호자 이름: ${parent}`,
        `휴대폰 번호: ${phone}`,
        `인원: ${people}`,
        `희망 장소/일정: ${schedule}`,
        ``,
        `문의 내용:`,
        `${message}`
      ];
      const body = encodeURIComponent(bodyLines.join("\n"));
      location.href = `mailto:yaonghistory@gmail.com?subject=${subject}&body=${body}`;
    });
  }

  // =========================
  // Init
  // =========================
  function init() {
    bindSmoothAnchors();

    const targets = markRevealTargets();
    bindRevealObserver(targets);

    bindMail();

    // 처음 로드 시 해시가 있으면 헤더 오프셋 반영해서 위치 보정
    // (인앱에서 기본 점프 후 위치가 어긋나는 케이스 대응)
    if (location.hash) {
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