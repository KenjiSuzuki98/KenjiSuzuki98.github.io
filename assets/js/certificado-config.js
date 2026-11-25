// Configuração da página de certificado (certificado.html). Edite só este arquivo.
window.CERTIFICADO = {
  // Vazio = usa a mesma planilha das inscrições da aula (painel → Aula / Evento → Endereço da planilha).
  // Só preencha se quiser outra planilha (URL do Apps Script, termina em /exec).
  endpoint: '',

  turma: 'Turma 01',
  prefixoCodigo: 'FP01', // início do código de cada certificado (ex.: FP01-7KX2QM)
  titulo: 'Faixa Preta em IA',
  curso: 'Do Zero ao Faixa Preta com Inteligência Artificial',
  periodo: 'realizado presencialmente nos dias 23, 24 e 25 de novembro de 2026',
  cargaHoraria: '6 horas',
  modulos: [
    'O Primeiro Golpe: Dominando o ChatGPT',
    'Dominando o Arsenal de IA',
    'A Arte do Impacto: Criação Audiovisual com IA',
  ],
  local: 'Barretos/SP',
  dataEmissao: '25 de novembro de 2026',
  instrutor: 'Kenji Marcos Suzuki',
  cargoInstrutor: 'Instrutor',

  // true = precisa indicar 2 pessoas para liberar o certificado. false = pode pular.
  indicacoesObrigatorias: true,

  // Arte do certificado (PNG ou JPG, de preferência A4 deitado, ex.: 3508 x 2480 px).
  // Quando preenchida, a página desenha só os campos abaixo por cima da imagem.
  // Vazio = usa o certificado padrão desenhado pela página.
  imagem: 'assets/certificado/modelo.png',
  // Posição dos textos sobre a arte, em frações da largura/altura (0 a 1).
  // x/y = centro do texto; tamanho = altura da letra em fração da altura da imagem;
  // largura = espaço máximo (o nome diminui sozinho se for muito comprido).
  campos: {
    // Calibrado para a arte "Certificado de Participação" (1536 x 1024): nome dentro da caixa dourada.
    nome: { x: 0.484, y: 0.389, tamanho: 0.052, largura: 0.43, cor: '#ffffff', peso: 700, fonte: 'Space Grotesk', alinhamento: 'center' },
    codigo: { x: 0.5, y: 0.962, tamanho: 0.016, largura: 0.4, cor: '#d6d6d6', peso: 500, fonte: 'Inter', alinhamento: 'center' },
  },
};
