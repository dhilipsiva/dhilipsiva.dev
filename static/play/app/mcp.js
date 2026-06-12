/* ============================================================================
   mcp.js — MCP-style app registry.
   The twin's "tools": each app has a description + params schema (what an MCP
   server would advertise) and a render(params) that returns a DOM node built
   from apps-data.json — so the SAME prompt-driven call that informs the model
   also draws an interactive card inline in the conversation.

   Two ways an app gets opened:
   1. MCP.route(prompt)  — deterministic keyword router (+ param extraction).
      Always available, even in scripted mode.
   2. The model itself — MCP.toolPrompt() is appended to the system prompt for
      capable models; MCP.parseToolCall(text) extracts a trailing
      `TOOL {"app":"projects","params":{...}}` line from the completion.
   ========================================================================== */

window.MCP = (function () {
  let DATA = null;

  async function load() {
    if (DATA) return DATA;
    DATA = await (await fetch('/play/app/apps-data.json')).json();
    return DATA;
  }

  /* Reader mode: the markdown-rendered pages remain the content pipeline —
     we fetch one, lift its .prose, and render it INSIDE the app card, so
     the conversation is the only surface a visitor ever needs. */
  async function fetchProse(url) {
    const html = await (await fetch(url)).text();
    const doc = new DOMParser().parseFromString(html, 'text/html');
    const prose = doc.querySelector('.prose');
    const title = doc.querySelector('.article-head h1, h1')?.textContent?.trim();
    return { title, html: prose ? prose.innerHTML : null };
  }

  function wireReader(card, btn, url, fallbackTitle) {
    btn.classList.add('mcp-read-btn');
    btn.addEventListener('click', async (ev) => {
      ev.preventDefault();
      const existing = card.querySelector('.mcp-reader');
      if (existing) existing.remove();
      btn.textContent = 'opening…';
      try {
        const { title, html } = await fetchProse(url);
        btn.textContent = 'read here';
        if (!html) { window.open(url, '_blank'); return; }
        const reader = el('div', 'mcp-reader');
        reader.innerHTML = `<h3 class="mcp-reader__title">${esc(title || fallbackTitle)}</h3><div class="prose">${html}</div>`;
        const close = el('button', 'q-btn q-btn--ghost q-btn--sm mcp-reader__close', 'close ✕');
        close.type = 'button';
        close.addEventListener('click', () => reader.remove());
        reader.append(close);
        card.append(reader);
        reader.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      } catch (e) {
        btn.textContent = 'read here';
        window.open(url, '_blank');
      }
    });
  }

  /* ── small DOM helpers ─────────────────────────────────────────────── */
  const el = (tag, cls, html) => {
    const n = document.createElement(tag);
    if (cls) n.className = cls;
    if (html !== undefined) n.innerHTML = html;
    return n;
  };
  const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const pills = tags => '<span class="tag-row">' + tags.map(t => `<span class="pill">${esc(t)}</span>`).join('') + '</span>';
  const badge = (txt, kind) => `<span class="q-badge q-badge--${kind}">${esc(txt)}</span>`;
  const statusBadge = s => s === 'active' || s === 'current'
    ? `<span class="q-badge q-badge--alive"><span class="q-badge__dot"></span>${esc(s)}</span>`
    : s === 'archived' ? badge(s, 'warning')
    : s === 'curated' ? badge(s, 'symbol')
    : badge(s, 'neutral');
  const appShell = (title, sub) => {
    const card = el('section', 'mcp-app q-card');
    card.innerHTML = `<header class="mcp-app__head"><span class="eyebrow">// app · ${esc(title)}</span>${sub ? `<span class="mcp-app__sub">${esc(sub)}</span>` : ''}</header>`;
    return card;
  };

  /* ── apps ──────────────────────────────────────────────────────────── */
  const APPS = {
    projects: {
      description: 'Things he architected and built. Params: filter (a tech tag like rust/python/wasm), category (oss|professional).',
      params: { filter: 'string?', category: 'string?' },
      render(p = {}) {
        let items = DATA.projects;
        let sub = '';
        if (p.category) { items = items.filter(x => x.category === p.category); sub = p.category; }
        if (p.filter) {
          const f = p.filter.toLowerCase();
          items = items.filter(x => x.tags.some(t => t.includes(f)) || x.name.toLowerCase().includes(f));
          sub = (sub ? sub + ' · ' : '') + '#' + f;
        }
        const card = appShell('projects', sub || 'all ' + items.length);
        if (!items.length) {
          card.append(el('p', 'mcp-app__empty', '∅ no projects match — try “rust”, “python”, or “professional”.'));
          return card;
        }
        const grid = el('div', 'mcp-projects');
        for (const x of items) {
          grid.append(el('article', 'mcp-proj', `
            <div class="mcp-proj__top"><span class="mcp-proj__glyph">${esc(x.glyph)}</span>${statusBadge(x.status)}</div>
            <h3>${esc(x.name)}</h3>
            <p>${esc(x.desc)}</p>
            ${pills(x.tags)}
            <div class="mcp-proj__links">
              ${x.links.source ? `<a href="${esc(x.links.source)}">{ } source</a>` : ''}
              ${x.links.writeup ? `<a href="${esc(x.links.writeup)}">∴ write-up</a>` : ''}
            </div>`));
        }
        card.append(grid);
        return card;
      }
    },

    books: {
      description: 'Books he is writing and books he reviewed.',
      params: {},
      render() {
        const card = appShell('books');
        const wrap = el('div', 'mcp-books');
        for (const b of DATA.books.authored) {
          const art = el('article', 'mcp-book', `
            ${b.cover ? `<img class="mcp-book__cover" src="${esc(b.cover)}" alt="Cover: ${esc(b.title)}">` : '<div class="mcp-book__cover mcp-book__cover--slot">▤</div>'}
            <div>${badge(b.status, 'ember')}<h3>${esc(b.title)}</h3><p>${esc(b.blurb)}</p></div>`);
          const btn = el('button', 'q-btn q-btn--secondary q-btn--sm', 'read here');
          btn.type = 'button';
          art.lastElementChild.append(btn);
          wireReader(card, btn, b.url, b.title);
          wrap.append(art);
        }
        for (const b of DATA.books.reviewed) {
          const art = el('article', 'mcp-book', `
            <div class="mcp-book__cover mcp-book__cover--slot">❡</div>
            <div>${badge('reviewed', 'neutral')}<h3>${esc(b.title)}</h3>
            <p class="mcp-book__meta">${esc(b.author)} · <span class="mcp-rating">${esc(b.rating)}</span></p>
            <p>${esc(b.note)}</p></div>`);
          const btn = el('button', 'q-btn q-btn--ghost q-btn--sm', 'read review here');
          btn.type = 'button';
          art.lastElementChild.append(btn);
          wireReader(card, btn, b.url, b.title);
          wrap.append(art);
        }
        card.append(wrap);
        return card;
      }
    },

    musings: {
      description: 'His blog — long-form essays on building, logic, freedom, Tamil. Read in full, right here.',
      params: {},
      render() {
        const card = appShell('musings', DATA.musings.length + ' recent');
        const list = el('div', 'mcp-posts');
        for (const m of DATA.musings) {
          const row = el('div', 'mcp-post', `
            <span class="mcp-post__date">${esc(m.date)}</span>
            <span><strong>${esc(m.title)}</strong><br><span class="mcp-post__ex">${esc(m.excerpt)}</span><br></span>`);
          const btn = el('button', 'q-btn q-btn--ghost q-btn--sm', 'read here');
          btn.type = 'button';
          row.lastElementChild.append(btn);
          wireReader(card, btn, m.url, m.title);
          list.append(row);
        }
        card.append(list);
        card.append(el('p', 'mcp-app__foot', `<a href="/musings/rss.xml">rss — protocols outlive platforms</a>`));
        return card;
      }
    },

    about: {
      description: 'Who he is — bio, experience timeline, languages.',
      params: {},
      render() {
        const a = DATA.about;
        const card = appShell('about');
        card.append(el('p', 'mcp-about__tagline', esc(a.tagline)));
        card.append(el('p', 'mcp-about__bio', esc(a.bio)));
        const tl = el('div', 'mcp-timeline');
        for (const t of a.timeline) {
          tl.append(el('div', 'mcp-timeline__row', `
            <span class="mcp-timeline__dates">${esc(t.dates)}</span>
            <span><strong>${esc(t.role)}</strong> · <span class="mcp-accent">${esc(t.org)}</span><br>
            <span class="mcp-dim">${esc(t.note)}</span></span>`));
        }
        card.append(tl);
        card.append(el('p', 'mcp-app__foot', pills(a.languages) + ` <a href="${esc(a.url)}">full story →</a>`));
        return card;
      }
    },

    now: {
      description: 'What he is focused on right now (dated).',
      params: {},
      render() {
        const card = appShell('now', 'updated ' + DATA.now.updated);
        const list = el('div', 'mcp-now');
        for (const it of DATA.now.items) {
          list.append(el('div', 'mcp-now__row', `<span class="mcp-now__k">${esc(it.k)}</span><span>${esc(it.v)}</span>`));
        }
        card.append(list);
        card.append(el('p', 'mcp-app__foot', `<a href="${esc(DATA.now.url)}">the /now page →</a>`));
        return card;
      }
    },

    uses: {
      description: 'His setup — OS, editor, languages, tools.',
      params: {},
      render() {
        const card = appShell('uses');
        for (const cat of DATA.uses) {
          card.append(el('h3', 'mcp-uses__cat', esc(cat.category)));
          const list = el('div', 'mcp-uses');
          for (const it of cat.items) {
            list.append(el('div', 'mcp-uses__row', `<span class="mcp-uses__name">${esc(it.name)}</span><span class="mcp-dim">${esc(it.note)}</span>`));
          }
          card.append(list);
        }
        card.append(el('p', 'mcp-app__foot', `<a href="${esc(DATA.usesUrl)}">full loadout →</a>`));
        return card;
      }
    },

    talks: {
      description: 'Talks and meetups; speaking topics.',
      params: {},
      render() {
        const card = appShell('talks');
        for (const t of DATA.talks) {
          card.append(el('div', 'mcp-timeline__row', `
            <span class="mcp-timeline__dates">${esc(t.date)}</span>
            <span><strong>${esc(t.title)}</strong><br><span class="mcp-dim">${esc(t.event)} — ${esc(t.note)}</span></span>`));
        }
        card.append(el('p', 'mcp-app__foot', esc(DATA.talksNote) + ` <a href="${esc(DATA.talksUrl)}">talks page →</a>`));
        return card;
      }
    },

    contact: {
      description: 'How to reach him — email, socials, location.',
      params: {},
      render() {
        const c = DATA.contact;
        const card = appShell('contact', c.location);
        card.append(el('p', 'mcp-contact__email', `<a href="mailto:${esc(c.email)}">${esc(c.email)}</a>`));
        card.append(el('p', 'mcp-dim', esc(c.note)));
        const row = el('p', 'mcp-contact__socials',
          c.socials.map(s => `<a class="q-btn q-btn--ghost q-btn--sm" href="${esc(s.url)}">${esc(s.name)}</a>`).join(' '));
        card.append(row);
        return card;
      }
    }
  };

  /* ── deterministic router ──────────────────────────────────────────── */
  const TAGS = ['rust', 'python', 'wasm', 'webassembly', 'security', 'cli', 'logic', 'symbolic', 'ml', 'machine-learning', 'protocols', 'ios', 'audio'];
  const ROUTES = [
    { app: 'projects', keys: ['project', 'projects', 'built', 'build', 'portfolio', 'made', 'created', 'work', 'repos', 'nibli', 'botwork', 'hostscli', 'awesome-rust-ml', 'appknox', 'nuflights', 'reckonsys', 'rewire', 'show me your rust', 'oss', 'open source'] },
    { app: 'books', keys: ['book', 'books', 'writing', 'manuscript', 'fixed point of thought', 'utopia', 'reading', 'review', 'geb', 'godel', 'gödel'] },
    { app: 'musings', keys: ['musing', 'musings', 'blog', 'post', 'posts', 'essay', 'article', 'rss', 'read your'] },
    { app: 'about', keys: ['about you', 'about him', 'about dhilipsiva', 'who are you', 'who is', 'bio', 'timeline', 'career', 'experience', 'history', 'background', 'yourself'] },
    { app: 'now', keys: ['now', 'currently', 'these days', 'working on', 'focus'] },
    { app: 'uses', keys: ['uses', 'you use', 'setup', 'editor', 'tools', 'hardware', 'laptop', 'nixos', 'neovim', 'terminal', 'os ', 'dotfiles', 'stack', 'gear', 'loadout'] },
    { app: 'talks', keys: ['talk', 'talks', 'speak', 'speaking', 'conference', 'meetup', 'bangml', 'slides'] },
    { app: 'contact', keys: ['contact', 'email', 'mail', 'reach', 'connect', 'github', 'linkedin', 'social', 'hire'] }
  ];

  function route(prompt) {
    const q = ' ' + prompt.toLowerCase().replace(/[^\p{L}\p{N}\s.-]/gu, ' ').replace(/\s+/g, ' ').trim() + ' ';
    let best = null, bestScore = 0;
    for (const r of ROUTES) {
      let score = 0;
      for (const k of r.keys) if (q.includes(k.length < 4 ? ' ' + k + ' ' : k)) score += k.length;
      if (score > bestScore) { bestScore = score; best = r.app; }
    }
    if (!best) return null;
    const params = {};
    if (best === 'projects') {
      for (const t of TAGS) if (q.includes(t)) { params.filter = t === 'webassembly' ? 'wasm' : t; break; }
      if (/professional|employer|job|paid|client|closed.source/.test(q)) params.category = 'professional';
      else if (/open.source|oss|foss|personal/.test(q)) params.category = 'oss';
    }
    return { app: best, params };
  }

  /* ── model-facing tool surface ─────────────────────────────────────── */
  function toolPrompt() {
    const lines = Object.entries(APPS).map(([k, a]) => `- ${k}: ${a.description}`);
    return 'You can open one app for the user. Available apps:\n' + lines.join('\n') +
      '\nIf (and only if) the user asks to see or browse something these cover, end your reply with a new line exactly like: TOOL {"app":"projects","params":{"filter":"rust"}}';
  }

  function parseToolCall(text) {
    const m = text.match(/TOOL\s*(\{.*\})\s*$/s);
    if (!m) return { text, call: null };
    try {
      const call = JSON.parse(m[1]);
      if (call.app && APPS[call.app]) {
        return { text: text.slice(0, m.index).trim(), call: { app: call.app, params: call.params || {} } };
      }
    } catch (e) { /* malformed tool JSON — show the text as-is */ }
    return { text: text.replace(/TOOL\s*\{.*\}\s*$/s, '').trim(), call: null };
  }

  async function render(app, params) {
    await load();
    if (!APPS[app]) return null;
    return APPS[app].render(params || {});
  }

  return { load, route, render, toolPrompt, parseToolCall, get apps() { return APPS; } };
})();
