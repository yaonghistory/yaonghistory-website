/* =========================
   Yaong History - main.js
   - Fixed header offset scroll
   - Smooth scroll (no jump)
   - Reveal in + passed sections fade out
   - Works without heavy/fragile code
========================= */

(function () {
  const header = document.querySelector(".site-header");
  const scrollLinks = document.querySelectorAll("[data-scroll]");
  const revealEls = document.querySelectorAll(".reveal");

  // --- Header offset (fixed header 바로 아래에 딱 맞게) ---
  function headerOffset() {
    if (!header) return 0;
    const h = header.getBoundingClientRect().height || 0;
    return Math.ceil(h + 10); // 살짝 여유
  }

  function scrollToSection(targetEl) {
    const y = window.scrollY + targetEl.getBoundingClientRect().top - headerOffset();
    window.scrollTo({ top: y, behavior: "smooth" });
  }

  // 링크 클릭 시 부드럽게 이동 (jump 방지)
  scrollLinks.forEach((a) => {
    a.addEventListener(
      "click",
      (e) => {
        const href = a.getAttribute("href") || "";
        if (!href.startsWith("#")) return;

        const target = document.querySelector(href);
        if (!target) return;

        e.preventDefault();
        scrollToSection(target);
      },
      { passive: false }
    );
  });

  // iOS 인앱에서 최초 로딩 시 hash가 있으면 점프하는 경우가 있어 방어
  window.addEventListener("load", () => {
    if (location.hash) {
      const target = document.querySelector(location.hash);
      if (target) {
        // 살짝 기다렸다가 (레이아웃 안정) 이동
        setTimeout(() => scrollToSection(target), 50);
      }
    }
  });

  // --- Reveal animation (in/out) ---
  // 목표: 화면에 들어오면 is-in, 지나가면 is-out
  // "고급스럽게" 보이도록 threshold/마진 조절
  if (revealEls.length) {
    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          const el = entry.target;

          if (entry.isIntersecting) {
            // 화면에 들어올 때
            el.classList.add("is-in");
            el.classList.remove("is-out");
          } else {
            // 화면 밖으로 나갈 때: 지나간 섹션은 살짝 흐리게(out)
            // 위로 지나갔는지/아래로 내려갔는지 판별: boundingClientRect 기준
            const rect = el.getBoundingClientRect();
            const passedUp = rect.top < -window.innerHeight * 0.15; // 위로 지나간 경우
            if (passedUp) {
              el.classList.add("is-out");
              el.classList.remove("is-in");
            } else {
              // 아직 안 내려온 섹션은 완전 숨김 상태 유지
              el.classList.remove("is-in");
              el.classList.remove("is-out");
            }
          }
        });
      },
      {
        // 들어오는 순간이 예쁘게 보이도록
        root: null,
        threshold: 0.12,
        rootMargin: "0px 0px -18% 0px",
      }
    );

    revealEls.forEach((el) => io.observe(el));
  }

  // --- Tiny stability helpers ---
  // 일부 인앱에서 스크롤 중 리플로우로 헤더 높이가 흔들리는 경우 방지용
  // (CSS가 대부분 해결하지만, JS에서도 안전하게)
  let lastH = 0;
  function syncHeaderHVar() {
    if (!header) return;
    const h = Math.ceil(header.getBoundingClientRect().height || 0);
    if (h && h !== lastH) {
      document.documentElement.style.setProperty("--headerH", h + "px");
      lastH = h;
    }
  }
  syncHeaderHVar();
  window.addEventListener("resize", syncHeaderHVar);

})();