(() => {
  const header = document.querySelector(".site-header");

  const getHeaderOffset = () => {
    const h = header ? header.getBoundingClientRect().height : 0;
    return Math.ceil(h + 12);
  };

  const smoothScrollTo = (el) => {
    const y = window.scrollY + el.getBoundingClientRect().top - getHeaderOffset();
    window.scrollTo({ top: y, behavior: "smooth" });
  };

  // 버튼/링크 스무스 스크롤 (헤더 바로 아래 정렬)
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

  // 메일 문의 (폼 내용을 mailto로 구성)
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

  // 페이드 인/아웃 (지나간 부분은 페이드아웃 유지)
  const items = document.querySelectorAll(".reveal");

  if ("IntersectionObserver" in window && items.length) {
    const io = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        const el = entry.target;

        if (entry.isIntersecting) {
          el.classList.add("is-in");
          el.classList.remove("is-out");
          return;
        }

        // 화면 위로 지나간(이미 봤던) 요소: 페이드아웃
        if (entry.boundingClientRect.top < 0) {
          el.classList.remove("is-in");
          el.classList.add("is-out");
        }
      });
    }, {
      threshold: 0.18,
      rootMargin: "0px 0px -10% 0px"
    });

    items.forEach((el) => io.observe(el));
  } else {
    // 구형 환경: 그냥 전부 표시
    items.forEach((el) => el.classList.add("is-in"));
  }
})();