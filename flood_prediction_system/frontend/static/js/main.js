/**
 * main.js
 * Shared behavior across every page: loading screen, dark/light theme
 * toggle, sticky navbar scroll state, mobile nav, scroll-reveal
 * animations, animated stat counters, toast notifications, and a small
 * API helper used by predict.js / charts.js.
 */

(function () {
  "use strict";

  /* ---------------------------------------------------------------------
   * API CONFIG — shared across pages
   * ------------------------------------------------------------------- */
  window.FloodAPI = {
    BASE_URL: "/api",

    async request(path, options = {}) {
      const url = `${this.BASE_URL}${path}`;
      const defaultHeaders = { "Content-Type": "application/json" };

      try {
        const response = await fetch(url, {
          headers: { ...defaultHeaders, ...(options.headers || {}) },
          ...options,
        });

        const contentType = response.headers.get("content-type") || "";
        const body = contentType.includes("application/json")
          ? await response.json()
          : await response.text();

        if (!response.ok) {
          const message = (body && body.message) || (body && body.error) || `Request failed (${response.status})`;
          throw new Error(message);
        }
        return { ok: true, data: body };
      } catch (err) {
        return { ok: false, error: err.message || "Network error" };
      }
    },

    get(path) {
      return this.request(path, { method: "GET" });
    },

    post(path, payload) {
      return this.request(path, { method: "POST", body: JSON.stringify(payload) });
    },
  };

  /* ---------------------------------------------------------------------
   * LOADING SCREEN
   * ------------------------------------------------------------------- */
  function hideLoadingScreen() {
    const screen = document.getElementById("loadingScreen");
    if (!screen) return;
    // Small minimum-display delay so the animation isn't a flash on fast loads
    setTimeout(() => {
      screen.classList.add("is-hidden");
      setTimeout(() => screen.remove(), 600);
    }, 350);
  }

  window.addEventListener("load", hideLoadingScreen);
  // Safety net: never let the loading screen trap the user
  setTimeout(hideLoadingScreen, 4000);

  /* ---------------------------------------------------------------------
   * THEME TOGGLE (persisted in localStorage)
   * ------------------------------------------------------------------- */
  const THEME_KEY = "flood-system-theme";

  function applyTheme(theme) {
    document.documentElement.setAttribute("data-theme", theme);
    const icons = document.querySelectorAll(".theme-toggle-icon");
    icons.forEach((icon) => {
      icon.innerHTML = theme === "light" ? MOON_ICON : SUN_ICON;
    });
  }

  const SUN_ICON = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="12" r="4.5"/><path d="M12 2v3M12 19v3M4.2 4.2l2.1 2.1M17.7 17.7l2.1 2.1M2 12h3M19 12h3M4.2 19.8l2.1-2.1M17.7 6.3l2.1-2.1"/></svg>';
  const MOON_ICON = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 14.5A8.5 8.5 0 1 1 9.5 4a7 7 0 0 0 10.5 10.5z"/></svg>';

  function initTheme() {
    const stored = localStorage.getItem(THEME_KEY);
    const preferred = stored || "dark";
    applyTheme(preferred);

    document.querySelectorAll("[data-theme-toggle]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const current = document.documentElement.getAttribute("data-theme") || "dark";
        const next = current === "dark" ? "light" : "dark";
        applyTheme(next);
        localStorage.setItem(THEME_KEY, next);
      });
    });
  }

  /* ---------------------------------------------------------------------
   * NAVBAR — scroll shadow + active link + mobile toggle
   * ------------------------------------------------------------------- */
  function initNavbar() {
    const navbar = document.querySelector(".navbar-glass");
    if (navbar) {
      const onScroll = () => {
        navbar.classList.toggle("is-scrolled", window.scrollY > 12);
      };
      onScroll();
      window.addEventListener("scroll", onScroll, { passive: true });
    }

    // Highlight active nav link based on current path
    const currentPath = window.location.pathname.replace(/\/$/, "") || "/";
    document.querySelectorAll(".nav-link-custom").forEach((link) => {
      const linkPath = (link.getAttribute("href") || "").replace(/\/$/, "") || "/";
      if (linkPath === currentPath) {
        link.classList.add("active");
      }
    });

    // Mobile menu toggle
    const toggler = document.getElementById("navTogglerBtn");
    const collapseEl = document.getElementById("mainNavCollapse");
    if (toggler && collapseEl) {
      toggler.addEventListener("click", () => {
        collapseEl.classList.toggle("show");
      });
      // Close menu when a link is tapped (mobile UX)
      collapseEl.querySelectorAll("a.nav-link-custom").forEach((link) => {
        link.addEventListener("click", () => collapseEl.classList.remove("show"));
      });
    }
  }

  /* ---------------------------------------------------------------------
   * BACK TO TOP BUTTON
   * ------------------------------------------------------------------- */
  function initBackToTop() {
    const btn = document.getElementById("backToTopBtn");
    if (!btn) return;
    const toggleVisibility = () => {
      btn.style.display = window.scrollY > 400 ? "flex" : "none";
    };
    toggleVisibility();
    window.addEventListener("scroll", toggleVisibility, { passive: true });
    btn.addEventListener("click", () => window.scrollTo({ top: 0, behavior: "smooth" }));
  }

  /* ---------------------------------------------------------------------
   * SCROLL REVEAL — IntersectionObserver driven
   * ------------------------------------------------------------------- */
  function initScrollReveal() {
    const targets = document.querySelectorAll(".reveal, .reveal-scale");
    if (!targets.length) return;

    if (!("IntersectionObserver" in window)) {
      targets.forEach((el) => el.classList.add("is-visible"));
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add("is-visible");
            observer.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.15, rootMargin: "0px 0px -40px 0px" }
    );

    targets.forEach((el) => observer.observe(el));
  }

  /* ---------------------------------------------------------------------
   * ANIMATED STAT COUNTERS
   * ------------------------------------------------------------------- */
  function animateCounter(el) {
    const target = parseFloat(el.getAttribute("data-count-to"));
    const decimals = parseInt(el.getAttribute("data-decimals") || "0", 10);
    const suffix = el.getAttribute("data-suffix") || "";
    const duration = parseInt(el.getAttribute("data-duration") || "1400", 10);
    if (Number.isNaN(target)) return;

    const start = performance.now();

    function tick(now) {
      const progress = Math.min((now - start) / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3); // ease-out-cubic
      const value = target * eased;
      el.textContent = value.toFixed(decimals) + suffix;
      if (progress < 1) {
        requestAnimationFrame(tick);
      } else {
        el.textContent = target.toFixed(decimals) + suffix;
      }
    }
    requestAnimationFrame(tick);
  }

  function initCounters() {
    const counters = document.querySelectorAll("[data-count-to]");
    if (!counters.length) return;

    if (!("IntersectionObserver" in window)) {
      counters.forEach(animateCounter);
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            animateCounter(entry.target);
            observer.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.4 }
    );
    counters.forEach((el) => observer.observe(el));
  }

  /* ---------------------------------------------------------------------
   * TOAST NOTIFICATIONS
   * ------------------------------------------------------------------- */
  const ICONS = {
    success: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#34D399" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><path d="M9 12.5l2.2 2.2L15.5 10"/></svg>',
    error: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#E8425A" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><path d="M9.5 9.5l5 5M14.5 9.5l-5 5"/></svg>',
    info: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#21C7C0" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><path d="M12 8v.01M12 11v5"/></svg>',
  };

  window.showToast = function (message, type = "info", duration = 4200) {
    document.querySelectorAll(".toast-custom").forEach((t) => t.remove());

    const toast = document.createElement("div");
    toast.className = "toast-custom anim-fade-up";
    toast.innerHTML = `
      <span style="flex-shrink:0;margin-top:2px;">${ICONS[type] || ICONS.info}</span>
      <span style="color:var(--color-text);font-size:0.9rem;line-height:1.4;">${message}</span>
    `;
    document.body.appendChild(toast);

    setTimeout(() => {
      toast.style.transition = "opacity 0.4s ease, transform 0.4s ease";
      toast.style.opacity = "0";
      toast.style.transform = "translateY(12px)";
      setTimeout(() => toast.remove(), 400);
    }, duration);
  };

  /* ---------------------------------------------------------------------
   * GENERIC FORM VALIDATION HELPERS (used by predict.js / contact form)
   * ------------------------------------------------------------------- */
  window.FormValidation = {
    showError(input, message) {
      input.classList.add("is-invalid-custom");
      input.classList.remove("is-valid-custom");
      const feedback = input.parentElement.querySelector(".invalid-feedback-custom");
      if (feedback) feedback.textContent = message;
    },
    clearError(input) {
      input.classList.remove("is-invalid-custom");
      input.classList.add("is-valid-custom");
    },
    isEmpty(value) {
      return value === null || value === undefined || String(value).trim() === "";
    },
    isValidEmail(value) {
      return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
    },
    inRange(value, min, max) {
      const num = parseFloat(value);
      return !Number.isNaN(num) && num >= min && num <= max;
    },
  };

  /* ---------------------------------------------------------------------
   * INIT
   * ------------------------------------------------------------------- */
  document.addEventListener("DOMContentLoaded", () => {
    initTheme();
    initNavbar();
    initBackToTop();
    initScrollReveal();
    initCounters();
  });
})();
