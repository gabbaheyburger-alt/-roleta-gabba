/*
 * Contador de uso do Fliperama Gabba (GoatCounter).
 * Conta acessos às páginas e partidas iniciadas, sem cookies e sem dados pessoais.
 * Para ligar: coloque abaixo o código da conta do GoatCounter (o "xxx" de xxx.goatcounter.com).
 */
(function () {
  // Versão delivery do Fliperama: os botões "‹ Jogos" voltam para /delivery/ em vez de /jogos/
  document.addEventListener('DOMContentLoaded', function () {
    var modo = null;
    try { modo = sessionStorage.getItem('gabba-modo'); } catch (e) {}
    if (modo !== 'delivery') return;
    var links = document.querySelectorAll('a[href="../jogos/"]');
    for (var i = 0; i < links.length; i++) links[i].setAttribute('href', '../delivery/');
  });
})();

(function () {
  var CODIGO = 'gabbajogos';

  var fila = [];
  window.gabbaConta = function (nome, titulo) {
    if (!CODIGO) return;
    var ev = { path: nome, title: titulo || nome, event: true };
    if (window.goatcounter && window.goatcounter.count) {
      try { window.goatcounter.count(ev); } catch (e) {}
    } else {
      fila.push(ev);
    }
  };

  if (!CODIGO) return;
  var s = document.createElement('script');
  s.async = true;
  s.src = 'https://gc.zgo.at/count.js';
  s.setAttribute('data-goatcounter', 'https://' + CODIGO + '.goatcounter.com/count');
  s.onload = function () {
    var tentar = function (n) {
      if (window.goatcounter && window.goatcounter.count) {
        while (fila.length) { try { window.goatcounter.count(fila.shift()); } catch (e) {} }
      } else if (n > 0) {
        setTimeout(function () { tentar(n - 1); }, 300);
      }
    };
    tentar(20);
  };
  document.head.appendChild(s);
})();
