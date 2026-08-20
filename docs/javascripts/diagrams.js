/*
 * Sequence diagram colouring and legends.
 *
 * Two problems with the diagrams as mermaid draws them:
 *
 *   1. Every participant is the same colour and every arrow the same stroke, so
 *      a diagram with six participants reads as one grey mesh. Mermaid offers
 *      no per-participant hook: its theme paints `.actor`, `.actor-line` and
 *      `.messageLine0/1` as single classes.
 *   2. An `opt` or `alt` box means nothing to a reader who has not met one.
 *
 * Both are fixed here.
 *
 * WHY IT WORKS THE WAY IT DOES
 *
 * The theme renders each diagram into a **closed** shadow root, so the finished
 * SVG cannot be reached from a stylesheet or from script. What it can be
 * reached through is `mermaid.render`, which the theme calls to produce the SVG
 * markup before sealing it away. Mermaid itself is loaded from unpkg on demand,
 * so this waits for the global to appear, wraps `render`, and colours the
 * markup on its way past.
 *
 * Colours are written as `var(--seq-*)` rather than as literal values. Custom
 * properties cross a shadow boundary, so the diagram keeps working when the
 * reader switches between the light and dark palettes, which is not something a
 * baked-in colour would survive. The values live in stylesheets/extra.css.
 *
 * The legends are separate, and simpler: they are built from the diagram source
 * in the page itself, before the theme takes it away, and inserted as ordinary
 * markup underneath.
 *
 * If any of this stops matching what the theme does, the diagram is returned
 * untouched: monochrome, but correct. Nothing here can break a diagram.
 */
