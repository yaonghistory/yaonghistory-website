(() => {
  const header = document.querySelector(".site-header");

  function headerOffset() {
    const h = header ? header.getBoundingClientRect().height : 0;
    return Math.ceil(h + 10);
  }

  function smoothScrollTo(targetEl) {
    const y = window.scrollY + targetEl.getBoundingClientRect().top - headerOffset();
    window.scrollTo({ top: y, behavior: "smooth" });
  }

  // Anchor smooth scroll with sticky-header offset
  document.querySelectorAll("[data-scroll]").forEach((a) => {
    a.addEventListener("click", (e) => {
      const href = a.getAttribute("href") || "";
      if (!href.startsWith("#")) return;

      const target = document.querySelector(href);
      if (!target) return;

      e.preventDefault();
      smoothScrollTo(target);
    }, { passive: false });
  });

  // Mail button -> mailto with form content
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

  // Fade in/out on scroll (visible when in view, hidden when out)
  const animEls = Array.from(document.querySelectorAll(".anim"));
  const reduceMotion = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  if (reduceMotion) {
    animEls.forEach(el => el.classList.add("is-visible"));
    return;
  }

  const io = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      // 들어오면 보이고, 벗어나면 다시 숨김(요청한 페이드아웃)
      if (entry.isIntersecting && entry.intersectionRatio > 0.12) {
        entry.target.classList.add("is-visible");
      } else {
        entry.target.classList.remove("is-visible");
      }
    });
  }, {
    root: null,
    rootMargin: "0px 0px -12% 0px",
    threshold: [0, 0.12, 0.25]
  });

  animEls.forEach(el => io.observe(el));
})();