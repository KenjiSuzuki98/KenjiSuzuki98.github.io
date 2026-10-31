(() => {
  const { $, esc, brl, waLink, safeUrl, ext } = Site;

  let site;

  const initials = (name) =>
    String(name || '').replace(/^(prof\.?|professor|dr\.?)\s+/i, '').split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]).join('').toUpperCase();

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

  // Imagem com texto alternativo e, se houver, crédito/autoria visível.
  function media(item) {
    const img = safeUrl(item.image);
    if (!img) return '';
    const alt = item.imageAlt || item.title || '';
    const credit = item.imageCredit ? `<figcaption class="credit">${esc(item.imageCredit)}</figcaption>` : '';
    return `<figure class="card-media"><img src="${esc(img)}" alt="${esc(alt)}" loading="lazy">${credit}</figure>`;
  }

  function priceBlock(item) {
    const n = Number(item.price);
    if (n > 0) return `<div class="price"><strong>${brl(n)}</strong>${item.priceNote ? `<span>${esc(item.priceNote)}</span>` : ''}</div>`;
    return `<div class="price"><span class="consult">${esc(item.priceNote || 'Sob consulta')}</span></div>`;
  }

  function offerCard(item, kind, i) {
    const n = Number(item.price);
    const canPay = item.buyable && n > 0;
    const askText = `Olá! Tenho interesse em "${item.title}". Pode me passar mais detalhes?`;
    const img = media(item);
    return `
      <article class="card reveal">
        ${img}
        <div class="card-body">
          ${img ? '' : `<div class="card-icon">${icon(item.icon)}</div>`}
          <h3>${esc(item.title)}</h3>
          <p class="desc">${esc(item.description)}</p>
          ${priceBlock(item)}
          <div class="card-actions">
            ${canPay ? `<button type="button" class="btn btn-gold btn-sm" data-pay="${kind}:${i}">${icon('pix')} Pagar ${brl(n)} via Pix</button>` : ''}
            ${ext(waLink(site.contact.whatsapp, askText), `${icon('whatsapp')} ${canPay ? 'Tirar dúvidas no WhatsApp' : 'Pedir orçamento no WhatsApp'}`, `class="btn btn-sm ${canPay ? '' : 'btn-primary'}"`)}
          </div>
        </div>
      </article>`;
  }

  function portfolioCard(p) {
    const link = safeUrl(p.link);
    const img = media(p) || `<div class="card-media pf-media">${icon(catIcon(p.category))}</div>`;
    return `
      <article class="card reveal" data-cat="${esc(p.category)}">
        ${img}
        <div class="card-body">
          <div class="pf-meta"><span class="tag">${esc(p.category)}</span><span>${esc(p.date)}</span></div>
          <h3>${esc(p.title)}</h3>
          <p class="desc">${esc(p.description)}</p>
          ${link ? ext(link, `Ver projeto<span class="sr-only">: ${esc(p.title)}</span> ${icon('arrow')}`, 'class="pf-link"') : ''}
        </div>
      </article>`;
  }

  function testimonialCard(t) {
    return `
      <figure class="card testimonial reveal">
        <blockquote><p>${esc(t.text)}</p></blockquote>
        <figcaption><strong>${esc(t.name)}</strong>${t.role ? `, ${esc(t.role)}` : ''}${t.date ? ` · <time datetime="${esc(t.date)}">${esc(Site.formatDate(t.date))}</time>` : ''}</figcaption>
      </figure>`;
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
    const testimonials = (site.testimonials || []).filter((t) => t.authorized === true && t.name && t.text);
    // Só mostra números que têm fonte/comprovação registrada.
    const stats = (site.stats || []).filter((s) => s.value && s.source);
    const cats = [...new Set(portfolio.map((x) => x.category).filter(Boolean))];

    $('#conteudo').innerHTML = `
      <section class="hero" id="inicio">
        <div class="wrap hero-grid">
          <div>
            <span class="eyebrow"><span class="dot"></span>Disponível para novos projetos</span>
            <h1>${esc(first)} <span class="grad">${esc(rest.join(' '))}</span></h1>
            <p class="role">${esc(p.title)}</p>
            <p class="tagline">${esc(p.tagline)}</p>
            <div class="hero-cta">
              ${ext(waMain, `${icon('whatsapp')} Falar no WhatsApp`, 'class="btn btn-wa"')}
              <a class="btn" href="#servicos">Ver serviços ${icon('arrow')}</a>
            </div>
            ${stats.length ? `<div class="stats">${stats.map((s) => `<div class="stat"><strong>${esc(s.value)}</strong><span>${esc(s.label)}</span><small class="stat-source">Fonte: ${esc(s.source)}</small></div>`).join('')}</div>` : ''}
          </div>
          <div class="portrait">
            <div class="portrait-ring"></div>
            <div class="portrait-frame">${photo ? `<img src="${esc(photo)}" alt="${esc(p.photoAlt || `Foto de ${name}`)}">` : `<div class="avatar-fallback" aria-hidden="true">${esc(initials(name))}</div>`}</div>
            <div class="badge-float badge-a" aria-hidden="true">${icon('ai')} IA &amp; Robótica</div>
            <div class="badge-float badge-b" aria-hidden="true">${icon('chart')} Gestão &amp; Negócios</div>
          </div>
        </div>
      </section>

      <section class="block alt" id="sobre">
        <div class="wrap about-grid">
          <div class="reveal">
            <div class="head head-tight"><span class="kicker">Sobre mim</span><h2>Ensino, desenvolvo e conecto tecnologia a negócios</h2></div>
            <p class="about-text">${esc(p.bio)}</p>
          </div>
          <div class="reveal">
            <div class="head head-tight"><h3 class="kicker">Áreas de atuação</h3></div>
            <ul class="areas">${(site.areas || []).map((a) => `<li class="chip">${icon(catIcon(a))}${esc(a)}</li>`).join('')}</ul>
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
          <div class="head reveal"><span class="kicker">Loja</span><h2>Cursos e produtos</h2><p>Pague via Pix e envie o comprovante pelo WhatsApp. Você tem 7 dias para desistir da compra, conforme a <a href="reembolso.html">Política de Reembolso</a>.</p></div>
          <div class="grid">${products.map((s, i) => offerCard(s, 'products', i)).join('')}</div>
        </div>
      </section>` : ''}

      ${portfolio.length ? `
      <section class="block" id="portfolio">
        <div class="wrap">
          <div class="head reveal"><span class="kicker">Portfólio</span><h2>Projetos, palestras e trabalhos</h2></div>
          ${cats.length > 1 ? `<div class="filters" role="group" aria-label="Filtrar portfólio por categoria"><button type="button" class="filter active" aria-pressed="true" data-filter="">Todos</button>${cats.map((x) => `<button type="button" class="filter" aria-pressed="false" data-filter="${esc(x)}">${esc(x)}</button>`).join('')}</div>` : ''}
          <div class="grid" id="pfGrid">${portfolio.map(portfolioCard).join('')}</div>
        </div>
      </section>` : ''}

      ${testimonials.length ? `
      <section class="block alt" id="depoimentos">
        <div class="wrap">
          <div class="head reveal"><span class="kicker">Depoimentos</span><h2>O que dizem alunos e clientes</h2><p>Depoimentos reais, publicados com autorização dos autores.</p></div>
          <div class="grid">${testimonials.map(testimonialCard).join('')}</div>
        </div>
      </section>` : ''}

      <section class="block" id="contato">
        <div class="wrap">
          <div class="contact-card reveal">
            <div>
              <span class="eyebrow"><span class="dot"></span>Contato</span>
              <h2 class="contact-title">Vamos conversar?</h2>
              <p>Me chame no WhatsApp para tirar dúvidas, pedir um orçamento ou agendar uma mentoria, aula ou palestra.</p>
              ${ext(waMain, `${icon('whatsapp')} Chamar no WhatsApp`, 'class="btn btn-wa"')}
            </div>
            <ul class="contact-list">
              ${c.whatsapp ? `<li>${ext(waMain, `${icon('whatsapp')}<span><small>WhatsApp</small>${esc(Site.formatPhone(c.whatsapp))}</span>`, 'class="contact-item"')}</li>` : ''}
              ${c.email ? `<li><a class="contact-item" href="mailto:${esc(c.email)}">${icon('mail')}<span><small>E-mail</small>${esc(c.email)}</span></a></li>` : ''}
              ${p.location ? `<li class="contact-item">${icon('pin')}<span><small>Atendimento</small>${esc(p.location)} · online e presencial</span></li>` : ''}
              ${[['instagram', c.instagram, 'Instagram'], ['linkedin', c.linkedin, 'LinkedIn'], ['youtube', c.youtube, 'YouTube'], ['github', c.github, 'GitHub']]
                .filter(([, url]) => safeUrl(url))
                .map(([ic, url, label]) => `<li>${ext(safeUrl(url), `${icon(ic)}<span><small>${label}</small>${esc(String(url).replace(/^https?:\/\/(www\.)?/, ''))}</span>`, 'class="contact-item"')}</li>`).join('')}
            </ul>
          </div>
        </div>
      </section>`;

    document.querySelectorAll('[data-section]').forEach((a) => (a.hidden = !document.getElementById(a.dataset.section)));
    Site.init(site);
    bind();
  }

  function bind() {
    document.querySelectorAll('[data-pay]').forEach((b) =>
      b.addEventListener('click', () => {
        const [kind, i] = b.dataset.pay.split(':');
        openPix(site[kind][+i], b);
      })
    );

    document.querySelectorAll('.filter').forEach((f) =>
      f.addEventListener('click', () => {
        document.querySelectorAll('.filter').forEach((x) => {
          x.classList.toggle('active', x === f);
          x.setAttribute('aria-pressed', String(x === f));
        });
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

  // ---------- Modal de pagamento Pix ----------
  const legalNote = `<p class="legal-note">Ao pagar, você concorda com os <a href="termos.html">Termos de Uso</a> e a <a href="reembolso.html">Política de Reembolso</a>, que inclui 7 dias para desistir da compra.</p>`;

  function openPix(item, trigger) {
    const pix = site.pix || {};
    const v = Site.values(site);
    const key = item.pixKey || pix.key;
    const keyType = item.pixKey ? item.pixKeyType || pix.keyType : pix.keyType;
    const amount = Number(item.price);
    const body = $('#pixBody');

    if (!key) {
      body.innerHTML = `
        <p class="pix-head">${icon('pix')} Pagamento via Pix</p>
        <h2 id="pixTitle">${esc(item.title)}</h2>
        <p class="pix-amount">${brl(amount)}</p>
        <p class="notice">O pagamento via Pix ainda não foi configurado. Fale comigo pelo WhatsApp para combinar.</p>
        ${ext(waLink(site.contact.whatsapp, `Olá! Quero adquirir "${item.title}" (${brl(amount)}). Como faço o pagamento?`), `${icon('whatsapp')} Combinar pagamento no WhatsApp`, 'class="btn btn-wa btn-block"')}
        ${legalNote}`;
      showModal(trigger);
      return;
    }

    const receiver = pix.receiverName || site.profile.name;
    const code = Pix.payload({ key, keyType, name: receiver, city: pix.city, amount, description: item.title });
    let qrSvg = '';
    try {
      const qr = qrcode(0, 'M');
      qr.addData(code);
      qr.make();
      qrSvg = qr.createSvgTag({ cellSize: 4, margin: 0, scalable: true, alt: 'QR Code do Pix', title: 'QR Code do Pix' });
    } catch (e) { /* sem QR, o copia-e-cola ainda funciona */ }

    body.innerHTML = `
      <p class="pix-head">${icon('pix')} Pagamento via Pix</p>
      <h2 id="pixTitle">${esc(item.title)}</h2>
      <p class="pix-amount">${brl(amount)}</p>
      ${qrSvg ? `<div class="qr" role="img" aria-label="QR Code do Pix no valor de ${brl(amount)}">${qrSvg}</div>` : ''}
      <div class="copy-box">
        <label class="sr-only" for="pixCode">Código Pix copia e cola</label>
        <input id="pixCode" readonly value="${esc(code)}">
        <button type="button" class="btn btn-primary btn-sm" id="copyPix">${icon('copy')} Copiar código Pix</button>
      </div>
      <p class="pix-info">Recebedor: <b>${esc(receiver)}</b>${v.cnpj ? ` · CNPJ <b>${esc(v.cnpj)}</b>` : ''} · Chave: <b>${esc(Pix.normalizeKey(key, keyType))}</b></p>
      <ol class="steps">
        <li><span aria-hidden="true">1</span>Abra o app do seu banco e escaneie o QR Code ou use o Pix Copia e Cola.</li>
        <li><span aria-hidden="true">2</span>Confira o valor e o recebedor, e conclua o pagamento.</li>
        <li><span aria-hidden="true">3</span>Envie o comprovante pelo WhatsApp no botão abaixo.</li>
      </ol>
      <div class="field">
        <label for="buyerName">Seu nome (opcional)</label>
        <input id="buyerName" placeholder="Ex.: Maria Silva" autocomplete="name" aria-describedby="buyerHelp">
        <small id="buyerHelp">Serve só para montar a mensagem do WhatsApp e não fica salvo neste site. Veja a <a href="privacidade.html">Política de Privacidade</a>.</small>
      </div>
      <a class="btn btn-wa btn-block" id="sendProof" target="_blank" rel="noopener noreferrer">${icon('whatsapp')} Já paguei: enviar comprovante no WhatsApp<span class="sr-only"> (abre em nova aba)</span></a>
      ${legalNote}`;

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
      Site.toast('Código Pix copiado!');
    });

    showModal(trigger);
  }

  let lastTrigger = null;
  const BACKGROUND = ['header', 'main', 'footer'];
  const focusables = (root) => [...root.querySelectorAll('a[href], button, input, select, textarea')].filter((e) => !e.disabled);

  function showModal(trigger) {
    const m = $('#pixModal');
    lastTrigger = trigger || document.activeElement;
    m.hidden = false;
    document.body.classList.add('modal-open');
    BACKGROUND.forEach((s) => document.querySelector(s)?.setAttribute('inert', ''));
    (m.querySelector('.modal-close') || focusables(m)[0]).focus();
  }

  function hideModal() {
    const m = $('#pixModal');
    if (m.hidden) return;
    m.hidden = true;
    document.body.classList.remove('modal-open');
    BACKGROUND.forEach((s) => document.querySelector(s)?.removeAttribute('inert'));
    if (lastTrigger) lastTrigger.focus();
  }

  $('#pixModal').addEventListener('keydown', (e) => {
    if (e.key !== 'Tab') return;
    const list = focusables($('#pixModal'));
    const first = list[0], last = list[list.length - 1];
    if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
    else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
  });
  document.addEventListener('click', (e) => { if (e.target.closest('[data-close]')) hideModal(); });
  document.addEventListener('keydown', (e) => e.key === 'Escape' && hideModal());
  document.querySelector('.modal-close').innerHTML = icon('x');

  Site.load()
    .then((data) => { site = data; render(); })
    .catch(() => { $('#conteudo').innerHTML = '<p class="loading">Não foi possível carregar o conteúdo.</p>'; });
})();
