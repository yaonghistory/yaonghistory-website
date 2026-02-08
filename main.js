(function () {
  const header = document.querySelector(".site-header");

  function getHeaderOffset() {
    const h = header ? header.getBoundingClientRect().height : 0;
    return Math.ceil(h + 10);
  }

  function smoothScrollTo(el) {
    const y = window.scrollY + el.getBoundingClientRect().top - getHeaderOffset();
    window.scrollTo({ top: y, behavior: "smooth" });
  }

  // Smooth scroll for buttons/anchors with data-scroll
  document.querySelectorAll("[data-scroll]").forEach(a => {
    a.addEventListener("click", (e) => {
      const href = a.getAttribute("href") || "";
      if (!href.startsWith("#")) return;
      const target = document.querySelector(href);
      if (!target) return;
      e.preventDefault();
      smoothScrollTo(target);
    }, { passive: false });
  });

  // Mail button
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

  // Fade-in / fade-out on scroll
  const targets = [
    ...document.querySelectorAll(".section .wrap > *"),
    ...document.querySelectorAll(".team-card"),
    ...document.querySelectorAll(".panel"),
    ...document.querySelectorAll(".card"),
    ...document.querySelectorAll(".step"),
    ...document.querySelectorAll(".stat"),
    ...document.querySelectorAll(".place-list li"),
    ...document.querySelectorAll(".info-list li"),
    ...document.querySelectorAll(".thumb"),
  ];

  targets.forEach(el => el.setAttribute("data-animate", "1"));

  const io = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      const el = entry.target;
      if (entry.isIntersecting) {
        el.classList.add("is-in");
        el.classList.remove("is-out");
      } else {
        const rect = el.getBoundingClientRect();
        if (rect.top < 0) el.classList.add("is-out");
      }
    });
  }, {
    root: null,
    threshold: [0.12, 0.22, 0.35],
  });

  targets.forEach(el => io.observe(el));
})();