(function () {
  "use strict";

  /* Participant label to palette slot. The keys are the labels used in the
     `participant X as Label` lines, lowercased. Anything unlisted falls back to
     a spare colour, so a new participant is never left uncoloured. */
  var SLOT = {
    "user": "user",
    "owner or primary": "user",
    "invited user": "invited",
    "app": "app",
    "binaryveda's backend": "backend",
    "spintly's servers": "spintly",
    "keycloak": "keycloak",
    "oauth sdk": "oauth",
    "access sdk": "access",
    "config sdk": "config",
    "lock hardware": "hardware",
    "the gateway": "hardware",
    "the accessory": "hardware",
    "the assistant app": "assistant",
    "firebase": "firebase",
    "file store": "filestore"
  };

  var SPARE = ["spare1", "spare2", "spare3", "spare4"];

  /* Blocks worth explaining, and the wording for each. Everything else in a
     sequence diagram reads on its own and gets no legend entry. */
  var BLOCKS = [
    ["opt", "everything inside the box happens only when the condition at the top of it is true, and is skipped otherwise"],
    ["alt", "the box is split into branches, each with its own condition at the top. Exactly one of them happens"],
    ["par", "the branches of the box all happen at the same time, rather than one after another"],
    ["loop", "everything inside the box repeats for as long as the condition at the top of it holds"]
  ];

  function normalise(label) {
    return label.replace(/[‘’]/g, "'").replace(/\s+/g, " ").trim().toLowerCase();
  }

  function isSequence(source) {
    return /^\s*(?:%%\{[^]*?\}%%\s*)?sequenceDiagram\b/.test(source);
  }

  /* Participants, in the order they are declared, which is also the order
     mermaid lays them out from left to right. */
  function participants(source) {
    var re = /^[ \t]*(?:participant|actor)[ \t]+(\S+?)(?:[ \t]+as[ \t]+(.+?))?[ \t]*$/gm;
    var out = [];
    var m;
    while ((m = re.exec(source))) out.push((m[2] || m[1]).trim());
    return out;
  }

  function slotsFor(names) {
    var spare = 0;
    return names.map(function (name) {
      return SLOT[normalise(name)] || SPARE[spare++ % SPARE.length];
    });
  }

  /* --- colouring the rendered markup ------------------------------------- */

  function important(node, prop, slot) {
    node.style.setProperty(prop, "var(--seq-" + slot + ")", "important");
  }

  function xOf(node) {
    var tag = node.tagName.toLowerCase();
    if (tag === "rect") {
      return parseFloat(node.getAttribute("x")) +
        parseFloat(node.getAttribute("width")) / 2;
    }
    if (tag === "circle" || tag === "ellipse") return parseFloat(node.getAttribute("cx"));
    if (tag === "line") return parseFloat(node.getAttribute("x1"));
    if (tag === "text") return parseFloat(node.getAttribute("x"));
    if (tag === "path") {
      var d = (node.getAttribute("d") || "").match(/-?[\d.]+/);
      return d ? parseFloat(d[0]) : NaN;
    }
    return NaN;
  }

  function colourise(markup, source) {
    var names = participants(source);
    if (names.length < 2) return markup;

    var doc = new DOMParser().parseFromString(markup, "text/html");
    var svg = doc.querySelector("svg");
    if (!svg) return markup;

    /* One lifeline per participant, so their x positions give the columns the
       rest of the diagram is measured against. */
    var lifelines = [].slice.call(svg.querySelectorAll("line.actor-line"));
    if (lifelines.length !== names.length) return markup;

    var columns = lifelines
      .map(function (l) { return parseFloat(l.getAttribute("x1")); })
      .filter(function (x) { return !isNaN(x); })
      .sort(function (a, b) { return a - b; });
    if (columns.length !== names.length) return markup;

    var slots = slotsFor(names);

    function slotAt(x) {
      var best = 0;
      var distance = Infinity;
      for (var i = 0; i < columns.length; i++) {
        var d = Math.abs(columns[i] - x);
        if (d < distance) { distance = d; best = i; }
      }
      return slots[best];
    }

    function each(selector, fn) {
      svg.querySelectorAll(selector).forEach(function (n) {
        var x = xOf(n);
        if (!isNaN(x)) fn(n, slotAt(x));
      });
    }

    /* Lifelines, kept faint so they sit behind the arrows. */
    each("line.actor-line", function (n, slot) {
      important(n, "stroke", slot);
      n.style.setProperty("stroke-opacity", "0.45", "important");
    });

    /* Participant boxes, top and bottom. */
    each("rect.actor", function (n, slot) {
      important(n, "stroke", slot);
      important(n, "fill", slot);
      n.style.setProperty("fill-opacity", "0.12", "important");
    });

    /* Stick figures, drawn for the actors rather than the participants. */
    each(".actor-man circle, .actor-man line, .actor-man path", function (n, slot) {
      important(n, "stroke", slot);
    });

    /* Participant labels. */
    each("text.actor, text.actor-box", function (n, slot) {
      important(n, "fill", slot);
      n.querySelectorAll("tspan").forEach(function (t) { important(t, "fill", slot); });
    });

    /* Arrows, coloured by the participant they leave from. */
    each(".messageLine0, .messageLine1", function (n, slot) {
      important(n, "stroke", slot);
      recolourHead(svg, n, slot);
    });

    return svg.outerHTML;
  }

  /* Arrowheads live in <defs> and are shared by every arrow, so each colour
     needs its own copy before an arrow can point at it. */
  function recolourHead(svg, node, slot) {
    var ref = node.getAttribute("marker-end");
    if (!ref) return;
    var match = ref.match(/#(.+?)\)/);
    if (!match) return;

    var source = svg.querySelector('[id="' + match[1] + '"]');
    if (!source) return;

    var id = "seq-head-" + match[1] + "-" + slot;
    if (!svg.querySelector('[id="' + id + '"]')) {
      var clone = source.cloneNode(true);
      clone.setAttribute("id", id);
      clone.removeAttribute("class");
      clone.querySelectorAll("*").forEach(function (child) {
        child.removeAttribute("class");
        important(child, "fill", slot);
        important(child, "stroke", slot);
      });
      source.parentNode.appendChild(clone);
    }
    node.setAttribute("marker-end", "url(#" + id + ")");
  }

  /* --- wrapping mermaid --------------------------------------------------- */

  function wrap(mermaid) {
    if (!mermaid || typeof mermaid.render !== "function" || mermaid.__seqWrapped) {
      return mermaid;
    }
    var render = mermaid.render.bind(mermaid);
    mermaid.render = function (id, source) {
      var result = render(id, source);
      if (!result || typeof result.then !== "function" || !isSequence(source)) {
        return result;
      }
      return result.then(function (out) {
        try {
          if (out && typeof out.svg === "string") out.svg = colourise(out.svg, source);
        } catch (e) {
          /* leave the diagram exactly as mermaid drew it */
        }
        return out;
      });
    };
    mermaid.__seqWrapped = true;
    return mermaid;
  }

  /* Mermaid is fetched from a CDN on demand, so the global does not exist yet.
     Catching the assignment is more reliable than polling for it. */
  if (typeof window.mermaid !== "undefined") {
    wrap(window.mermaid);
  } else {
    var held;
    try {
      Object.defineProperty(window, "mermaid", {
        configurable: true,
        get: function () { return held; },
        set: function (value) { held = wrap(value); }
      });
    } catch (e) {
      /* nothing to do: diagrams stay monochrome */
    }
  }

  /* --- legends ------------------------------------------------------------ */

  /* Read from the diagram source in the page, which is still a <pre> at this
     point. The theme swaps that <pre> for its own element on the way to
     rendering, and the legend inserted after it stays where it is. */
  function addLegends() {
    document.querySelectorAll("pre").forEach(function (pre) {
      if (pre.dataset.seqLegend === "1") return;

      var source = pre.textContent || "";
      if (!isSequence(source)) return;
      pre.dataset.seqLegend = "1";

      var blocks = {};
      source.replace(/^[ \t]*(opt|alt|par|loop)\b/gm, function (_, word) {
        blocks[word] = true;
        return _;
      });

      var parts = BLOCKS.filter(function (b) { return blocks[b[0]]; });
      if (!parts.length) return;

      var note = document.createElement("div");
      note.className = "seq-legend";
      note.innerHTML = parts.map(function (b) {
        return '<span><span class="seq-tag">' + b[0] + "</span>" + b[1] + "</span>";
      }).join("");
      pre.parentNode.insertBefore(note, pre.nextSibling);
    });
  }

  addLegends();

  /* Instant navigation swaps in a whole new page without reloading. */
  var queued = false;
  new MutationObserver(function () {
    if (queued) return;
    queued = true;
    requestAnimationFrame(function () {
      queued = false;
      addLegends();
    });
  }).observe(document.documentElement, { childList: true, subtree: true });
})();
