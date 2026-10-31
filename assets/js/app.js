(() => {
  const $ = (s, r = document) => r.querySelector(s);
  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const brl = (v) => Number(v).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  const digits = (s) => String(s || '').replace(/\D/g, '');
  const waLink = (num, text) => `https://wa.me/${digits(num)}?text=${encodeURIComponent(text)}`;
  const safeUrl = (u) => (/^(https?:|mailto:|tel:|data:image\/|assets\/)/i.test(String(u || '').trim()) ? String(u).trim() : '');

  let site;

  async function load() {
    // ?preview=1 mostra o rascunho do painel admin antes de publicar.
    if (new URLSearchParams(location.search).has('preview')) {
      try {
        const draft = localStorage.getItem('site-draft');
        if (draft) return JSON.parse(draft);
      } catch (e) { /* ignora */ }
    }
    const res = await fetch('data/site.json?v=' + Date.now(), { cache: 'no-store' });
    return res.json();
  }

  function toast(msg) {
    const t = $('#toast');
    t.textContent = msg;
    t.hidden = false;
    clearTimeout(toast.timer);
    toast.timer = setTimeout(() => (t.hidden = true), 2400);
  }

  const initials = (name) =>
    String(name || '').replace(/^(prof\.?|professor|dr\.?)\s+/i, '').split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]).join('').toUpperCase();

  function priceBlock(item) {
    const n = Number(item.price);
    if (n > 0) return `<div class="price"><strong>${brl(n)}</strong>${item.priceNote ? `<span>${esc(item.priceNote)}</span>` : ''}</div>`;
    return `<div class="price"><span class="consult">${esc(item.priceNote || 'Sob consulta')}</span></div>`;
  }

  function offerCard(item, kind, i) {
    const n = Number(item.price);
    const canPay = item.buyable && n > 0;
    const askText = `Olá! Tenho interesse em "${item.title}". Pode me passar mais detalhes?`;
    const img = safeUrl(item.image);
    return `
      <article class="card reveal">
        ${img ? `<div class="card-media"><img src="${esc(img)}" alt="${esc(item.title)}" loading="lazy"></div>` : ''}
        <div class="card-body">
          ${img ? '' : `<div class="card-icon">${icon(item.icon)}</div>`}
          <h3>${esc(item.title)}</h3>
          <p class="desc">${esc(item.description)}</p>
          ${priceBlock(item)}
          <div class="card-actions">
            ${canPay ? `<button class="btn btn-gold btn-sm" data-pay="${kind}:${i}">${icon('pix')} ${kind === 'products' ? 'Comprar' : 'Contratar'} via Pix</button>` : ''}
            <a class="btn btn-sm ${canPay ? '' : 'btn-primary'}" href="${waLink(site.contact.whatsapp, askText)}" target="_blank" rel="noopener">${icon('whatsapp')} ${canPay ? 'Dúvidas' : 'Solicitar orçamento'}</a>
          </div>
        </div>
      </article>`;
  }

  function portfolioCard(p) {
    const img = safeUrl(p.image);
    const link = safeUrl(p.link);
    return `
      <article class="card reveal" data-cat="${esc(p.category)}">
        <div class="card-media">${img ? `<img src="${esc(img)}" alt="${esc(p.title)}" loading="lazy">` : `<div class="pf-media" style="height:100%">${icon(catIcon(p.category))}</div>`}</div>
        <div class="card-body">
          <div class="pf-meta"><span class="tag">${esc(p.category)}</span><span>${esc(p.date)}</span></div>
          <h3>${esc(p.title)}</h3>
          <p class="desc">${esc(p.description)}</p>
          ${link ? `<a class="pf-link" href="${esc(link)}" target="_blank" rel="noopener">Ver mais ${icon('arrow')}</a>` : ''}
        </div>
      </article>`;
  }

  function catIcon(cat) {
    const c = String(cat || '').toLowerCase();
    if (/intelig|ia\b|\bai\b|machine/.test(c)) return 'ai';
    if (/eletr/.test(c)) return 'chip';
    if (/rob/.test(c)) return 'robot';
    if (/autom|industr/.test(c)) return 'gear';
    if (/gest|neg|empre/.test(c)) return 'chart';
    if (/palest/.test(c)) return 'mic';
    if (/curso|trein|aula/.test(c)) return 'class';
    if (/app|software|sistema|desenv/.test(c)) return 'code';
    return 'spark';
  }

  function render() {
    const p = site.profile || {};
    const c = site.contact || {};
    const name = p.name || 'Seu Nome';
    document.title = `${name} · ${p.title || 'Portfólio'}`;
    $('#brandName').textContent = name;

    const [first, ...rest] = name.split(' ');
    const photo = safeUrl(p.photo);
    const waMain = waLink(c.whatsapp, c.whatsappMessage || 'Olá! Vim pelo seu site.');
    const services = site.services || [];
    const products = site.products || [];
    const portfolio = site.portfolio || [];
    const cats = [...new Set(portfolio.map((x) => x.category).filter(Boolean))];

    const socials = [
      ['instagram', c.instagram, 'Instagram'],
      ['linkedin', c.linkedin, 'LinkedIn'],
      ['youtube', c.youtube, 'YouTube'],
      ['github', c.github, 'GitHub'],
    ].filter(([, url]) => safeUrl(url));

    $('#app').innerHTML = `
      <section class="hero" id="inicio">
        <div class="wrap hero-grid">
          <div>
            <span class="eyebrow"><span class="dot"></span>Disponível para novos projetos</span>
            <h1>${esc(first)} <span class="grad">${esc(rest.join(' '))}</span></h1>
            <div class="role">${esc(p.title)}</div>
            <p class="tagline">${esc(p.tagline)}</p>
            <div class="hero-cta">
              <a class="btn btn-wa" href="${waMain}" target="_blank" rel="noopener">${icon('whatsapp')} Falar no WhatsApp</a>
              <a class="btn" href="#servicos">Ver serviços ${icon('arrow')}</a>
            </div>
            ${(site.stats || []).length ? `<div class="stats">${site.stats.map((s) => `<div class="stat"><strong>${esc(s.value)}</strong><span>${esc(s.label)}</span></div>`).join('')}</div>` : ''}
          </div>
          <div class="portrait">
            <div class="portrait-ring"></div>
            <div class="portrait-frame">${photo ? `<img src="${esc(photo)}" alt="Foto de ${esc(name)}">` : `<div class="avatar-fallback">${esc(initials(name))}</div>`}</div>
            <div class="badge-float badge-a">${icon('ai')} IA &amp; Robótica</div>
            <div class="badge-float badge-b">${icon('chart')} Gestão &amp; Negócios</div>
          </div>
        </div>
      </section>

      <section class="block alt" id="sobre">
        <div class="wrap about-grid">
          <div class="reveal">
            <div class="head" style="margin-bottom:20px"><span class="kicker">Sobre mim</span><h2>Ensino, desenvolvo e conecto tecnologia a negócios</h2></div>
            <p class="about-text">${esc(p.bio)}</p>
          </div>
          <div class="reveal">
            <div class="head" style="margin-bottom:20px"><span class="kicker">Áreas de atuação</span></div>
            <div class="areas">${(site.areas || []).map((a) => `<span class="chip">${icon(catIcon(a))}${esc(a)}</span>`).join('')}</div>
          </div>
        </div>
      </section>

      <section class="block" id="servicos">
        <div class="wrap">
          <div class="head reveal"><span class="kicker">Serviços</span><h2>Como posso te ajudar</h2><p>Mentorias, treinamentos, aulas, palestras e desenvolvimento sob medida. Contrate direto por aqui ou fale comigo no WhatsApp.</p></div>
          <div class="grid">${services.map((s, i) => offerCard(s, 'services', i)).join('')}</div>
        </div>
      </section>

      ${products.length ? `
      <section class="block alt" id="loja">
        <div class="wrap">
          <div class="head reveal"><span class="kicker">Loja</span><h2>Cursos e produtos</h2><p>Pague via Pix e envie o comprovante pelo WhatsApp. Simples e direto.</p></div>
          <div class="grid">${products.map((s, i) => offerCard(s, 'products', i)).join('')}</div>
        </div>
      </section>` : ''}

      ${portfolio.length ? `
      <section class="block" id="portfolio">
        <div class="wrap">
          <div class="head reveal"><span class="kicker">Portfólio</span><h2>Projetos, palestras e trabalhos</h2></div>
          ${cats.length > 1 ? `<div class="filters"><button class="filter active" data-filter="">Todos</button>${cats.map((x) => `<button class="filter" data-filter="${esc(x)}">${esc(x)}</button>`).join('')}</div>` : ''}
          <div class="grid" id="pfGrid">${portfolio.map(portfolioCard).join('')}</div>
        </div>
      </section>` : ''}

      <section class="block" id="contato">
        <div class="wrap">
          <div class="contact-card reveal">
            <div>
              <span class="eyebrow"><span class="dot"></span>Contato</span>
              <h2 style="margin-top:16px">Vamos conversar?</h2>
              <p>Me chame no WhatsApp para tirar dúvidas, pedir um orçamento ou agendar uma mentoria, aula ou palestra.</p>
              <a class="btn btn-wa" href="${waMain}" target="_blank" rel="noopener">${icon('whatsapp')} Chamar no WhatsApp</a>
            </div>
            <div class="contact-list">
              ${c.whatsapp ? `<a class="contact-item" href="${waMain}" target="_blank" rel="noopener">${icon('whatsapp')}<div><small>WhatsApp</small>${esc(formatPhone(c.whatsapp))}</div></a>` : ''}
              ${c.email ? `<a class="contact-item" href="mailto:${esc(c.email)}">${icon('mail')}<div><small>E-mail</small>${esc(c.email)}</div></a>` : ''}
              ${p.location ? `<div class="contact-item">${icon('pin')}<div><small>Atendimento</small>${esc(p.location)} · online e presencial</div></div>` : ''}
              ${socials.map(([ic, url, label]) => `<a class="contact-item" href="${esc(safeUrl(url))}" target="_blank" rel="noopener">${icon(ic)}<div><small>${label}</small>${esc(String(url).replace(/^https?:\/\/(www\.)?/, ''))}</div></a>`).join('')}
            </div>
          </div>
        </div>
      </section>`;

    $('#footer').innerHTML = `
      <div class="wrap footer-inner">
        <div>© ${new Date().getFullYear()} ${esc(name)}${p.cnpj ? ` · CNPJ ${esc(p.cnpj)}` : ''}</div>
        <div class="socials">${socials.map(([ic, url, label]) => `<a href="${esc(safeUrl(url))}" target="_blank" rel="noopener" aria-label="${label}">${icon(ic)}</a>`).join('')}</div>
      </div>`;

    document.querySelectorAll('[data-section]').forEach((a) => (a.hidden = !document.getElementById(a.dataset.section)));

    const wa = $('#waFloat');
    wa.href = waMain;
    wa.innerHTML = icon('whatsapp');
    wa.hidden = !c.whatsapp;

    bind();
  }

  function formatPhone(n) {
    const d = digits(n);
    const m = d.match(/^55(\d{2})(\d{4,5})(\d{4})$/);
    return m ? `(${m[1]}) ${m[2]}-${m[3]}` : '+' + d;
  }

  function bind() {
    document.querySelectorAll('[data-pay]').forEach((b) =>
      b.addEventListener('click', () => {
        const [kind, i] = b.dataset.pay.split(':');
        openPix(site[kind][+i]);
      })
    );

    document.querySelectorAll('.filter').forEach((f) =>
      f.addEventListener('click', () => {
        document.querySelectorAll('.filter').forEach((x) => x.classList.toggle('active', x === f));
        document.querySelectorAll('#pfGrid .card').forEach((card) => {
          card.hidden = !!f.dataset.filter && card.dataset.cat !== f.dataset.filter;
        });
      })
    );

    const io = 'IntersectionObserver' in window
      ? new IntersectionObserver((entries) => entries.forEach((e) => e.isIntersecting && (e.target.classList.add('in'), io.unobserve(e.target))), { threshold: 0.12 })
      : null;
    document.querySelectorAll('.reveal').forEach((el) => (io ? io.observe(el) : el.classList.add('in')));
  }

  function openPix(item) {
    const pix = site.pix || {};
    const key = item.pixKey || pix.key;
    const keyType = item.pixKey ? item.pixKeyType || pix.keyType : pix.keyType;
    const amount = Number(item.price);
    const body = $('#pixBody');

    if (!key) {
      body.innerHTML = `
        <div class="pix-head">${icon('pix')} Pagamento via Pix</div>
        <h3 id="pixTitle">${esc(item.title)}</h3>
        <div class="pix-amount">${brl(amount)}</div>
        <div class="notice">O pagamento via Pix ainda não foi configurado. Fale comigo pelo WhatsApp para combinar.</div>
        <a class="btn btn-wa btn-block" href="${waLink(site.contact.whatsapp, `Olá! Quero adquirir "${item.title}" (${brl(amount)}). Como faço o pagamento?`)}" target="_blank" rel="noopener">${icon('whatsapp')} Falar no WhatsApp</a>`;
      showModal();
      return;
    }

    const code = Pix.payload({ key, keyType, name: pix.receiverName || site.profile.name, city: pix.city, amount, description: item.title });
    let qrSvg = '';
    try {
      const qr = qrcode(0, 'M');
      qr.addData(code);
      qr.make();
      qrSvg = qr.createSvgTag({ cellSize: 4, margin: 0, scalable: true });
    } catch (e) { /* sem QR, o copia-e-cola ainda funciona */ }

    body.innerHTML = `
      <div class="pix-head">${icon('pix')} Pagamento via Pix</div>
      <h3 id="pixTitle">${esc(item.title)}</h3>
      <div class="pix-amount">${brl(amount)}</div>
      ${qrSvg ? `<div class="qr">${qrSvg}</div>` : ''}
      <div class="copy-box">
        <input id="pixCode" readonly value="${esc(code)}" aria-label="Código Pix copia e cola">
        <button class="btn btn-primary btn-sm" id="copyPix">${icon('copy')} Copiar</button>
      </div>
      <div class="pix-info">Recebedor: <b>${esc(pix.receiverName || site.profile.name)}</b> · Chave: <b>${esc(Pix.normalizeKey(key, keyType))}</b></div>
      <ol class="steps">
        <li><span>1</span>Abra o app do seu banco e escaneie o QR Code ou use o Pix Copia e Cola.</li>
        <li><span>2</span>Confira o valor e o recebedor, e conclua o pagamento.</li>
        <li><span>3</span>Envie o comprovante pelo WhatsApp no botão abaixo.</li>
      </ol>
      <label class="field">Seu nome (para identificarmos o pagamento)
        <input id="buyerName" placeholder="Ex.: Maria Silva" autocomplete="name">
      </label>
      <a class="btn btn-wa btn-block" id="sendProof" target="_blank" rel="noopener">${icon('whatsapp')} Já paguei: enviar comprovante</a>`;

    const proof = $('#sendProof');
    const updateProof = () => {
      const buyer = $('#buyerName').value.trim();
      proof.href = waLink(site.contact.whatsapp,
        `Olá! ${buyer ? `Sou ${buyer} e fiz` : 'Fiz'} o pagamento via Pix de ${brl(amount)} referente a "${item.title}". Segue o comprovante:`);
    };
    $('#buyerName').addEventListener('input', updateProof);
    updateProof();

    $('#copyPix').addEventListener('click', async () => {
      const input = $('#pixCode');
      try { await navigator.clipboard.writeText(input.value); }
      catch (e) { input.select(); document.execCommand('copy'); }
      toast('Código Pix copiado!');
    });

    showModal();
  }

  function showModal() {
    const m = $('#pixModal');
    m.hidden = false;
    document.body.style.overflow = 'hidden';
  }
  function hideModal() {
    $('#pixModal').hidden = true;
    document.body.style.overflow = '';
  }

  document.addEventListener('click', (e) => {
    if (e.target.closest('[data-close]')) hideModal();
    if (e.target.closest('#menu a')) $('#menu').classList.remove('open');
  });
  document.addEventListener('keydown', (e) => e.key === 'Escape' && hideModal());

  $('#menuBtn').innerHTML = icon('menu');
  $('#menuBtn').addEventListener('click', () => $('#menu').classList.toggle('open'));
  document.querySelector('.modal-close').innerHTML = icon('x');

  load()
    .then((data) => { site = data; render(); })
    .catch(() => { $('#app').innerHTML = '<div class="loading">Não foi possível carregar o conteúdo.</div>'; });
})();
