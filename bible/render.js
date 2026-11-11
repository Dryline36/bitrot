/* Renders bible/bitrot_bible_v2.md with the images mapped in bible/manifest.json. */
(function () {
  const ROOT = "/bible/";
  const motionOK = !window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  const $ = (id) => document.getElementById(id);

  function esc(s) {
    return String(s).replace(/[&<>"']/g, (c) => ({
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;"
    }[c]));
  }

  function asset(path) {
    return ROOT + String(path).replace(/^\//, "");
  }

  function slug(text) {
    return String(text).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  }

  function headingText(h) {
    return String(h).replace(/^#+\s+/, "").trim();
  }

  function isDraft(text) {
    return /for review only|not for the site|nicholas signs off|end of draft/i.test(text);
  }

  function isLede(text) {
    return /^\*[^*][\s\S]*\*$/.test(text) && !text.slice(1, -1).includes("*");
  }

  function parse(md) {
    const lines = md.replace(/\r\n/g, "\n").split("\n");
    const blocks = [];
    let i = 0;
    while (i < lines.length) {
      const line = lines[i];
      if (!line.trim()) { i++; continue; }
      if (/^---+\s*$/.test(line)) { blocks.push({ type: "hr" }); i++; continue; }
      const heading = /^(#{1,6})\s+(.*)$/.exec(line);
      if (heading) {
        blocks.push({ type: "h", level: heading[1].length, text: heading[2].trim() });
        i++;
        continue;
      }
      const trimmed = line.trim();
      // Labels in this book sit on their own line without a blank line under them.
      if (/^\*\*[^*]+\*\*$/.test(trimmed) || (/^\*[^*].*\*$/.test(trimmed) && !trimmed.slice(1, -1).includes("*"))) {
        blocks.push({ type: "p", text: trimmed });
        i++;
        continue;
      }
      if (/^[-*]\s+/.test(line)) {
        const items = [];
        while (i < lines.length && /^[-*]\s+/.test(lines[i])) {
          items.push(lines[i].replace(/^[-*]\s+/, ""));
          i++;
        }
        blocks.push({ type: "ul", items });
        continue;
      }
      if (/^\d+\.\s+/.test(line)) {
        const items = [];
        while (i < lines.length && /^\d+\.\s+/.test(lines[i])) {
          items.push(lines[i].replace(/^\d+\.\s+/, ""));
          i++;
        }
        blocks.push({ type: "ol", items });
        continue;
      }
      const buf = [line.trim()];
      i++;
      while (i < lines.length && lines[i].trim() && !/^(#{1,6}\s|---+\s*$|[-*]\s+|\d+\.\s+)/.test(lines[i])) {
        buf.push(lines[i].trim());
        i++;
      }
      blocks.push({ type: "p", text: buf.join(" ") });
    }
    return blocks;
  }

  function sceneImg(src, alt, eager) {
    const load = eager ? ' loading="eager" fetchpriority="high"' : ' loading="lazy"';
    return `<img src="${esc(asset(src))}" alt="${esc(alt)}" width="1600" height="900" decoding="async"${load}>`;
  }

  function banner(src, alt, eager) {
    return `<figure class="banner">${sceneImg(src, alt, eager)}</figure>`;
  }

  function saintArt(gif, poster, alt) {
    const gifImg = motionOK
      ? `<img class="gif" src="${esc(asset(gif))}" alt="" aria-hidden="true" width="480" height="480" loading="lazy" decoding="async">`
      : "";
    return `<figure class="saint-art"><img class="poster" src="${esc(asset(poster))}" alt="${esc(alt)}" width="480" height="480" loading="lazy" decoding="async">${gifImg}</figure>`;
  }

  function linkSaints(html, saints) {
    const ordered = saints.slice().sort((a, b) => b.name.length - a.name.length);
    for (const saint of ordered) {
      const name = esc(saint.name);
      const from = `<strong>${name}.`;
      const to = `<strong><a href="#${slug(headingText(saint.heading))}">${name}</a>.`;
      html = html.split(from).join(to);
    }
    return html;
  }

  function inline(raw, saints) {
    let s = esc(raw);
    s = s.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
    s = s.replace(/\*([^*]+)\*/g, "<em>$1</em>");
    return linkSaints(s, saints);
  }

  function renderParagraph(text, saints) {
    if (/^\*\*[^*]+\*\*$/.test(text)) {
      return `<h4 class="rubric">${esc(text.slice(2, -2))}</h4>`;
    }
    if (isLede(text)) return `<p class="lede">${esc(text.slice(1, -1))}</p>`;
    return `<p>${inline(text, saints)}</p>`;
  }

  function renderList(tag, items, saints) {
    return `<${tag}>${items.map((item) => `<li>${inline(item, saints)}</li>`).join("")}</${tag}>`;
  }

  function wordHas(alt, name) {
    const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    return new RegExp("\\b" + escaped + "\\b").test(alt);
  }

  function armGifs(root) {
    if (!motionOK) return;
    root.querySelectorAll(".saint-art .gif").forEach((img) => {
      const ready = () => img.parentElement.classList.add("is-ready");
      img.addEventListener("error", () => img.remove());
      if (img.complete && img.naturalWidth) ready();
      else img.addEventListener("load", ready);
    });
  }

  function render(md, manifest) {
    const saints = manifest.saints || [];
    const scenes = manifest.scenes || [];
    const sections = manifest.sections || [];
    const byHeading = new Map(sections.map((s) => [headingText(s.heading), s]));
    const saintNames = new Set(saints.map((s) => headingText(s.heading)));
    const h1spec = sections.find((s) => /^# [^#]/.test(s.heading));
    const usedScenes = new Set();

    const extras = new Map();
    scenes.forEach((scene) => {
      if (sections.some((s) => s.image === scene.file)) return;
      let best = null;
      saints.forEach((saint) => {
        if (wordHas(scene.alt || "", saint.name) && (!best || saint.name.length > best.name.length)) best = saint;
      });
      if (best) extras.set(headingText(best.heading), scene);
    });

    const blocks = parse(md);
    const intro = [];
    const chapters = [];
    let mode = "pre";
    let current = null;
    let lastScene = h1spec ? h1spec.image : null;
    if (h1spec) usedScenes.add(h1spec.image);

    function startChapter(chapter) {
      current = chapter;
      chapters.push(chapter);
      mode = "body";
    }

    blocks.forEach((block) => {
      if (block.type === "hr") return;
      if (block.type === "p" && isDraft(block.text)) return;

      if (block.type === "h") {
        if (block.level === 1) return;
        if (block.level === 2 && block.text === "The Church of the Rot") {
          $("bible-kicker").textContent = block.text;
          mode = "intro";
          return;
        }
        const spec = byHeading.get(block.text) || null;
        if (block.level === 2) {
          let figure = "";
          if (spec && spec.image && !spec.poster && spec.image !== lastScene) {
            figure = banner(spec.image, spec.alt || "", false);
            lastScene = spec.image;
            usedScenes.add(spec.image);
          }
          startChapter({ kind: "book", id: slug(block.text), title: block.text, banner: figure, parts: [] });
          return;
        }
        if (block.level === 3 && saintNames.has(block.text)) {
          const extra = extras.get(block.text);
          let figure = "";
          if (extra) {
            figure = banner(extra.file, extra.alt || "", false);
            lastScene = extra.file;
            usedScenes.add(extra.file);
          }
          const poster = (spec && spec.poster) || "";
          const gif = (spec && spec.image) || "";
          startChapter({
            kind: "saint",
            id: slug(block.text),
            title: block.text,
            banner: figure,
            art: poster && gif ? saintArt(gif, poster, (spec && spec.alt) || block.text) : "",
            parts: []
          });
          return;
        }
        if (!current) return;
        if (spec && spec.image && !spec.poster && spec.image !== lastScene) {
          current.parts.push(banner(spec.image, spec.alt || "", false));
          lastScene = spec.image;
          usedScenes.add(spec.image);
        }
        current.parts.push(`<h3 id="${slug(block.text)}">${esc(block.text)}</h3>`);
        return;
      }

      const html = block.type === "p"
        ? renderParagraph(block.text, saints)
        : block.type === "ul"
          ? renderList("ul", block.items, saints)
          : block.type === "ol"
            ? renderList("ol", block.items, saints)
            : "";
      if (!html) return;
      if (mode === "intro") intro.push(html);
      else if (current) current.parts.push(html);
    });

    if (h1spec) {
      $("hero-banner").innerHTML = sceneImg(h1spec.image, h1spec.alt || "", true);
    }

    const bookLinks = chapters
      .filter((c) => c.kind === "book")
      .map((c) => `<li><a href="#${c.id}">${esc(c.title)}</a></li>`)
      .join("");
    const cards = saints.map((saint) => {
      const id = slug(headingText(saint.heading));
      return `<a class="saint-card" href="#${id}"><img src="${esc(asset(saint.png))}" alt="" width="480" height="480" loading="lazy" decoding="async"><span>${esc(saint.name)}</span></a>`;
    }).join("");

    const chapterHtml = chapters.map((c) => {
      if (c.kind === "saint") {
        return `<section class="saint-chapter" id="${c.id}">${c.banner}<div class="saint">${c.art}<div class="saint-copy"><h3>${esc(c.title)}</h3><div class="prose">${c.parts.join("")}</div></div></div></section>`;
      }
      return `<section class="book" id="${c.id}">${c.banner}<h2>${esc(c.title)}</h2><div class="prose">${c.parts.join("")}</div></section>`;
    }).join("");

    const missed = scenes.filter((scene) => !usedScenes.has(scene.file));
    const missedHtml = missed.length
      ? `<section class="book" id="other-scenes">${missed.map((scene) => banner(scene.file, scene.alt || "", false)).join("")}</section>`
      : "";

    const introHtml = intro.length
      ? `<section class="box bible-intro" id="church"><div class="prose">${intro.join("")}</div></section>`
      : "";

    $("bible-root").innerHTML =
      introHtml +
      `<section class="box bible-toc" id="contents"><h2>Contents</h2><ol class="toc-books">${bookLinks}</ol><h3 class="toc-label">The Twenty</h3><div class="saint-grid">${cards}</div></section>` +
      chapterHtml +
      missedHtml;

    armGifs(document);
    const status = $("bible-status");
    if (status) status.hidden = true;
    const hash = location.hash.slice(1);
    if (hash) {
      const target = document.getElementById(decodeURIComponent(hash));
      if (target) target.scrollIntoView();
    }
  }

  async function main() {
    const [mdRes, manifestRes] = await Promise.all([
      fetch(ROOT + "bitrot_bible_v2.md"),
      fetch(ROOT + "manifest.json")
    ]);
    if (!mdRes.ok || !manifestRes.ok) throw new Error("fetch failed");
    render(await mdRes.text(), await manifestRes.json());
  }

  main().catch((err) => {
    console.error(err);
    const status = $("bible-status");
    if (status) {
      status.hidden = false;
      status.textContent = "THE CODEX DID NOT LOAD.";
    }
  });
})();
