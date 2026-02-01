(() => {
  const header = document.querySelector(".site-header");

  // ===== Smooth scroll (header offset) =====
  function getHeaderOffset() {
    const h = header ? header.getBoundingClientRect().height : 0;
    return Math.ceil(h + 12);
  }

  function smoothScrollTo(target) {
    const y = window.scrollY + target.getBoundingClientRect().top - getHeaderOffset();
    window.scrollTo({ top: y, behavior: "smooth" });
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

  // ===== Accordion (multi-open) =====
  const accRoot = document.querySelector("[data-accordion]");
  if (accRoot) {
    const items = Array.from(accRoot.querySelectorAll(".acc-item"));
    items.forEach((item) => {
      const btn = item.querySelector(".acc-btn");
      const panel = item.querySelector(".acc-panel");
      if (!btn || !panel) return;

      // init sync
      const expanded = btn.getAttribute("aria-expanded") === "true";
      panel.hidden = !expanded;

      btn.addEventListener("click", () => {
        const isOpen = btn.getAttribute("aria-expanded") === "true";
        btn.setAttribute("aria-expanded", String(!isOpen));
        panel.hidden = isOpen;

        // 열릴 때는 헤더 바로 아래로 살짝 맞추기
        if (!isOpen) {
          setTimeout(() => smoothScrollTo(item), 40);
        }
      });
    });
  }

  // ===== Reveal on scroll (fade in + fade out past) =====
  const revealEls = document.querySelectorAll(".reveal");
  if (revealEls.length) {
    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) entry.target.classList.add("show");
          else entry.target.classList.remove("show");
        });
      },
      { threshold: 0.14 }
    );

    revealEls.forEach((el) => io.observe(el));
  }

  // ===== Mail (Form -> mailto) =====
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
          "",
          "문의 내용:",
          message
        ].join("\n")
      );

      location.href = `mailto:yaonghistory@gmail.com?subject=${subject}&body=${body}`;
    });
  }
})();