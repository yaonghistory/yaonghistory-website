(() => {
  const $ = (s, r=document) => r.querySelector(s);
  const $$ = (s, r=document) => Array.from(r.querySelectorAll(s));

  const header = $(".site-header");

  function headerOffset(){
    const h = header ? header.getBoundingClientRect().height : 0;
    return Math.ceil(h + 10);
  }

  // 부드러운 스크롤 (인앱에서도 안정적으로)
  function smoothScrollTo(el){
    const y = window.scrollY + el.getBoundingClientRect().top - headerOffset();
    window.scrollTo({ top: y, behavior: "smooth" });
    // 일부 인앱에서 첫 호출이 튀는 경우 보정
    requestAnimationFrame(() => window.scrollTo({ top: y, behavior: "smooth" }));
  }

  $$("[data-scroll]").forEach(a => {
    a.addEventListener("click", (e) => {
      const href = a.getAttribute("href") || "";
      if (!href.startsWith("#")) return;
      const target = $(href);
      if (!target) return;
      e.preventDefault();
      smoothScrollTo(target);
    }, { passive: false });
  });

  // 메일 문의 (폼 → mailto)
  const mailBtn = $("#mailBtn");
  const form = $("#contactForm");
  if (mailBtn && form){
    mailBtn.addEventListener("click", () => {
      const fd = new FormData(form);
      const parent = String(fd.get("parent") || "").trim();
      const phone = String(fd.get("phone") || "").trim();
      const people = String(fd.get("people") || "").trim();
      const schedule = String(fd.get("schedule") || "").trim();
      const message = String(fd.get("message") || "").trim();

      const subject = encodeURIComponent("야옹 역사 수업 문의");
      const body = encodeURIComponent([
        `보호자 이름: ${parent}`,
        `휴대폰 번호: ${phone}`,
        `인원: ${people}`,
        `희망 장소/일정: ${schedule}`,
        ``,
        `문의 내용:`,
        `${message}`
      ].join("\n"));

      location.href = `mailto:yaonghistory@gmail.com?subject=${subject}&body=${body}`;
    });
  }

  // 스크롤 페이드 인/아웃 (IntersectionObserver)
  const items = $$(".reveal");
  if (!items.length) return;

  const io = new IntersectionObserver((entries) => {
    entries.forEach(ent => {
      if (ent.isIntersecting){
        ent.target.classList.add("is-in");
        ent.target.classList.remove("is-out");
      } else {
        // 지나간 요소는 은은하게 페이드 아웃 느낌
        // (화면 아래로 아직 안 온 요소는 is-out 안 붙여서 깔끔 유지)
        const rect = ent.target.getBoundingClientRect();
        if (rect.top < 0) {
          ent.target.classList.add("is-out");
        }
      }
    });
  }, {
    threshold: [0.12, 0.35, 0.65],
    rootMargin: "0px 0px -10% 0px"
  });

  items.forEach(el => io.observe(el));
})();