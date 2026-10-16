// Checklist de FECHAMENTO da liderança (link ?loja=gabba&setor=fechamento)
// Grava no mesmo formulário/planilha CHECKLISTS, com Setor = "Fechamento".
// Linhas: problemas ("NÃO" → categoria corrigir), perdas (perda), ocorrências (obs),
// notas informativas (Status "NOTA": produções para amanhã e diário do dia) e o RESUMO.
(async function () {
  const E = id => document.getElementById(id);
  const esc = v => String(v ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const read = (k, d) => { try { const v = JSON.parse(localStorage.getItem(k)); return v ?? d; } catch (e) { return d; } };
  const write = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} };
  const day = () => new Intl.DateTimeFormat('sv-SE', { timeZone: 'America/Fortaleza' }).format(new Date());
  const hm = () => new Intl.DateTimeFormat('pt-BR', { timeZone: 'America/Fortaleza', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(new Date());

  let CONFIG, CFG, LOJA;
  try {
    const r = await fetch('config.json?v=' + Date.now(), { cache: 'no-store' });
    CONFIG = await r.json();
    const qs = new URLSearchParams(location.search);
    LOJA = Object.keys(CONFIG.lojas).find(k => k.toLowerCase() === (qs.get('loja') || 'gabba').toLowerCase());
    CFG = CONFIG.lojas[LOJA].setores.Fechamento;
    if (!CFG) throw Error('setor');
  } catch (e) {
    document.body.innerHTML = '<main style="font:18px system-ui;padding:24px"><h1>Não foi possível abrir o fechamento</h1><p>Recarregue a página. Se continuar, avise o Gabba.</p></main>';
    return;
  }
  // Prazo pode mudar por dia da semana: prazo_semana = [dom, seg, ter, qua, qui, sex, sáb]
  const dsem = new Date(new Date().toLocaleString('en-US', { timeZone: 'America/Fortaleza' })).getDay();
  const SETOR = CFG.nome || 'Fechamento', PRAZO = (CFG.prazo_semana && CFG.prazo_semana[dsem]) || CFG.prazo || '23:00';
  const ST = 'gabba-fechamento-v1';
  const PERGS = CFG.perguntas; // [{id, q, hint, botao?:{texto,url}, campo?:{rotulo}}]
  const OCOR = CFG.tipos_ocorrencia || ['Quebra', 'Reclamação de cliente', 'Falta de funcionário', 'Outra'];

  // ---------- visual (igual ao das outras páginas de checklist) ----------
  document.querySelectorAll('style').forEach(s => s.remove());
  const css = document.createElement('style');
  css.textContent = `:root{--bg:#f3f2ee;--ink:#23241f;--red:#a33e2d;--ok:#2f6b3a;--line:#deded6;--muted:#66685f}*{box-sizing:border-box}body{margin:0;background:var(--bg);color:var(--ink);font:16px/1.5 Inter,system-ui,sans-serif}
header{background:#171916;color:#fff;padding:18px 20px;display:flex;gap:16px;align-items:center}header img{max-width:150px;max-height:46px}header div{border-left:1px solid #444;padding-left:16px}header small{display:block;letter-spacing:3px;color:#bdb8a8;font-size:11px}header b{font-size:20px;line-height:1.2}header span{display:block;color:#d5d0be;font-size:13px}
main{max-width:760px;margin:auto;padding:16px 16px 150px}.box{background:#fff;border:1px solid var(--line);border-radius:16px;padding:18px;margin:14px 0}
h2{font-size:13px;letter-spacing:2px;text-transform:uppercase;margin:0 0 4px}h2 i{font-style:normal;color:var(--muted);margin-right:10px}.muted{color:var(--muted);font-size:14px;margin:0 0 10px}
.q{border-top:1px solid var(--line);padding:14px 0}.q:first-of-type{border-top:0}.q>b{display:block}.q .hint{font-size:13px;color:var(--muted);margin:2px 0 0}
.opts{display:flex;gap:8px;margin:10px 0 0}.opts button,.names button{flex:1;font:inherit;font-weight:650;min-height:48px;border:1px solid var(--line);border-radius:10px;background:#fff;color:var(--ink);cursor:pointer}
.opts button.on{background:var(--ink);color:#fff;border-color:var(--ink)}.opts button.on.nao{background:var(--red);border-color:var(--red)}
.names{display:grid;grid-template-columns:1fr 1fr;gap:8px}.names button.on{background:var(--ink);color:#fff}
label{display:block;font-weight:650;font-size:14px;margin:10px 0 0}textarea,input[type=text]{display:block;width:100%;border:1px solid var(--line);border-radius:10px;padding:11px;font:inherit;margin-top:6px;background:#fff;color:var(--ink)}textarea{min-height:80px}
.link{display:flex;align-items:center;justify-content:center;gap:6px;margin-top:10px;min-height:46px;border-radius:10px;background:#eae8de;color:var(--ink);font-weight:700;text-decoration:none}
.chips{display:flex;flex-wrap:wrap;gap:8px;margin-top:8px}.chips button{font:inherit;font-size:14px;font-weight:600;padding:8px 12px;border-radius:999px;border:1px solid var(--line);background:#fff;cursor:pointer}.chips button.on{background:var(--ink);color:#fff}
.tip{background:#f3f2ee;border-radius:8px;padding:9px 11px;font-size:13px;margin-top:8px}.warn{background:#f9e6df;border:2px solid var(--red);color:#7a2416;border-radius:10px;padding:9px 11px;margin-top:10px;font-size:14px}
.obsbtn{all:unset;cursor:pointer;color:var(--red);font-weight:600;font-size:14px;margin-top:8px;display:inline-block}
footer{position:fixed;left:0;right:0;bottom:0;background:#fff;border-top:1px solid var(--line);padding:12px 16px calc(12px + env(safe-area-inset-bottom))}footer>div{max-width:760px;margin:auto;display:flex;gap:14px;align-items:center}
.prog{flex:1;font-size:14px}.prog b{display:block}.bar{height:6px;border-radius:9px;background:#e7e5dc;margin-top:6px;overflow:hidden}.bar>div{height:100%;background:var(--ok);width:0}
.send{font:inherit;font-weight:800;min-height:50px;padding:0 20px;border-radius:12px;border:0;background:var(--ink);color:#fff;cursor:pointer}.send:disabled{opacity:.4}
#fix{margin-top:8px;width:100%;min-height:38px;border:0;border-radius:8px;background:var(--red);color:#fff;font:inherit;font-size:14px;font-weight:700}
.task{border-left:4px solid var(--red);background:#fff;border-radius:12px;padding:12px 14px;margin:10px 0;border:1px solid var(--line);border-left-width:4px}.task b{display:block}.task p{margin:4px 0;font-size:14px;color:var(--muted)}.task button{width:100%;min-height:42px;margin-top:6px;font:inherit;font-weight:700;border:1px solid var(--line);border-radius:10px;background:#fff}
.ok{background:#e8efe0;border-radius:12px;padding:14px}.reset{font:inherit;font-size:14px;color:var(--red);background:none;border:0;margin-top:10px;cursor:pointer;padding:0}[hidden]{display:none!important}`;
  document.head.append(css);
  document.title = 'Fechamento · ' + CONFIG.lojas[LOJA].nome;

  // ---------- estado ----------
  const vazio = () => ({ nome: '', outro: '', r: {}, prob: {}, prov: {}, obs: {}, campo: {}, perda: '', perdaTxt: '', ocor: '', ocorTipos: [], ocorTxt: '', diario: '', started: null, ultimo: null });
  let S = vazio();
  const rasc = read(ST + '-draft', null);
  if (rasc && rasc.day === day()) S = Object.assign(vazio(), rasc.s);
  else { const n = read(ST + '-name', ''); if (n) { if ((CFG.equipe || []).includes(n)) S.nome = n; else { S.nome = 'Outro nome'; S.outro = n; } } }
  let tasks = read(ST + '-tasks', []), fila = read(ST + '-fila', []), enviando = false, enviado = null;
  const PAUSA = 300000;
  const marcar = () => { const ag = Date.now(); if (!S.started) S.started = ag; else if (S.ultimo && ag - S.ultimo > PAUSA) S.started += ag - S.ultimo; S.ultimo = ag; };
  const salvar = () => { write(ST + '-draft', { day: day(), s: S }); const n = quem(); if (n) write(ST + '-name', n); };
  const quem = () => S.nome === 'Outro nome' ? S.outro.trim() : S.nome;

  // ---------- validação ----------
  function erros() {
    const out = [];
    if (!quem()) out.push({ id: 'nome', msg: 'Escolha quem está conferindo.', vazio: true });
    PERGS.forEach(p => {
      if (!S.r[p.id]) out.push({ id: p.id, msg: 'Responda Sim ou Não.', vazio: true });
      else if (S.r[p.id] === 'Não' && (!(S.prob[p.id] || '').trim() || !(S.prov[p.id] || '').trim())) out.push({ id: p.id, msg: 'Escreva o problema e a providência.' });
    });
    if (!S.perda) out.push({ id: 'perda', msg: 'Responda se teve perda hoje.', vazio: true });
    else if (S.perda === 'Sim' && !S.perdaTxt.trim()) out.push({ id: 'perda', msg: 'Escreva o que foi perdido.' });
    if (!S.ocor) out.push({ id: 'ocor', msg: 'Responda se teve ocorrência hoje.', vazio: true });
    else if (S.ocor === 'Sim' && (!S.ocorTipos.length || !S.ocorTxt.trim())) out.push({ id: 'ocor', msg: 'Marque o tipo e conte o que aconteceu.' });
    return out;
  }
  const total = PERGS.length + 2;
  const respondidas = () => PERGS.filter(p => S.r[p.id]).length + (S.perda ? 1 : 0) + (S.ocor ? 1 : 0);

  // ---------- tela ----------
  document.body.innerHTML = `<header><img src="../pedidos/logo-grupo-gabba.svg" alt="Grupo Gabba"><div><small>CHECKLIST DE FECHAMENTO</small><b>Liderança · ${esc(CONFIG.lojas[LOJA].nome)}</b><span>Fazer até as ${esc(PRAZO.replace(':', 'h'))}</span></div></header>
<main><div id="fila" class="tip" hidden></div><section id="pend" hidden></section><div id="corpo"></div><div id="fim" hidden></div></main>
<footer><div><div class="prog"><b id="cnt"></b><div class="bar"><div id="barra"></div></div><button type="button" id="fix" hidden></button></div><button class="send" id="enviar" type="button">Enviar</button></div></footer>`;

  function sn(id, v, on) { return `<div class="opts">${['Sim', 'Não'].map(o => `<button type="button" data-k="${id}" data-v="${o}" class="${v === o ? 'on' + (o === 'Não' ? ' nao' : '') : ''}">${o}</button>`).join('')}</div>`; }
  function aviso(id) { const e = erros().find(x => x.id === id && !x.vazio); return e ? `<div class="warn" role="alert">⚠️ <b>Falta completar:</b> ${esc(e.msg)}</div>` : ''; }

  function render() {
    const eq = [...(CFG.equipe || []), 'Outro nome'];
    let h = `<section class="box" id="b-nome"><h2><i>01</i>Quem está conferindo</h2>
<div class="names">${eq.map(n => `<button type="button" data-nome="${esc(n)}" class="${S.nome === n ? 'on' : ''}">${esc(n)}</button>`).join('')}</div>
<input type="text" id="outro" placeholder="Digite seu nome" value="${esc(S.outro)}" ${S.nome === 'Outro nome' ? '' : 'hidden'} data-f="outro">
<button type="button" class="reset" id="reset">Apagar respostas e começar de novo</button></section>`;
    h += `<section class="box"><h2><i>02</i>Conferência de fechamento</h2><p class="muted">Se algo não estiver certo, marque Não e diga o problema e a providência.</p>`;
    PERGS.forEach(p => {
      const v = S.r[p.id];
      h += `<div class="q" id="b-${p.id}"><b>${esc(p.q)}</b>${p.hint ? `<p class="hint">${esc(p.hint)}</p>` : ''}${aviso(p.id)}${sn(p.id, v)}`;
      if (p.botao) h += `<a class="link" href="${esc(p.botao.url)}" target="_blank" rel="noopener">${esc(p.botao.texto)} ↗</a>`;
      if (p.campo) h += `<label>${esc(p.campo.rotulo)} <small style="font-weight:400;color:var(--muted)">opcional</small><textarea data-f="campo" data-id="${p.id}" placeholder="${esc(p.campo.exemplo || '')}">${esc(S.campo[p.id] || '')}</textarea></label>`;
      if (v === 'Não') h += `<label>Qual é o problema? *<textarea data-f="prob" data-id="${p.id}">${esc(S.prob[p.id] || '')}</textarea></label><label>Qual providência foi ou será tomada? *<textarea data-f="prov" data-id="${p.id}">${esc(S.prov[p.id] || '')}</textarea></label><p class="tip">Gera tarefa: resolver antes de sair.</p>`;
      else if (v === 'Sim' && !p.campo) h += S.obs[p.id] != null ? `<label>Observação<textarea data-f="obs" data-id="${p.id}">${esc(S.obs[p.id])}</textarea></label>` : `<button type="button" class="obsbtn" data-addobs="${p.id}">+ Adicionar observação</button>`;
      h += `</div>`;
    });
    h += `</section>`;
    h += `<section class="box" id="b-perda"><h2><i>03</i>Perdas do dia</h2><p class="muted">Algo foi jogado fora, estragou ou venceu hoje?</p>${aviso('perda')}${sn('perda', S.perda)}
${S.perda === 'Sim' ? `<label>O que foi perdido e quanto? *<textarea data-f="perdaTxt" placeholder="Ex.: 2 pães (queimaram), 1 molho vencido">${esc(S.perdaTxt)}</textarea></label><p class="tip">Lembre de lançar também na <b>planilha de perdas</b>.</p>` : ''}</section>`;
    h += `<section class="box" id="b-ocor"><h2><i>04</i>Ocorrências do dia</h2><p class="muted">Quebra, reclamação de cliente, falta de funcionário ou outro fato importante.</p>${aviso('ocor')}${sn('ocor', S.ocor)}
${S.ocor === 'Sim' ? `<div class="chips">${OCOR.map(t => `<button type="button" data-tipo="${esc(t)}" class="${S.ocorTipos.includes(t) ? 'on' : ''}">${esc(t)}</button>`).join('')}</div><label>O que aconteceu? *<textarea data-f="ocorTxt">${esc(S.ocorTxt)}</textarea></label>` : ''}</section>`;
    h += `<section class="box"><h2><i>05</i>Diário do dia</h2><p class="muted">Opcional. Escreva o que achar importante registrar sobre o dia.</p><textarea data-f="diario" placeholder="Ex.: movimento forte depois das 20h, faltou troco, cliente elogiou o atendimento…">${esc(S.diario)}</textarea></section>`;
    E('corpo').innerHTML = h;
    sync();
  }
  function sync() {
    const n = respondidas();
    E('cnt').textContent = n + ' de ' + total + ' respondidos';
    E('barra').style.width = Math.round(100 * n / total) + '%';
    const ruins = erros().filter(e => !e.vazio);
    E('fix').hidden = !ruins.length;
    E('fix').textContent = '⚠️ ' + ruins.length + (ruins.length === 1 ? ' item precisa' : ' itens precisam') + ' de ajuste · toque para ver';
    E('enviar').textContent = enviado ? 'Nova conferência' : 'Revisar e enviar';
  }
  function irPara(id) { const el = E('b-' + id); if (el) el.scrollIntoView({ block: 'center', behavior: 'smooth' }); }
  function refreshAviso(id) {
    const box = E('b-' + id); if (!box) return;
    const old = box.querySelector('.warn'); if (old) old.remove();
    const h = aviso(id); if (h) (box.querySelector('.opts') || box.lastChild).insertAdjacentHTML('beforebegin', h);
  }

  E('corpo').addEventListener('click', e => {
    const b = e.target.closest('button'); if (!b) return;
    if (b.dataset.nome) { S.nome = b.dataset.nome; salvar(); render(); return; }
    if (b.id === 'reset') { if (confirm('Apagar todas as respostas e começar de novo?')) { S = vazio(); try { localStorage.removeItem(ST + '-draft'); } catch (x) {} render(); } return; }
    if (b.dataset.k) { const k = b.dataset.k; marcar(); if (k === 'perda') S.perda = b.dataset.v; else if (k === 'ocor') S.ocor = b.dataset.v; else S.r[k] = b.dataset.v; salvar(); render(); return; }
    if (b.dataset.addobs) { S.obs[b.dataset.addobs] = ''; render(); return; }
    if (b.dataset.tipo) { const t = b.dataset.tipo; S.ocorTipos = S.ocorTipos.includes(t) ? S.ocorTipos.filter(x => x !== t) : S.ocorTipos.concat(t); marcar(); salvar(); render(); return; }
  });
  E('corpo').addEventListener('input', e => {
    const f = e.target.dataset.f; if (!f) return;
    const id = e.target.dataset.id, v = e.target.value;
    if (id) S[f][id] = v; else S[f] = v;
    if (f !== 'outro') marcar();
    salvar(); sync();
    refreshAviso(id || (f.startsWith('perda') ? 'perda' : f.startsWith('ocor') ? 'ocor' : ''));
  });
  E('fix').onclick = () => { const e = erros().find(x => !x.vazio); if (e) irPara(e.id); };

  // ---------- envio ----------
  const segs = () => { if (!S.started) return 0; const ag = Date.now(), fim = S.ultimo && ag - S.ultimo > PAUSA ? S.ultimo : ag; return Math.max(0, Math.round((fim - S.started) / 1000)); };
  const fmtT = s => Math.floor(s / 60) + ' min ' + String(s % 60).padStart(2, '0') + ' s';
  function codigo() { const p = Object.fromEntries(new Intl.DateTimeFormat('pt-BR', { timeZone: 'America/Fortaleza', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).formatToParts(new Date()).map(x => [x.type, x.value])); return 'FCH-' + p.year.slice(2) + p.month + p.day + '-' + p.hour + p.minute + '-' + Math.random().toString(36).slice(2, 4).toUpperCase(); }
  function montar(comp) {
    const base = { loja: LOJA, setor: SETOR, responsavel: quem(), comprovante: comp };
    const rows = [], novas = []; let sim = 0, nao = 0;
    PERGS.forEach(p => {
      const v = S.r[p.id], item = '[Funcionamento] ' + p.q;
      if (v === 'Sim') sim++; else nao++;
      if (v === 'Não') {
        const ob = 'Problema: ' + S.prob[p.id].trim() + ' · Providência: ' + S.prov[p.id].trim();
        rows.push({ ...base, status: 'NÃO', item, motivo: '', observacao: ob, tempo: 'corrigir' });
        novas.push({ id: comp + '|' + p.id, comp, item, nome: p.q, cat: 'corrigir', det: ob });
      } else if ((S.obs[p.id] || '').trim()) rows.push({ ...base, status: 'SIM', item, motivo: '', observacao: S.obs[p.id].trim(), tempo: 'obs' });
      if (p.campo && (S.campo[p.id] || '').trim()) rows.push({ ...base, status: 'NOTA', item: p.campo.item || p.campo.rotulo, motivo: '', observacao: S.campo[p.id].trim(), tempo: '' });
    });
    if (S.perda === 'Sim') { sim++; rows.push({ ...base, status: 'SIM', item: 'Perdas do dia', motivo: 'Lançar na planilha de perdas', observacao: S.perdaTxt.trim(), tempo: 'perda' }); novas.push({ id: comp + '|perda', comp, item: 'Perdas do dia', nome: 'Lançar as perdas do dia na planilha de perdas', cat: 'perda', det: S.perdaTxt.trim() }); } else sim++;
    if (S.ocor === 'Sim') { sim++; rows.push({ ...base, status: 'SIM', item: 'Ocorrência do dia', motivo: S.ocorTipos.join(', '), observacao: S.ocorTxt.trim(), tempo: 'obs' }); } else sim++;
    if (S.diario.trim()) rows.push({ ...base, status: 'NOTA', item: 'Diário do dia', motivo: '', observacao: S.diario.trim(), tempo: '' });
    rows.push({ ...base, status: sim + ' OK · 0 POUCO · ' + nao + ' FALTA', item: 'RESUMO', motivo: 'Fechamento', observacao: total + ' itens conferidos', tempo: fmtT(segs()) });
    return { rows, novas };
  }
  async function esvaziar() {
    if (enviando || !fila.length) return; enviando = true;
    try {
      while (fila.length) {
        const body = new URLSearchParams(); Object.keys(CONFIG.campos).forEach(k => body.append(CONFIG.campos[k], fila[0][k] || ''));
        await fetch(CONFIG.form, { method: 'POST', mode: 'no-cors', body });
        fila = fila.slice(1); write(ST + '-fila', fila); mostraFila();
        await new Promise(r => setTimeout(r, 150));
      }
    } catch (e) { mostraFila(); } finally { enviando = false; mostraFila(); }
  }
  function mostraFila() { E('fila').hidden = !fila.length; E('fila').textContent = '⏳ Enviando ' + fila.length + ' linha(s)… não feche a página.'; }
  function enfileirar(rows) { fila = fila.concat(rows); write(ST + '-fila', fila); mostraFila(); esvaziar(); }
  window.addEventListener('online', esvaziar);

  function tarefasHTML(lista) {
    if (!lista.length) return '';
    return lista.map(t => `<div class="task"><b>${t.cat === 'perda' ? '⚠️ ' : '🛠️ '}${esc(t.nome)}</b><p>${esc(t.det)}</p><button type="button" data-done="${esc(t.id)}">Resolvido</button></div>`).join('');
  }
  function mostraPend() {
    const box = E('pend');
    box.hidden = !tasks.length;
    box.innerHTML = tasks.length ? `<div class="box"><h2>Pendências do fechamento</h2><p class="muted">Toque em Resolvido quando estiver feito.</p>${tarefasHTML(tasks)}</div>` : '';
  }
  document.addEventListener('click', e => {
    const b = e.target.closest('[data-done]'); if (!b) return;
    const t = tasks.find(x => x.id === b.dataset.done); if (!t) return;
    const n = quem() || read(ST + '-name', '');
    if (!n) { alert('Escolha seu nome no início da página.'); return; }
    enfileirar([{ loja: LOJA, setor: SETOR, responsavel: n, comprovante: t.comp, item: t.item, status: 'RESOLVIDO', motivo: 'Resolvido pela equipe', observacao: '', tempo: '' }]);
    tasks = tasks.filter(x => x.id !== t.id); write(ST + '-tasks', tasks); mostraPend();
    if (enviado) mostraFim();
  });

  function revisar() {
    const errs = erros();
    if (errs.length) { const e0 = errs[0]; render(); irPara(e0.id); const box = E('b-' + e0.id); if (box && e0.vazio) box.insertAdjacentHTML('afterbegin', `<div class="warn" role="alert">⚠️ ${esc(e0.msg)}</div>`); return; }
    const { rows } = montar('PREVIA');
    const linhas = rows.filter(r => r.item !== 'RESUMO').map(r => `<li><b>${esc(r.item.replace('[Funcionamento] ', ''))}</b> · ${esc(r.status)}${r.observacao ? ' · ' + esc(r.observacao) : ''}</li>`).join('');
    E('fim').hidden = false; E('corpo').hidden = true;
    E('fim').innerHTML = `<section class="box"><h2>Revise antes de enviar</h2><p>${esc(quem())} · ${hm()}</p>${linhas ? `<ul>${linhas}</ul>` : '<p class="ok">✅ Tudo certo no fechamento, sem problemas.</p>'}
<button type="button" class="send" id="confirmar" style="width:100%">Enviar fechamento</button><button type="button" class="reset" id="voltar">← Voltar e corrigir</button></section>`;
    E('confirmar').onclick = confirmar; E('voltar').onclick = () => { E('fim').hidden = true; E('corpo').hidden = false; };
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }
  function confirmar() {
    const comp = codigo(), { rows, novas } = montar(comp);
    tasks = tasks.filter(t => !novas.some(n => n.item === t.item)).concat(novas); write(ST + '-tasks', tasks);
    enviado = { comp, hora: hm(), nome: quem() }; write(ST + '-ultimo', { day: day(), ...enviado });
    enfileirar(rows);
    try { localStorage.removeItem(ST + '-draft'); } catch (x) {}
    mostraFim();
  }
  function mostraFim() {
    E('corpo').hidden = true; E('fim').hidden = false;
    E('fim').innerHTML = `<section class="box"><div class="ok"><b>✅ Fechamento enviado</b><br>${esc(enviado.nome)} · ${esc(enviado.hora)} · comprovante ${esc(enviado.comp)}</div>
${tasks.length ? `<h2 style="margin-top:16px">O que fazer agora</h2>${tarefasHTML(tasks)}` : '<p>Nada pendente. Bom descanso!</p>'}</section>`;
    E('pend').hidden = true; sync();
  }
  E('enviar').onclick = () => { if (enviado) { enviado = null; S = vazio(); S.nome = read(ST + '-name', '') && (CFG.equipe || []).includes(read(ST + '-name', '')) ? read(ST + '-name', '') : ''; E('fim').hidden = true; E('corpo').hidden = false; mostraPend(); render(); } else revisar(); };

  const ult = read(ST + '-ultimo', null);
  render(); mostraPend(); mostraFila(); esvaziar();
  if (ult && ult.day === day() && !rasc) { enviado = ult; mostraFim(); }
})();
