(() => {
  const $ = (s, r = document) => r.querySelector(s);
  const DATA_PATH = 'data/site.json';
  const CFG_KEY = 'admin-config';

  let cfg = null;      // { owner, repo, branch, token } ou null no modo offline
  let data = null;     // conteúdo do site
  let sha = null;      // versão do site.json no GitHub
  let dirty = false;
  let current = 'perfil';
  const previews = {}; // caminho da imagem -> dataURL, até o GitHub Pages atualizar

  // ---------- Utilidades ----------
  function el(tag, attrs = {}, ...children) {
    const e = document.createElement(tag);
    for (const [k, v] of Object.entries(attrs)) {
      if (k === 'class') e.className = v;
      else if (k.startsWith('on')) e.addEventListener(k.slice(2), v);
      else if (v !== undefined && v !== null && v !== false) e.setAttribute(k, v === true ? '' : v);
    }
    for (const c of children.flat()) if (c != null) e.append(c.nodeType ? c : document.createTextNode(c));
    return e;
  }
  const html = (s) => { const t = document.createElement('template'); t.innerHTML = s; return t.content; };

  function toast(msg) {
    const t = $('#toast');
    t.textContent = msg;
    t.hidden = false;
    clearTimeout(toast.timer);
    toast.timer = setTimeout(() => (t.hidden = true), 2600);
  }

  function setStatus(text, cls = '') {
    const s = $('#status');
    s.textContent = text;
    s.className = 'status ' + cls;
  }

  function markDirty() {
    dirty = true;
    setStatus('Alterações não publicadas', 'dirty');
    try { localStorage.setItem('site-draft', JSON.stringify(data)); } catch (e) { /* ignora */ }
  }

  const b64encode = (str) => {
    const bytes = new TextEncoder().encode(str);
    let bin = '';
    for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
    return btoa(bin);
  };
  const b64decode = (b64) => new TextDecoder().decode(Uint8Array.from(atob(b64.replace(/\s/g, '')), (c) => c.charCodeAt(0)));

  // ---------- GitHub API ----------
  async function gh(path, opts = {}) {
    const res = await fetch(`https://api.github.com/repos/${cfg.owner}/${cfg.repo}/${path}`, {
      ...opts,
      headers: {
        Accept: 'application/vnd.github+json',
        Authorization: `Bearer ${cfg.token}`,
        'X-GitHub-Api-Version': '2022-11-28',
        ...(opts.body ? { 'Content-Type': 'application/json' } : {}),
      },
    });
    if (!res.ok) {
      let msg = res.statusText;
      try { msg = (await res.json()).message || msg; } catch (e) { /* ignora */ }
      const err = new Error(msg);
      err.status = res.status;
      throw err;
    }
    return res.json();
  }

  async function fetchRemote() {
    const file = await gh(`contents/${DATA_PATH}?ref=${encodeURIComponent(cfg.branch)}`);
    sha = file.sha;
    return JSON.parse(b64decode(file.content));
  }

  async function putFile(path, base64, message, fileSha) {
    return gh(`contents/${path}`, {
      method: 'PUT',
      body: JSON.stringify({ message, content: base64, branch: cfg.branch, ...(fileSha ? { sha: fileSha } : {}) }),
    });
  }

  function explain(err) {
    if (err.status === 401) return 'Token inválido ou expirado.';
    if (err.status === 403) return 'O token não tem permissão de escrita (Contents: Read and write).';
    if (err.status === 404) return 'Repositório, branch ou arquivo não encontrado. Confira usuário, repositório e branch.';
    if (err.status === 409) return 'O arquivo mudou no GitHub enquanto você editava. Recarregue a página.';
    return err.message || 'Erro desconhecido.';
  }

  // ---------- Login ----------
  function guessRepo() {
    const m = location.hostname.match(/^([^.]+)\.github\.io$/i);
    if (!m) return {};
    const seg = location.pathname.split('/').filter(Boolean)[0];
    const repo = seg && !/\.html?$/i.test(seg) ? seg : `${m[1]}.github.io`;
    return { owner: m[1], repo };
  }

  function initLogin() {
    let saved = {};
    try { saved = JSON.parse(localStorage.getItem(CFG_KEY) || '{}'); } catch (e) { /* ignora */ }
    const guess = guessRepo();
    $('#cfgOwner').value = saved.owner || guess.owner || '';
    $('#cfgRepo').value = saved.repo || guess.repo || '';
    $('#cfgBranch').value = saved.branch || 'main';
    $('#cfgToken').value = saved.token || '';

    $('#connectBtn').addEventListener('click', connect);
    $('#cfgToken').addEventListener('keydown', (e) => e.key === 'Enter' && connect());
    $('#offlineBtn').addEventListener('click', async () => {
      cfg = null;
      try {
        data = await (await fetch(DATA_PATH + '?v=' + Date.now(), { cache: 'no-store' })).json();
      } catch (e) {
        $('#loginMsg').textContent = 'Não foi possível ler data/site.json.';
        return;
      }
      openEditor();
      setStatus('Modo offline: ao salvar, um arquivo site.json será baixado.');
    });

    if (saved.token && saved.owner && saved.repo) connect();
  }

  async function connect() {
    const c = {
      owner: $('#cfgOwner').value.trim(),
      repo: $('#cfgRepo').value.trim(),
      branch: $('#cfgBranch').value.trim() || 'main',
      token: $('#cfgToken').value.trim(),
    };
    const msg = $('#loginMsg');
    if (!c.owner || !c.repo || !c.token) { msg.textContent = 'Preencha usuário, repositório e token.'; return; }
    msg.className = 'msg ok';
    msg.textContent = 'Conectando…';
    cfg = c;
    try {
      data = await fetchRemote();
      try {
        if ($('#cfgRemember').checked) localStorage.setItem(CFG_KEY, JSON.stringify(c));
        else localStorage.removeItem(CFG_KEY);
      } catch (e) { /* ignora */ }
      msg.textContent = '';
      openEditor();
      setStatus(`Conectado a ${c.owner}/${c.repo}`, 'ok');
    } catch (err) {
      cfg = null;
      msg.className = 'msg';
      msg.textContent = explain(err);
    }
  }

  // ---------- Editor ----------
  const TABS = [
    ['perfil', 'Perfil', 'mentor'],
    ['contato', 'Contato', 'whatsapp'],
    ['pix', 'Pix', 'pix'],
    ['services', 'Serviços', 'training'],
    ['products', 'Produtos / Loja', 'bag'],
    ['portfolio', 'Portfólio', 'spark'],
    ['testimonials', 'Depoimentos', 'mentor'],
    ['empresa', 'Empresa & Legal', 'book'],
  ];

  const KEY_TYPES = { email: 'E-mail', telefone: 'Telefone', cpf: 'CPF', cnpj: 'CNPJ', aleatoria: 'Chave aleatória' };

  function openEditor() {
    data.profile ||= {}; data.contact ||= {}; data.pix ||= {};
    data.services ||= []; data.products ||= []; data.portfolio ||= []; data.areas ||= []; data.stats ||= [];
    data.company ||= {}; data.policies ||= {}; data.analytics ||= {}; data.testimonials ||= [];
    // Versões antigas guardavam o CNPJ no perfil.
    if (data.profile.cnpj && !data.company.cnpj) data.company.cnpj = data.profile.cnpj;
    delete data.profile.cnpj;
    $('#loginView').hidden = true;
    $('#editorView').hidden = false;
    $('#tabs').replaceChildren(
      ...TABS.map(([id, label, ic]) =>
        el('button', { type: 'button', class: 'tab', 'data-tab': id, onclick: () => { current = id; renderPanel(); } }, html(icon(ic)), label)
      )
    );
    renderPanel();
  }

  function renderPanel() {
    document.querySelectorAll('.tab').forEach((t) => t.classList.toggle('active', t.dataset.tab === current));
    const p = $('#panel');
    p.replaceChildren();
    ({
      perfil: panelPerfil, contato: panelContato, pix: panelPix, empresa: panelEmpresa,
      services: () => panelList('services'), products: () => panelList('products'),
      portfolio: panelPortfolio, testimonials: panelTestimonials,
    })[current](p);
  }

  // Aviso padrão para textos: aponta promessas que não dá para comprovar.
  const claimWarning = (v) => {
    const found = Compliance.findRiskyClaims(v);
    return found.length ? `Atenção: evite promessas que você não consegue comprovar ("${found[0]}"). O CDC proíbe publicidade enganosa.` : '';
  };

  // Campos ligados a um objeto, com caminho (ex.: "profile.tagline") para identificação.
  const bound = (ns, obj) => (key, label, type, opts = {}) => field(obj, key, label, type, { ...opts, path: `${ns}.${key}` });

  // Campo ligado diretamente a obj[key].
  function field(obj, key, label, type = 'text', opts = {}) {
    let input;
    const warn = el('small', { class: 'warn', 'aria-live': 'polite' });
    const validate = opts.validate || (type === 'text' || type === 'textarea' ? claimWarning : null);
    const check = (v) => { if (validate) warn.textContent = validate(v) || ''; };
    const onChange = (v) => { obj[key] = v; markDirty(); check(v); opts.onChange?.(v); };
    if (type === 'textarea') {
      input = el('textarea', { placeholder: opts.placeholder || '' });
      input.value = obj[key] ?? '';
      input.addEventListener('input', () => onChange(input.value));
    } else if (type === 'select') {
      input = el('select', {}, Object.entries(opts.options).map(([v, l]) => el('option', { value: v }, l)));
      input.value = obj[key] ?? Object.keys(opts.options)[0];
      input.addEventListener('change', () => onChange(input.value));
    } else if (type === 'checkbox') {
      input = el('input', { type: 'checkbox' });
      input.checked = !!obj[key];
      input.addEventListener('change', () => onChange(input.checked));
      return el('label', { class: 'f inline' }, input, el('span', {}, label));
    } else if (type === 'number') {
      input = el('input', { type: 'number', step: '0.01', min: '0', placeholder: opts.placeholder || '' });
      input.value = obj[key] ?? '';
      input.addEventListener('input', () => onChange(input.value === '' ? 0 : Number(input.value)));
    } else if (type === 'image') {
      return imageField(obj, key, label);
    } else {
      input = el('input', { type, placeholder: opts.placeholder || '' });
      input.value = obj[key] ?? '';
      input.addEventListener('input', () => onChange(input.value));
    }
    check(input.value);
    return el('label', { class: 'f', 'data-field': opts.path }, el('span', {}, label), input, opts.hint ? el('small', {}, opts.hint) : null, warn);
  }

  function imageField(obj, key, label) {
    const prev = el('img', { class: 'img-prev', alt: '' });
    const url = el('input', { type: 'text', placeholder: 'assets/uploads/foto.jpg ou https://…' });
    const refresh = () => {
      const v = obj[key] || '';
      url.value = v;
      prev.src = previews[v] || v || 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7';
    };
    url.addEventListener('input', () => { obj[key] = url.value.trim(); markDirty(); refresh(); });

    const file = el('input', { type: 'file', accept: 'image/*' });
    const status = el('small', {});
    file.addEventListener('change', async () => {
      const f = file.files[0];
      if (!f) return;
      status.textContent = 'Processando imagem…';
      try {
        const dataUrl = await resizeImage(f, key === 'photo' ? 900 : 1400);
        if (cfg) {
          const slug = f.name.replace(/\.[^.]+$/, '').normalize('NFD').replace(/[^\w-]+/g, '-').toLowerCase().slice(0, 40) || 'imagem';
          const path = `assets/uploads/${Date.now()}-${slug}.jpg`;
          status.textContent = 'Enviando para o GitHub…';
          await putFile(path, dataUrl.split(',')[1], `Upload de imagem: ${slug}`);
          previews[path] = dataUrl;
          obj[key] = path;
          status.textContent = 'Imagem enviada. Clique em “Salvar e publicar” para aplicar.';
        } else {
          obj[key] = dataUrl;
          status.textContent = 'Imagem embutida (modo offline).';
        }
        markDirty();
        refresh();
      } catch (err) {
        status.textContent = 'Falha no envio: ' + explain(err);
      }
      file.value = '';
    });

    const clear = el('button', { class: 'btn btn-sm', type: 'button', onclick: () => { obj[key] = ''; markDirty(); refresh(); } }, 'Remover');
    refresh();
    return el('div', { class: 'f' },
      el('span', {}, label),
      el('div', { class: 'img-field' }, prev,
        el('div', { class: 'stack' }, url,
          el('div', { style: 'display:flex;gap:8px;flex-wrap:wrap' }, el('label', { class: 'upload btn btn-sm' }, 'Enviar imagem', file), clear),
          status)));
  }

  function resizeImage(file, max) {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => {
        const scale = Math.min(1, max / Math.max(img.width, img.height));
        const c = document.createElement('canvas');
        c.width = Math.round(img.width * scale);
        c.height = Math.round(img.height * scale);
        c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
        URL.revokeObjectURL(img.src);
        resolve(c.toDataURL('image/jpeg', 0.85));
      };
      img.onerror = reject;
      img.src = URL.createObjectURL(file);
    });
  }

  const head = (p, title, sub) => p.append(el('h2', {}, title), el('p', {}, sub));

  function panelPerfil(p) {
    const d = data.profile;
    const f = bound('profile', d);
    head(p, 'Perfil', 'Seu nome, foto e apresentação que aparecem no topo do site.');
    p.append(
      el('div', { class: 'box' },
        f('photo', 'Sua foto', 'image'),
        f('photoAlt', 'Descrição da foto (para leitores de tela)', 'text', { placeholder: 'Ex.: Kenji sorrindo, de terno azul-marinho', hint: 'Descreva a foto para quem não pode vê-la. Lei Brasileira de Inclusão (13.146/2015).' }),
        el('div', { class: 'grid2' },
          f('name', 'Nome', 'text', { placeholder: 'Prof. Seu Nome' }),
          f('title', 'Título / profissão', 'text', { placeholder: 'Professor · Mentor · Desenvolvedor' })),
        f('tagline', 'Frase de destaque', 'textarea'),
        f('bio', 'Sobre mim', 'textarea'),
        f('location', 'Cidade / Estado', 'text', { placeholder: 'São Paulo - SP' })
      ),
      el('div', { class: 'box' },
        el('label', { class: 'f' }, el('span', {}, 'Áreas de atuação (uma por linha)'),
          (() => {
            const t = el('textarea', {});
            t.value = data.areas.join('\n');
            t.addEventListener('input', () => { data.areas = t.value.split('\n').map((s) => s.trim()).filter(Boolean); markDirty(); });
            return t;
          })())
      ),
      el('div', { class: 'box' },
        el('h3', { class: 'kicker' }, 'Números de destaque'),
        el('p', { class: 'notice-box' }, 'Use só números que você consegue provar (certificados, contratos, listas de presença). O número só aparece no site se a fonte estiver preenchida.'),
        ...data.stats.map((s, i) =>
          el('div', { style: 'display:grid;grid-template-columns:110px 1fr 1fr 32px;gap:8px;align-items:start' },
            field(s, 'value', 'Número'), field(s, 'label', 'Descrição'), field(s, 'source', 'Fonte / comprovação', 'text', { placeholder: 'Ex.: certificados emitidos 2019–2025' }),
            el('button', { type: 'button', class: 'icon-btn danger', style: 'margin-top:26px', 'aria-label': 'Remover número', title: 'Remover', onclick: () => { data.stats.splice(i, 1); markDirty(); renderPanel(); } }, html(icon('x'))))),
        el('button', { type: 'button', class: 'btn btn-sm add-btn', onclick: () => { data.stats.push({ value: '', label: '', source: '' }); markDirty(); renderPanel(); } }, '+ Adicionar número')
      )
    );
  }

  function panelContato(p) {
    const d = data.contact;
    head(p, 'Contato', 'Como as pessoas falam com você. O WhatsApp recebe os pedidos e comprovantes de Pix.');
    p.append(el('div', { class: 'box' },
      field(d, 'whatsapp', 'WhatsApp (com código do país e DDD)', 'text', { placeholder: '5511999999999', hint: 'Só números. Ex.: 55 + DDD + número → 5511999999999' }),
      field(d, 'whatsappMessage', 'Mensagem inicial do WhatsApp', 'text'),
      field(d, 'email', 'E-mail', 'email'),
      el('div', { class: 'grid2' },
        field(d, 'instagram', 'Instagram (link)', 'url', { placeholder: 'https://instagram.com/…' }),
        field(d, 'linkedin', 'LinkedIn (link)', 'url', { placeholder: 'https://linkedin.com/in/…' }),
        field(d, 'youtube', 'YouTube (link)', 'url', { placeholder: 'https://youtube.com/@…' }),
        field(d, 'github', 'GitHub (link)', 'url', { placeholder: 'https://github.com/…' }))
    ));
  }

  function panelPix(p) {
    const d = data.pix;
    head(p, 'Pix', 'Chave padrão usada nos pagamentos. Cada serviço ou produto pode ter uma chave própria.');
    const test = el('small', { style: 'overflow-wrap:anywhere' });
    const updateTest = () => {
      test.textContent = d.key
        ? 'Exemplo de código gerado (R$ 1,00): ' + Pix.payload({ key: d.key, keyType: d.keyType, name: d.receiverName || data.profile.name, city: d.city, amount: 1 })
        : 'Preencha a chave para ver um exemplo.';
    };
    p.append(el('div', { class: 'box' },
      el('div', { class: 'grid2' },
        field(d, 'keyType', 'Tipo da chave', 'select', { options: KEY_TYPES, onChange: updateTest }),
        field(d, 'key', 'Chave Pix', 'text', { onChange: updateTest, hint: 'Telefone: com DDD. CPF/CNPJ: pode digitar com ou sem pontos.' }),
        field(d, 'receiverName', 'Nome do recebedor (como no banco)', 'text', { onChange: updateTest, hint: 'Até 25 letras, sem acentos é o ideal.' }),
        field(d, 'city', 'Cidade do recebedor', 'text', { onChange: updateTest, hint: 'Até 15 letras.' })),
      test,
      el('p', { class: 'muted', style: 'font-size:.85rem;margin-top:14px' }, 'Dica: depois de publicar, faça um teste pagando R$ 1,00 pelo site para conferir se o Pix cai na conta certa.')
    ));
    updateTest();
  }

  function listControls(list, i) {
    const move = (to) => { const [x] = list.splice(i, 1); list.splice(to, 0, x); markDirty(); renderPanel(); };
    return [
      el('button', { type: 'button', class: 'icon-btn', title: 'Subir', 'aria-label': 'Mover para cima', disabled: i === 0, onclick: () => move(i - 1) }, '↑'),
      el('button', { type: 'button', class: 'icon-btn', title: 'Descer', 'aria-label': 'Mover para baixo', disabled: i === list.length - 1, onclick: () => move(i + 1) }, '↓'),
      el('button', {
        type: 'button', class: 'icon-btn danger', title: 'Excluir', 'aria-label': 'Excluir item',
        onclick: (e) => { e.stopPropagation(); if (confirm('Excluir este item?')) { list.splice(i, 1); markDirty(); renderPanel(); } },
      }, html(icon('x'))),
    ];
  }

  function itemCard(titleText, extra, body, open) {
    const title = el('strong', {}, titleText || '(sem título)');
    const card = el('div', { class: 'item' + (open ? ' open' : '') });
    const bodyId = 'item-' + Math.random().toString(36).slice(2, 9);
    const hasTag = extra[0] && extra[0].classList && extra[0].classList.contains('price-tag');
    const tag = hasTag ? extra[0] : null;
    const controls = hasTag ? extra.slice(1) : extra;
    const toggle = el('button', { type: 'button', class: 'item-toggle', 'aria-expanded': String(!!open), 'aria-controls': bodyId }, title, tag);
    toggle.addEventListener('click', () => toggle.setAttribute('aria-expanded', String(card.classList.toggle('open'))));
    card.append(el('div', { class: 'item-head' }, toggle, ...controls), el('div', { class: 'item-body', id: bodyId }, ...body));
    return { card, title };
  }

  function panelList(kind) {
    const p = $('#panel');
    const list = data[kind];
    const isProd = kind === 'products';
    head(p, isProd ? 'Produtos / Loja' : 'Serviços',
      isProd ? 'Cursos, e-books, kits e outros itens à venda. Sem produtos, a seção Loja some do site.'
             : 'Mentoria, treinamentos, aulas, palestras… Preço 0 aparece como “sob consulta”.');
    const brl = (v) => Number(v || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

    list.forEach((it, i) => {
      const priceTag = el('span', { class: 'price-tag' }, Number(it.price) > 0 ? brl(it.price) : 'sob consulta');
      const { card, title } = itemCard(it.title, [priceTag, ...listControls(list, i)], [
        el('div', { class: 'grid2' },
          field(it, 'title', 'Título', 'text', { onChange: (v) => (title.textContent = v || '(sem título)') }),
          field(it, 'icon', 'Ícone (usado quando não há imagem)', 'select', { options: ICON_CHOICES })),
        field(it, 'description', 'Descrição', 'textarea'),
        ...imageGroup(it, 'Imagem (opcional)'),
        el('div', { class: 'grid2' },
          field(it, 'price', 'Preço (R$)', 'number', { placeholder: '0 = sob consulta', onChange: (v) => (priceTag.textContent = v > 0 ? brl(v) : 'sob consulta') }),
          field(it, 'priceNote', 'Observação do preço', 'text', { placeholder: 'por hora, por sessão, a partir de…' })),
        field(it, 'buyable', 'Mostrar botão de pagamento via Pix', 'checkbox'),
        el('details', { class: 'help' },
          el('summary', {}, 'Chave Pix específica para este item (opcional)'),
          el('div', { class: 'grid2', style: 'margin-top:12px' },
            field(it, 'pixKeyType', 'Tipo da chave', 'select', { options: { '': 'Usar a chave padrão', ...KEY_TYPES } }),
            field(it, 'pixKey', 'Chave Pix', 'text', { hint: 'Vazio = usa a chave da aba Pix.' }))),
      ], it._new);
      delete it._new;
      p.append(card);
    });

    p.append(el('button', {
      type: 'button', class: 'btn add-btn',
      onclick: () => {
        list.push({ title: isProd ? 'Novo produto' : 'Novo serviço', icon: isProd ? 'bag' : 'spark', description: '', image: '', imageAlt: '', imageCredit: '', price: 0, priceNote: '', buyable: true, pixKeyType: '', pixKey: '', _new: true });
        markDirty(); renderPanel();
      },
    }, isProd ? '+ Adicionar produto' : '+ Adicionar serviço'));
  }

  function imageGroup(it, label) {
    return [
      field(it, 'image', label, 'image'),
      el('div', { class: 'grid2' },
        field(it, 'imageAlt', 'Descrição da imagem (texto alternativo)', 'text', { hint: 'O que aparece na imagem, para leitores de tela.' }),
        field(it, 'imageCredit', 'Crédito / fonte da imagem', 'text', { placeholder: 'Ex.: Foto: Fulano / Unsplash', hint: 'Use só imagens suas, licenciadas ou autorizadas.' })),
    ];
  }

  function panelTestimonials(p) {
    const list = data.testimonials;
    head(p, 'Depoimentos', 'Só depoimentos reais, com autorização do autor. Sem a confirmação, o depoimento não aparece no site.');
    p.append(el('p', { class: 'notice-box' }, 'Guarde a autorização por escrito (print do WhatsApp ou e-mail em que a pessoa autoriza publicar o texto com o nome dela). Depoimento inventado é publicidade enganosa (CDC art. 37).'));
    list.forEach((it, i) => {
      const { card, title } = itemCard(it.name, listControls(list, i), [
        el('div', { class: 'grid2' },
          field(it, 'name', 'Nome do autor', 'text', { onChange: (v) => (title.textContent = v || '(sem título)') }),
          field(it, 'role', 'Quem é (ex.: aluno de robótica)', 'text'),
          field(it, 'date', 'Data (AAAA-MM)', 'text', { placeholder: '2025-05' })),
        field(it, 'text', 'Depoimento (como a pessoa escreveu)', 'textarea'),
        field(it, 'authorized', 'Confirmo que o depoimento é real e que o autor autorizou por escrito a publicação com o nome dele', 'checkbox'),
      ], it._new);
      delete it._new;
      p.append(card);
    });
    p.append(el('button', {
      type: 'button', class: 'btn add-btn',
      onclick: () => { list.unshift({ name: '', role: '', text: '', date: new Date().toISOString().slice(0, 7), authorized: false, _new: true }); markDirty(); renderPanel(); },
    }, '+ Adicionar depoimento'));
  }

  function panelEmpresa(p) {
    const co = bound('company', data.company);
    const pol = bound('policies', data.policies);
    const an = bound('analytics', data.analytics);
    head(p, 'Empresa & Legal', 'Dados obrigatórios para vender pela internet (Decreto 7.962/2013) e prazos das suas políticas.');
    if (!Compliance.isValidCNPJ(data.company.cnpj)) {
      p.append(el('p', { class: 'notice-box' }, 'Preencha o nome empresarial, o CNPJ e o endereço: a lei exige que eles apareçam em sites que vendem produtos ou serviços.'));
    }
    p.append(
      el('div', { class: 'box' },
        el('div', { class: 'grid2' },
          co('legalName', 'Nome empresarial (como no cartão CNPJ)', 'text', { placeholder: 'Ex.: KENJI SUZUKI 12345678000195' }),
          co('tradeName', 'Nome fantasia (opcional)', 'text'),
          co('cnpj', 'CNPJ', 'text', { placeholder: '00.000.000/0000-00', validate: (v) => (v && !Compliance.isValidCNPJ(v) ? 'CNPJ inválido: confira os números.' : '') })),
        co('address', 'Endereço (aparece no rodapé e nas políticas)', 'text', { placeholder: 'Rua, número - bairro, cidade - UF, CEP', hint: 'Se for o endereço da sua casa, você pode usar um endereço comercial ou caixa postal.' })
      ),
      el('div', { class: 'box' },
        el('h3', { class: 'kicker' }, 'Política de Reembolso'),
        el('div', { class: 'grid2' },
          pol('cancelHours', 'Antecedência mínima para cancelar sem custo (horas)', 'number'),
          pol('refundDays', 'Prazo para devolver o dinheiro (dias)', 'number'),
          pol('updatedAt', 'Data da última atualização das políticas', 'date', { hint: 'Atualize sempre que mudar algum prazo.' }))
      ),
      el('div', { class: 'box' },
        el('h3', { class: 'kicker' }, 'Google Analytics (opcional)'),
        an('gaId', 'ID de medição do Google Analytics 4', 'text', {
          placeholder: 'G-XXXXXXXXXX',
          validate: (v) => (v && !Compliance.isValidGaId(v) ? 'ID inválido. Use o formato G-XXXXXXXXXX.' : ''),
          hint: 'Deixe vazio para não usar. Se preencher, o site passa a mostrar o aviso de cookies e só mede visitas de quem aceitar.',
        })
      )
    );
  }

  function panelPortfolio(p) {
    const list = data.portfolio;
    head(p, 'Portfólio', 'Projetos, palestras, cursos ministrados, trabalhos entregues. As categorias viram filtros no site.');
    list.forEach((it, i) => {
      const { card, title } = itemCard(it.title, listControls(list, i), [
        el('div', { class: 'grid2' },
          field(it, 'title', 'Título', 'text', { onChange: (v) => (title.textContent = v || '(sem título)') }),
          field(it, 'category', 'Categoria', 'text', { placeholder: 'Robótica, Palestras, IA…' }),
          field(it, 'date', 'Ano / data', 'text', { placeholder: '2025' }),
          field(it, 'link', 'Link (opcional)', 'url', { placeholder: 'https://…' })),
        field(it, 'description', 'Descrição', 'textarea'),
        ...imageGroup(it, 'Imagem'),
      ], it._new);
      delete it._new;
      p.append(card);
    });
    p.append(el('button', {
      type: 'button', class: 'btn add-btn',
      onclick: () => { list.unshift({ title: 'Novo trabalho', category: '', description: '', image: '', link: '', date: String(new Date().getFullYear()), _new: true }); markDirty(); renderPanel(); },
    }, '+ Adicionar ao portfólio'));
  }

  // ---------- Salvar ----------
  async function save() {
    const json = JSON.stringify(data, null, 2) + '\n';
    if (!cfg) {
      const a = el('a', { href: URL.createObjectURL(new Blob([json], { type: 'application/json' })), download: 'site.json' });
      a.click();
      setStatus('Arquivo baixado. Substitua data/site.json no repositório.', 'ok');
      dirty = false;
      return;
    }
    const btn = $('#saveBtn');
    btn.disabled = true;
    setStatus('Publicando…');
    try {
      const res = await putFile(DATA_PATH, b64encode(json), 'Atualiza conteúdo do site pelo painel admin', sha);
      sha = res.content.sha;
      dirty = false;
      setStatus('Publicado! O site atualiza em cerca de 1 minuto.', 'ok');
      toast('Publicado com sucesso!');
    } catch (err) {
      setStatus('Erro ao publicar: ' + explain(err), 'err');
    } finally {
      btn.disabled = false;
    }
  }

  $('#saveBtn').addEventListener('click', save);
  $('#previewBtn').addEventListener('click', () => {
    // Imagens recém-enviadas ainda não estão no site publicado: usa a versão local na prévia.
    const draft = JSON.parse(JSON.stringify(data), (k, v) => (typeof v === 'string' && previews[v] ? previews[v] : v));
    try { localStorage.setItem('site-draft', JSON.stringify(draft)); } catch (e) { toast('Prévia muito grande para o navegador.'); }
    window.open('index.html?preview=1', '_blank');
  });
  $('#logoutBtn').addEventListener('click', () => {
    if (dirty && !confirm('Há alterações não publicadas. Sair mesmo assim?')) return;
    try { localStorage.removeItem(CFG_KEY); } catch (e) { /* ignora */ }
    location.reload();
  });
  window.addEventListener('beforeunload', (e) => { if (dirty) { e.preventDefault(); e.returnValue = ''; } });

  initLogin();
})();
