// Preenche as páginas legais com os dados da empresa e os prazos configurados no admin.
(() => {
  function fill(site) {
    const v = Site.values(site);
    const c = site.contact || {};
    document.querySelectorAll('[data-bind]').forEach((el) => { if (v[el.dataset.bind]) el.textContent = v[el.dataset.bind]; });
    document.querySelectorAll('[data-if]').forEach((el) => (el.hidden = !v[el.dataset.if]));
    document.querySelectorAll('[data-if-not]').forEach((el) => (el.hidden = !!v[el.dataset.ifNot]));
    document.querySelectorAll('a[data-wa]').forEach((a) => {
      if (c.whatsapp) a.href = Site.waLink(c.whatsapp, a.dataset.wa);
      else a.hidden = true;
    });
    document.querySelectorAll('a[data-mailto]').forEach((a) => {
      if (v.email) a.href = `mailto:${v.email}?subject=${encodeURIComponent(a.dataset.mailto)}`;
    });
    Site.init(site);
  }

  const clear = document.getElementById('clearLocalData');
  if (clear) clear.addEventListener('click', () => {
    Site.clearLocalData();
    Site.toast('Dados deste site apagados do seu navegador.');
  });

  Site.load().then(fill).catch(() => { /* o texto das políticas continua legível sem os dados */ });
})();
