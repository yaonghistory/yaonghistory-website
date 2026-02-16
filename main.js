(() => {
  "use strict";

  // double-init guard (in case main.js is loaded twice)
  if (window.__YAONG_MAIN_INIT__) return;
  window.__YAONG_MAIN_INIT__ = true;

  // prevent iOS/in-app from restoring scroll position on reload
  try {
    if ("scrollRestoration" in history) history.scrollRestoration = "manual";
  } catch (_) {}

  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

  const header = $(".site-header");
  const prefersReducedMotion =
    window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  const clamp = (n, min, max) => Math.max(min, Math.min(max, n));
  const nowY = () => window.pageYOffset || document.documentElement.scrollTop || 0;
  const maxScrollY = () =>
    Math.max(0, document.documentElement.scrollHeight - window.innerHeight);

  function getHeaderOffset() {
    const root = document.documentElement;
    const cssVal = getComputedStyle(root).getPropertyValue("--header-offset").trim();
    const cssNum = cssVal ? parseInt(cssVal, 10) : NaN;
    const h = header ? Math.ceil(header.getBoundingClientRect().height) : 0;
    const base = Number.isFinite(cssNum) ? cssNum : h + 10;
    return Math.max(60, base);
  }

  function getTargetY(el) {
    const rect = el.getBoundingClientRect();
    const y = nowY() + rect.top - getHeaderOffset();
    return clamp(y, 0, maxScrollY());
  }

  function getNavType() {
    try {
      const nav = performance.getEntriesByType && performance.getEntriesByType("navigation");
      return nav && nav[0] && nav[0].type ? nav[0].type : null;
    } catch (_) {
      return null;
    }
  }

  function clearHash() {
    try {
      history.replaceState(null, "", location.pathname + location.search);
    } catch (_) {}
  }

  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

  async function warmupImagesBeforeContact(timeoutMs = 700) {
    const imgs = Array.from(document.querySelectorAll("#review img, #photos img"));
    const pending = imgs.filter((img) => !img.complete);

    if (!pending.length) return;

    const decodeOrLoad = (img) => {
      if (img.decode) return img.decode().catch(() => {});
      return new Promise((res) => img.addEventListener("load", () => res(), { once: true }));
    };

    await Promise.race([Promise.allSettled(pending.map(decodeOrLoad)), sleep(timeoutMs)]);
  }

  let animToken = 0;
  let rafId = 0;
  let settleTimer = 0;
  let isAnimating = false;

  function cancelScroll() {
    animToken += 1;
    isAnimating = false;
    if (rafId) cancelAnimationFrame(rafId);
    rafId = 0;
    if (settleTimer) clearTimeout(settleTimer);
    settleTimer = 0;
  }

  const easeInOutCubic = (t) =>
    t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;

  function smoothToY(targetY, duration = 720) {
    const endY = clamp(targetY, 0, maxScrollY());

    if (prefersReducedMotion) {
      cancelScroll();
      window.scrollTo(0, endY);
      return;
    }

    cancelScroll();
    const myToken = animToken;
    const startY = nowY();
    const startT = performance.now();
    isAnimating = true;

    function tick(tNow) {
      if (myToken !== animToken) return;

      const t = clamp((tNow - startT) / duration, 0, 1);
      const y = startY + (endY - startY) * easeInOutCubic(t);
      window.scrollTo(0, y);

      if (t < 1) {
        rafId = requestAnimationFrame(tick);
      } else {
        rafId = 0;
        isAnimating = false;
      }
    }

    rafId = requestAnimationFrame(tick);
  }

  function scrollToEl(el) {
    if (!el) return;

    smoothToY(getTargetY(el), 760);

    // one-time settle after potential layout changes
    settleTimer = setTimeout(() => {
      window.scrollTo(0, getTargetY(el));
    }, 900);
  }

  function bindUserCancel() {
    const cancel = () => cancelScroll();
    window.addEventListener("wheel", cancel, { passive: true });
    window.addEventListener("touchstart", cancel, { passive: true });
    window.addEventListener("keydown", (e) => {
      const keys = ["ArrowDown", "ArrowUp", "PageDown", "PageUp", "Home", "End", " "];
      if (keys.includes(e.key)) cancel();
    });

    // iOS status-bar tap "scroll-to-top" should not fight our animation
    window.addEventListener(
      "scroll",
      () => {
        if (nowY() <= 0) cancelScroll();
      },
      { passive: true }
    );
  }

  function bindAnchors() {
    $$("[data-scroll]").forEach((a) => {
      a.addEventListener(
        "click",
        async (e) => {
          const href = a.getAttribute("href") || "";
          if (!href.startsWith("#")) return;

          const target = $(href);
          if (!target) return;

          e.preventDefault();
          clearHash();

          // only for contact: warm up review/photos images to prevent layout-shift stop
          if (target.id === "contact") {
            await warmupImagesBeforeContact(700);
          }

          scrollToEl(target);
        },
        { passive: false }
      );
    });
  }

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
      const body = encodeURIComponent(
        [
          `보호자 이름: ${parent}`,
          `휴대폰 번호: ${phone}`,
          `인원: ${people}`,
          `희망 장소/일정: ${schedule}`,
          ``,
          `문의 내용:`,
          `${message}`
        ].join("\n")
      );

      location.href = `mailto:yaonghistory@gmail.com?subject=${subject}&body=${body}`;
    });
  }

  function forceTopOnReloadOrBFCache() {
    const navType = getNavType();

    if (navType === "reload" || navType === "back_forward") {
      clearHash();
      window.scrollTo(0, 0);
      cancelScroll();
    }

    window.addEventListener(
      "pageshow",
      (e) => {
        if (e.persisted) {
          clearHash();
          window.scrollTo(0, 0);
          cancelScroll();
        }
      },
      { passive: true }
    );
  }

  function init() {
    forceTopOnReloadOrBFCache();
    bindUserCancel();
    bindAnchors();
    bindMail();

    const navType = getNavType();
    if (location.hash && navType !== "reload" && navType !== "back_forward") {
      const el = $(location.hash);
      clearHash();
      if (el) setTimeout(() => scrollToEl(el), 0);
    } else {
      if (location.hash) clearHash();
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();