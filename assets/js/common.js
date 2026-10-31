// Partes compartilhadas pelas páginas públicas: dados do site, rodapé legal,
// menu, avisos e consentimento de cookies (Google Analytics só com permissão).
window.Site = (() => {
  const $ = (s, r = document) => r.querySelector(s);
  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const brl = (v) => Number(v).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  const digits = (s) => String(s || '').replace(/\D/g, '');
  const waLink = (num, text) => `https://wa.me/${digits(num)}?text=${encodeURIComponent(text)}`;
  const safeUrl = (u) => (/^(https?:|mailto:|tel:|data:image\/|assets\/)/i.test(String(u || '').trim()) ? String(u).trim() : '');

  // Link externo: abre em nova aba, não envia a origem e avisa leitores de tela.
  const NEW_TAB = '<span class="sr-only"> (abre em nova aba)</span>';
  const ext = (href, inner, attrs = '') => `<a href="${esc(href)}" target="_blank" rel="noopener noreferrer" ${attrs}>${inner}${NEW_TAB}</a>`;

  function formatPhone(n) {
    const d = digits(n);
    const m = d.match(/^55(\d{2})(\d{4,5})(\d{4})$/);
    return m ? `(${m[1]}) ${m[2]}-${m[3]}` : d ? '+' + d : '';
  }

  function formatDate(iso) {
    const m = String(iso || '').match(/^(\d{4})-(\d{2})(?:-(\d{2}))?/);
    if (!m) return String(iso || '');
    return m[3] ? `${m[3]}/${m[2]}/${m[1]}` : `${m[2]}/${m[1]}`;
  }

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
    if (!t) return;
    t.textContent = msg;
    t.hidden = false;
    clearTimeout(toast.timer);
    toast.timer = setTimeout(() => (t.hidden = true), 2600);
  }

  // Valores usados no rodapé e nas páginas legais.
  function values(site) {
    const p = site.profile || {}, c = site.contact || {}, co = site.company || {}, pol = site.policies || {};
    return {
      name: co.tradeName || p.name || '',
      legalName: co.legalName || p.name || '',
      cnpj: co.cnpj ? Compliance.formatCNPJ(co.cnpj) : '',
      address: co.address || '',
      email: c.email || '',
      whatsapp: formatPhone(c.whatsapp),
      cancelHours: String(pol.cancelHours ?? 24),
      refundDays: String(pol.refundDays ?? 7),
      updatedAt: formatDate(pol.updatedAt),
      analytics: Compliance.isValidGaId(site.analytics && site.analytics.gaId) ? 'sim' : '',
    };
  }

  function renderFooter(site) {
    const footer = $('#footer');
    if (!footer) return;
    const v = values(site);
    const c = site.contact || {};
    const socials = [
      ['instagram', c.instagram, 'Instagram'],
      ['linkedin', c.linkedin, 'LinkedIn'],
      ['youtube', c.youtube, 'YouTube'],
      ['github', c.github, 'GitHub'],
    ].filter(([, url]) => safeUrl(url));
    const gaOn = !!v.analytics;
    const waText = (c.whatsappMessage || 'Olá! Vim pelo seu site.');

    footer.innerHTML = `
      <div class="wrap footer-grid">
        <div class="footer-company">
          <strong>${esc(v.name)}</strong>
          <p>${esc(v.legalName)}${v.cnpj ? ` · CNPJ ${esc(v.cnpj)}` : ''}</p>
          ${v.address ? `<p>${esc(v.address)}</p>` : ''}
          <p class="footer-contacts">
            ${v.email ? `<a href="mailto:${esc(v.email)}">${esc(v.email)}</a>` : ''}
            ${c.whatsapp ? ext(waLink(c.whatsapp, waText), `WhatsApp ${esc(v.whatsapp)}`) : ''}
          </p>
        </div>
        <nav class="footer-links" aria-label="Informações legais">
          <a href="privacidade.html">Política de Privacidade</a>
          <a href="termos.html">Termos de Uso</a>
          <a href="reembolso.html">Política de Reembolso</a>
          ${gaOn ? '<button type="button" class="link-btn" id="cookiePrefs">Preferências de cookies</button>' : '<a href="privacidade.html#cookies">Cookies</a>'}
        </nav>
        ${socials.length ? `<div class="socials">${socials.map(([ic, url, label]) => ext(safeUrl(url), icon(ic), `aria-label="${label} (abre em nova aba)"`)).join('')}</div>` : ''}
      </div>
      <div class="wrap footer-bottom">© ${new Date().getFullYear()} ${esc(v.legalName)}. Todos os direitos reservados.</div>
      ${c.whatsapp ? `<a class="wa-float" href="${esc(waLink(c.whatsapp, waText))}" target="_blank" rel="noopener noreferrer" aria-label="Falar no WhatsApp (abre em nova aba)">${icon('whatsapp')}</a>` : ''}`;
  }

  function initMenu() {
    const btn = $('#menuBtn');
    const menu = $('#menu');
    if (!btn || !menu) return;
    btn.innerHTML = icon('menu');
    const set = (open) => {
      menu.classList.toggle('open', open);
      btn.setAttribute('aria-expanded', String(open));
      btn.setAttribute('aria-label', open ? 'Fechar menu' : 'Abrir menu');
    };
    btn.addEventListener('click', () => set(!menu.classList.contains('open')));
    menu.addEventListener('click', (e) => e.target.closest('a') && set(false));
  }

  // ---------- Cookies e Google Analytics ----------
  const CONSENT_KEY = 'cookie-consent';
  let gaLoaded = false;

  function readConsent() {
    try { return JSON.parse(localStorage.getItem(CONSENT_KEY)); } catch (e) { return null; }
  }
  function saveConsent(analytics) {
    try { localStorage.setItem(CONSENT_KEY, JSON.stringify({ analytics, date: new Date().toISOString() })); } catch (e) { /* ignora */ }
  }

  function clearGaCookies() {
    for (const part of document.cookie.split(';')) {
      const name = part.split('=')[0].trim();
      if (!/^_ga/.test(name)) continue;
      for (const domain of ['', `; domain=${location.hostname}`, `; domain=.${location.hostname}`]) {
        document.cookie = `${name}=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/${domain}`;
      }
    }
  }

  function loadGA(id) {
    if (gaLoaded || !Compliance.isValidGaId(id)) return;
    gaLoaded = true;
    window.dataLayer = window.dataLayer || [];
    window.gtag = function () { window.dataLayer.push(arguments); };
    window.gtag('consent', 'default', { ad_storage: 'denied', ad_user_data: 'denied', ad_personalization: 'denied', analytics_storage: 'granted' });
    window.gtag('js', new Date());
    window.gtag('config', id, { allow_google_signals: false, allow_ad_personalization_signals: false });
    const s = document.createElement('script');
    s.async = true;
    s.src = 'https://www.googletagmanager.com/gtag/js?id=' + encodeURIComponent(id);
    document.head.append(s);
  }

  function initConsent(site) {
    const id = site.analytics && site.analytics.gaId;
    if (!Compliance.isValidGaId(id)) return;

    const banner = document.createElement('div');
    banner.id = 'cookieBanner';
    banner.className = 'cookie-banner';
    banner.setAttribute('role', 'region');
    banner.setAttribute('aria-label', 'Aviso de cookies');
    banner.hidden = true;
    banner.innerHTML = `
      <p>Este site pode usar cookies do <strong>Google Analytics</strong> para contar visitas de forma estatística. Só ativamos com a sua permissão e nunca para publicidade.
        <a href="privacidade.html#cookies">Ler a política de cookies</a></p>
      <div class="cookie-actions">
        <button type="button" class="btn btn-sm cookie-btn" id="cookieReject">Recusar cookies de análise</button>
        <button type="button" class="btn btn-sm cookie-btn" id="cookieAccept">Aceitar cookies de análise</button>
      </div>`;
    document.body.append(banner);

    const consent = readConsent();
    if (consent && consent.analytics === true) loadGA(id);
    else if (!consent) banner.hidden = false;

    $('#cookieAccept').addEventListener('click', () => {
      saveConsent(true);
      banner.hidden = true;
      loadGA(id);
      toast('Preferência salva.');
    });
    $('#cookieReject').addEventListener('click', () => {
      const wasLoaded = gaLoaded;
      saveConsent(false);
      banner.hidden = true;
      clearGaCookies();
      toast('Preferência salva.');
      if (wasLoaded) location.reload();
    });
    const prefs = $('#cookiePrefs');
    if (prefs) prefs.addEventListener('click', () => { banner.hidden = false; $('#cookieReject').focus(); });
  }

  function clearLocalData() {
    try { localStorage.removeItem(CONSENT_KEY); } catch (e) { /* ignora */ }
    clearGaCookies();
  }

  function init(site) {
    renderFooter(site);
    initConsent(site);
  }

  initMenu();

  return { $, esc, brl, digits, waLink, safeUrl, ext, formatPhone, formatDate, load, toast, values, init, clearLocalData };
})();
