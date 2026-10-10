/*
 * Janela "Não sabe o que pedir? Eu te ajudo" da bio3.
 * - Com o serviço configurado (assistente/config.json → url), a resposta vem da OpenAI pelo serviço separado.
 * - Sem serviço configurado, roda um MODO DEMONSTRAÇÃO sem IA (regras simples sobre o mesmo cardápio), sempre identificado na tela.
 * Nome e preço mostrados sempre saem de assistente/cardapio.json.
 */
(function () {
  var BASE = '../assistente/';
  var MAX = 300;
  var cardapio = null, servico = '', historico = [], ocupado = false;
  var $ = function (id) { return document.getElementById(id); };
  var conta = function (ev, t) { try { window.gabbaConta && window.gabbaConta(ev, t); } catch (e) {} };
  var linkDe = function (k, padrao) { try { return (window.gabbaLink && window.gabbaLink(k)) || padrao; } catch (e) { return padrao; } };
  var real = function (n) { return 'R$ ' + Number(n).toFixed(2).replace('.', ','); };

  fetch(BASE + 'cardapio.json?v=' + Date.now(), { cache: 'no-store' }).then(function (r) { return r.json(); }).then(function (c) { cardapio = c; }).catch(function () {});
  fetch(BASE + 'config.json?v=' + Date.now(), { cache: 'no-store' }).then(function (r) { return r.json(); }).then(function (c) { servico = (c && /^https:\/\//.test(c.url || '')) ? c.url.replace(/\/+$/, '') : ''; marcaDemo(); }).catch(function () { marcaDemo(); });

  function marcaDemo() { $('ass-demo').hidden = !!servico; }

  // ---------- abrir / fechar ----------
  function abre() {
    $('ass').hidden = false; document.body.style.overflow = 'hidden';
    setTimeout(function () { $('ass-texto').focus(); }, 250);
    conta('bio3-assistente-abriu', 'Bio3: abriu o assistente');
  }
  function fecha() { $('ass').hidden = true; document.body.style.overflow = ''; }
  $('ass-abrir').addEventListener('click', abre);
  $('ass-x').addEventListener('click', fecha);
  $('ass').addEventListener('click', function (e) { if (e.target === $('ass')) fecha(); });
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && !$('ass').hidden) fecha(); });

  // ---------- campo e atalhos ----------
  var txt = $('ass-texto');
  function contador() { $('ass-cont').textContent = txt.value.length + '/' + MAX; }
  txt.addEventListener('input', contador);
  document.querySelectorAll('#ass .atalho').forEach(function (b) {
    b.addEventListener('click', function () {
      var t = b.getAttribute('data-t'), v = txt.value.trim();
      var on = b.getAttribute('aria-pressed') === 'true';
      if (on) { txt.value = v.replace(new RegExp('(^|,\\s*)' + t + '(?=,|$)', 'i'), '').replace(/^,\s*/, '').trim(); }
      else { txt.value = v ? v + ', ' + t.toLowerCase() : t; }
      b.setAttribute('aria-pressed', on ? 'false' : 'true');
      contador();
    });
  });
  $('ass-ir').addEventListener('click', envia);
  txt.addEventListener('keydown', function (e) { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); envia(); } });

  // ---------- enviar ----------
  function envia() {
    var t = txt.value.trim().slice(0, MAX);
    if (!t) { mostraAviso('Escreve tua vontade ou toca num atalho 🙂'); txt.focus(); return; }
    if (ocupado) return;
    ocupado = true; $('ass-ir').disabled = true;
    $('ass-res').innerHTML = '<p class="ass-carregando">Procurando tua pedida… 🔥</p>';
    conta('bio3-assistente-pediu', 'Bio3: pediu sugestão');
    var pronto = function (res) {
      ocupado = false; $('ass-ir').disabled = false;
      historico.push({ papel: 'cliente', texto: t });
      if (res && res.mensagem) historico.push({ papel: 'assistente', texto: res.mensagem });
      historico = historico.slice(-4);
      mostra(res);
    };
    if (!servico) { setTimeout(function () { pronto(demo(t)); }, 450); return; }
    var ctrl = window.AbortController ? new AbortController() : null;
    var tempo = setTimeout(function () { if (ctrl) ctrl.abort(); }, 20000);
    fetch(servico + '/recomendar', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ texto: t, historico: historico }), signal: ctrl ? ctrl.signal : undefined })
      .then(function (r) { return r.json().then(function (j) { return { ok: r.ok, status: r.status, j: j }; }); })
      .then(function (x) {
        clearTimeout(tempo);
        if (!x.ok || x.j.erro) { ocupado = false; $('ass-ir').disabled = false; return falha(x.j && x.j.erro); }
        pronto(x.j);
      })
      .catch(function () { clearTimeout(tempo); ocupado = false; $('ass-ir').disabled = false; falha('rede'); });
  }

  // ---------- telas de resposta ----------
  function el(tag, cls, texto) { var e = document.createElement(tag); if (cls) e.className = cls; if (texto != null) e.textContent = texto; return e; }
  function botoes(extra) {
    var w = el('div', 'ass-botoes');
    var a = el('a', 'ass-b1', 'VER NO CARDÁPIO'); a.href = linkDe('pedir', 'https://gabbaburger.saipos.com'); a.setAttribute('data-ev', 'bio3-assistente-cardapio');
    w.append(a);
    if (extra) w.append(extra);
    return w;
  }
  function mostraAviso(m) { $('ass-res').innerHTML = ''; $('ass-res').append(el('p', 'ass-aviso', m)); }

  function mostra(res) {
    var box = $('ass-res'); box.innerHTML = '';
    if (!servico) box.append(el('p', 'ass-tag-demo', 'Demonstração sem IA · respostas por regras simples'));
    if (!res) return falha();
    if (res.tipo === 'pergunta' || res.tipo === 'fora_do_cardapio' || !res.principal) {
      box.append(el('p', 'ass-balao', res.mensagem || 'Me conta um pouco mais do que tu tá com vontade?'));
      if (res.alergia) box.append(el('p', 'ass-nota', '⚠️ O cardápio não informa alérgenos nem contaminação cruzada. Confirme com a equipe antes de pedir.'));
      txt.value = ''; contador();
      document.querySelectorAll('#ass .atalho').forEach(function (b) { b.setAttribute('aria-pressed', 'false'); });
      $('ass-dica').textContent = res.tipo === 'pergunta' ? 'Responde aqui embaixo 👇' : '';
      setTimeout(function () { txt.focus(); }, 100);
      return;
    }
    $('ass-dica').textContent = '';
    var p = res.principal;
    var c = el('div', 'ass-card');
    c.append(el('span', 'ass-selo', 'Minha sugestão pra ti'));
    c.append(el('b', 'ass-nome', p.nome));
    if (p.preco_burger != null) {
      var pr = el('div', 'ass-precos');
      var a1 = el('span', '', ''); a1.append(el('small', '', 'Só o burger'), el('strong', '', real(p.preco_burger)));
      var a2 = el('span', '', ''); a2.append(el('small', '', 'Combo (batata + refri)'), el('strong', '', real(p.preco_combo)));
      pr.append(a1, a2); c.append(pr);
    } else c.append(el('div', 'ass-preco1', real(p.preco)));
    if (res.mensagem) c.append(el('p', 'ass-msg', res.mensagem));
    if (p.descricao) c.append(el('p', 'ass-desc', p.descricao));
    if (p.observacao) c.append(el('p', 'ass-desc', 'Obs.: ' + p.observacao));
    box.append(c);
    if (res.alternativa) {
      var alt = res.alternativa, pa = alt.preco_burger != null ? real(alt.preco_burger) + ' (combo ' + real(alt.preco_combo) + ')' : real(alt.preco);
      box.append(el('p', 'ass-alt', 'Outra ideia: ' + alt.nome + ' · ' + pa + (res.motivo_alternativa ? ' — ' + res.motivo_alternativa : '')));
    }
    if (res.alergia) box.append(el('p', 'ass-nota', '⚠️ O cardápio não informa alérgenos nem contaminação cruzada. Confirme com a equipe antes de pedir.'));
    box.append(el('p', 'ass-nota', 'Disponibilidade e mudanças no lanche: confirme com a equipe na hora do pedido.'));
    var outra = el('button', 'ass-b2', 'OUTRA IDEIA'); outra.type = 'button';
    outra.addEventListener('click', function () { historico = []; box.innerHTML = ''; txt.value = ''; contador(); document.querySelectorAll('#ass .atalho').forEach(function (b) { b.setAttribute('aria-pressed', 'false'); }); txt.focus(); });
    box.append(botoes(outra));
    box.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }

  function falha(cod) {
    var box = $('ass-res'); box.innerHTML = '';
    var m = cod === 'limite' ? 'Muita gente perguntando ao mesmo tempo 😅 Espera um minutinho e tenta de novo, ou dá uma olhada no cardápio.'
      : cod === 'mensagem_grande' ? 'Essa mensagem ficou grande demais. Tenta resumir em poucas palavras.'
      : 'Ops, o assistente deu uma pausa pra afinar a guitarra 🎸 Enquanto isso, olha o cardápio ou chama a gente no WhatsApp.';
    box.append(el('p', 'ass-balao', m));
    var z = el('a', 'ass-b2', 'WHATSAPP'); z.href = linkDe('whatsapp', 'https://wa.me/message/QXY4DJK6HWG6N1'); z.setAttribute('data-ev', 'bio3-assistente-whatsapp');
    box.append(botoes(z));
  }

  // ---------- MODO DEMONSTRAÇÃO (sem IA): regras simples sobre o cardápio ----------
  function demo(t) {
    var s = ' ' + t.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '') + ' ';
    var it = cardapio ? cardapio.itens : [];
    var acha = function (id) { return it.filter(function (i) { return i.id === id; })[0] || null; };
    var R = function (id, msg, extra) { var p = acha(id); if (!p) return { tipo: 'pergunta', mensagem: 'Não consegui abrir o cardápio agora. Tenta de novo em instantes?' }; return Object.assign({ tipo: 'recomendacao', principal: p, mensagem: msg }, extra || {}); };
    if (/alerg|intoler|celiac|gluten|lactose/.test(s)) return { tipo: 'pergunta', alergia: true, mensagem: 'Pra alergia ou intolerância, o mais seguro é falar com a equipe: o cardápio não informa alérgenos nem contaminação cruzada. Quer que eu te sugira algo enquanto isso? Me diz o que precisa evitar.' };
    if (/dieta|emagrec|fitness|caloria|leve|saudavel|light/.test(s)) return { tipo: 'pergunta', mensagem: 'Bora achar algo que combine contigo! O que tu procura evitar: pão, fritura, carne, algum ingrediente?' };
    if (/vegan/.test(s)) return R('rita-lee', 'O cardápio não indica opção vegana. O mais próximo é o Rita Lee, que é vegetariano (falafel com mussarela e maionese de coentro). Confirma com a equipe se precisar de algo vegano.');
    if (/sem carne|vegetarian|nao como carne|nao como came/.test(s)) return R('rita-lee', 'Sem carne? O Rita Lee é o nosso vegetariano: disco de falafel com mussarela, salada e maionese de coentro.');
    if (/sem pao/.test(s)) return R('no-bread', 'Sem pão é com o NO BREAD: nosso burger grelhado de 160g no prato, acompanhado de salada e fritas.');
    var orc = (s.match(/(?:ate|max|maximo|r\$)\s*r?\$?\s*(\d{1,3})/) || [])[1]; orc = orc ? +orc : null;
    if (/pouca fome|fome pequena|lanchinho|pouquinho/.test(s)) return R('billie-joe', 'Pra uma fome pequena, o Billie Joe é certeiro: smash de 75g com cheddar e ketchup.');
    if (/muita fome|fome grande|faminto|morrendo de fome|fome de leao/.test(s)) return R('bb-king', 'Fome grande pede o B.B. King: dois burgers defumados de 160g, cheddar, picles e molho da casa.', { alternativa: acha('axl-rose'), motivo_alternativa: 'dois smash de 75g, por um preço menor.' });
    // pontua por ingredientes citados (e tira o que a pessoa evita)
    var ingr = ['gorgonzola', 'bacon', 'cheddar', 'cream cheese', 'frango', 'camarao', 'costela', 'brisket', 'carne do sol', 'pimenta', 'cebola caramelizada', 'cebola crispy', 'ovo', 'falafel', 'tapioca', 'queijo coalho', 'picles', 'bbq', 'mussarela', 'parmesao', 'smash', 'defumad'];
    var quer = ingr.filter(function (k) { return s.indexOf(k) >= 0 && !new RegExp('(sem|nao gosto de|nao quero|evito)\\s+' + k).test(s); });
    var evita = ingr.filter(function (k) { return new RegExp('(sem|nao gosto de|nao quero|evito)\\s+' + k).test(s); });
    if (!quer.length) return { tipo: 'pergunta', mensagem: 'Me conta um pouco mais: tu quer burger, smash, uma porção pra dividir ou algo defumado? Tem algum ingrediente que tu ama ou evita?' };
    var cand = it.filter(function (i) { return ['burgers', 'smash', 'defumados', 'carnes', 'entradas'].indexOf(i.categoria) >= 0; }).map(function (i) {
      var d = (i.nome + ' ' + i.descricao + ' ' + i.categoria).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
      var pts = quer.filter(function (k) { return d.indexOf(k) >= 0; }).length * 10 - evita.filter(function (k) { return d.indexOf(k) >= 0; }).length * 100;
      if (i.categoria === 'burgers' || i.categoria === 'smash') pts += 1;
      var preco = i.preco_burger != null ? i.preco_burger : i.preco;
      if (orc && preco > orc) pts -= 1000;
      return { i: i, pts: pts, preco: preco };
    }).filter(function (x) { return x.pts > 0; }).sort(function (a, b) { return b.pts - a.pts || a.preco - b.preco; });
    if (!cand.length) return { tipo: 'pergunta', mensagem: orc ? 'Com esse valor não achei nada com tudo isso. Topa mudar um ingrediente ou o valor?' : 'Não achei nada com essa combinação no cardápio. Quer trocar algum ingrediente?' };
    var p = cand[0].i;
    return { tipo: 'recomendacao', principal: p, mensagem: 'Pelo que tu falou (' + quer.join(', ') + '), essa é a pedida: ' + p.descricao.replace(/\.$/, '') + '.', alternativa: cand[1] ? cand[1].i : null, motivo_alternativa: cand[1] ? 'também tem o que tu pediu.' : '' };
  }
})();
