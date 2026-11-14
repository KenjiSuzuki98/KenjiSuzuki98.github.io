// Página de inscrição da aula gratuita (aula.html).
// Coleta só nome, celular e e-mail. Os dados vão para a planilha Google do
// responsável (Google Apps Script) e não ficam salvos no navegador.
(() => {
  const { $, esc, ext, digits, waLink } = Site;
  // Só aceita um endereço de Web App do Google Apps Script.
  const ENDPOINT_RE = /^https:\/\/script\.google\.com\/macros\/s\/[\w-]+\/exec$/;
  const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

  let site, ev;

  // Celular brasileiro: DDD + número (10 ou 11 dígitos), aceitando +55 na frente.
  function phoneDigits(v) {
    let d = digits(v);
    if (d.length > 11 && d.startsWith('55')) d = d.slice(2);
    return d;
  }
  function formatPhone(v) {
    const d = phoneDigits(v).slice(0, 11);
    if (d.length <= 2) return d.length ? `(${d}` : '';
    if (d.length <= 6) return `(${d.slice(0, 2)}) ${d.slice(2)}`;
    if (d.length <= 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
    return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
  }

  const endpoint = () => {
    const url = String(ev.formEndpoint || '').trim();
    return ENDPOINT_RE.test(url) ? url : '';
  };

  // ---------- Agenda (.ics) ----------
  function icsHref() {
    const stamp = (d) => d.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
    const text = (s) => String(s).replace(/[\\;,]/g, (c) => '\\' + c).replace(/\n/g, '\\n');
    const ics = [
      'BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Aula gratuita//PT-BR', 'CALSCALE:GREGORIAN',
      'BEGIN:VEVENT',
      `UID:aula-${stamp(ev.start)}@${location.hostname || 'site'}`,
      `DTSTAMP:${stamp(new Date())}`,
      `DTSTART:${stamp(ev.start)}`,
      `DTEND:${stamp(ev.end)}`,
      `SUMMARY:${text(`Aula gratuita: ${ev.title}`)}`,
      `DESCRIPTION:${text(`Aula online e gratuita. O link será enviado no grupo do WhatsApp${ev.group ? `: ${ev.group}` : '.'}`)}`,
      'BEGIN:VALARM', 'TRIGGER:-PT30M', 'ACTION:DISPLAY', `DESCRIPTION:${text('A aula começa em 30 minutos')}`, 'END:VALARM',
      'END:VEVENT', 'END:VCALENDAR',
    ].join('\r\n');
    return 'data:text/calendar;charset=utf-8,' + encodeURIComponent(ics);
  }

  function groupQr() {
    if (!ev.group || typeof qrcode !== 'function') return '';
    try {
      const qr = qrcode(0, 'M');
      qr.addData(ev.group);
      qr.make();
      return `<div class="qr qr-group" role="img" aria-label="QR Code para entrar no grupo do WhatsApp">${qr.createSvgTag({ cellSize: 4, margin: 0, scalable: true })}</div>`;
    } catch (e) { return ''; }
  }

  // Bloco com o link e o QR Code do grupo do WhatsApp.
  function groupBlock() {
    const when = `${ev.weekday}, ${ev.date}, às ${ev.time}`;
    if (!ev.group) {
      return `<p class="notice">Em breve enviaremos o link da aula, <strong>${esc(when)}</strong>, pelo WhatsApp que você informou.</p>`;
    }
    return `
      <p class="group-info">É <strong>por este grupo do WhatsApp</strong> que vamos enviar o link da aula gratuita e online, <strong>${esc(when)}</strong> (horário de Brasília).</p>
      ${ext(ev.group, `${icon('whatsapp')} Entrar no grupo do WhatsApp`, 'class="btn btn-wa btn-block" id="groupLink"')}
      <div class="group-qr">
        ${groupQr()}
        <p>No computador? Aponte a câmera do celular para o QR Code e entre pelo WhatsApp.</p>
      </div>
      <p class="group-url">Link do grupo: <span>${esc(ev.group)}</span></p>`;
  }

  function calendarLink() {
    return `<a class="btn btn-block" id="icsLink" href="${icsHref()}" download="aula-gratuita-ia.ics">${icon('class')} Adicionar a aula à minha agenda</a>`;
  }

  // ---------- Telas ----------
  function infoColumn() {
    return `
      <div class="aula-info">
        <span class="eyebrow eyebrow-gold"><span class="dot"></span>${esc(ev.kicker || 'Aula gratuita')}</span>
        <h1>${esc(ev.title)}</h1>
        <ul class="event-meta">
          <li>${icon('class')}<span>${esc(ev.weekday)}, <strong>${esc(ev.date)}</strong></span></li>
          <li>${icon('spark')}<span>às <strong>${esc(ev.time)}</strong> (horário de Brasília)</span></li>
          <li>${icon('whatsapp')}<span>Online, com link enviado no grupo do WhatsApp</span></li>
        </ul>
        <a class="btn btn-gold btn-block jump-cta" href="#aulaCard">Ir para a inscrição gratuita ${icon('arrow', 'ico-down')}</a>
        ${ev.subtitle ? `<p class="aula-lead">${esc(ev.subtitle)}</p>` : ''}
        ${ev.topics.length ? `
        <h2 class="aula-sub">O que você vai ver</h2>
        <ul class="event-topics">${ev.topics.map((t) => `<li>${icon('check')}${esc(t)}</li>`).join('')}</ul>` : ''}
        ${ev.host ? `<p class="aula-host">${icon('mentor')}<span><small>Com</small>${esc(ev.host)}</span></p>` : ''}
      </div>`;
  }

  function formCard() {
    return `
      <div class="aula-card" id="aulaCard">
        <h2 id="formTitle">Garanta sua vaga gratuita</h2>
        <p class="muted-text">Leva menos de 1 minuto. Campos com * são obrigatórios.</p>
        <form id="aulaForm" novalidate aria-labelledby="formTitle">
          <div class="field">
            <label for="fNome">Nome completo *</label>
            <input id="fNome" name="nome" autocomplete="name" required maxlength="120" aria-describedby="eNome">
            <small class="err" id="eNome"></small>
          </div>
          <div class="field">
            <label for="fCel">Celular com WhatsApp *</label>
            <input id="fCel" name="celular" type="tel" inputmode="tel" autocomplete="tel-national" required placeholder="(17) 99999-9999" maxlength="16" aria-describedby="eCel">
            <small class="err" id="eCel"></small>
          </div>
          <div class="field">
            <label for="fEmail">E-mail *</label>
            <input id="fEmail" name="email" type="email" autocomplete="email" required maxlength="160" placeholder="voce@exemplo.com" aria-describedby="eEmail">
            <small class="err" id="eEmail"></small>
          </div>
          <div class="hp" aria-hidden="true">
            <label for="fSite">Deixe este campo vazio</label>
            <input id="fSite" name="website" tabindex="-1" autocomplete="off">
          </div>

          <p class="data-use" id="dataUse">Usamos seus dados para enviar as informações e o link da aula, falar com você depois dela e, se você autorizar abaixo, enviar ofertas e promoções. Veja a <a href="privacidade.html#inscricoes">Política de Privacidade</a>.</p>

          <label class="check-field">
            <input type="checkbox" id="fConsent" name="consentimento" required aria-describedby="eConsent">
            <span>Li e concordo com a Política de Privacidade e autorizo o contato por WhatsApp e e-mail sobre esta aula. *</span>
          </label>
          <small class="err" id="eConsent"></small>
          <label class="check-field">
            <input type="checkbox" id="fOffers" name="ofertas">
            <span>Quero receber ofertas e promoções, como condições especiais do treinamento Faixa Preta em IA. (opcional)</span>
          </label>

          <button type="submit" class="btn btn-gold btn-block" id="submitBtn">Garantir minha vaga gratuita</button>
          <p class="form-status" id="formStatus" role="status" aria-live="polite"></p>
        </form>
      </div>`;
  }

  // Inscrições pelo site ainda não configuradas: mostra direto o grupo do WhatsApp.
  function directCard() {
    return `
      <div class="aula-card" id="aulaCard">
        <h2>Participe da aula gratuita</h2>
        ${groupBlock()}
        ${calendarLink()}
      </div>`;
  }

  function closedPage() {
    const c = site.contact || {};
    $('#conteudo').innerHTML = `
      <section class="block">
        <div class="wrap aula-closed">
          <h1>As inscrições para esta aula foram encerradas</h1>
          <p>Obrigado pelo interesse! Fique de olho nas próximas aulas e treinamentos.</p>
          <div class="hero-cta">
            ${c.whatsapp ? ext(waLink(c.whatsapp, 'Olá! Quero saber das próximas aulas e treinamentos.'), `${icon('whatsapp')} Avisar-me das próximas aulas`, 'class="btn btn-wa"') : ''}
            <a class="btn" href="index.html">Voltar para o início</a>
          </div>
        </div>
      </section>`;
  }

  function showSuccess(firstName) {
    const card = $('#aulaCard');
    card.innerHTML = `
      <p class="success-badge">${icon('check')} Inscrição confirmada</p>
      <h2 id="successTitle" tabindex="-1">${firstName ? `Tudo certo, ${esc(firstName)}!` : 'Tudo certo!'} Falta só um passo.</h2>
      ${groupBlock()}
      ${calendarLink()}`;
    card.classList.add('is-done');
    $('#successTitle').focus();
  }

  // ---------- Validação e envio ----------
  function setError(input, msgEl, msg) {
    msgEl.textContent = msg;
    if (msg) input.setAttribute('aria-invalid', 'true');
    else input.removeAttribute('aria-invalid');
    return !msg;
  }

  function validate() {
    const nome = $('#fNome'), cel = $('#fCel'), email = $('#fEmail'), consent = $('#fConsent');
    const n = nome.value.trim().replace(/\s+/g, ' ');
    const d = phoneDigits(cel.value);
    const ok = [
      setError(nome, $('#eNome'), n.length < 3 ? 'Informe seu nome completo.' : !/\s/.test(n) ? 'Informe nome e sobrenome.' : ''),
      setError(cel, $('#eCel'), !(d.length === 10 || d.length === 11) ? 'Informe o celular com DDD. Ex.: (17) 99999-9999.' : ''),
      setError(email, $('#eEmail'), !EMAIL_RE.test(email.value.trim()) ? 'Informe um e-mail válido. Ex.: voce@exemplo.com.' : ''),
      setError(consent, $('#eConsent'), !consent.checked ? 'Para se inscrever, marque a autorização de contato sobre a aula.' : ''),
    ];
    const firstBad = [nome, cel, email, consent][ok.indexOf(false)];
    if (firstBad) firstBad.focus();
    return firstBad ? null : { nome: n, celular: '55' + d, email: email.value.trim().toLowerCase() };
  }

  async function submit(e) {
    e.preventDefault();
    const status = $('#formStatus');
    const btn = $('#submitBtn');
    if (btn.disabled) return;
    const data = validate();
    if (!data) { status.textContent = 'Confira os campos destacados.'; return; }

    // Robôs costumam preencher o campo escondido: finge sucesso e não envia nada.
    if ($('#fSite').value) { showSuccess(''); return; }

    btn.disabled = true;
    btn.textContent = 'Enviando…';
    status.textContent = 'Enviando sua inscrição…';
    const payload = {
      ...data,
      ofertas: $('#fOffers').checked,
      consentimento: true,
      evento: `${ev.title} (${ev.date} ${ev.time})`,
      website: '',
    };
    try {
      const res = await fetch(endpoint(), {
        method: 'POST',
        // text/plain evita o "preflight" de CORS, que o Google Apps Script não responde.
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify(payload),
      });
      const out = await res.json();
      if (!res.ok || !out || out.ok !== true) throw new Error('falha');
      showSuccess(data.nome.split(' ')[0]);
    } catch (err) {
      btn.disabled = false;
      btn.textContent = 'Tentar enviar de novo';
      status.innerHTML = `Não conseguimos enviar agora. Verifique sua internet e tente de novo.${ev.group ? ` Se continuar, ${ext(ev.group, 'entre direto no grupo do WhatsApp')}.` : ''}`;
    }
  }

  function bind() {
    const form = $('#aulaForm');
    if (!form) return;
    form.addEventListener('submit', submit);
    const cel = $('#fCel');
    cel.addEventListener('input', () => {
      const atEnd = cel.selectionStart === cel.value.length;
      const v = formatPhone(cel.value);
      if (atEnd || !cel.value) cel.value = v;
    });
    cel.addEventListener('blur', () => { cel.value = formatPhone(cel.value); });
    // Limpa o aviso de erro quando a pessoa corrige o campo.
    form.addEventListener('input', (e) => {
      if (e.target.getAttribute('aria-invalid') === 'true') {
        e.target.removeAttribute('aria-invalid');
        const msg = document.getElementById(e.target.getAttribute('aria-describedby'));
        if (msg) msg.textContent = '';
      }
    });
  }

  function render() {
    const name = (site.profile && site.profile.name) || '';
    if (name) $('#brandName').textContent = name;
    ev = Site.event(site);
    if (!ev) { closedPage(); Site.init(site); return; }

    document.title = `Aula gratuita: ${ev.title}`;
    const img = Site.safeUrl(ev.image);
    $('#conteudo').innerHTML = `
      <section class="aula">
        <div class="wrap aula-grid">
          <div>
            ${img ? `<figure class="event-media aula-media"><img src="${esc(img)}" alt="${esc(ev.imageAlt || '')}" width="960" height="720"></figure>` : ''}
            ${infoColumn()}
          </div>
          ${endpoint() ? formCard() : directCard()}
        </div>
      </section>`;
    Site.init(site);
    bind();
  }

  Site.load()
    .then((data) => { site = data; render(); })
    .catch(() => { $('#conteudo').innerHTML = '<p class="loading">Não foi possível carregar a página. Recarregue para tentar de novo.</p>'; });
})();
