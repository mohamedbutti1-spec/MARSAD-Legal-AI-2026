/* ==========================================================================
   BUIO clone — shared vanilla JS behaviors
   No framework, no build step. Runs on every page.
   ========================================================================== */
(function () {
  "use strict";

  var root = document.documentElement;
  root.classList.add("js");

  /* ---------------- theme toggle ---------------- */
  var THEME_KEY = "buio-theme";

  function applyStoredTheme() {
    var stored = localStorage.getItem(THEME_KEY);
    if (stored === "light" || stored === "dark") {
      root.setAttribute("data-theme", stored);
    }
  }
  applyStoredTheme();

  function currentTheme() {
    // Dark is the CSS default whenever data-theme isn't set — BUIO is dark-first.
    return root.getAttribute("data-theme") || "dark";
  }

  document.addEventListener("click", function (e) {
    var btn = e.target.closest("[data-theme-toggle]");
    if (!btn) return;
    var next = currentTheme() === "dark" ? "light" : "dark";
    root.setAttribute("data-theme", next);
    localStorage.setItem(THEME_KEY, next);
  });

  /* ---------------- active nav link ---------------- */
  var currentPage = (location.pathname.split("/").pop() || "index.html") || "index.html";
  document.querySelectorAll(".main-nav a[href], .mobile-nav a[href]").forEach(function (a) {
    var href = a.getAttribute("href").split("/").pop();
    if (href === currentPage || (href === "index.html" && currentPage === "")) {
      a.classList.add("active");
    }
  });

  /* ---------------- header scroll state ---------------- */
  var header = document.querySelector(".site-header");
  if (header) {
    var onScroll = function () {
      header.classList.toggle("scrolled", window.scrollY > 8);
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
  }

  /* ---------------- mobile nav ---------------- */
  var menuToggle = document.querySelector("[data-menu-toggle]");
  var mobileNav = document.querySelector("[data-mobile-nav]");
  if (menuToggle && mobileNav) {
    menuToggle.addEventListener("click", function () {
      var isOpen = mobileNav.classList.toggle("open");
      document.body.style.overflow = isOpen ? "hidden" : "";
      menuToggle.setAttribute("aria-expanded", String(isOpen));
    });
    mobileNav.querySelectorAll("a").forEach(function (a) {
      a.addEventListener("click", function () {
        mobileNav.classList.remove("open");
        document.body.style.overflow = "";
      });
    });
  }

  /* ---------------- scroll reveal (AOS-lite) ---------------- */
  var revealTargets = document.querySelectorAll("[data-aos]");
  if (revealTargets.length) {
    if ("IntersectionObserver" in window) {
      var io = new IntersectionObserver(
        function (entries) {
          entries.forEach(function (entry) {
            if (entry.isIntersecting) {
              var delay = entry.target.getAttribute("data-aos-delay");
              if (delay) entry.target.style.transitionDelay = delay + "ms";
              entry.target.classList.add("aos-visible");
              io.unobserve(entry.target);
            }
          });
        },
        { threshold: 0.15, rootMargin: "0px 0px -60px 0px" }
      );
      revealTargets.forEach(function (el) { io.observe(el); });
    } else {
      revealTargets.forEach(function (el) { el.classList.add("aos-visible"); });
    }
  }

  /* ---------------- FAQ accordion ---------------- */
  document.querySelectorAll(".faq-item").forEach(function (item) {
    var q = item.querySelector(".faq-q");
    var a = item.querySelector(".faq-a");
    if (!q || !a) return;
    q.addEventListener("click", function () {
      var willOpen = !item.classList.contains("open");
      item.parentElement.querySelectorAll(".faq-item.open").forEach(function (other) {
        if (other !== item) {
          other.classList.remove("open");
          other.querySelector(".faq-a").style.maxHeight = "";
        }
      });
      item.classList.toggle("open", willOpen);
      a.style.maxHeight = willOpen ? a.scrollHeight + "px" : "";
    });
  });

  /* ---------------- pricing monthly/annual toggle ---------------- */
  var billingSwitch = document.querySelector("[data-billing-toggle]");
  if (billingSwitch) {
    var setBilling = function (annual) {
      document.querySelectorAll(".price.monthly").forEach(function (el) {
        el.classList.toggle("active", !annual);
      });
      document.querySelectorAll(".price.annual").forEach(function (el) {
        el.classList.toggle("active", annual);
      });
    };
    setBilling(billingSwitch.checked);
    billingSwitch.addEventListener("change", function () {
      setBilling(billingSwitch.checked);
    });
  }

  /* ---------------- blog / integrations / jobs filter chips ---------------- */
  document.querySelectorAll("[data-filter-group]").forEach(function (group) {
    var targetSelector = group.getAttribute("data-filter-group");
    var items = document.querySelectorAll(targetSelector);
    group.addEventListener("click", function (e) {
      var chip = e.target.closest(".filter-chip");
      if (!chip) return;
      group.querySelectorAll(".filter-chip").forEach(function (c) { c.classList.remove("active"); });
      chip.classList.add("active");
      var cat = chip.getAttribute("data-filter");
      items.forEach(function (item) {
        var match = cat === "all" || item.getAttribute("data-category") === cat;
        item.style.display = match ? "" : "none";
      });
    });
  });

  /* ---------------- table of contents scroll-spy ---------------- */
  var tocLinks = document.querySelectorAll(".toc a, .whitepaper-nav a");
  if (tocLinks.length && "IntersectionObserver" in window) {
    var headingMap = {};
    tocLinks.forEach(function (link) {
      var id = link.getAttribute("href").replace("#", "");
      var heading = document.getElementById(id);
      if (heading) headingMap[id] = link;
    });
    var tocIo = new IntersectionObserver(
      function (entries) {
        entries.forEach(function (entry) {
          var link = headingMap[entry.target.id];
          if (!link) return;
          if (entry.isIntersecting) {
            tocLinks.forEach(function (l) { l.classList.remove("active"); });
            link.classList.add("active");
          }
        });
      },
      { rootMargin: "-20% 0px -70% 0px" }
    );
    Object.keys(headingMap).forEach(function (id) {
      tocIo.observe(document.getElementById(id));
    });
  }

  /* ---------------- form submit stubs (static demo, no backend) ---------------- */
  document.querySelectorAll("form[data-demo-form]").forEach(function (form) {
    form.addEventListener("submit", function (e) {
      e.preventDefault();
      var note = form.querySelector("[data-form-note]");
      if (note) {
        note.textContent = form.getAttribute("data-success-message") || "Submitted. This is a static demo — no data was sent anywhere.";
        note.hidden = false;
      }
      form.reset();
    });
  });

  /* ---------------- simple logo/testimonial marquee duplication ---------------- */
  document.querySelectorAll("[data-marquee]").forEach(function (track) {
    track.innerHTML += track.innerHTML;
  });
})();
