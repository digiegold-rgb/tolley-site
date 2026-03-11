/**
 * NARRPR → Tolley.io Bookmarklet
 *
 * Scrapes the NARRPR property detail page and POSTs to Tolley.io.
 * Loaded via bookmarklet: javascript:void(function(){...})
 */
(function () {
  "use strict";

  // Get token from script URL params
  var scripts = document.getElementsByTagName("script");
  var currentScript = scripts[scripts.length - 1];
  var params = new URLSearchParams(currentScript.src.split("?")[1] || "");
  var token = params.get("token") || "";
  var apiUrl = currentScript.src.split("/narrpr-bookmarklet")[0] + "/api/leads/narrpr/rich";

  // ── Create floating overlay ─────────────────────────────────
  var overlay = document.createElement("div");
  overlay.id = "tolley-narrpr-overlay";
  overlay.style.cssText =
    "position:fixed;top:20px;right:20px;z-index:999999;background:#1a1a2e;color:#fff;" +
    "border:1px solid rgba(255,165,0,0.3);border-radius:12px;padding:16px 20px;" +
    "font-family:-apple-system,BlinkMacSystemFont,sans-serif;font-size:13px;" +
    "box-shadow:0 8px 32px rgba(0,0,0,0.5);min-width:280px;max-width:400px;";
  overlay.innerHTML =
    '<div style="display:flex;align-items:center;gap:8px;margin-bottom:8px;">' +
    '<span style="font-size:16px;font-weight:bold;color:#fb923c;">NARRPR → Tolley.io</span>' +
    '<span id="tolley-status" style="font-size:11px;color:rgba(255,255,255,0.4);">Scraping...</span>' +
    "</div>" +
    '<div id="tolley-log" style="font-size:11px;color:rgba(255,255,255,0.5);line-height:1.6;"></div>';
  document.body.appendChild(overlay);

  var statusEl = document.getElementById("tolley-status");
  var logEl = document.getElementById("tolley-log");

  function log(msg) {
    if (logEl) logEl.innerHTML += msg + "<br>";
  }

  function setStatus(msg, color) {
    if (statusEl) {
      statusEl.textContent = msg;
      statusEl.style.color = color || "rgba(255,255,255,0.4)";
    }
  }

  // ── Scrape helper functions ─────────────────────────────────

  function getText(selector) {
    var el = document.querySelector(selector);
    return el ? el.textContent.trim() : "";
  }

  function getAll(selector) {
    return Array.from(document.querySelectorAll(selector));
  }

  function parseNumber(text) {
    if (!text) return null;
    var cleaned = text.replace(/[^0-9.-]/g, "");
    var num = parseFloat(cleaned);
    return isNaN(num) ? null : num;
  }

  // ── Scrape address ──────────────────────────────────────────

  var address = "";
  var city = "";
  var stateVal = "";
  var zip = "";

  // NARRPR address is typically in a prominent heading or address bar
  var addressEl =
    document.querySelector(".property-address, .address, [data-address], h1.address, .detail-address") ||
    document.querySelector("h1, h2");

  if (addressEl) {
    var fullAddr = addressEl.textContent.trim();
    // Try to parse "123 Main St, Kansas City, MO 64050"
    var parts = fullAddr.split(",").map(function (s) { return s.trim(); });
    if (parts.length >= 3) {
      address = parts[0];
      city = parts[1];
      var stateZip = parts[2].split(" ");
      stateVal = stateZip[0] || "";
      zip = stateZip[1] || "";
    } else if (parts.length === 2) {
      address = parts[0];
      var rest = parts[1].split(" ");
      city = rest.slice(0, -2).join(" ");
      stateVal = rest[rest.length - 2] || "";
      zip = rest[rest.length - 1] || "";
    } else {
      address = fullAddr;
    }
  }

  log("Address: " + address);

  // ── Scrape mortgage data ────────────────────────────────────

  var mortgages = [];
  var mortSection = document.querySelector(
    '.mortgage-section, [data-section="mortgage"], .deed-mortgage, #mortgage'
  );

  if (mortSection) {
    var rows = mortSection.querySelectorAll("tr, .mortgage-row, .record-row");
    rows.forEach(function (row) {
      var cells = row.querySelectorAll("td, .cell, span");
      if (cells.length >= 3) {
        var amount = parseNumber(cells[0]?.textContent);
        if (amount && amount > 1000) {
          mortgages.push({
            lender: (cells[2]?.textContent || "").trim(),
            amount: amount,
            type: (cells[1]?.textContent || "Conventional").trim(),
            date: (cells[3]?.textContent || new Date().toISOString().split("T")[0]).trim(),
          });
        }
      }
    });
  }

  // Fallback: scan page text for mortgage patterns
  if (mortgages.length === 0) {
    var pageText = document.body.innerText;
    var mortMatch = pageText.match(/(?:mortgage|loan)[\s\S]{0,200}\$[\d,]+/i);
    if (mortMatch) {
      var amtMatch = mortMatch[0].match(/\$([\d,]+)/);
      if (amtMatch) {
        var amt = parseNumber(amtMatch[1]);
        if (amt && amt > 10000) {
          mortgages.push({
            lender: "Unknown",
            amount: amt,
            type: "Conventional",
            date: new Date().toISOString().split("T")[0],
          });
        }
      }
    }
  }

  log("Mortgages: " + mortgages.length);

  // ── Scrape RVM ──────────────────────────────────────────────

  var rvm = null;
  var rvmEl = document.querySelector(
    '.rvm-value, [data-rvm], .realtors-valuation, .property-value-estimate'
  );

  if (rvmEl) {
    var rvmVal = parseNumber(rvmEl.textContent);
    if (rvmVal && rvmVal > 10000) {
      rvm = {
        value: rvmVal,
        confidence: 0.8,
        date: new Date().toISOString().split("T")[0],
      };
    }
  }

  // Fallback: look for "RVM" or "Realtors Valuation" in page
  if (!rvm) {
    var rvmMatch = document.body.innerText.match(
      /(?:RVM|Realtors\s+Valuation)[:\s]*\$?([\d,]+)/i
    );
    if (rvmMatch) {
      var v = parseNumber(rvmMatch[1]);
      if (v && v > 10000) {
        rvm = { value: v, confidence: 0.7, date: new Date().toISOString().split("T")[0] };
      }
    }
  }

  log("RVM: " + (rvm ? "$" + rvm.value.toLocaleString() : "none"));

  // ── Scrape Esri Tapestry ────────────────────────────────────

  var tapestry = null;
  var tapEl = document.querySelector(
    '.tapestry-section, [data-section="tapestry"], .esri-tapestry, .demographics-section'
  );

  if (tapEl) {
    var segEl = tapEl.querySelector(".segment-name, .tapestry-name, h3, h4, strong");
    if (segEl) {
      tapestry = {
        segment: segEl.textContent.trim(),
        segmentCode: "",
        lifeMode: "",
        urbanization: "",
      };
      // Try to find additional fields
      var tapText = tapEl.textContent;
      var codeMatch = tapText.match(/(\d+[A-Z])/);
      if (codeMatch) tapestry.segmentCode = codeMatch[1];
      var lifeMatch = tapText.match(/LifeMode[:\s]*([\w\s]+?)(?:\n|$)/i);
      if (lifeMatch) tapestry.lifeMode = lifeMatch[1].trim();
      var urbanMatch = tapText.match(/Urbanization[:\s]*([\w\s]+?)(?:\n|$)/i);
      if (urbanMatch) tapestry.urbanization = urbanMatch[1].trim();
    }
  }

  log("Tapestry: " + (tapestry ? tapestry.segment : "none"));

  // ── Scrape Distress / Foreclosure ───────────────────────────

  var distress = null;
  var distressEl = document.querySelector(
    '.distress-section, [data-section="distress"], .foreclosure-section, .nod-section'
  );

  if (distressEl) {
    var distText = distressEl.textContent;
    var nodMatch = distText.match(/(?:NOD|Notice of Default)[:\s]*([\d/\-]+)/i);
    var auctMatch = distText.match(/(?:Auction|Sale Date)[:\s]*([\d/\-]+)/i);
    if (nodMatch || auctMatch) {
      distress = {
        nodDate: nodMatch ? nodMatch[1] : undefined,
        auctionDate: auctMatch ? auctMatch[1] : undefined,
        status: nodMatch ? "pre_foreclosure" : "auction_scheduled",
      };
    }
  }

  log("Distress: " + (distress ? distress.status : "none"));

  // ── Scrape Deed Records ─────────────────────────────────────

  var deeds = [];
  var deedSection = document.querySelector(
    '.deed-section, [data-section="deed"], .deed-history, #deeds'
  );

  if (deedSection) {
    var deedRows = deedSection.querySelectorAll("tr, .deed-row");
    deedRows.forEach(function (row) {
      var cells = row.querySelectorAll("td, .cell");
      if (cells.length >= 4) {
        var date = (cells[0]?.textContent || "").trim();
        var price = parseNumber(cells[1]?.textContent);
        if (date && /\d/.test(date)) {
          deeds.push({
            date: date,
            price: price,
            grantor: (cells[2]?.textContent || "").trim(),
            grantee: (cells[3]?.textContent || "").trim(),
            type: (cells[4]?.textContent || "Warranty").trim(),
          });
        }
      }
    });
  }

  log("Deeds: " + deeds.length);

  // ── Build payload & POST ────────────────────────────────────

  if (!address) {
    setStatus("No address found!", "#f87171");
    log("Could not find property address on this page.");
    setTimeout(function () { overlay.remove(); }, 5000);
    return;
  }

  var payload = { address: address, city: city, state: stateVal, zip: zip };
  if (mortgages.length) payload.mortgages = mortgages;
  if (rvm) payload.rvm = rvm;
  if (tapestry) payload.tapestry = tapestry;
  if (distress) payload.distress = distress;
  if (deeds.length) payload.deeds = deeds;

  setStatus("Sending...", "#fbbf24");

  fetch(apiUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: "Bearer " + token,
    },
    body: JSON.stringify(payload),
  })
    .then(function (res) {
      return res.json().then(function (data) {
        if (res.ok && data.ok) {
          setStatus(data.status === "merged" ? "Merged!" : "Staged", "#4ade80");
          log(
            "Status: " + data.status +
            (data.dossierResultId ? " | Dossier: " + data.dossierResultId : "") +
            (data.listingId ? " | Listing: " + data.listingId : "")
          );
        } else {
          setStatus("Error", "#f87171");
          log(data.error || "Unknown error");
        }
      });
    })
    .catch(function (err) {
      setStatus("Failed", "#f87171");
      log("Network error: " + err.message);
    })
    .finally(function () {
      // Auto-dismiss after 8 seconds
      setTimeout(function () {
        overlay.style.transition = "opacity 0.5s";
        overlay.style.opacity = "0";
        setTimeout(function () { overlay.remove(); }, 500);
      }, 8000);
    });
})();
