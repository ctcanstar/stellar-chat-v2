(function () {
  "use strict";

  // ============================================================
  // CONFIGURATION
  // ============================================================
  var API_URL = "https://stellar-chat-v2.vercel.app/api/chat";

  // Prevent double-injection of the entire IIFE
  if (window.__stellarInjected) return;
  window.__stellarInjected = true;

  // URL helper
  function isComparePage() {
    return window.location.pathname.includes("/health-insurance/results/compare/");
  }

  // CSS is now in stellar.css (add separately in Optimizely experiment)

  // ============================================================
  // SPARKLE SVG PATHS (reused for button and header)
  // ============================================================
  var SPARKLE_PATHS =
    '<path d="M9.5 1 Q10 5 15.5 7 Q10 9 9.5 13 Q9 9 3.5 7 Q9 5 9.5 1Z"/>' +
    '<path d="M18.5 11 Q19 13.5 23 15 Q19 16.5 18.5 19 Q18 16.5 14 15 Q18 13.5 18.5 11Z"/>' +
    '<path d="M6 16.5 Q6.2 17.5 8 18.5 Q6.2 19.5 6 20.5 Q5.8 19.5 4 18.5 Q5.8 17.5 6 16.5Z"/>';

  // ============================================================
  // QUICK ACTIONS DATA
  // ============================================================
  var quickActions = [
    {
      label: "Best Value",
      query:
        "Which policy provides the overall best value considering premium cost vs coverage limits?",
    },
    {
      label: "Dental Cover",
      query:
        "Which policy provides the highest coverage limits for general dental and major dental?",
    },
    {
      label: "Optical Cover",
      query: "Which policy provides the highest optical coverage limit?",
    },
    {
      label: "Physio Cover",
      query:
        "Which policy provides the highest physiotherapy coverage limit?",
    },
    {
      label: "Chiro Cover",
      query:
        "Which policy provides the highest chiropractic coverage limit?",
    },
    {
      label: "Hospital Cover",
      query:
        "Which policy provides the best hospital cover? Compare the inclusions and exclusions.",
    },
    {
      label: "Best Offer",
      query:
        "Which policy has the best special offer right now? Compare the free weeks and conditions.",
    },
    {
      label: "Overall Extras",
      query:
        "Which policy provides the highest overall extras coverage limits across all categories?",
    },
  ];

  // ============================================================
  // HELP ME CHOOSE STEPS
  // ============================================================
  var helpSteps = [
    {
      question:
        "Is price your top priority, or are you willing to pay more for better coverage?",
      options: [
        { label: "💰 Price is most important", value: "price_priority" },
        { label: "⚖️ Balance of price & coverage", value: "balanced" },
        {
          label: "🛡️ Best coverage regardless of price",
          value: "coverage_priority",
        },
      ],
    },
    {
      question: "Which extras matter most to you? (select all that apply)",
      multiSelect: true,
      options: [
        { label: "🦷 General Dental", value: "general_dental" },
        { label: "🦷 Major Dental", value: "major_dental" },
        { label: "👓 Optical", value: "optical" },
        { label: "💪 Physiotherapy", value: "physio" },
        { label: "🦴 Chiropractic", value: "chiro" },
        { label: "🧠 Psychology", value: "psychology" },
      ],
    },
    {
      question: "How important is comprehensive hospital cover to you?",
      options: [
        { label: "Essential — I want the most inclusions", value: "essential" },
        { label: "Nice to have — basic cover is fine", value: "nice_to_have" },
        {
          label: "Not a priority — extras matter more",
          value: "not_priority",
        },
      ],
    },
    {
      question:
        "Are upfront savings (free weeks / waiver offers) important to your decision?",
      options: [
        {
          label: "Yes — I want the best sign-up deal",
          value: "offers_important",
        },
        {
          label: "Somewhat — but ongoing value matters more",
          value: "offers_somewhat",
        },
        {
          label: "No — I care more about the policy itself",
          value: "offers_not_important",
        },
      ],
    },
  ];

  // ============================================================
  // HELP ME CHOOSE SUMMARY BUILDER
  // ============================================================
  var budgetMap = {
    price_priority: "Price is my top priority",
    balanced: "I want a balance of price and coverage",
    coverage_priority: "I want the best coverage regardless of price",
  };
  var extrasMap = {
    general_dental: "General Dental",
    major_dental: "Major Dental",
    optical: "Optical",
    physio: "Physiotherapy",
    chiro: "Chiropractic",
    psychology: "Psychology",
  };
  var hospitalMap = {
    essential: "Comprehensive hospital cover is essential",
    nice_to_have: "Hospital cover is nice to have but not critical",
    not_priority:
      "Hospital cover is not my priority — extras matter more",
  };
  var offersMap = {
    offers_important: "Sign-up deals and free weeks are very important",
    offers_somewhat:
      "Sign-up deals matter somewhat but ongoing value matters more",
    offers_not_important:
      "I don't care about sign-up deals — the policy itself matters more",
  };

  function buildHelpSummary(answers) {
    var budget = budgetMap[answers[0]] || answers[0];
    var extras = Array.isArray(answers[1])
      ? answers[1].map(function (v) { return extrasMap[v] || v; }).join(", ")
      : "No specific extras selected";
    var hospital = hospitalMap[answers[2]] || answers[2];
    var offers = offersMap[answers[3]] || answers[3];

    return (
      "Based on my preferences, recommend the best policy for me. Here are my answers:\n\n" +
      "1. Budget priority: " + budget + "\n" +
      "2. Most important extras: " + extras + "\n" +
      "3. Hospital importance: " + hospital + "\n" +
      "4. Sign-up offers importance: " + offers + "\n\n" +
      "Please compare all 3 policies against my preferences and give me a clear recommendation with a comparison table showing how each policy scores for my priorities. End with a brief rationale"
    );
  }

  // ============================================================
  // SIMPLE MARKDOWN RENDERER
  // ============================================================
  function renderMarkdown(text) {
    if (!text) return "";
    // Escape HTML
    var s = text
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");

    // Inline formatting
    s = s.replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>");
    s = s.replace(/\*(.+?)\*/g, "<em>$1</em>");

    // Line-by-line list and block processing
    var lines = s.split("\n");
    var out = [];
    var inOl = false;
    var inUl = false;
    var inSubUl = false;

    for (var i = 0; i < lines.length; i++) {
      var line = lines[i];
      var olMatch = line.match(/^(\d+)\. (.+)/);
      var ulMatch = line.match(/^[-*] (.+)/);
      var subUlMatch = line.match(/^\s+[-*·•] (.+)/);
      var headerMatch = line.match(/^(#{1,3}) (.+)/);

      if (olMatch) {
        // Close sub-UL + parent LI if open
        if (inSubUl) { out.push("</ul></li>"); inSubUl = false; }
        else if (inOl) { /* previous li already closed */ }
        // Close UL if open
        if (inUl) { out.push("</ul>"); inUl = false; }
        // Open OL if not already open
        if (!inOl) { out.push("<ol>"); inOl = true; }
        // Leave <li> open so sub-bullets can nest inside
        out.push("<li>" + olMatch[2]);
      } else if (subUlMatch && (inOl || inUl)) {
        // Sub-bullet under an ordered/unordered list item
        if (!inSubUl) { out.push("<ul>"); inSubUl = true; }
        out.push("<li>" + subUlMatch[1] + "</li>");
      } else if (ulMatch && !inOl) {
        // Top-level unordered list (not inside an OL context)
        if (inSubUl) { out.push("</ul></li>"); inSubUl = false; }
        if (!inUl) { out.push("<ul>"); inUl = true; }
        // Leave <li> open for potential sub-bullets
        out.push("<li>" + ulMatch[1]);
      } else if (ulMatch && inOl) {
        // Bullet that looks top-level but we're in an OL — treat as sub-bullet
        if (!inSubUl) { out.push("<ul>"); inSubUl = true; }
        out.push("<li>" + ulMatch[1] + "</li>");
      } else {
        // Skip blank lines inside lists (Claude often inserts them between items)
        if (line.trim() === "" && (inOl || inUl)) { continue; }
        // Close any open lists (close nested sub-UL + parent LI first)
        if (inSubUl) { out.push("</ul></li>"); inSubUl = false; }
        else if (inOl || inUl) { out.push("</li>"); }
        if (inOl) { out.push("</ol>"); inOl = false; }
        if (inUl) { out.push("</ul>"); inUl = false; }

        if (headerMatch) {
          var level = headerMatch[1].length;
          var tag = level <= 2 ? "h3" : "h4";
          out.push("<" + tag + ">" + headerMatch[2] + "</" + tag + ">");
        } else if (line.trim() === "") {
          out.push("</p><p>");
        } else {
          out.push(line);
        }
      }
    }

    // Close any remaining open lists
    if (inSubUl) out.push("</ul></li>");
    else if (inOl || inUl) out.push("</li>");
    if (inOl) out.push("</ol>");
    if (inUl) out.push("</ul>");

    // Join lines — use <br> between non-block lines
    var html = "";
    for (var j = 0; j < out.length; j++) {
      var chunk = out[j];
      if (j > 0 && !isBlock(chunk) && !isBlock(out[j - 1])) {
        html += "<br>";
      }
      html += chunk;
    }

    // Wrap in paragraph
    html = "<p>" + html + "</p>";

    // Clean up empty paragraphs and paragraph wrapping around blocks
    html = html.replace(/<p>\s*<\/p>/g, "");
    html = html.replace(/<p>(<[huo])/g, "$1");
    html = html.replace(/(<\/[huo]l>)<\/p>/g, "$1");
    html = html.replace(/<br>(<[huo])/g, "$1");
    html = html.replace(/(<\/[huo]l>)<br>/g, "$1");
    html = html.replace(/<p><br>/g, "<p>");
    html = html.replace(/<br><\/p>/g, "</p>");

    return html;
  }

  function isBlock(s) {
    return /^<\/?[huo]|^<\/?li|^<\/?p|^<\/p>/.test(s);
  }

  // ============================================================
  // DOM SCRAPER
  // ============================================================
  function scrapeProductData() {
    try {
      var tables = document.querySelectorAll("table");
      if (tables.length < 3) return null;

      // Provider name mapping from logo filenames
      var providerMap = {
        nib: "nib",
        cpsh: "see-u by HBF",
        bupa: "Bupa",
        ahm: "ahm",
        medibank: "Medibank",
        hcf: "HCF",
        frank: "Frank Health Insurance",
      };

      // Find product cards / headers to get provider names and product names
      var providers = [];
      var productImgs = document.querySelectorAll('img[src*="small_"]');

      productImgs.forEach(function (img) {
        var src = img.getAttribute("src") || "";
        var match = src.match(/small_(\w+)_logo/);
        if (match) {
          var slug = match[1];
          var providerName = providerMap[slug] || slug;

          // Find product name - look for nearby text content
          var card = img.closest('[class*="flex"]');
          var productName = "";
          if (card) {
            var textEls = card.querySelectorAll('[class*="text-sm"], [class*="text-lg"], [class*="font-medium"]');
            textEls.forEach(function (el) {
              var t = el.textContent.trim();
              if (t.length > 10 && !t.includes("View") && !t.includes("Remove")) {
                productName = t;
              }
            });
          }

          providers.push({
            slug: slug,
            name: providerName,
            productName: productName || providerName + " Policy",
            premium: "",
            excess: "",
            specialOffer: { headline: "", conditions: "", expiry: "" },
            hospitalInclusions: [],
            hospitalExclusions: [],
            hospitalRestricted: [],
            extras: [],
          });
        }
      });

      if (providers.length === 0) return null;

      var productCount = providers.length;

      // Parse summary table (Table 0) — rows alternate between mobile headers and data
      var summaryTable = tables[0];
      if (summaryTable) {
        var rows = summaryTable.querySelectorAll("tr");
        rows.forEach(function (row) {
          var cells = row.querySelectorAll("th, td");
          if (cells.length < productCount + 1) return;

          var label = (cells[0].textContent || "").trim().toLowerCase();

          if (label.includes("monthly premium")) {
            for (var i = 0; i < productCount; i++) {
              var priceMatch = (cells[i + 1].textContent || "").match(
                /\$[\d,.]+/
              );
              if (priceMatch) providers[i].premium = priceMatch[0];
            }
          } else if (
            label.includes("excess") ||
            label.includes("admission")
          ) {
            for (var i = 0; i < productCount; i++) {
              var excessMatch = (cells[i + 1].textContent || "").match(
                /\$[\d,.]+/
              );
              if (excessMatch) providers[i].excess = excessMatch[0];
            }
          } else if (label.includes("special offer")) {
            for (var i = 0; i < productCount; i++) {
              var cell = cells[i + 1];
              var cellText = (cell.textContent || "").trim();
              // Try to extract structured offer data
              var children = cell.querySelectorAll("div, span, p, a");
              var parts = [];
              children.forEach(function (child) {
                var t = child.textContent.trim();
                if (t && t.length > 2) parts.push(t);
              });

              if (parts.length >= 2) {
                providers[i].specialOffer.headline = parts[0];
                // Find conditions (usually the longest text)
                var condParts = parts.filter(function (p) {
                  return (
                    !p.match(/^(T&Cs|Offer ends)/i) && p !== parts[0]
                  );
                });
                providers[i].specialOffer.conditions =
                  condParts.join(". ");
                // Find expiry
                var expiryPart = parts.find(function (p) {
                  return p.match(/Offer ends|expires/i);
                });
                if (expiryPart) {
                  providers[i].specialOffer.expiry = expiryPart.replace(
                    /Offer ends\s*/i,
                    ""
                  );
                }
              } else if (cellText) {
                providers[i].specialOffer.headline = cellText;
              }
            }
          }
        });
      }

      // Parse hospital cover table (Table 1)
      var hospitalTable = tables[1];
      if (hospitalTable) {
        var rows = hospitalTable.querySelectorAll("tr");
        rows.forEach(function (row) {
          var cells = row.querySelectorAll("th, td");
          if (cells.length < productCount + 1) return;

          var category = (cells[0].textContent || "").trim();
          // Skip empty or header-like rows
          if (!category || category.length < 3) return;

          for (var i = 0; i < productCount; i++) {
            var val = (cells[i + 1].textContent || "").trim().toLowerCase();
            if (val.includes("yes") || val === "included") {
              providers[i].hospitalInclusions.push(category);
            } else if (val.includes("restricted")) {
              providers[i].hospitalRestricted.push(category);
            } else if (val.includes("no") || val === "not included") {
              providers[i].hospitalExclusions.push(category);
            }
          }
        });
      }

      // Parse extras cover table (Table 2)
      var extrasTable = tables[2];
      if (extrasTable) {
        var rows = extrasTable.querySelectorAll("tr");
        rows.forEach(function (row) {
          var cells = row.querySelectorAll("th, td");
          if (cells.length < productCount + 1) return;

          var category = (cells[0].textContent || "").trim();
          if (!category || category.length < 3) return;

          for (var i = 0; i < productCount; i++) {
            var cell = cells[i + 1];
            var cellText = (cell.textContent || "").trim();

            // Extract dollar amount
            var amountMatch = cellText.match(/\$([\d,]+)/);
            if (!amountMatch) continue;

            var limit = "$" + amountMatch[1];

            // Check for "per policy" etc
            if (cellText.includes("per policy")) {
              limit += " per policy";
            } else if (cellText.includes("per person")) {
              limit += " per person";
            }

            // Check for combined limit text
            var combinedWith = [];
            var combinedEls = cell.querySelectorAll(
              'span, div, p, [class*="text"]'
            );
            combinedEls.forEach(function (el) {
              var t = (el.textContent || "").trim();
              var cMatch = t.match(/Combined limit for (.+)/i);
              if (cMatch) {
                combinedWith = cMatch[1]
                  .split(/,\s*|\s*&\s*/)
                  .map(function (s) { return s.trim(); })
                  .filter(function (s) { return s.length > 0; });
              }
            });

            providers[i].extras.push({
              name: category,
              limit: limit,
              combinedWith: combinedWith.length > 0 ? combinedWith : null,
            });
          }
        });
      }

      // Format as markdown
      var sections = providers.map(function (p) {
        var extrasStr = p.extras
          .map(function (e) {
            return (
              "  - " +
              e.name +
              ": " +
              e.limit +
              (e.combinedWith
                ? " (combined with " + e.combinedWith.join(", ") + ")"
                : "")
            );
          })
          .join("\n");

        var hospitalIncl =
          p.hospitalInclusions.length > 0
            ? p.hospitalInclusions.join(", ")
            : "None listed";
        var hospitalExcl =
          p.hospitalExclusions.length > 0
            ? p.hospitalExclusions.join(", ")
            : "None listed";
        var hospitalRestr =
          p.hospitalRestricted.length > 0
            ? "\n\nHospital restricted: " + p.hospitalRestricted.join(", ")
            : "";

        var offerStr = p.specialOffer.headline
          ? p.specialOffer.headline +
            (p.specialOffer.conditions
              ? " (" + p.specialOffer.conditions + ")"
              : "") +
            (p.specialOffer.expiry
              ? ". Expires " + p.specialOffer.expiry
              : "")
          : "No current offer";

        return (
          "### " + p.name + " — " + p.productName + "\n" +
          "- Monthly premium: " + (p.premium || "Not found") + "\n" +
          "- Excess per admission: " + (p.excess || "Not found") + "\n" +
          "- Special offer: " + offerStr + "\n\n" +
          "Hospital inclusions: " + hospitalIncl + "\n\n" +
          "Hospital exclusions: " + hospitalExcl +
          hospitalRestr + "\n\n" +
          "Extras coverage:\n" + (extrasStr || "  None listed")
        );
      });

      return sections.join("\n\n---\n\n");
    } catch (e) {
      console.error("[Stellar] Scraper error:", e);
      return null;
    }
  }

  // ============================================================
  // EXPAND COLLAPSED SECTIONS
  // ============================================================
  function expandAllSections() {
    return new Promise(function (resolve) {
      var buttons = document.querySelectorAll(
        'button[aria-expanded="false"]'
      );
      var clicked = false;
      buttons.forEach(function (btn) {
        var text = (btn.textContent || "").trim().toLowerCase();
        if (
          text.includes("cover") ||
          text.includes("detail") ||
          text.includes("hospital") ||
          text.includes("extras")
        ) {
          btn.click();
          clicked = true;
        }
      });
      if (clicked) {
        setTimeout(resolve, 500);
      } else {
        resolve();
      }
    });
  }

  // ============================================================
  // WAIT FOR TABLES TO LOAD (React SPA)
  // ============================================================
  function waitForTables(maxWait) {
    return new Promise(function (resolve) {
      var elapsed = 0;
      var interval = 500;

      function check() {
        var tables = document.querySelectorAll("table");
        if (tables.length >= 3) {
          resolve(true);
        } else if (elapsed >= maxWait) {
          resolve(false);
        } else {
          elapsed += interval;
          setTimeout(check, interval);
        }
      }
      check();
    });
  }

  // ============================================================
  // STELLAR CHAT WIDGET
  // ============================================================
  var nextMsgId = 0;

  function StellarChat() {
    this.isOpen = false;
    this.messages = [
      {
        id: "welcome",
        role: "assistant",
        content:
          "Hi! I'm **Stellar**, Canstar's comparison assistant. I can help you compare the policies on this page.\n\nTap a quick action below, or ask me anything about these policies!",
      },
    ];
    this.isLoading = false;
    this.helpActive = false;
    this.helpStep = 0;
    this.helpAnswers = {};
    this.showChipsOverride = false;
    this.productData = null;
    this.multiSelected = [];

    this.root = null;
    this.messagesEl = null;
    this.inputEl = null;
    this._scrollRAF = null;
    this._streamingBubble = null;

    // Smooth typing buffer
    this._pendingText = "";    // text received but not yet displayed
    this._displayedText = "";  // text currently rendered
    this._drainTimer = null;
    this._drainMsgId = null;
    this._drainRate = 2;       // characters per tick
    this._drainInterval = 16;  // ms between ticks (~60fps)
  }

  StellarChat.prototype.init = function (productData) {
    this.productData = productData;

    // Create root
    this.root = document.createElement("div");
    this.root.id = "stellar-chat-root";
    document.body.appendChild(this.root);

    this.renderButton();
  };

  StellarChat.prototype.renderButton = function () {
    this.root.innerHTML = "";

    if (this.isOpen) {
      this.renderPanel();
      return;
    }

    var btn = document.createElement("button");
    btn.className = "stlr-btn";
    btn.setAttribute("aria-label", "Open chat assistant");
    btn.innerHTML =
      '<svg viewBox="0 0 24 24" fill="white">' + SPARKLE_PATHS + "</svg>";
    var self = this;
    btn.onclick = function () {
      self.isOpen = true;
      self.renderButton();
    };
    this.root.appendChild(btn);
  };

  StellarChat.prototype.renderPanel = function () {
    this.root.innerHTML = "";
    var self = this;

    var panel = document.createElement("div");
    panel.className = "stlr-panel";

    // Header
    var header = document.createElement("div");
    header.className = "stlr-header";
    header.innerHTML =
      '<div class="stlr-header-left">' +
      '<div class="stlr-header-icon"><svg viewBox="0 0 24 24" fill="white">' +
      SPARKLE_PATHS +
      "</svg></div>" +
      "<div>" +
      '<div class="stlr-header-title">Stellar</div>' +
      '<div class="stlr-header-sub">Canstar\'s comparison assistant</div>' +
      "</div></div>";

    var closeBtn = document.createElement("button");
    closeBtn.className = "stlr-close";
    closeBtn.innerHTML =
      '<svg fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/></svg>';
    closeBtn.onclick = function () {
      self.isOpen = false;
      self.renderButton();
    };
    header.appendChild(closeBtn);
    panel.appendChild(header);

    // Messages area
    var messagesDiv = document.createElement("div");
    messagesDiv.className = "stlr-messages";
    this.messagesEl = messagesDiv;

    this.renderMessages(messagesDiv);
    panel.appendChild(messagesDiv);

    // Input area
    if (!this.productData) {
      var errorDiv = document.createElement("div");
      errorDiv.className = "stlr-error";
      errorDiv.textContent =
        "Could not read comparison data from this page. Please reload and try again.";
      panel.appendChild(errorDiv);
    } else {
      var inputArea = document.createElement("div");
      inputArea.className = "stlr-input-area";

      var form = document.createElement("form");
      form.className = "stlr-input-row";
      form.onsubmit = function (e) {
        e.preventDefault();
        var val = self.inputEl.value.trim();
        if (!val || self.isLoading || self.helpActive) return;
        self.sendMessage(val);
      };

      var input = document.createElement("input");
      input.type = "text";
      input.className = "stlr-input";
      input.placeholder = this.helpActive
        ? "Use the options above..."
        : "Ask about these policies...";
      input.disabled = this.isLoading || this.helpActive;
      this.inputEl = input;
      form.appendChild(input);

      var sendBtn = document.createElement("button");
      sendBtn.type = "submit";
      sendBtn.className = "stlr-send";
      sendBtn.textContent = "Send";
      sendBtn.disabled = this.isLoading || this.helpActive;
      form.appendChild(sendBtn);

      inputArea.appendChild(form);

      var disclaimer = document.createElement("p");
      disclaimer.className = "stlr-disclaimer";
      disclaimer.textContent = "Stellar is an AI tool. It can make mistakes.";
      inputArea.appendChild(disclaimer);

      panel.appendChild(inputArea);
    }

    this.root.appendChild(panel);

    // Focus input
    if (this.inputEl && !this.isLoading && !this.helpActive) {
      this.inputEl.focus();
    }

    this.scrollToBottom();
  };

  StellarChat.prototype.renderMessages = function (container) {
    var self = this;
    container.innerHTML = "";

    // Render all messages
    var lastIdx = this.messages.length - 1;
    this.messages.forEach(function (msg, idx) {
      var msgDiv = document.createElement("div");
      msgDiv.className = "stlr-msg stlr-msg-" + msg.role;

      var bubble = document.createElement("div");
      bubble.className = "stlr-bubble stlr-bubble-" + msg.role;

      if (msg.role === "user") {
        bubble.textContent = msg.content;
      } else {
        bubble.innerHTML = renderMarkdown(msg.content);
      }

      // Capture reference to streaming bubble for incremental updates
      if (self.isLoading && msg.role === "assistant" && idx === lastIdx) {
        self._streamingBubble = bubble;
        bubble.classList.add("stlr-streaming");
      }

      msgDiv.appendChild(bubble);
      container.appendChild(msgDiv);
    });

    // Loading dots
    if (
      this.isLoading &&
      this.messages.length > 0 &&
      this.messages[this.messages.length - 1].content === ""
    ) {
      var loadDiv = document.createElement("div");
      loadDiv.className = "stlr-loading";
      loadDiv.innerHTML =
        '<div class="stlr-loading-inner">' +
        '<span class="stlr-dot"></span>' +
        '<span class="stlr-dot"></span>' +
        '<span class="stlr-dot"></span>' +
        "</div>";
      container.appendChild(loadDiv);
    }

    // "Ask another question" link
    var lastMsg = this.messages[this.messages.length - 1];
    if (
      !this.isLoading &&
      !this.helpActive &&
      !this.showChipsOverride &&
      this.messages.length > 2 &&
      lastMsg &&
      lastMsg.role === "assistant"
    ) {
      var askAgain = document.createElement("div");
      askAgain.className = "stlr-ask-again";
      var askBtn = document.createElement("button");
      askBtn.textContent = "← Ask another question";
      askBtn.onclick = function () {
        self.showChipsOverride = true;
        self.renderMessages(self.messagesEl);
        self.scrollToBottom();
      };
      askAgain.appendChild(askBtn);
      container.appendChild(askAgain);
    }

    // Quick action chips
    var showChips =
      (this.messages.length <= 2 || this.showChipsOverride) &&
      !this.isLoading &&
      !this.helpActive;

    if (showChips) {
      var chipsDiv = document.createElement("div");
      chipsDiv.className = "stlr-chips";

      quickActions.forEach(function (action) {
        var chip = document.createElement("button");
        chip.className = "stlr-chip";
        chip.textContent = action.label;
        chip.disabled = self.isLoading;
        chip.onclick = function () {
          self.showChipsOverride = false;
          self.sendMessage(action.query);
        };
        chipsDiv.appendChild(chip);
      });

      // Help Me Choose chip
      var helpChip = document.createElement("button");
      helpChip.className = "stlr-chip stlr-chip-primary";
      helpChip.textContent = "✦ Help Me Choose";
      helpChip.disabled = self.isLoading;
      helpChip.onclick = function () {
        self.startHelpMeChoose();
      };
      chipsDiv.appendChild(helpChip);

      container.appendChild(chipsDiv);
    }

    // Help Me Choose step
    if (this.helpActive && !this.isLoading) {
      this.renderHelpStep(container);
    }
  };

  StellarChat.prototype.renderHelpStep = function (container) {
    var self = this;
    var step = helpSteps[this.helpStep];
    if (!step) return;

    var optionsDiv = document.createElement("div");
    optionsDiv.className = "stlr-help-options";

    if (step.multiSelect) {
      // Multi-select step
      step.options.forEach(function (opt) {
        var btn = document.createElement("button");
        btn.className = "stlr-help-opt";
        if (self.multiSelected.indexOf(opt.value) !== -1) {
          btn.className += " stlr-selected";
        }
        btn.textContent = opt.label;
        btn.onclick = function () {
          var idx = self.multiSelected.indexOf(opt.value);
          if (idx !== -1) {
            self.multiSelected.splice(idx, 1);
          } else {
            self.multiSelected.push(opt.value);
          }
          self.renderMessages(self.messagesEl);
          self.scrollToBottom();
        };
        optionsDiv.appendChild(btn);
      });

      if (this.multiSelected.length > 0) {
        var continueBtn = document.createElement("button");
        continueBtn.className = "stlr-help-continue";
        continueBtn.textContent =
          "Continue with " + this.multiSelected.length + " selected";
        continueBtn.onclick = function () {
          var selected = self.multiSelected.slice();
          self.multiSelected = [];
          self.handleHelpAnswer(selected);
        };
        optionsDiv.appendChild(continueBtn);
      }
    } else {
      // Single-select step
      step.options.forEach(function (opt) {
        var btn = document.createElement("button");
        btn.className = "stlr-help-opt";
        btn.textContent = opt.label;
        btn.onclick = function () {
          self.handleHelpAnswer(opt.value);
        };
        optionsDiv.appendChild(btn);
      });
    }

    container.appendChild(optionsDiv);
  };

  StellarChat.prototype.startHelpMeChoose = function () {
    this.showChipsOverride = false;
    this.helpActive = true;
    this.helpStep = 0;
    this.helpAnswers = {};
    this.multiSelected = [];

    this.messages.push({
      id: Date.now().toString(),
      role: "assistant",
      content:
        "Let me help you find the best policy! I'll ask you a few quick questions.\n\n**Question 1 of " +
        helpSteps.length +
        ":** " +
        helpSteps[0].question,
    });

    this.renderMessages(this.messagesEl);
    this.scrollToBottom();
  };

  StellarChat.prototype.handleHelpAnswer = function (answer) {
    var step = helpSteps[this.helpStep];
    this.helpAnswers[this.helpStep] = answer;

    // Show user's answer as a message
    var answerLabel;
    if (Array.isArray(answer)) {
      answerLabel = step.options
        .filter(function (o) { return answer.indexOf(o.value) !== -1; })
        .map(function (o) { return o.label; })
        .join(", ");
    } else {
      var found = step.options.find(function (o) { return o.value === answer; });
      answerLabel = found ? found.label : answer;
    }

    this.messages.push({
      id: Date.now().toString(),
      role: "user",
      content: answerLabel,
    });

    var nextStep = this.helpStep + 1;

    if (nextStep < helpSteps.length) {
      this.helpStep = nextStep;
      this.messages.push({
        id: (Date.now() + 1).toString(),
        role: "assistant",
        content:
          "**Question " +
          (nextStep + 1) +
          " of " +
          helpSteps.length +
          ":** " +
          helpSteps[nextStep].question,
      });
      this.renderMessages(this.messagesEl);
      this.scrollToBottom();
    } else {
      // All questions answered
      this.helpActive = false;
      var summaryPrompt = buildHelpSummary(this.helpAnswers);
      this.sendMessage(summaryPrompt);
    }
  };

  StellarChat.prototype.sendMessage = function (content) {
    var self = this;

    var userMsg = { id: String(++nextMsgId), role: "user", content: content };
    this.messages.push(userMsg);

    var assistantId = String(++nextMsgId);
    var assistantMsg = { id: assistantId, role: "assistant", content: "" };
    this.messages.push(assistantMsg);

    this.isLoading = true;
    this.showChipsOverride = false;
    this._streamingBubble = null;

    // Reset typing buffer
    this._pendingText = "";
    this._displayedText = "";
    this._drainMsgId = assistantId;
    this._startDrain();

    // Re-render to show user message + loading, then snap scroll instantly
    this.renderPanel();
    if (this.messagesEl) {
      this.messagesEl.scrollTop = this.messagesEl.scrollHeight;
    }

    // Prepare API messages (exclude welcome and empty assistant placeholder)
    var apiMessages = this.messages
      .filter(function (m) {
        return m.id !== "welcome" && m.id !== assistantId;
      })
      .map(function (m) {
        return { role: m.role, content: m.content };
      });

    fetch(API_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        messages: apiMessages,
        productData: this.productData,
      }),
    })
      .then(function (response) {
        if (!response.ok) throw new Error("API request failed");
        var reader = response.body.getReader();
        var decoder = new TextDecoder();
        var accumulated = "";

        function read() {
          return reader.read().then(function (result) {
            if (result.done) {
              // Flush any remaining buffered text immediately
              self._flushDrain();
              self.isLoading = false;
              self._completeStream();
              return;
            }

            var chunk = decoder.decode(result.value);
            var lines = chunk.split("\n").filter(function (l) {
              return l.startsWith("data: ");
            });

            for (var i = 0; i < lines.length; i++) {
              var data = lines[i].slice(6);
              if (data === "[DONE]") continue;

              try {
                var parsed = JSON.parse(data);
                if (parsed.text) {
                  accumulated += parsed.text;
                  // Buffer the new text for smooth drain
                  self._pendingText += parsed.text;
                }
                if (parsed.error) {
                  // NEW RATE LIMIT ERROR HANDLING HERE
                  if (parsed.error === "rate_limit") {
                    self.updateMessage(
                      assistantId, 
                      "**Stellar is currently helping a lot of customers and is a bit busy right now!** \n\nPlease wait a moment and try asking your question again."
                    );
                  } else {
                    self.updateMessage(
                      assistantId, 
                      "Sorry, I encountered an unexpected error. Please try again."
                    );
                  }
                }
              } catch (e) {
                // skip malformed JSON
              }
            }

            return read();
          });
        }

        return read();
      })
      .catch(function () {
        self._stopDrain();
        self.updateMessage(assistantId, "Sorry, I couldn't connect to the assistant. Please try again.");
        self.isLoading = false;
        self.renderPanel();
      });
  };

  // ---- Smooth typing drain ----
  // Uses a single RAF loop that:
  //  1. Drains chars from pending buffer at a steady rate
  //  2. Throttles DOM (innerHTML) updates to ~50ms intervals
  //  3. Lerps scroll position smoothly instead of snapping
  StellarChat.prototype._startDrain = function () {
    var self = this;
    if (this._drainTimer) return;

    this._lastRenderTime = 0;
    this._renderInterval = 50; // ms between DOM updates
    this._dirty = false;

    this._drainTimer = setInterval(function () {
      if (!self._pendingText) return;

      // Drain characters — speed up if buffer is growing
      var chars = self._drainRate;
      if (self._pendingText.length > 80) chars = 8;
      if (self._pendingText.length > 200) chars = 20;

      var slice = self._pendingText.slice(0, chars);
      self._pendingText = self._pendingText.slice(chars);
      self._displayedText += slice;
      self._dirty = true;

      // Throttle DOM updates to every ~50ms
      var now = Date.now();
      if (now - self._lastRenderTime >= self._renderInterval) {
        self._lastRenderTime = now;
        self._dirty = false;
        self.updateMessage(self._drainMsgId, self._displayedText);

        if (self._streamingBubble) {
          self._streamingBubble.innerHTML = renderMarkdown(self._displayedText);
        } else if (self.messagesEl) {
          self.renderMessages(self.messagesEl);
        }
        self._smoothScroll();
      }
    }, this._drainInterval);
  };

  StellarChat.prototype._stopDrain = function () {
    if (this._drainTimer) {
      clearInterval(this._drainTimer);
      this._drainTimer = null;
    }
    if (this._scrollAnimRAF) {
      cancelAnimationFrame(this._scrollAnimRAF);
      this._scrollAnimRAF = null;
    }
  };

  StellarChat.prototype._flushDrain = function () {
    this._stopDrain();
    if (this._pendingText || this._dirty) {
      this._displayedText += this._pendingText;
      this._pendingText = "";
      this._dirty = false;
      this.updateMessage(this._drainMsgId, this._displayedText);
    }
  };

  // ---- Lightweight stream completion (avoids full re-render flash) ----
  StellarChat.prototype._completeStream = function () {
    var bubble = this._streamingBubble;

    // 1. Final markdown render on the existing bubble
    if (bubble) {
      bubble.innerHTML = renderMarkdown(this._displayedText);
      bubble.classList.remove("stlr-streaming");
    }
    this._streamingBubble = null;

    // 2. Remove loading dots if present
    if (this.messagesEl) {
      var loadingEl = this.messagesEl.querySelector(".stlr-loading");
      if (loadingEl) loadingEl.remove();

      // 3. Add "Ask another question" link
      if (this.messages.length > 2) {
        var self = this;
        var askAgain = document.createElement("div");
        askAgain.className = "stlr-ask-again";
        var askBtn = document.createElement("button");
        askBtn.textContent = "\u2190 Ask another question";
        askBtn.onclick = function () {
          self.showChipsOverride = true;
          self.renderMessages(self.messagesEl);
          self.scrollToBottom();
        };
        askAgain.appendChild(askBtn);
        this.messagesEl.appendChild(askAgain);
      }
    }

    // 4. Re-enable input
    if (this.inputEl) {
      this.inputEl.disabled = false;
      this.inputEl.placeholder = "Ask about these policies...";
      this.inputEl.focus();
    }
    var sendBtn = this.root && this.root.querySelector(".stlr-send");
    if (sendBtn) sendBtn.disabled = false;

    // 5. Scroll to show the user's question + start of response
    if (bubble && this.messagesEl) {
      var self = this;
      requestAnimationFrame(function () {
        var msgEl = bubble.parentElement; // .stlr-msg wrapper
        // Find the preceding user message to include it in view
        var userMsg = msgEl.previousElementSibling;
        var scrollTarget = userMsg || msgEl;
        var target = scrollTarget.offsetTop - 12; // 12px breathing room

        var current = self.messagesEl.scrollTop;
        if (Math.abs(target - current) > 20) {
          self.messagesEl.scrollTo({ top: target, behavior: "smooth" });
        }
      });
    }
  };

  // Smooth scroll: lerp toward target over several frames
  StellarChat.prototype._smoothScroll = function () {
    var self = this;
    if (self._scrollAnimRAF) return; // already animating

    function step() {
      self._scrollAnimRAF = null;
      if (!self.messagesEl) return;

      var target = self.messagesEl.scrollHeight - self.messagesEl.clientHeight;
      var current = self.messagesEl.scrollTop;
      var diff = target - current;

      if (diff < 1) {
        self.messagesEl.scrollTop = target;
        return;
      }

      // Lerp 25% of remaining distance each frame — fast but smooth
      self.messagesEl.scrollTop = current + diff * 0.25;
      self._scrollAnimRAF = requestAnimationFrame(step);
    }

    self._scrollAnimRAF = requestAnimationFrame(step);
  };

  StellarChat.prototype.updateMessage = function (id, content) {
    for (var i = 0; i < this.messages.length; i++) {
      if (this.messages[i].id === id) {
        this.messages[i].content = content;
        return;
      }
    }
  };

  StellarChat.prototype.scrollToBottom = function () {
    var self = this;
    if (self._scrollRAF) return;
    self._scrollRAF = requestAnimationFrame(function () {
      self._scrollRAF = null;
      if (self.messagesEl) {
        var target = self.messagesEl.scrollHeight - self.messagesEl.clientHeight;
        var current = self.messagesEl.scrollTop;
        // Snap if close or first render; otherwise smooth
        if (target - current < 60) {
          self.messagesEl.scrollTop = target;
        } else {
          self.messagesEl.scrollTo({ top: target, behavior: "smooth" });
        }
      }
    });
  };

  StellarChat.prototype.hide = function () {
    if (this.root) {
      this.root.style.display = "none";
    }
  };

  StellarChat.prototype.show = function () {
    if (this.root) {
      this.root.style.display = "";
    }
  };

  StellarChat.prototype.refreshData = function (productData) {
    this.productData = productData;
    // Reset conversation for fresh comparison
    this.messages = [
      {
        id: "welcome",
        role: "assistant",
        content:
          "Hi! I'm **Stellar**, Canstar's comparison assistant. I can help you compare the policies on this page.\n\nTap a quick action below, or ask me anything about these policies!",
      },
    ];
    this.isLoading = false;
    this.helpActive = false;
    this.helpStep = 0;
    this.helpAnswers = {};
    this.showChipsOverride = false;
    this.multiSelected = [];
    this.isOpen = false;
    this.renderButton();
  };

  // ============================================================
  // INITIALIZATION & URL MONITORING
  // ============================================================
  var chatInstance = null;
  var lastUrl = window.location.href;

  function initChat() {
    waitForTables(10000).then(function (found) {
      if (!found) {
        console.warn(
          "[Stellar] Could not find comparison tables within timeout"
        );
      }

      expandAllSections().then(function () {
        var productData = scrapeProductData();

        if (!productData) {
          console.warn("[Stellar] Could not scrape product data");
        } else {
          console.log("[Stellar] Scraped product data successfully");
        }

        if (!chatInstance) {
          // First time — create and initialise
          chatInstance = new StellarChat();
          chatInstance.init(productData);
        } else {
          // Returning to compare page — refresh data and show
          chatInstance.refreshData(productData);
          chatInstance.show();
        }
      });
    });
  }

  function onUrlChange() {
    if (isComparePage()) {
      console.log("[Stellar] Compare page detected — initialising");
      initChat();
    } else {
      if (chatInstance) {
        console.log("[Stellar] Left compare page — hiding");
        chatInstance.hide();
      }
    }
  }

  // Monitor SPA route changes (React Router doesn't fire popstate on push)
  var urlPollId = null;
  function popstateHandler() {
    lastUrl = window.location.href;
    onUrlChange();
  }

  function watchUrl() {
    urlPollId = setInterval(function () {
      if (window.location.href !== lastUrl) {
        lastUrl = window.location.href;
        onUrlChange();
      }
    }, 500);

    window.addEventListener("popstate", popstateHandler);
  }

  function start() {
    watchUrl();
    onUrlChange(); // Check current URL immediately
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", start);
  } else {
    start();
  }
})();