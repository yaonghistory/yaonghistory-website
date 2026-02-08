(() => {
  "use strict";

  const header = document.querySelector(".site-header");
  const revealEls = Array.from(document.querySelectorAll(".reveal"));
  const prefersReduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  function headerOffset() {
    if (!header) return 0;
    const h = header.getBoundingClientRect().height;
    return Math.ceil(h + 10);
  }

  // ----------------------------
  // Smooth scroll with fixed header offset
  // ----------------------------
  function smoothScrollTo(target) {
    const y = window.scrollY + target.getBoundingClientRect().top - headerOffset();
    window.scrollTo({ top: y, behavior: prefersReduced ? "auto" : "smooth" });
  }

  document.querySelectorAll("[data-scroll]").forEach((a) => {
    a.addEventListener(
      "click",
      (e) => {
        const href = a.getAttribute("href") || "";
        if (!href.startsWith("#")) return;

        const target = document.querySelector(href);
        if (!target) return;

        e.preventDefault();
        smoothScrollTo(target);
      },
      { passive: false }
    );
  });

  // ----------------------------
  // Reveal / Fade-out on scroll
  //  - Enter viewport: fade in
  //  - Leave far behind: fade out
  // ----------------------------
  if (prefersReduced) {
    // motion 줄이기 설정이면 즉시 표시
    revealEls.forEach((el) => el.classList.add("is-visible"));
    return;
  }

  // IntersectionObserver 지원 시 (대부분)
  if ("IntersectionObserver" in window) {
    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          const el = entry.target;

          // 뷰포트 안으로 들어오면 보여주기
          if (entry.isIntersecting) {
            el.classList.add("is-visible");
          } else {
            // 지나간 부분은 페이드아웃(위로 많이 올라간 경우만)
            // entry.boundingClientRect.top: 요소의 현재 뷰포트 기준 위치
            // top이 -60px보다 더 위면 "지나감"으로 판단
            if (entry.boundingClientRect.top < -60) {
              el.classList.remove("is-visible");
            }
          }
        });
      },
      {
        root: null,
        threshold: 0.12,
        // 위쪽에서 살짝 미리 등장하고, 아래쪽은 여유 있게
        rootMargin: "0px 0px -12% 0px",
      }
    );

    revealEls.forEach((el) => io.observe(el));
  } else {
    // IntersectionObserver 없을 때(구형 인앱) 대비: rAF 스크롤 체크
    const onScroll = () => {
      const vh = window.innerHeight || document.documentElement.clientHeight;

      revealEls.forEach((el) => {
        const r = el.getBoundingClientRect();
        const inView = r.top < vh * 0.88 && r.bottom > vh * 0.12;

        if (inView) el.classList.add("is-visible");
        else if (r.top < -60) el.classList.remove("is-visible");
      });
    };

    let ticking = false;
    const requestTick = () => {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(() => {
        onScroll();
        ticking = false;
      });
    };

    window.addEventListener("scroll", requestTick, { passive: true });
    window.addEventListener("resize", requestTick, { passive: true });
    requestTick();
  }

  // ----------------------------
  // Mail button -> mailto compose with form template
  // ----------------------------
  const mailBtn = document.getElementById("mailBtn");
  const form = document.getElementById("contactForm");

  if (mailBtn && form) {
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
          `${message}`,
        ].join("\n")
      );

      location.href = `mailto:yaonghistory@gmail.com?subject=${subject}&body=${body}`;
    });
  }
})();