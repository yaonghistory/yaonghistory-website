(() => {
  "use strict";

  // =========================
  // iOS/인앱: 새로고침 시 스크롤 위치 복원 방지
  // =========================
  try {
    if ("scrollRestoration" in history) history.scrollRestoration = "manual";
  } catch (_) {}

  // =========================
  // Helpers
  // =========================
  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

  const header = $(".site-header");
  const prefersReducedMotion =
    window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

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
    const y =
      (window.pageYOffset || document.documentElement.scrollTop || 0) +
      rect.top -
      getHeaderOffset();
    smoothScrollToY(y);
  }

  // 현재 navigation type (지원 안 되면 null)
  function getNavType() {
    try {
      const nav = performance.getEntriesByType && performance.getEntriesByType("navigation");
      if (nav && nav[0] && nav[0].type) return nav[0].type; // "navigate" | "reload" | "back_forward"
    } catch (_) {}
    return null;
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

          // ✅ 해시를 URL에 남기지 않음 (새로고침 시 특정 섹션 점프 방지)
          try {
            history.replaceState(null, "", location.pathname + location.search);
          } catch (_) {}
        },
        { passive: false }
      );
    });
  }

  // =========================
  // 2) Reveal animations (fade-in/out) - 성능/부드러움 개선
  // =========================
  function markRevealTargets() {
    // "덩어리" 단위로 (디폴트 셀렉터 유지 + 커리큘럼 항목도 포함)
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

  // 상태 변경을 "바뀔 때만" 적용해서 깜빡임/부하 최소화
  function applyState(el, next) {
    const cur = el.dataset.rv || "";
    if (cur === next) return;
    el.dataset.rv = next;

    if (next === "in") {
      el.classList.add("is-in");
      el.classList.remove("is-out");
      el.dataset.seen = "1";
    } else if (next === "out") {
      el.classList.remove("is-in");
      el.classList.add("is-out");
    } else {
      // init(아직 안 봄): 숨김 상태 유지
      el.classList.remove("is-in");
      el.classList.remove("is-out");
    }
  }

  function bindRevealObserver(targets) {
    // 감속 모드면 전부 표시
    if (prefersReducedMotion) {
      targets.forEach((el) => applyState(el, "in"));
      return;
    }

    if (!("IntersectionObserver" in window)) {
      targets.forEach((el) => applyState(el, "in"));
      return;
    }

    // 초기 상태: 아직 안 본 요소는 숨김
    targets.forEach((el) => applyState(el, "init"));

    // ✅ IO 콜백을 rAF로 묶어서 프레임당 1회 처리
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

        // 아직 한 번도 안 본 요소는 그대로 숨김 유지
        if (el.dataset.seen !== "1") continue;

        const top =
          entry.boundingClientRect && typeof entry.boundingClientRect.top === "number"
            ? entry.boundingClientRect.top
            : el.getBoundingClientRect().top;

        // 위로 지나간 요소는 out
        if (top < offset) {
          applyState(el, "out");
          continue;
        }

        // 아래로 충분히 내려간 요소는 init으로 되돌려서
        // 다시 내려올 때 fade-in 재적용(스크롤 올/내릴 때 둘 다 자연스럽게)
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

    // 화면 회전/리사이즈 시 rootMargin 체감 보정
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
    // ✅ 새로고침(reload) 또는 뒤로가기(back_forward)라면 무조건 맨 위로
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

    // ✅ 외부에서 #해시 링크로 들어온 경우만(첫 방문 navigate) 해당 섹션으로 이동
    if (location.hash && navType !== "reload" && navType !== "back_forward") {
      const el = $(location.hash);
      if (el) setTimeout(() => scrollToEl(el), 0);
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();