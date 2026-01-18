(() => {
  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

  /* -------------------------
     Smooth scroll (header offset)
     ------------------------- */
  const header = $(".site-header");

  function headerOffset() {
    const h = header ? header.getBoundingClientRect().height : 0;
    return Math.ceil(h + 10);
  }

  function smoothScrollTo(target) {
    const y = window.scrollY + target.getBoundingClientRect().top - headerOffset();
    // iOS WebView에서 behavior:smooth가 가끔 끊겨서 rAF로 한번 보정
    window.scrollTo({ top: y, behavior: "smooth" });
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

  /* -------------------------
     Mail
     ------------------------- */
  const mailBtn = $("#mailBtn");
  const form = $("#contactForm");

  if (mailBtn && form) {
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

  /* -------------------------
     Modal galleries (review / photos separated)
     + stable zoom: double-tap zoom + drag pan
     + swipe (only when not zoomed)
     ------------------------- */
  const galleries = {
    review: ["review.jpg"],
    photos: ["photo1.jpg", "photo2.jpg", "photo3.jpg", "photo4.jpg", "photo5.jpg"]
  };

  const modal = $("#modal");
  const modalImg = $("#modalImg");
  const modalCount = $("#modalCount");
  const modalClose = $("#modalClose");
  const modalBackdrop = $("#modalBackdrop");
  const prevBtn = $("#prevBtn");
  const nextBtn = $("#nextBtn");
  const zoomWrap = $("#zoomWrap");

  if (!modal || !modalImg || !zoomWrap) return;

  let gKey = "review";
  let idx = 0;

  // scroll lock (iOS 안정)
  let lockedY = 0;
  function lockScroll() {
    lockedY = window.scrollY || 0;
    document.documentElement.classList.add("modal-lock");
    document.body.classList.add("modal-lock");
    document.body.style.top = `-${lockedY}px`;
  }
  function unlockScroll() {
    document.documentElement.classList.remove("modal-lock");
    document.body.classList.remove("modal-lock");
    const top = document.body.style.top;
    document.body.style.top = "";
    const y = top ? Math.abs(parseInt(top, 10)) : lockedY;
    window.scrollTo(0, y || 0);
  }

  // zoom state (안정: 더블탭 줌 + 드래그)
  let scale = 1;
  let tx = 0, ty = 0;

  function apply() {
    modalImg.style.transform = `translate(${tx}px, ${ty}px) scale(${scale})`;
  }

  function resetZoom() {
    scale = 1; tx = 0; ty = 0;
    apply();
  }

  function clampPan() {
    const rect = zoomWrap.getBoundingClientRect();
    const maxX = rect.width * (scale - 1) * 0.5;
    const maxY = rect.height * (scale - 1) * 0.5;
    if (scale <= 1.001) { tx = 0; ty = 0; return; }
    tx = Math.max(-maxX, Math.min(maxX, tx));
    ty = Math.max(-maxY, Math.min(maxY, ty));
  }

  function setImage() {
    const list = galleries[gKey] || [];
    const total = list.length || 1;

    modalImg.src = list[idx] || "";
    modalCount.textContent = `${idx + 1}/${total}`;

    const navOn = total > 1;
    prevBtn.disabled = !navOn;
    nextBtn.disabled = !navOn;
    prevBtn.style.visibility = navOn ? "visible" : "hidden";
    nextBtn.style.visibility = navOn ? "visible" : "hidden";
  }

  function openModal(key, index) {
    gKey = key;
    idx = index;

    modal.classList.add("is-open");
    modal.setAttribute("aria-hidden", "false");
    lockScroll();

    setImage();
    resetZoom();
  }

  function closeModal() {
    modal.classList.remove("is-open");
    modal.setAttribute("aria-hidden", "true");
    resetZoom();
    unlockScroll();
  }

  function prev() {
    const list = galleries[gKey] || [];
    if (list.length <= 1) return;
    idx = (idx - 1 + list.length) % list.length;
    setImage();
    resetZoom();
  }

  function next() {
    const list = galleries[gKey] || [];
    if (list.length <= 1) return;
    idx = (idx + 1) % list.length;
    setImage();
    resetZoom();
  }

  // thumbnails
  $$(".thumb[data-gallery]").forEach(btn => {
    btn.addEventListener("click", () => {
      const key = btn.getAttribute("data-gallery") || "review";
      const n = parseInt(btn.getAttribute("data-index") || "0", 10);
      openModal(key, Number.isFinite(n) ? n : 0);
    });
  });

  // close: X가 안 먹는 문제 방지(캡처 단계 + stopPropagation)
  modalClose?.addEventListener("click", (e) => {
    e.preventDefault(); e.stopPropagation();
    closeModal();
  }, true);

  modalBackdrop?.addEventListener("click", (e) => {
    e.preventDefault(); e.stopPropagation();
    closeModal();
  }, true);

  document.addEventListener("keydown", (e) => {
    if (!modal.classList.contains("is-open")) return;
    if (e.key === "Escape") closeModal();
    if (e.key === "ArrowLeft") prev();
    if (e.key === "ArrowRight") next();
  });

  prevBtn?.addEventListener("click", (e) => { e.preventDefault(); prev(); });
  nextBtn?.addEventListener("click", (e) => { e.preventDefault(); next(); });

  // double-tap zoom toggle (가장 안정적)
  let lastTap = 0;
  function onTap() {
    const now = Date.now();
    if (now - lastTap < 280) {
      // toggle: 1 -> 2.5 -> 1
      if (scale < 1.1) scale = 2.5;
      else resetZoom();
      clampPan();
      apply();
      lastTap = 0;
      return;
    }
    lastTap = now;
  }

  // drag pan (one finger) when zoomed
  let dragging = false;
  let startX = 0, startY = 0;

  function touchPoint(e) {
    const t = e.touches && e.touches[0];
    return t ? { x: t.clientX, y: t.clientY } : null;
  }

  zoomWrap.addEventListener("touchstart", (e) => {
    if (!modal.classList.contains("is-open")) return;
    if (e.touches.length !== 1) return;

    onTap();

    if (scale > 1.05) {
      dragging = true;
      const p = touchPoint(e);
      startX = p.x - tx;
      startY = p.y - ty;
      e.preventDefault();
    }
  }, { passive: false });

  zoomWrap.addEventListener("touchmove", (e) => {
    if (!modal.classList.contains("is-open")) return;
    if (!dragging || e.touches.length !== 1) return;

    const p = touchPoint(e);
    tx = p.x - startX;
    ty = p.y - startY;
    clampPan();
    apply();
    e.preventDefault();
  }, { passive: false });

  zoomWrap.addEventListener("touchend", () => { dragging = false; }, { passive: true });
  zoomWrap.addEventListener("touchcancel", () => { dragging = false; }, { passive: true });

  // swipe next/prev (only when not zoomed)
  let sx = 0, sy = 0;
  zoomWrap.addEventListener("touchstart", (e) => {
    if (!modal.classList.contains("is-open")) return;
    if (e.touches.length !== 1) return;
    const t = e.touches[0];
    sx = t.clientX; sy = t.clientY;
  }, { passive: true });

  zoomWrap.addEventListener("touchend", (e) => {
    if (!modal.classList.contains("is-open")) return;
    const list = galleries[gKey] || [];
    if (list.length <= 1) return;
    if (scale > 1.05) return;

    const t = e.changedTouches && e.changedTouches[0];
    if (!t) return;

    const dx = t.clientX - sx;
    const dy = t.clientY - sy;

    if (Math.abs(dx) > 55 && Math.abs(dy) < 40) {
      if (dx < 0) next();
      else prev();
    }
  }, { passive: true });

  // ensure transform re-applied
  modalImg.addEventListener("load", apply);
})();