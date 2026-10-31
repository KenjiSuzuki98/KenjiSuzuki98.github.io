// Ícones em SVG (traço), usados pelo site e pelo painel admin.
window.ICONS = {
  ai: '<path d="M12 3l1.8 4.6 4.7 1.9-4.7 1.9L12 16l-1.8-4.6-4.7-1.9 4.7-1.9z"/><path d="M19 15l.7 1.8 1.8.7-1.8.7L19 20l-.7-1.8-1.8-.7 1.8-.7z"/>',
  chip: '<rect x="6" y="6" width="12" height="12" rx="2"/><rect x="9.5" y="9.5" width="5" height="5" rx="1"/><path d="M9 2v4M15 2v4M9 18v4M15 18v4M2 9h4M2 15h4M18 9h4M18 15h4"/>',
  robot: '<rect x="4" y="8" width="16" height="12" rx="3"/><path d="M12 4v4M9 13.5v1M15 13.5v1M2 13v3M22 13v3"/><circle cx="12" cy="3" r="1"/>',
  gear: '<circle cx="12" cy="12" r="3"/><path d="M12 2v3M12 19v3M4.9 4.9l2.1 2.1M17 17l2.1 2.1M2 12h3M19 12h3M4.9 19.1L7 17M17 7l2.1-2.1"/>',
  chart: '<path d="M3 3v18h18"/><path d="M7 15l4-4 3 3 5-6"/>',
  mentor: '<circle cx="9" cy="8" r="3.5"/><path d="M2.5 20a6.5 6.5 0 0113 0"/><path d="M16 4.5a3.5 3.5 0 010 7M18 14.5a6.5 6.5 0 013.5 5.5"/>',
  training: '<rect x="3" y="4" width="18" height="12" rx="2"/><path d="M8 20h8M12 16v4M7 12l3-3 2 2 4-4"/>',
  code: '<path d="M8 7l-5 5 5 5M16 7l5 5-5 5M14 4l-4 16"/>',
  class: '<path d="M2 9l10-5 10 5-10 5z"/><path d="M6 11v5c3 2 9 2 12 0v-5M22 9v6"/>',
  mic: '<rect x="9" y="2" width="6" height="12" rx="3"/><path d="M5 11a7 7 0 0014 0M12 18v4M8 22h8"/>',
  bag: '<path d="M5 8h14l-1 12H6z"/><path d="M9 8V6a3 3 0 016 0v2"/>',
  book: '<path d="M4 19V5a2 2 0 012-2h14v16H6a2 2 0 00-2 2zm0 0a2 2 0 002 2h14"/>',
  spark: '<path d="M13 2L4 14h7l-1 8 9-12h-7z"/>',
  whatsapp: '<path d="M3 21l1.7-5A8.5 8.5 0 1112 20.5a8.6 8.6 0 01-4-1z"/><path d="M9 9.5c0 3 2.5 5.5 5.5 5.5l1.2-1.4-2-1-1 .8a4 4 0 01-2.1-2.1l.8-1-1-2z"/>',
  mail: '<rect x="3" y="5" width="18" height="14" rx="2"/><path d="M3 7l9 6 9-6"/>',
  pin: '<path d="M12 21s-7-6.2-7-11.5a7 7 0 0114 0C19 14.8 12 21 12 21z"/><circle cx="12" cy="9.5" r="2.5"/>',
  link: '<path d="M10 14a4 4 0 005.7 0l3-3a4 4 0 00-5.7-5.7l-1 1"/><path d="M14 10a4 4 0 00-5.7 0l-3 3a4 4 0 005.7 5.7l1-1"/>',
  instagram: '<rect x="3" y="3" width="18" height="18" rx="5"/><circle cx="12" cy="12" r="4"/><circle cx="17.5" cy="6.5" r=".6"/>',
  linkedin: '<rect x="3" y="3" width="18" height="18" rx="3"/><path d="M8 10v7M8 7v.01M12 17v-4a2 2 0 014 0v4M12 10v7"/>',
  youtube: '<rect x="2" y="5" width="20" height="14" rx="4"/><path d="M10 9l5 3-5 3z"/>',
  github: '<path d="M9 19c-4 1.3-4-2-6-2.5M15 21v-3.5a3 3 0 00-.9-2.3c3-.3 6-1.5 6-6.6a5 5 0 00-1.4-3.6 4.7 4.7 0 00-.1-3.5s-1.1-.3-3.6 1.4a12.4 12.4 0 00-6.4 0C6.1 1.2 5 1.5 5 1.5a4.7 4.7 0 00-.1 3.5A5 5 0 003.5 8.6c0 5.1 3 6.3 6 6.6a3 3 0 00-.9 2.3V21"/>',
  copy: '<rect x="8" y="8" width="13" height="13" rx="2"/><path d="M16 8V5a2 2 0 00-2-2H5a2 2 0 00-2 2v9a2 2 0 002 2h3"/>',
  check: '<path d="M4 12l5 5L20 6"/>',
  x: '<path d="M6 6l12 12M18 6L6 18"/>',
  arrow: '<path d="M5 12h14M13 6l6 6-6 6"/>',
  pix: '<path d="M12 2.5l4.2 4.2-4.2 4.2-4.2-4.2zM12 13.1l4.2 4.2-4.2 4.2-4.2-4.2zM2.5 12l4.2-4.2 4.2 4.2-4.2 4.2zM13.1 12l4.2-4.2 4.2 4.2-4.2 4.2z"/>',
  menu: '<path d="M4 7h16M4 12h16M4 17h16"/>'
};

window.ICON_CHOICES = {
  ai: 'Inteligência Artificial', chip: 'Eletrônica', robot: 'Robótica', gear: 'Automação',
  chart: 'Gestão / Negócios', mentor: 'Mentoria', training: 'Treinamento', code: 'Desenvolvimento',
  class: 'Aula', mic: 'Palestra', book: 'Curso / E-book', bag: 'Produto', spark: 'Destaque'
};

window.icon = (name, cls = '') =>
  `<svg class="ico ${cls}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${window.ICONS[name] || window.ICONS.spark}</svg>`;
