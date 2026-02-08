// main.js
(() => {
  const header = document.querySelector(".site-header");

  function headerOffset() {
    const h = header ? header.getBoundingClientRect().height : 0;
    return Math.ceil(h + 12);
  }

  function smoothScrollTo(el) {
    const y = window.scrollY + el.getBoundingClientRect().top - headerOffset();
    window.scrollTo({ top: y, behavior: "smooth" });
  }

  // Smooth scroll with header offset
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

  // Mail
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
        `${message}`,
      ];
      const body = encodeURIComponent(bodyLines.join("\n"));
      location.href = `mailto:yaonghistory@gmail.com?subject=${subject}&body=${body}`;
    });
  }

  // Fade in + fade out past
  const items = Array.from(document.querySelectorAll(".reveal"));
  if (!items.length) return;

  function updateReveal() {
    const vh = window.innerHeight || 800;
    const enterTop = vh * 0.12;
    const enterBottom = vh * 0.86;

    for (const el of items) {
      const r = el.getBoundingClientRect();

      if (r.bottom < enterTop) {
        el.classList.remove("is-in");
        el.classList.add("is-past");
        continue;
      }

      const inZone = r.top < enterBottom && r.bottom > enterTop;
      if (inZone) {
        el.classList.add("is-in");
        el.classList.remove("is-past");
      } else {
        if (r.top >= enterBottom) {
          el.classList.remove("is-in");
          el.classList.remove("is-past");
        }
      }
    }
  }

  let ticking = false;
  function onScrollOrResize() {
    if (ticking) return;
    ticking = true;
    requestAnimationFrame(() => {
      updateReveal();
      ticking = false;
    });
  }

  window.addEventListener("scroll", onScrollOrResize, { passive: true });
  window.addEventListener("resize", onScrollOrResize, { passive: true });
  window.addEventListener("orientationchange", onScrollOrResize, { passive: true });

  updateReveal();
})();