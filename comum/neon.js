/*
 * Monta o visual neon padrão (comum/neon.css) nas telas .overlay de cada jogo:
 * coloca o conteúdo dentro de um cartão com brilho e, se a .overlay tiver data-icon, um ícone redondo no topo.
 * Os jogos podem trocar a cor e o ícone na hora com: neonKind('over', 'win', '🏆')
 * Carregar com <script src="../comum/neon.js" defer></script> (roda depois do HTML pronto).
 */
(function () {
  function montar(ov) {
    if (ov.classList.contains('neon') || ov.querySelector('.endcard')) return;
    var card = document.createElement('div');
    card.className = 'neon-card';
    while (ov.firstChild) card.appendChild(ov.firstChild);
    var ring = document.createElement('div');
    ring.className = 'neon-ring';
    ring.setAttribute('aria-hidden', 'true');
    ring.textContent = ov.getAttribute('data-icon') || '';
    ring.hidden = !ov.getAttribute('data-icon');
    card.insertBefore(ring, card.firstChild);
    ov.appendChild(card);
    ov.classList.add('neon');
    if (!ov.getAttribute('data-kind')) ov.setAttribute('data-kind', ov.id === 'start' ? 'start' : 'info');
  }
  window.neonKind = function (id, kind, icon) {
    var ov = document.getElementById(id);
    if (!ov) return;
    if (kind) ov.setAttribute('data-kind', kind);
    if (icon != null) {
      ov.setAttribute('data-icon', icon);
      var ring = ov.querySelector('.neon-ring');
      if (ring) { ring.textContent = icon; ring.hidden = !icon; }
    }
  };
  function tudo() { var l = document.querySelectorAll('.overlay'); for (var i = 0; i < l.length; i++) montar(l[i]); }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', tudo); else tudo();
})();
