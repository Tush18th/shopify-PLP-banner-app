(function () {
  "use strict";

  // =========================================================================
  // PLP Banner Injector
  // Detects the product grid on collection pages and injects promotional
  // banner tiles at configured positions. Handles responsive layouts,
  // infinite scroll, and deduplication.
  // =========================================================================

  var INJECTED_ATTR = "data-plp-banner-injected";
  var BANNER_ATTR = "data-plp-banner-id";
  var impressionsSent = {};
  var config = {};
  var bannerData = [];

  // ---- Initialization ----

  function init() {
    var script = document.currentScript || document.querySelector("script[data-shop]");
    if (!script) return;

    config = {
      shop: script.getAttribute("data-shop"),
      collectionId: script.getAttribute("data-collection-id"),
      collectionHandle: script.getAttribute("data-collection-handle"),
      gridSelector: script.getAttribute("data-grid-selector") || ".product-grid",
      productSelector: script.getAttribute("data-product-selector") || ".grid__item",
      desktopColumns: parseInt(script.getAttribute("data-desktop-columns"), 10) || 4,
      tabletColumns: parseInt(script.getAttribute("data-tablet-columns"), 10) || 3,
      mobileColumns: parseInt(script.getAttribute("data-mobile-columns"), 10) || 2,
      appProxyUrl: script.getAttribute("data-app-proxy-url") || "/apps/plp-banners",
    };

    fetchBanners();
  }

  // ---- Fetch banners from app proxy ----

  function fetchBanners() {
    var url =
      config.appProxyUrl +
      "/api/storefront/banners?shop=" +
      encodeURIComponent(config.shop) +
      "&collection_id=" +
      encodeURIComponent(config.collectionId || "");

    var xhr = new XMLHttpRequest();
    xhr.open("GET", url, true);
    xhr.timeout = 5000;
    xhr.onreadystatechange = function () {
      if (xhr.readyState === 4) {
        if (xhr.status === 200) {
          try {
            var response = JSON.parse(xhr.responseText);
            bannerData = response.banners || [];
            if (bannerData.length > 0) {
              injectBanners();
              observeGridChanges();
              observeResize();
            }
          } catch (e) {
            // Silent fail — don't break the store
          }
        }
      }
    };
    xhr.onerror = function () {
      // Silent fail
    };
    xhr.send();
  }

  // ---- Find the product grid ----

  function findGrid() {
    var selectors = config.gridSelector.split(",").map(function (s) {
      return s.trim();
    });
    for (var i = 0; i < selectors.length; i++) {
      var grid = document.querySelector(selectors[i]);
      if (grid) return grid;
    }
    return null;
  }

  // ---- Find product items in the grid ----

  function findProducts(grid) {
    var selectors = config.productSelector.split(",").map(function (s) {
      return s.trim();
    });
    for (var i = 0; i < selectors.length; i++) {
      var items = grid.querySelectorAll(selectors[i]);
      if (items.length > 0) {
        // Filter out our own banner tiles
        return Array.prototype.filter.call(items, function (item) {
          return !item.hasAttribute(BANNER_ATTR);
        });
      }
    }
    return [];
  }

  // ---- Get current column count based on viewport ----

  function getColumnCount() {
    var width = window.innerWidth;
    if (width >= 990) return config.desktopColumns;
    if (width >= 750) return config.tabletColumns;
    return config.mobileColumns;
  }

  // ---- Calculate insertion index for a placement ----

  function getInsertionIndex(placement, products, columns) {
    if (placement.type === "AFTER_INDEX") {
      return Math.min(placement.position, products.length);
    }
    if (placement.type === "AFTER_ROW") {
      return Math.min(placement.position * columns, products.length);
    }
    return 0;
  }

  // ---- Create a banner tile DOM element ----

  function createBannerElement(banner) {
    var sizeClass = "";
    if (banner.tileSize === "SIZE_2x1") sizeClass = " plp-banner-tile--2x1";
    if (banner.tileSize === "SIZE_2x2") sizeClass = " plp-banner-tile--2x2";

    var tag = banner.ctaLink ? "a" : "div";
    var el = document.createElement(tag);
    el.className = "plp-banner-tile" + sizeClass;
    el.setAttribute(BANNER_ATTR, banner.id);
    el.style.backgroundColor = banner.backgroundColor || "#ffffff";

    if (banner.ctaLink) {
      el.href = banner.ctaLink;
      if (banner.openInNewTab) {
        el.target = "_blank";
        el.rel = "noopener noreferrer";
      }
    }

    // Build inner HTML
    var html = "";

    // Desktop image
    if (banner.desktopImageUrl) {
      html +=
        '<img class="plp-banner-tile__image plp-banner-tile__image--desktop" ' +
        'src="' + escapeAttr(banner.desktopImageUrl) + '" ' +
        'alt="' + escapeAttr(banner.title || "Promotional banner") + '" ' +
        'loading="lazy">';
    }

    // Mobile image (fallback to desktop)
    if (banner.mobileImageUrl) {
      html +=
        '<img class="plp-banner-tile__image plp-banner-tile__image--mobile" ' +
        'src="' + escapeAttr(banner.mobileImageUrl) + '" ' +
        'alt="' + escapeAttr(banner.title || "Promotional banner") + '" ' +
        'loading="lazy">';
    } else if (banner.desktopImageUrl) {
      // If no mobile image, desktop image is shown on both
      html = html.replace("plp-banner-tile__image--desktop", "plp-banner-tile__image");
    }

    // Content overlay
    html += '<div class="plp-banner-tile__content">';
    if (banner.title) {
      html += '<p class="plp-banner-tile__title">' + escapeHtml(banner.title) + "</p>";
    }
    if (banner.subtitle) {
      html += '<p class="plp-banner-tile__subtitle">' + escapeHtml(banner.subtitle) + "</p>";
    }
    if (banner.ctaText) {
      html += '<span class="plp-banner-tile__cta">' + escapeHtml(banner.ctaText) + "</span>";
    }
    html += "</div>";

    el.innerHTML = html;

    // Track click
    el.addEventListener("click", function () {
      trackEvent(banner.id, "click");
    });

    return el;
  }

  // ---- Inject all banners into the grid ----

  function injectBanners() {
    var grid = findGrid();
    if (!grid) return;

    // Remove previously injected banners (for re-injection on resize)
    var existing = grid.querySelectorAll("[" + BANNER_ATTR + "]");
    for (var i = 0; i < existing.length; i++) {
      existing[i].remove();
    }

    var products = findProducts(grid);
    if (products.length === 0) return;

    var columns = getColumnCount();

    // Collect all placements from all banners, sorted by position (descending)
    // so we can insert from the end and not shift earlier indices
    var allPlacements = [];
    for (var b = 0; b < bannerData.length; b++) {
      var banner = bannerData[b];
      for (var p = 0; p < banner.placements.length; p++) {
        allPlacements.push({
          banner: banner,
          placement: banner.placements[p],
          insertIndex: getInsertionIndex(banner.placements[p], products, columns),
        });
      }
    }

    // Sort descending by insertIndex so we insert from end to start
    allPlacements.sort(function (a, b) {
      if (b.insertIndex !== a.insertIndex) return b.insertIndex - a.insertIndex;
      return b.banner.priority - a.banner.priority;
    });

    // Deduplicate: only one banner per position
    var usedPositions = {};
    var toInsert = [];
    for (var j = 0; j < allPlacements.length; j++) {
      var idx = allPlacements[j].insertIndex;
      if (!usedPositions[idx]) {
        usedPositions[idx] = true;
        toInsert.push(allPlacements[j]);
      }
    }

    // Insert banners
    for (var k = 0; k < toInsert.length; k++) {
      var item = toInsert[k];
      var bannerEl = createBannerElement(item.banner);

      // Copy the product item's class for consistent grid styling
      if (products[0]) {
        var productClasses = products[0].className
          .split(" ")
          .filter(function (c) {
            return c.indexOf("product") === -1 && c.trim().length > 0;
          });
        for (var c = 0; c < productClasses.length; c++) {
          bannerEl.classList.add(productClasses[c]);
        }
      }

      var insertIdx = Math.min(item.insertIndex, products.length);
      if (insertIdx >= products.length) {
        grid.appendChild(bannerEl);
      } else {
        grid.insertBefore(bannerEl, products[insertIdx]);
      }

      // Track impression
      trackImpression(item.banner.id);
    }

    grid.setAttribute(INJECTED_ATTR, "true");
  }

  // ---- Track impression (deduped per page load) ----

  function trackImpression(bannerId) {
    if (impressionsSent[bannerId]) return;
    impressionsSent[bannerId] = true;
    trackEvent(bannerId, "impression");
  }

  // ---- Track event via API ----

  function trackEvent(bannerId, event) {
    var url = config.appProxyUrl + "/api/storefront/track";
    var xhr = new XMLHttpRequest();
    xhr.open("POST", url, true);
    xhr.setRequestHeader("Content-Type", "application/json");
    xhr.timeout = 3000;
    xhr.send(JSON.stringify({ bannerId: bannerId, event: event }));
  }

  // ---- Observe grid for infinite scroll / dynamic changes ----

  function observeGridChanges() {
    var grid = findGrid();
    if (!grid || !window.MutationObserver) return;

    var debounceTimer;
    var observer = new MutationObserver(function () {
      clearTimeout(debounceTimer);
      debounceTimer = setTimeout(function () {
        injectBanners();
      }, 200);
    });

    observer.observe(grid, { childList: true, subtree: false });
  }

  // ---- Re-inject on window resize (column count may change) ----

  function observeResize() {
    var lastColumns = getColumnCount();
    var resizeTimer;

    window.addEventListener("resize", function () {
      clearTimeout(resizeTimer);
      resizeTimer = setTimeout(function () {
        var currentColumns = getColumnCount();
        if (currentColumns !== lastColumns) {
          lastColumns = currentColumns;
          injectBanners();
        }
      }, 250);
    });
  }

  // ---- Utility: Escape HTML ----

  function escapeHtml(str) {
    var div = document.createElement("div");
    div.appendChild(document.createTextNode(str));
    return div.innerHTML;
  }

  // ---- Utility: Escape HTML attribute ----

  function escapeAttr(str) {
    return str
      .replace(/&/g, "&amp;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");
  }

  // ---- Start ----

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
