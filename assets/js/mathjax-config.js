window.MathJax = {
  startup: {
    typeset: false
  },
  loader: {
    load: ['input/tex', 'output/svg']
  },
  tex: {
    inlineMath: [['$', '$'], ['\\(', '\\)']],
    packages: ['base', 'ams', 'noerrors', 'noundefined']
  },
  svg: {
    fontCache: 'none'
  }
};

