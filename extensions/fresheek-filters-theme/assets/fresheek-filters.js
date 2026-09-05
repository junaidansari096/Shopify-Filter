/**
 * Fresheek Filters — Storefront behaviour.
 *
 * Loads only when the Fresheek Filters app block is present on the page.
 * Implements server-side section refreshing using Shopify's native filter
 * URL parameters, so we never download the entire catalog to the browser.
 *
 * Modules (kept as small classes/objects to avoid a giant single file):
 *   - URLState           : central URL mutation + parsing
 *   - SectionFetcher     : fetches Shopify section HTML with abort + cache
 *   - FilterController   : event delegation for checkboxes/price/sort
 *   - FilterOptionSearch : local option filtering (no network)
 *   - ShowMoreController : Show more / Show less
 *   - MobileDrawer       : mobile drawer open/close/focus behaviour
 *   - ActiveFilterManager: manages chips and clear-all
 *   - ThemeAdapter       : safe product-results replacement abstraction
 */
(function () {
  "use strict";

  var ROOT_SELECTOR = ".fresheek-filters";

  var root = document.querySelector(ROOT_SELECTOR);
  if (!root) {
    return;
  }

  // Prevent duplicate controller instances on the same root DOM element
  if (root.getAttribute("data-ff-initialized") === "true") {
    return;
  }
  root.setAttribute("data-ff-initialized", "true");

  // ---------------------------------------------------------------------
  // Configuration
  // ---------------------------------------------------------------------
  var config = {
    enableDesktop: root.getAttribute("data-ff-enable-desktop") !== "false",
    enableMobile: root.getAttribute("data-ff-enable-mobile") !== "false",
    sidebarWidth: root.getAttribute("data-ff-sidebar-width") || "260px",
    sticky: root.getAttribute("data-ff-sticky") !== "false",
    stickyOffset: root.getAttribute("data-ff-sticky-offset") || "80px",
    showCount: root.getAttribute("data-ff-show-count") !== "false",
    showActive: root.getAttribute("data-ff-show-active") !== "false",
    breakpoint: parseInt(root.getAttribute("data-ff-breakpoint") || "990", 10),
    baseUrl: root.getAttribute("data-ff-base-url") || "",
    hasFilters: root.getAttribute("data-ff-has-filters") === "true",
    shop: root.getAttribute("data-ff-shop") || "",
  };

  if (!config.hasFilters) {
    // No native filter data; nothing to wire up. Keep it non-destructive.
    return;
  }

  var DEBUG = window.location.search.indexOf("ff_debug=1") !== -1;

  function log() {
    if (!DEBUG) {
      return;
    }
    /* eslint-disable no-console */
    console.log.apply(console, ["[Fresheek Filters]"].concat(Array.prototype.slice.call(arguments)));
    /* eslint-enable no-console */
  }

  // ---------------------------------------------------------------------
  // URLState
  // ---------------------------------------------------------------------
  var URLState = {
    /**
     * Toggle a multi-value filter parameter, preserving other parameters and
     * resetting page on change. Mirrors the tested util in app/utils.
     */
    toggleFilter: function (url, parameter, value, checked) {
      var next = new URL(url.toString());
      var values = next.searchParams.getAll(parameter);
      next.searchParams.delete(parameter);

      var seen = Object.create(null);
      var updated = [];
      var i;

      values.forEach(function (v) {
        if (!seen[v]) {
          seen[v] = true;
          updated.push(v);
        }
      });

      if (checked) {
        if (!seen[value]) {
          updated.push(value);
        }
      } else {
        updated = updated.filter(function (entry) {
          return entry !== value;
        });
      }

      updated.forEach(function (item) {
        next.searchParams.append(parameter, item);
      });

      next.searchParams.delete("page");
      return next;
    },

    setPrice: function (url, minParam, minVal, maxParam, maxVal) {
      var next = new URL(url.toString());
      next.searchParams.delete(minParam);
      next.searchParams.delete(maxParam);
      if (minVal) {
        next.searchParams.set(minParam, minVal);
      }
      if (maxVal) {
        next.searchParams.set(maxParam, maxVal);
      }
      next.searchParams.delete("page");
      return next;
    },

    setSort: function (url, sortBy) {
      var next = new URL(url.toString());
      if (sortBy) {
        next.searchParams.set("sort_by", sortBy);
      } else {
        next.searchParams.delete("sort_by");
      }
      return next;
    },

    clearAll: function (url) {
      var next = new URL(url.toString());
      var keysToRemove = [];
      next.searchParams.forEach(function (_val, key) {
        if (key.indexOf("filter.") === 0) {
          keysToRemove.push(key);
        }
      });
      keysToRemove.forEach(function (key) {
        next.searchParams.delete(key);
      });
      next.searchParams.delete("page");
      return next;
    },

    readActiveFilters: function (url) {
      var active = [];
      url.searchParams.forEach(function (val, key) {
        if (key.indexOf("filter.") === 0) {
          active.push({ param: key, value: val });
        }
      });
      return active;
    },

    current: function () {
      return new URL(window.location.href);
    },
  };

  // ---------------------------------------------------------------------
  // SectionFetcher
  // ---------------------------------------------------------------------
  var SectionFetcher = (function () {
    var cache = new Map(); // bounded in-memory cache
    var MAX_CACHE = 50;
    var inflight = new Map(); // url -> AbortController

    function cacheGet(url) {
      return cache.get(url) || null;
    }

    function cacheSet(url, html) {
      if (cache.size >= MAX_CACHE) {
        var firstKey = cache.keys().next().value;
        if (firstKey) {
          cache.delete(firstKey);
        }
      }
      cache.set(url, html);
    }

    return {
      /**
       * Fetch the collection/search section HTML for the given URL.
       * Returns a promise resolving to { html } or throwing on failure.
       * Passing an AbortSignal cancels an in-flight request.
       */
      fetchSection: function (urlString, targetSectionId, signal) {
        var cached = cacheGet(urlString + "|section=" + targetSectionId);
        if (cached) {
          return Promise.resolve(cached);
        }

        // Abort any in-flight request for the same URL.
        var existing = inflight.get(urlString);
        if (existing) {
          existing.abort();
        }

        var controller = new AbortController();
        inflight.set(urlString, controller);

        var fetchSignal = controller.signal;
        if (signal) {
          // Combine caller signal with internal controller.
          if (signal.aborted) {
            controller.abort();
          } else {
            signal.addEventListener(
              "abort",
              function () {
                controller.abort();
              },
              { once: true },
            );
          }
        }

        var url = new URL(urlString, window.location.origin);
        url.searchParams.set("sections", targetSectionId);

        return fetch(url.toString(), {
          headers: {
            Accept: "text/html",
            "X-Requested-With": "XMLHttpRequest",
          },
          signal: fetchSignal,
          credentials: "same-origin",
        })
          .then(function (response) {
            if (!response.ok) {
              throw new Error("Section request failed with status " + response.status);
            }
            return response.text();
          })
          .then(function (text) {
            var parsed = parseSections(text);
            var sectionHtml = parsed[targetSectionId];
            if (sectionHtml === undefined) {
              throw new Error("Requested section not found in response");
            }
            var cacheKey = urlString + "|section=" + targetSectionId;
            cacheSet(cacheKey, sectionHtml);
            return sectionHtml;
          })
          .finally(function () {
            inflight.delete(urlString);
          });
      },

      clear: function () {
        cache.clear();
      },
    };

    function parseSections(text) {
      // Shopify returns {"section-id": "html", ...} JSON when ?sections= is used.
      try {
        return JSON.parse(text);
      } catch (e) {
        log("Failed to parse section JSON", e);
        throw new Error("Malformed section response");
      }
    }
  })();

  // ---------------------------------------------------------------------
  // ThemeAdapter — safe product-results replacement
  // ---------------------------------------------------------------------
  var ThemeAdapter = (function () {
    // Selector lists ordered by preference. The grid prefers a *container*
    // first (Dawn's #ProductGridContainer wraps the grid + pagination), so a
    // single innerHTML swap updates both; it then falls back to the grid node.
    var GRID_SELECTORS = [
      "#ProductGridContainer",
      "[data-ff-grid]",
      "#product-grid",
      "[id*='product-grid']",
      ".collection__grid",
      "ul.product-grid",
      ".product-grid",
      "[data-section-id] .product-grid",
      ".grid--collection",
    ];
    var COUNT_SELECTORS = [
      "[data-ff-product-count]",
      ".product-count",
      "#ProductCount",
      ".collection__products-count",
      ".product-count__text",
      "[data-ff-count]",
    ];
    var PAGINATION_SELECTORS = [
      "[data-ff-pagination]",
      ".pagination-wrapper",
      "nav.pagination",
      ".pagination",
    ];

    function firstMatch(scope, selectors) {
      var i;
      for (i = 0; i < selectors.length; i++) {
        var el = scope.querySelector(selectors[i]);
        if (el) {
          return el;
        }
      }
      return null;
    }

    function findProductGrid() {
      // Configurable selector override (Admin > Settings).
      var custom = root.getAttribute("data-ff-grid-selector");
      if (custom) {
        var el = document.querySelector(custom);
        if (el) {
          return el;
        }
      }
      return firstMatch(document, GRID_SELECTORS);
    }

    function extractCount(scope) {
      var i;
      for (i = 0; i < COUNT_SELECTORS.length; i++) {
        var el = scope.querySelector(COUNT_SELECTORS[i]);
        if (el && el.textContent) {
          var match = el.textContent.replace(/,/g, "").match(/\d+/);
          if (match) {
            return match[0];
          }
        }
      }
      return null;
    }

    return {
      findProductGrid: findProductGrid,

      /**
       * Resolve the Shopify section id/key that renders the product results.
       * The reliable, theme-agnostic source is the live grid's enclosing
       * `#shopify-section-<id>` wrapper — exactly what the `?sections=` API
       * expects. Falls back to a Liquid-provided hint, then legacy ids.
       * Returns null when nothing resolves (caller degrades to full nav).
       */
      resolveSectionId: function () {
        var grid = findProductGrid();
        if (grid && grid.closest) {
          var wrapper = grid.closest("[id^='shopify-section-']");
          if (wrapper && wrapper.id) {
            return wrapper.id.replace("shopify-section-", "");
          }
        }
        var hint = root.getAttribute("data-ff-section-id");
        if (hint) {
          return hint;
        }
        if (document.getElementById("main-collection")) {
          return "main-collection";
        }
        if (document.getElementById("main-search")) {
          return "main-search";
        }
        return null;
      },

      /**
       * Replace the product results in place using the freshly fetched section
       * HTML. Swaps only the grid (and, when present, the product count and a
       * separate pagination block) — never the Fresheek block itself, so the
       * delegated listeners on `root` survive. Returns true on success, false
       * if the grid could not be located in either document (the caller then
       * falls back to full navigation).
       */
      replaceResults: function (sectionHtml) {
        var doc;
        try {
          doc = new DOMParser().parseFromString(sectionHtml, "text/html");
        } catch (e) {
          log("Failed to parse section HTML", e);
          return false;
        }

        var newGrid = firstMatch(doc, GRID_SELECTORS);
        var liveGrid = findProductGrid();
        if (!newGrid || !liveGrid) {
          return false;
        }

        try {
          liveGrid.innerHTML = newGrid.innerHTML;
        } catch (e2) {
          log("Failed to swap product grid", e2);
          return false;
        }

        // Refresh the theme's own product-count element like-for-like, so we
        // never inject a foreign theme's markup into a different element.
        var ci;
        for (ci = 0; ci < COUNT_SELECTORS.length; ci++) {
          var liveCount = document.querySelector(COUNT_SELECTORS[ci]);
          var newCount = doc.querySelector(COUNT_SELECTORS[ci]);
          if (liveCount && newCount) {
            liveCount.innerHTML = newCount.innerHTML;
            break;
          }
        }

        // Refresh all Fresheek product count elements (desktop header, mobile
        // toolbar, drawer button) using the new numeric count.
        var count = extractCount(doc);
        if (count !== null) {
          var ffCounts = document.querySelectorAll("[data-ff-product-count]");
          ffCounts.forEach(function (ffCount) {
            var labelEl = ffCount.querySelector(".ff-count-label");
            ffCount.innerHTML = count + (labelEl ? " " + labelEl.outerHTML : "");
          });
          var drawerCount = document.querySelector("[data-ff-drawer-count]");
          if (drawerCount) {
            drawerCount.textContent = count;
          }
        }

        // Pagination that lives *outside* the swapped grid (themes where the
        // grid selector matched the <ul> rather than a container). Clear the
        // stale block when the filtered result no longer paginates.
        var livePagination = firstMatch(document, PAGINATION_SELECTORS);
        if (livePagination && !liveGrid.contains(livePagination)) {
          var newPagination = firstMatch(doc, PAGINATION_SELECTORS);
          livePagination.innerHTML = newPagination ? newPagination.innerHTML : "";
        }

        // Refresh active filters chips from the newly fetched section
        var newActiveFilters = doc.querySelector("[data-ff-active-filters]");
        var liveActiveFilters = document.querySelectorAll("[data-ff-active-filters]");
        if (newActiveFilters && liveActiveFilters.length > 0) {
          liveActiveFilters.forEach(function (liveEl) {
            liveEl.innerHTML = newActiveFilters.innerHTML;
            liveEl.className = newActiveFilters.className;
            liveEl.style.display = newActiveFilters.style.display;
          });
        }

        if (typeof InfiniteScrollManager !== "undefined") {
          InfiniteScrollManager.reset(doc);
        }

        return true;
      },
    };
  })();

  // ---------------------------------------------------------------------
  // InfiniteScrollManager — seamless scroll loading instead of 1,2,3,4 paging
  // ---------------------------------------------------------------------
  var InfiniteScrollManager = (function () {
    var observer = null;
    var sentinelEl = null;
    var currentPage = 1;
    var totalPages = 1;
    var isLoading = false;
    var sectionId = null;
    var scrollGeneration = 0;
    var activeScrollController = null;

    function parseTotalPages(scope) {
      var rootScope = scope || document;
      var pagination = rootScope.querySelector(
        ".pagination, [data-ff-pagination], nav.pagination, .pagination-wrapper, .pagination__list"
      );
      if (!pagination) {
        return 1;
      }
      var links = pagination.querySelectorAll("a[href*='page=']");
      var maxPage = 1;
      links.forEach(function (a) {
        var href = a.getAttribute("href") || "";
        var match = href.match(/[?&]page=(\d+)/);
        if (match && match[1]) {
          var num = parseInt(match[1], 10);
          if (num > maxPage) {
            maxPage = num;
          }
        }
      });
      var items = pagination.querySelectorAll(".pagination__item, li, a");
      items.forEach(function (item) {
        var txt = (item.textContent || "").trim();
        var num = parseInt(txt, 10);
        if (!isNaN(num) && num > maxPage && num < 1000) {
          maxPage = num;
        }
      });
      return maxPage;
    }

    function createOrGetSentinel() {
      if (sentinelEl && document.body.contains(sentinelEl)) {
        return sentinelEl;
      }
      var existing = document.querySelector("[data-ff-infinite-scroll]");
      if (existing) {
        sentinelEl = existing;
        return sentinelEl;
      }

      var wrap = document.createElement("div");
      wrap.className = "ff-infinite-scroll";
      wrap.setAttribute("data-ff-infinite-scroll", "");
      wrap.innerHTML =
        '<div class="ff-infinite-loader" data-ff-infinite-loader style="display: none;">' +
        '  <div class="ff-spinner"></div>' +
        '  <span>Loading more products...</span>' +
        "</div>" +
        '<div class="ff-infinite-end" data-ff-infinite-end style="display: none;">' +
        "  <span>You've viewed all products</span>" +
        "</div>";

      var gridUl = document.querySelector("#product-grid, ul.product-grid");
      if (gridUl && gridUl.parentNode) {
        gridUl.parentNode.insertBefore(wrap, gridUl.nextSibling);
      } else {
        var grid = ThemeAdapter.findProductGrid();
        if (grid) {
          grid.appendChild(wrap);
        }
      }
      sentinelEl = wrap;
      return sentinelEl;
    }

    function showLoader(show) {
      if (!sentinelEl) return;
      var loader = sentinelEl.querySelector("[data-ff-infinite-loader]");
      if (loader) {
        loader.style.display = show ? "flex" : "none";
      }
    }

    function showEndMessage(show) {
      if (!sentinelEl) return;
      var end = sentinelEl.querySelector("[data-ff-infinite-end]");
      if (end) {
        end.style.display = show ? "inline-block" : "none";
      }
    }

    function loadNextPage() {
      if (isLoading || currentPage >= totalPages) {
        return;
      }
      isLoading = true;
      showLoader(true);
      showEndMessage(false);

      scrollGeneration++;
      var myGen = scrollGeneration;
      if (activeScrollController) {
        activeScrollController.abort();
      }
      activeScrollController = new AbortController();

      var nextPg = currentPage + 1;
      var nextUrl = new URL(window.location.href);
      nextUrl.searchParams.set("page", String(nextPg));

      var secId = sectionId || ThemeAdapter.resolveSectionId();
      if (!secId) {
        isLoading = false;
        showLoader(false);
        return;
      }

      SectionFetcher.fetchSection(nextUrl.toString(), secId, activeScrollController.signal)
        .then(function (sectionHtml) {
          if (myGen !== scrollGeneration) {
            // Discard superseded/stale page load
            return;
          }
          var doc;
          try {
            doc = new DOMParser().parseFromString(sectionHtml, "text/html");
          } catch (e) {
            log("Failed to parse section HTML for infinite scroll", e);
            return;
          }

          var newItems = doc.querySelectorAll(
            "#product-grid > li, ul.product-grid > li, [data-ff-grid] > li, .grid--collection > li"
          );
          var liveGridUl = document.querySelector("#product-grid, ul.product-grid");
          if (!liveGridUl) {
            var liveContainer = ThemeAdapter.findProductGrid();
            liveGridUl = liveContainer ? liveContainer.querySelector("ul") : null;
          }

          if (liveGridUl && newItems.length > 0) {
            newItems.forEach(function (item) {
              item.classList.remove("scroll-trigger");
              item.style.opacity = "1";
              item.style.transform = "none";
              liveGridUl.appendChild(item);
            });
            currentPage = nextPg;
            window.history.replaceState({}, "", nextUrl.toString());
          }

          if (currentPage >= totalPages || newItems.length === 0) {
            showLoader(false);
            if (totalPages > 1) {
              showEndMessage(true);
            }
            if (observer && sentinelEl) {
              observer.unobserve(sentinelEl);
            }
          }
        })
        .catch(function (err) {
          if (err && err.name === "AbortError") {
            return;
          }
          log("Infinite scroll fetch error", err);
        })
        .finally(function () {
          if (myGen === scrollGeneration) {
            isLoading = false;
            showLoader(false);
          }
        });
    }

    function setupObserver() {
      if (observer) {
        observer.disconnect();
      }
      var sentinel = createOrGetSentinel();
      if (!sentinel) return;

      if (!window.IntersectionObserver) {
        return;
      }

      observer = new IntersectionObserver(
        function (entries) {
          entries.forEach(function (entry) {
            if (entry.isIntersecting && !isLoading && currentPage < totalPages) {
              loadNextPage();
            }
          });
        },
        { root: null, rootMargin: "400px 0px", threshold: 0.05 }
      );

      observer.observe(sentinel);
    }

    return {
      init: function (secId) {
        sectionId = secId;
        var pageParam = URLState.current().searchParams.get("page");
        currentPage = pageParam ? parseInt(pageParam, 10) || 1 : 1;
        totalPages = parseTotalPages(document);
        showEndMessage(false);
        showLoader(false);
        setupObserver();
      },

      reset: function (newDoc) {
        scrollGeneration++;
        if (activeScrollController) {
          activeScrollController.abort();
          activeScrollController = null;
        }
        isLoading = false;
        var pageParam = URLState.current().searchParams.get("page");
        currentPage = pageParam ? parseInt(pageParam, 10) || 1 : 1;
        totalPages = parseTotalPages(newDoc || document);
        showEndMessage(false);
        showLoader(false);
        setupObserver();
      },

      disable: function () {
        if (observer && sentinelEl) {
          observer.unobserve(sentinelEl);
        }
        if (sentinelEl) {
          sentinelEl.style.display = "none";
        }
      },

      enable: function () {
        if (sentinelEl) {
          sentinelEl.style.display = "";
        }
        setupObserver();
      },
    };
  })();

  function updateTriggerBadge(url) {
    var activeFilters = URLState.readActiveFilters(url || URLState.current());
    var count = activeFilters.length;
    var badges = document.querySelectorAll("[data-ff-trigger-badge]");
    badges.forEach(function (badge) {
      if (count > 0) {
        badge.textContent = count;
        badge.style.display = "inline-flex";
      } else {
        badge.textContent = "0";
        badge.style.display = "none";
      }
    });
  }

  // ---------------------------------------------------------------------
  // ActiveFilterManager
  // ---------------------------------------------------------------------
  var ActiveFilterManager = {
    render: function (url) {
      updateTriggerBadge(url);
      if (!config.showActive) {
        return;
      }
      ActiveFilterManager.syncCount(url);
    },

    syncCount: function (url) {
      void url;
    },
  };

  // ---------------------------------------------------------------------
  // LatestRequestGuard — cancels prior request, ensures only latest renders
  // ---------------------------------------------------------------------
  var RequestGuard = (function () {
    var activeController = null;
    var currentRequestId = 0;

    return {
      next: function () {
        if (activeController) {
          activeController.abort();
        }
        activeController = new AbortController();
        currentRequestId++;
        return {
          id: currentRequestId,
          signal: activeController.signal,
        };
      },
      isLatest: function (id) {
        return id === currentRequestId;
      },
      abort: function () {
        if (activeController) {
          activeController.abort();
        }
        activeController = null;
      },
    };
  })();

  var controllerState = {
    loading: false,
  };

  function buildFilterUrlFromForm(form) {
    var url = new URL(window.location.origin + config.baseUrl);
    url.search = "";

    var params = new URLSearchParams();
    var inputs = form.querySelectorAll("input[name]");
    Array.prototype.forEach.call(inputs, function (input) {
      if ((input.type === "checkbox" || input.type === "radio") && !input.checked) {
        return;
      }
      if (input.value !== "" && input.value !== undefined) {
        params.append(input.name, input.value);
      }
    });

    url.search = params.toString();
    return url;
  }

  function applyFilterChange(nextUrl, sectionId, skipPush) {
    // Without a resolvable section id we cannot perform a targeted AJAX swap;
    // degrade gracefully to a normal navigation so filtering still works.
    if (!sectionId) {
      window.location.href = nextUrl.toString();
      return;
    }

    var req = RequestGuard.next();
    controllerState.loading = true;
    setLoading(true);

    // Update URL + history immediately so the URL is the primary state and
    // back/forward work. Do not push on popstate.
    if (!skipPush) {
      window.history.pushState({}, "", nextUrl.toString());
    }

    SectionFetcher.fetchSection(nextUrl.toString(), sectionId, req.signal)
      .then(function (html) {
        if (req.signal.aborted || !RequestGuard.isLatest(req.id)) {
          return; // superseded by a newer request
        }
        var replaced = ThemeAdapter.replaceResults(html);
        if (!replaced) {
          // Could not find a replaceable region — fall back to full navigation.
          window.location.href = nextUrl.toString();
          return;
        }
        ActiveFilterManager.render(nextUrl);
        updateFormCheckboxes();
      })
      .catch(function (err) {
        if (req.signal.aborted || !RequestGuard.isLatest(req.id)) {
          return; // abort is expected, not an error
        }
        log("Section fetch failed", err);
        // Fail gracefully: do not blank the grid. Leave existing products.
        // Optionally fall back to full navigation for a degraded experience.
        window.location.href = nextUrl.toString();
      })
      .finally(function () {
        if (RequestGuard.isLatest(req.id)) {
          setLoading(false);
          controllerState.loading = false;
        }
      });
  }

  function setLoading(busy) {
    // Mark the live results section busy for a11y/CSS. Prefer the grid's own
    // #shopify-section wrapper; fall back to legacy ids.
    var target = null;
    var grid = ThemeAdapter.findProductGrid();
    if (grid) {
      target = (grid.closest && grid.closest("[id^='shopify-section-']")) || grid;
    }
    if (!target) {
      target = document.getElementById("main-collection") || document.getElementById("main-search");
    }
    if (target) {
      target.setAttribute("aria-busy", busy ? "true" : "false");
      target.classList.toggle("ff-block--loading", busy);
    }
  }

  function updateFormCheckboxes() {
    // The grid swap leaves the Fresheek block's own DOM intact, so on
    // back/forward (popstate) the inputs must be re-synced from the URL — the
    // single source of truth. Sync every option input (desktop sidebar + mobile
    // drawer), not just the drawer.
    var current = URLState.current();
    var activeSet = URLState.readActiveFilters(current);

    document.querySelectorAll("[data-ff-option]").forEach(function (input) {
      if (input.type !== "checkbox" && input.type !== "radio") {
        return;
      }
      var matched = activeSet.some(function (a) {
        return a.param === input.getAttribute("name") && a.value === input.value;
      });
      input.checked = matched;
    });

    // Keep all price inputs in sync with the URL too (important on popstate).
    var priceWidgets = document.querySelectorAll("[data-ff-price]");
    priceWidgets.forEach(function (priceWidget) {
      var minParam = priceWidget.getAttribute("data-ff-min-param");
      var maxParam = priceWidget.getAttribute("data-ff-max-param");
      var minInput = priceWidget.querySelector("[data-ff-price-min]");
      var maxInput = priceWidget.querySelector("[data-ff-price-max]");
      if (minInput && minParam) {
        minInput.value = current.searchParams.get(minParam) || "";
      }
      if (maxInput && maxParam) {
        maxInput.value = current.searchParams.get(maxParam) || "";
      }
    });

    // Sync dual slider thumbs and highlights
    if (typeof PriceSliderManager !== "undefined") {
      PriceSliderManager.syncAllWithInputs();
    }

    // Toggle option active styling.
    document.querySelectorAll(".ff-option").forEach(function (label) {
      var input = label.querySelector(".ff-checkbox");
      if (input) {
        label.classList.toggle("ff-option--active", input.checked);
      }
    });

    updateTriggerBadge(current);
  }

  // ---------------------------------------------------------------------
  // StorefrontConfigManager — hydrates merchant Admin config into storefront
  // ---------------------------------------------------------------------
  var StorefrontConfigManager = {
    hydrate: function () {
      if (!config.shop) {
        return;
      }
      var storageKey = "ff_config_" + config.shop;
      var cached = null;
      try {
        var raw = sessionStorage.getItem(storageKey);
        if (raw) {
          cached = JSON.parse(raw);
        }
      } catch (e) {
        // ignore storage errors
      }

      if (cached && cached.timestamp && Date.now() - cached.timestamp < 300000) {
        StorefrontConfigManager.apply(cached.data);
        return;
      }

      var endpoints = [
        "/apps/fresheek-filters/config?shop=" + encodeURIComponent(config.shop),
        "/api/config?shop=" + encodeURIComponent(config.shop),
      ];

      function tryFetch(idx) {
        if (idx >= endpoints.length) {
          return;
        }
        var controller = new AbortController();
        var timeoutId = setTimeout(function () {
          controller.abort();
        }, 4000);

        fetch(endpoints[idx], {
          signal: controller.signal,
          headers: { Accept: "application/json" },
        })
          .then(function (res) {
            clearTimeout(timeoutId);
            if (!res.ok) {
              throw new Error("HTTP " + res.status);
            }
            return res.json();
          })
          .then(function (data) {
            if (data && (data.filters || data.appearance || data.settings)) {
              try {
                sessionStorage.setItem(
                  storageKey,
                  JSON.stringify({ timestamp: Date.now(), data: data })
                );
              } catch (e2) {}
              StorefrontConfigManager.apply(data);
            }
          })
          .catch(function () {
            clearTimeout(timeoutId);
            tryFetch(idx + 1);
          });
      }

      tryFetch(0);
    },

    apply: function (data) {
      if (!data) {
        return;
      }

      // 1. Appearance custom properties
      if (data.appearance) {
        var a = data.appearance;
        var targets = [root, document.documentElement];
        targets.forEach(function (target) {
          if (!target) return;
          if (a.accentColor) target.style.setProperty("--ff-accent", a.accentColor);
          if (a.sidebarWidth) {
            var widthVal = typeof a.sidebarWidth === "number" ? a.sidebarWidth + "px" : a.sidebarWidth;
            target.style.setProperty("--ff-sidebar-width", widthVal);
          }
          if (a.panelBackground) target.style.setProperty("--ff-panel-bg", a.panelBackground);
          if (a.textColor) target.style.setProperty("--ff-text", a.textColor);
          if (a.mutedTextColor) target.style.setProperty("--ff-muted", a.mutedTextColor);
          if (a.borderColor) target.style.setProperty("--ff-border", a.borderColor);
          if (a.checkboxRadius) target.style.setProperty("--ff-checkbox-radius", a.checkboxRadius);
          if (a.checkboxSize) target.style.setProperty("--ff-checkbox-size", a.checkboxSize);
          if (a.headingSize) target.style.setProperty("--ff-heading-size", a.headingSize);
          if (a.optionFontSize) target.style.setProperty("--ff-option-font-size", a.optionFontSize);
        });
      }

      // 2. Application & Mobile Settings
      if (data.settings) {
        var s = data.settings;

        if (s.productGridSelector) {
          root.setAttribute("data-ff-grid-selector", s.productGridSelector);
        }

        // Pagination mode (infinite vs pagination)
        if (s.paginationMode) {
          var isInfinite = s.paginationMode === "infinite";
          var paginations = document.querySelectorAll(".pagination-wrapper, nav.pagination, .pagination");
          paginations.forEach(function (p) {
            p.style.setProperty("display", isInfinite ? "none" : "block", "important");
          });
          if (typeof InfiniteScrollManager !== "undefined") {
            if (isInfinite) {
              InfiniteScrollManager.enable();
            } else {
              InfiniteScrollManager.disable();
            }
          }
        }

        // Mobile drawer position (right vs left)
        if (s.mobileDrawerPosition) {
          var drawerPanels = document.querySelectorAll(".ff-drawer-panel");
          drawerPanels.forEach(function (p) {
            p.classList.toggle("ff-drawer-panel--left", s.mobileDrawerPosition === "left");
          });
        }

        // Mobile trigger text
        if (s.mobileTriggerText) {
          var triggers = document.querySelectorAll("[data-ff-filter-trigger]");
          triggers.forEach(function (btn) {
            for (var i = 0; i < btn.childNodes.length; i++) {
              var n = btn.childNodes[i];
              if (n.nodeType === 3 && n.textContent.trim().length > 0) {
                n.textContent = " " + s.mobileTriggerText + " ";
                break;
              }
            }
          });
        }

        // Mobile button variant (outline vs solid)
        if (s.mobileButtonVariant) {
          var triggers = document.querySelectorAll("[data-ff-filter-trigger]");
          triggers.forEach(function (btn) {
            btn.classList.toggle("ff-filter-trigger--solid", s.mobileButtonVariant === "solid");
          });
        }

        // Mobile product count visibility
        if (s.mobileShowProductCount !== undefined) {
          var counts = document.querySelectorAll(".ff-mobile-product-count");
          counts.forEach(function (c) {
            c.style.display = s.mobileShowProductCount ? "" : "none";
          });
        }

        // Active filters visibility
        if (s.showActiveFilters === false) {
          var actives = document.querySelectorAll("[data-ff-active-filters]");
          actives.forEach(function (act) {
            act.style.display = "none";
          });
        }
      }

      // 3. Filter group configurations (custom labels, enabled/disabled, visible counts, reordering)
      if (Array.isArray(data.filters) && data.filters.length > 0) {
        var groups = root.querySelectorAll("[data-ff-group]");
        var filterMap = Object.create(null);
        data.filters.forEach(function (f) {
          filterMap[f.sourceKey] = f;
        });

        groups.forEach(function (group) {
          var param = group.getAttribute("data-ff-param");
          var cfg = filterMap[param];
          if (!cfg) {
            return;
          }

          // Enabled toggle
          if (cfg.enabled === false) {
            group.style.display = "none";
            return;
          } else {
            group.style.display = "";
          }

          // Custom label (e.g. rename Vendor -> Brand)
          if (cfg.label) {
            var labelEl = group.querySelector(".ff-group-label");
            if (labelEl) {
              labelEl.textContent = cfg.label;
            }
          }

          // Visible options limit
          if (typeof cfg.initialVisibleCount === "number" && cfg.initialVisibleCount > 0) {
            var list = group.querySelector("[data-ff-option-list]");
            if (list) {
              list.setAttribute("data-ff-limit", String(cfg.initialVisibleCount));
            }
          }
        });

        // Reorder filter groups in DOM
        var sortedFilters = data.filters.slice().sort(function (a, b) {
          return (a.position || 0) - (b.position || 0);
        });
        var groupLists = document.querySelectorAll("[data-ff-group-list], .ff-group-list");
        groupLists.forEach(function (gList) {
          sortedFilters.forEach(function (f) {
            var el = gList.querySelector('[data-ff-param="' + f.sourceKey + '"]');
            if (el) {
              gList.appendChild(el);
            }
          });
        });
      }
    },
  };

  // ---------------------------------------------------------------------
  // PriceSliderManager — handles dual-handle price range slider
  // ---------------------------------------------------------------------
  var PriceSliderManager = (function () {
    function updateHighlight(widget) {
      var minSlider = widget.querySelector("[data-ff-slider-min]");
      var maxSlider = widget.querySelector("[data-ff-slider-max]");
      var highlight = widget.querySelector("[data-ff-slider-highlight]");
      if (!minSlider || !maxSlider || !highlight) {
        return;
      }
      var minRange = Number(minSlider.min) || 0;
      var maxRange = Number(minSlider.max) || 100;
      var span = maxRange - minRange;
      if (span <= 0) {
        return;
      }
      var minVal = Number(minSlider.value) || minRange;
      var maxVal = Number(maxSlider.value) || maxRange;
      var leftPct = Math.max(0, Math.min(100, ((minVal - minRange) / span) * 100));
      var rightPct = Math.max(0, Math.min(100, 100 - ((maxVal - minRange) / span) * 100));
      highlight.style.left = leftPct + "%";
      highlight.style.right = rightPct + "%";
    }

    function syncSlidersFromInputs(widget) {
      var minInput = widget.querySelector("[data-ff-price-min]");
      var maxInput = widget.querySelector("[data-ff-price-max]");
      var minSlider = widget.querySelector("[data-ff-slider-min]");
      var maxSlider = widget.querySelector("[data-ff-slider-max]");
      if (!minSlider || !maxSlider) {
        return;
      }
      var minRange = Number(minSlider.min) || 0;
      var maxRange = Number(minSlider.max) || 100;

      var minVal = minInput && minInput.value !== "" ? Number(minInput.value) : minRange;
      var maxVal = maxInput && maxInput.value !== "" ? Number(maxInput.value) : maxRange;

      if (isNaN(minVal) || minVal < minRange) minVal = minRange;
      if (isNaN(maxVal) || maxVal > maxRange) maxVal = maxRange;
      if (minVal > maxVal) minVal = maxVal;

      minSlider.value = minVal;
      maxSlider.value = maxVal;
      updateHighlight(widget);
    }

    function initWidget(widget, onSliderCommit) {
      var minSlider = widget.querySelector("[data-ff-slider-min]");
      var maxSlider = widget.querySelector("[data-ff-slider-max]");
      var minInput = widget.querySelector("[data-ff-price-min]");
      var maxInput = widget.querySelector("[data-ff-price-max]");
      if (!minSlider || !maxSlider) {
        return;
      }

      updateHighlight(widget);

      minSlider.addEventListener("input", function () {
        if (Number(minSlider.value) > Number(maxSlider.value)) {
          minSlider.value = maxSlider.value;
        }
        if (minInput) {
          minInput.value = minSlider.value;
        }
        updateHighlight(widget);
      });

      maxSlider.addEventListener("input", function () {
        if (Number(maxSlider.value) < Number(minSlider.value)) {
          maxSlider.value = minSlider.value;
        }
        if (maxInput) {
          maxInput.value = maxSlider.value;
        }
        updateHighlight(widget);
      });

      if (typeof onSliderCommit === "function") {
        minSlider.addEventListener("change", function () {
          onSliderCommit(widget);
        });
        maxSlider.addEventListener("change", function () {
          onSliderCommit(widget);
        });
      }

      if (minInput) {
        minInput.addEventListener("input", function () {
          var val = Number(minInput.value);
          if (!isNaN(val)) {
            var minRange = Number(minSlider.min) || 0;
            minSlider.value = Math.min(Math.max(val, minRange), Number(maxSlider.value));
            updateHighlight(widget);
          }
        });
      }

      if (maxInput) {
        maxInput.addEventListener("input", function () {
          var val = Number(maxInput.value);
          if (!isNaN(val)) {
            var maxRange = Number(maxSlider.max) || 100;
            maxSlider.value = Math.max(Math.min(val, maxRange), Number(minSlider.value));
            updateHighlight(widget);
          }
        });
      }
    }

    return {
      initAll: function (onSliderCommit) {
        var widgets = document.querySelectorAll("[data-ff-price]");
        widgets.forEach(function (widget) {
          initWidget(widget, onSliderCommit);
        });
      },
      syncAllWithInputs: function () {
        var widgets = document.querySelectorAll("[data-ff-price]");
        widgets.forEach(function (widget) {
          syncSlidersFromInputs(widget);
        });
      },
    };
  })();

  // ---------------------------------------------------------------------
  // Initialization + event delegation
  // ---------------------------------------------------------------------
  function init() {
    var form = root.querySelector("[data-ff-form]");
    if (!form) {
      return;
    }

    // Resolve the results section id/key from the live DOM (theme-agnostic).
    var finalSectionId = ThemeAdapter.resolveSectionId();
    if (!finalSectionId) {
      log("Could not resolve a results section id; filters will use full-page navigation.");
    }

    applySticky();

    // ---- Central delegated listener on the root ----
    root.addEventListener("change", function (event) {
      var target = event.target;
      if (!target || !target.classList) {
        return;
      }

      // Checkbox / radio option
      if (target.dataset && target.dataset.ffOption !== undefined) {
        var param = target.getAttribute("name");
        var value = target.value;
        var checked = target.checked;
        var next = URLState.toggleFilter(URLState.current(), param, value, checked);
        applyFilterChange(next, finalSectionId);
      }
    });

    root.addEventListener("keydown", function (event) {
      if (event.key === "Enter") {
        var target = event.target;
        if (target && target.classList && target.classList.contains("ff-price-input")) {
          event.preventDefault();
          var widget = target.closest("[data-ff-price]");
          handlePriceApply(finalSectionId, widget);
        }
      }
    });

    root.addEventListener("click", function (event) {
      var target = event.target;

      if (target.closest) {
        // Active filter chip remove
        var chipRemove = target.closest("[data-ff-chip-remove]");
        if (chipRemove) {
          event.preventDefault();
          var href = chipRemove.getAttribute("href");
          if (href) {
            var next = new URL(href, window.location.origin);
            applyFilterChange(next, finalSectionId);
          }
          return;
        }

        // Price apply button
        var priceApply = target.closest("[data-ff-price-apply]");
        if (priceApply) {
          var widget = priceApply.closest("[data-ff-price]");
          handlePriceApply(finalSectionId, widget);
          return;
        }

        // Show more / show less
        if (target.closest("[data-ff-show-more]")) {
          controlShowMore(target.closest("[data-ff-group]"), true);
          return;
        }
        if (target.closest("[data-ff-show-less]")) {
          controlShowMore(target.closest("[data-ff-group]"), false);
          return;
        }

        // Group toggle (collapse/expand)
        if (target.closest("[data-ff-group-toggle]")) {
          var toggle = target.closest("[data-ff-group-toggle]");
          toggleGroup(toggle);
          return;
        }

        // Clear all
        if (target.closest("[data-ff-clear-all]")) {
          event.preventDefault();
          var next = URLState.clearAll(URLState.current());
          applyFilterChange(next, finalSectionId);
          return;
        }

        // Mobile drawer open/close
        if (target.closest("[data-ff-filter-trigger]")) {
          MobileDrawer.open();
          return;
        }
        if (target.closest("[data-ff-drawer-close]") || target.closest("[data-ff-drawer-overlay]")) {
          MobileDrawer.close();
          return;
        }
        if (target.closest("[data-ff-drawer-view]")) {
          MobileDrawer.close();
          var grid = ThemeAdapter.findProductGrid();
          if (grid && grid.scrollIntoView) {
            grid.scrollIntoView({ behavior: "smooth", block: "start" });
          }
          return;
        }
      }
    });

    // Option search (local filtering, no network)
    root.addEventListener("input", function (event) {
      var target = event.target;
      if (target.classList && target.classList.contains("ff-search-input")) {
        handleSearch(target);
      }
    });

    // Browser back/forward — restore filter state from URL.
    window.addEventListener("popstate", function () {
      restoreFromUrl(finalSectionId);
    });

    // Initialize dual-handle price sliders
    PriceSliderManager.initAll(function (widget) {
      handlePriceApply(finalSectionId, widget);
    });

    // Sync initial active state.
    updateFormCheckboxes();

    // Wire mobile drawer + trigger visibility.
    MobileDrawer.init();

    // Initialize infinite scrolling for seamless product loading
    InfiniteScrollManager.init(finalSectionId);

    // Hydrate dynamic merchant settings if available from app backend.
    StorefrontConfigManager.hydrate();
  }

  function handlePriceApply(sectionId, optWidget) {
    var priceWidget = optWidget || root.querySelector("[data-ff-price]");
    if (!priceWidget) {
      return;
    }
    var minInput = priceWidget.querySelector("[data-ff-price-min]");
    var maxInput = priceWidget.querySelector("[data-ff-price-max]");
    var minParam = priceWidget.getAttribute("data-ff-min-param");
    var maxParam = priceWidget.getAttribute("data-ff-max-param");

    var minVal = minInput ? minInput.value.trim() : "";
    var maxVal = maxInput ? maxInput.value.trim() : "";

    // Validation
    var minNum = minVal === "" ? null : Number(minVal);
    var maxNum = maxVal === "" ? null : Number(maxVal);
    if (minNum !== null && (isNaN(minNum) || minNum < 0)) {
      return;
    }
    if (maxNum !== null && (isNaN(maxNum) || maxNum < 0)) {
      return;
    }
    if (minNum !== null && maxNum !== null && minNum > maxNum) {
      return;
    }

    var next = URLState.setPrice(
      URLState.current(),
      minParam,
      minNum === null ? "" : String(minNum),
      maxParam,
      maxNum === null ? "" : String(maxNum)
    );
    applyFilterChange(next, sectionId);
  }

  function controlShowMore(group, expand) {
    if (!group) {
      return;
    }
    var list = group.querySelector("[data-ff-option-list]");
    var moreBtn = group.querySelector("[data-ff-show-more]");
    var lessBtn = group.querySelector("[data-ff-show-less]");
    if (!list) {
      return;
    }
    list.classList.toggle("ff-option-list--expanded", expand);
    if (moreBtn) {
      moreBtn.hidden = expand;
    }
    if (lessBtn) {
      lessBtn.hidden = !expand;
    }
  }

  function toggleGroup(toggle) {
    var expanded = toggle.getAttribute("aria-expanded") !== "true";
    toggle.setAttribute("aria-expanded", expanded ? "true" : "false");
    var body = toggle.parentElement ? toggle.parentElement.nextElementSibling : null;
    if (body && body.hasAttribute("data-ff-group-body")) {
      body.hidden = !expanded;
    }
  }

  function handleSearch(input) {
    var group = input.closest("[data-ff-group]");
    if (!group) {
      return;
    }
    var query = input.value.trim().toLowerCase();
    var rows = group.querySelectorAll("[data-ff-option-row], .ff-option");
    var noMatch = group.querySelector("[data-ff-no-match]");
    var list = group.querySelector("[data-ff-option-list]");
    var hasMatch = false;

    rows.forEach(function (row) {
      var label = row.textContent || "";
      var match = query === "" || label.toLowerCase().indexOf(query) !== -1;
      if (match) {
        hasMatch = true;
      }
      row.style.display = match ? "" : "none";
    });

    if (noMatch) {
      noMatch.hidden = hasMatch || query === "";
    }
    if (list) {
      // While searching, show all matches regardless of limit; when query
      // clears, restore overflow behaviour.
      list.classList.toggle("ff-option-list--expanded", query !== "");
    }
  }

  function restoreFromUrl(sectionId) {
    var next = URLState.current();
    applyFilterChange(next, sectionId, true);
  }

  function applySticky() {
    var sidebar = root.querySelector("[data-ff-sidebar]");
    if (sidebar && config.sticky) {
      sidebar.classList.add("ff-sidebar--sticky");
    }
  }

  // ---------------------------------------------------------------------
  // MobileDrawer
  // ---------------------------------------------------------------------
  var MobileDrawer = (function () {
    var drawer = null;
    var trigger = null;
    var lastFocused = null;
    var focusableSelector =
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])';

    function getElements() {
      if (!drawer) {
        drawer = root.querySelector("[data-ff-drawer]");
      }
      if (!trigger) {
        trigger = root.querySelector("[data-ff-filter-trigger]");
      }
    }

    function onKeydown(e) {
      if (e.key === "Escape") {
        close();
        return;
      }
      if (e.key !== "Tab") {
        return;
      }
      // Focus trap. querySelectorAll returns a NodeList (no Array methods),
      // so materialize it to a real array before filtering.
      var focusables = Array.prototype.slice
        .call(drawer.querySelectorAll(focusableSelector))
        .filter(function (el) {
          return !el.disabled && el.offsetParent !== null;
        });
      if (focusables.length === 0) {
        return;
      }
      var first = focusables[0];
      var last = focusables[focusables.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    }

    return {
      init: function () {
        getElements();
        updateTriggerBadge();
        window.addEventListener(
          "resize",
          throttled(function () {
            getElements();
            if (window.innerWidth >= config.breakpoint) {
              close();
            }
          }, 200),
        );
      },

      open: function () {
        getElements();
        if (!drawer) {
          return;
        }
        lastFocused = document.activeElement;
        drawer.hidden = false;
        document.body.style.overflow = "hidden";
        drawer.addEventListener("keydown", onKeydown);
        requestAnimationFrame(function () {
          var closeBtn = drawer.querySelector("[data-ff-drawer-close]");
          if (closeBtn) {
            closeBtn.focus();
          }
        });
      },

      close: function () {
        getElements();
        if (!drawer) {
          return;
        }
        drawer.hidden = true;
        document.body.style.overflow = "";
        drawer.removeEventListener("keydown", onKeydown);
        if (lastFocused && lastFocused.focus) {
          lastFocused.focus();
        }
      },
    };
  })();

  function throttled(fn, wait) {
    var last = 0;
    var timer = null;
    return function () {
      var context = this;
      var args = arguments;
      var now = Date.now();
      var remaining = wait - (now - last);
      if (remaining <= 0) {
        // Leading edge: enough time has elapsed, run immediately.
        if (timer) {
          clearTimeout(timer);
          timer = null;
        }
        last = now;
        fn.apply(context, args);
      } else if (timer === null) {
        // Trailing edge: guarantee the final call within the window runs so
        // the last resize (the resting size) is always applied.
        timer = setTimeout(function () {
          last = Date.now();
          timer = null;
          fn.apply(context, args);
        }, remaining);
      }
    };
  }

  window.StorefrontConfigManager = StorefrontConfigManager;
  window.InfiniteScrollManager = InfiniteScrollManager;

  init();

  // Support Theme Editor live reloading & Turbo / SPA navigation
  document.addEventListener("shopify:section:load", function (e) {
    var newRoot = e.target && e.target.querySelector ? e.target.querySelector(ROOT_SELECTOR) : null;
    if (newRoot && newRoot.getAttribute("data-ff-initialized") !== "true") {
      newRoot.setAttribute("data-ff-initialized", "true");
      root = newRoot;
      init();
    }
  });

  document.addEventListener("turbo:load", function () {
    var freshRoot = document.querySelector(ROOT_SELECTOR);
    if (freshRoot && freshRoot.getAttribute("data-ff-initialized") !== "true") {
      freshRoot.setAttribute("data-ff-initialized", "true");
      root = freshRoot;
      init();
    }
  });
})();
