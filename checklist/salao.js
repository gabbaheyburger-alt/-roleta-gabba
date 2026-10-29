// Checklists do SALÃO (Recepção e Garçom · abertura e fechamento)
// Links: ?loja=gabba&setor=recepcao-abertura | recepcao-fechamento | garcom-abertura | garcom-fechamento
// Tudo vem do config.json (setores "Recepcao-abertura" etc.). Nomes da equipe: equipe.json (fácil de editar).
// Grava no mesmo formulário/planilha CHECKLISTS. Tipos de item:
//  sn          Sim/Não. "Não" exige problema + providência → tarefa (categoria do item, padrão "corrigir").
//  sn + campo  Sim/Não com campo de texto (quando: "Sim" | "Não" | "sempre"; obrigatorio: true/false).
//  pendencia   "Há pendência…?" Sim exige descrição → tarefa corrigir. Não = tudo certo.
//  ocorrencia  Sim → tipos + descrição (categoria obs).
//  material    OK / POUCO / FALTA. POUCO/FALTA exige motivo → tarefa estoque.
// "dias": [0..6] (dom..sáb) = só aparece nesses dias. Sem "dias" = todo dia.
(async function () {
  const E = id => document.getElementById(id);
  const esc = v => String(v ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const read = (k, d) => { try { const v = JSON.parse(localStorage.getItem(k)); return v ?? d; } catch (e) { return d; } };
  const write = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} };
  const TZ = 'America/Fortaleza';
  const day = () => new Intl.DateTimeFormat('sv-SE', { timeZone: TZ }).format(new Date());
  const hm = () => new Intl.DateTimeFormat('pt-BR', { timeZone: TZ, hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(new Date());
  const qs = new URLSearchParams(location.search);
  const CHAVE = (qs.get('setor') || '').toLowerCase();

  let CONFIG, CFG, LOJA, EQUIPE = {};
  try {
    const r = await fetch('config.json?v=' + Date.now(), { cache: 'no-store' });
    CONFIG = await r.json();
    LOJA = Object.keys(CONFIG.lojas).find(k => k.toLowerCase() === (qs.get('loja') || 'gabba').toLowerCase());
    const setores = CONFIG.lojas[LOJA].setores;
    CFG = setores[Object.keys(setores).find(k => k.toLowerCase() === CHAVE)];
    if (!CFG) throw Error('setor');
    try { const re = await fetch('equipe.json?v=' + Date.now(), { cache: 'no-store' }); if (re.ok) EQUIPE = await re.json(); } catch (e) {}
  } catch (e) {
    document.body.innerHTML = '<main style="font:18px system-ui;padding:24px"><h1>Não foi possível abrir o checklist</h1><p>Recarregue a página. Se continuar, avise o Gabba.</p></main>';
    return;
  }
  const dsem = new Date(new Date().toLocaleString('en-US', { timeZone: TZ })).getDay();
  const SETOR = CFG.nome, PRAZO = (CFG.prazo_semana && CFG.prazo_semana[dsem]) || CFG.prazo || '17:00';
  const FECH = !!CFG.fechamento;
  const EQ = (EQUIPE[CFG.funcao] && EQUIPE[CFG.funcao].length ? EQUIPE[CFG.funcao] : CFG.equipe) || [];
  const ST = 'gabba-' + CHAVE + '-v1';
  const OCOR = ['Quebra', 'Reclamação de cliente', 'Falta de funcionário', 'Outra'];
  const MOTIVOS = ['Pedido, aguardando estoque central', 'Ainda não foi pedido', 'Outro'];
  // Itens de hoje (filtra pelos dias da semana)
  const SECOES = CFG.secoes.map(s => ({ ...s, itens: s.itens.filter(i => !i.dias || i.dias.includes(dsem)) })).filter(s => s.itens.length);
  const ITENS = SECOES.flatMap(s => s.itens.map(i => ({ ...i, tipo: i.tipo || s.tipo || 'sn', secao: s.titulo })));

  // ---------- visual (mesmo das outras páginas de checklist) ----------
  document.querySelectorAll('style').forEach(s => s.remove());
  const css = document.createElement('style');
  css.textContent = `:root{--bg:#f3f2ee;--ink:#23241f;--red:#a33e2d;--ok:#2f6b3a;--amb:#8a620e;--line:#deded6;--muted:#66685f}*{box-sizing:border-box}body{margin:0;background:var(--bg);color:var(--ink);font:16px/1.5 Inter,system-ui,sans-serif}
header{background:#171916;color:#fff;padding:18px 20px;display:flex;gap:16px;align-items:center}header img{max-width:150px;max-height:46px}header div{border-left:1px solid #444;padding-left:16px}header small{display:block;letter-spacing:3px;color:#bdb8a8;font-size:11px}header b{font-size:20px;line-height:1.2}header span{display:block;color:#d5d0be;font-size:13px}
main{max-width:760px;margin:auto;padding:16px 16px 160px}.box{background:#fff;border:1px solid var(--line);border-radius:16px;padding:18px;margin:14px 0}
h2{font-size:13px;letter-spacing:2px;text-transform:uppercase;margin:0 0 4px}h2 i{font-style:normal;color:var(--muted);margin-right:10px}.muted{color:var(--muted);font-size:14px;margin:0 0 10px}
.q{border-top:1px solid var(--line);padding:14px 0}.q:first-of-type{border-top:0}.q>b{display:block}.q .hint{font-size:13px;color:var(--muted);margin:2px 0 0}
.opts{display:flex;gap:8px;margin:10px 0 0}.opts button,.names button{flex:1;font:inherit;font-weight:650;min-height:48px;border:1px solid var(--line);border-radius:10px;background:#fff;color:var(--ink);cursor:pointer}
.opts button.on{background:var(--ink);color:#fff;border-color:var(--ink)}.opts button.on.nao,.opts button.on.falta{background:var(--red);border-color:var(--red)}.opts button.on.pouco{background:var(--amb);border-color:var(--amb)}
.names{display:grid;grid-template-columns:1fr 1fr;gap:8px}.names button.on{background:var(--ink);color:#fff}
label{display:block;font-weight:650;font-size:14px;margin:10px 0 0}textarea,input[type=text],select{display:block;width:100%;border:1px solid var(--line);border-radius:10px;padding:11px;font:inherit;margin-top:6px;background:#fff;color:var(--ink)}textarea{min-height:76px}
.link{display:flex;align-items:center;justify-content:center;gap:6px;margin-top:10px;min-height:46px;border-radius:10px;background:#eae8de;color:var(--ink);font-weight:700;text-decoration:none}
.chips{display:flex;flex-wrap:wrap;gap:8px;margin-top:8px}.chips button{font:inherit;font-size:14px;font-weight:600;padding:8px 12px;border-radius:999px;border:1px solid var(--line);background:#fff;cursor:pointer}.chips button.on{background:var(--ink);color:#fff}
.tip{background:#f3f2ee;border-radius:8px;padding:9px 11px;font-size:13px;margin-top:8px}.warn{background:#f9e6df;border:2px solid var(--red);color:#7a2416;border-radius:10px;padding:9px 11px;margin-top:10px;font-size:14px}
.dia{display:inline-block;font-size:11px;font-weight:700;letter-spacing:.04em;color:#7a5a12;background:#f6ecd2;border-radius:99px;padding:1px 8px;margin-left:6px;vertical-align:2px}
.obsbtn{all:unset;cursor:pointer;color:var(--red);font-weight:600;font-size:14px;margin-top:8px;display:inline-block}
footer{position:fixed;left:0;right:0;bottom:0;background:#fff;border-top:1px solid var(--line);padding:12px 16px calc(12px + env(safe-area-inset-bottom))}footer>div{max-width:760px;margin:auto;display:flex;gap:14px;align-items:center}
.prog{flex:1;font-size:14px}.prog b{display:block}.bar{height:6px;border-radius:9px;background:#e7e5dc;margin-top:6px;overflow:hidden}.bar>div{height:100%;background:var(--ok);width:0}
.send{font:inherit;font-weight:800;min-height:50px;padding:0 20px;border-radius:12px;border:0;background:var(--ink);color:#fff;cursor:pointer}
#fix{margin-top:8px;width:100%;min-height:38px;border:0;border-radius:8px;background:var(--red);color:#fff;font:inherit;font-size:14px;font-weight:700}
.task{background:#fff;border-radius:12px;padding:12px 14px;margin:10px 0;border:1px solid var(--line);border-left:4px solid var(--red)}.task b{display:block}.task p{margin:4px 0;font-size:14px;color:var(--muted)}.task button{width:100%;min-height:42px;margin-top:6px;font:inherit;font-weight:700;border:1px solid var(--line);border-radius:10px;background:#fff}
.ok{background:#e8efe0;border-radius:12px;padding:14px}.reset{font:inherit;font-size:14px;color:var(--red);background:none;border:0;margin-top:10px;cursor:pointer;padding:0}[hidden]{display:none!important}`;
  document.head.append(css);
  document.title = CFG.titulo + ' · ' + CONFIG.lojas[LOJA].nome;

  // ---------- estado ----------
  const vazio = () => ({ nome: '', outro: '', r: {}, prob: {}, prov: {}, obs: {}, campo: {}, motivo: {}, tipos: {}, started: null, ultimo: null });
  let S = vazio();
  const rasc = read(ST + '-draft', null);
  const lembrar = () => { const n = read(ST + '-name', ''); if (n) { if (EQ.includes(n)) S.nome = n; else { S.nome = 'Outro nome'; S.outro = n; } } };
  if (rasc && rasc.day === day()) S = Object.assign(vazio(), rasc.s); else lembrar();
  let tasks = read(ST + '-tasks', []), fila = read(ST + '-fila', []), enviando = false, enviado = null;
  const PAUSA = 300000;
  const marcar = () => { const ag = Date.now(); if (!S.started) S.started = ag; else if (S.ultimo && ag - S.ultimo > PAUSA) S.started += ag - S.ultimo; S.ultimo = ag; };
  const quem = () => S.nome === 'Outro nome' ? S.outro.trim() : S.nome;
  const salvar = () => { write(ST + '-draft', { day: day(), s: S }); const n = quem(); if (n) write(ST + '-name', n); };
  const t = x => (x || '').trim();

  // ---------- regras de cada tipo ----------
  const opcoes = it => it.tipo === 'material' ? ['OK', 'POUCO', 'FALTA'] : ['Sim', 'Não'];
  const mostraCampo = it => it.campo && (it.campo.quando === 'sempre' || S.r[it.id] === (it.campo.quando || 'Sim'));
  function erroDe(it) {
    const v = S.r[it.id];
    if (!v) return { msg: 'Responda este item.', vazio: true };
    if (it.tipo === 'sn' && v === 'Não' && !it.campo && (!t(S.prob[it.id]) || !t(S.prov[it.id]))) return { msg: 'Escreva o problema e a providência.' };
    if (mostraCampo(it) && it.campo.obrigatorio && !t(S.campo[it.id])) return { msg: it.campo.erro || 'Preencha o campo abaixo.' };
    if (it.tipo === 'pendencia' && v === 'Sim' && !t(S.campo[it.id])) return { msg: 'Descreva a pendência.' };
    if (it.tipo === 'ocorrencia' && v === 'Sim' && (!(S.tipos[it.id] || []).length || !t(S.campo[it.id]))) return { msg: 'Marque o tipo e conte o que aconteceu.' };
    if (it.tipo === 'material' && v !== 'OK' && !S.motivo[it.id]) return { msg: 'Escolha o motivo.' };
    if (it.tipo === 'material' && S.motivo[it.id] === 'Outro' && !t(S.campo[it.id])) return { msg: 'Explique o motivo.' };
    return null;
  }
  const erros = () => { const out = []; if (!quem()) out.push({ id: 'nome', msg: 'Escolha quem está conferindo.', vazio: true }); ITENS.forEach(it => { const e = erroDe(it); if (e) out.push({ id: it.id, ...e }); }); return out; };

  // ---------- tela ----------
  const prazoTxt = PRAZO === '23:59' ? '23h59' : PRAZO.replace(':', 'h');
  document.body.innerHTML = `<header><img src="../pedidos/logo-grupo-gabba.svg" alt="Grupo Gabba"><div><small>CHECKLIST DE ${FECH ? 'FECHAMENTO' : 'ABERTURA'}</small><b>${esc(CFG.titulo)} · ${esc(CONFIG.lojas[LOJA].nome)}</b><span>Fazer até as ${esc(prazoTxt)}</span></div></header>
<main><div id="fila" class="tip" hidden></div><section id="pend" hidden></section><div id="corpo"></div><div id="fim" hidden></div></main>
<footer><div><div class="prog"><b id="cnt"></b><div class="bar"><div id="barra"></div></div><button type="button" id="fix" hidden></button></div><button class="send" id="enviar" type="button">Revisar e enviar</button></div></footer>`;
  const NOMES_DIA = ['domingo', 'segunda', 'terça', 'quarta', 'quinta', 'sexta', 'sábado'];
  function aviso(id) { const it = ITENS.find(x => x.id === id); const e = it && erroDe(it); return e && !e.vazio ? `<div class="warn" role="alert">⚠️ <b>Falta completar:</b> ${esc(e.msg)}</div>` : ''; }
  const corBotao = (it, o) => it.tipo === 'material' ? o.toLowerCase() : (it.tipo === 'pendencia' ? (o === 'Sim' ? 'nao' : '') : it.tipo === 'ocorrencia' ? '' : (o === 'Não' ? 'nao' : ''));
  function itemHTML(it) {
    const v = S.r[it.id], ops = opcoes(it);
    let h = `<div class="q" id="b-${it.id}"><b>${esc(it.q)}${it.dias ? `<span class="dia">hoje é ${NOMES_DIA[dsem]}</span>` : ''}</b>${it.hint ? `<p class="hint">${esc(it.hint)}</p>` : ''}${aviso(it.id)}`;
    h += `<div class="opts">${ops.map(o => `<button type="button" data-k="${it.id}" data-v="${o}" class="${v === o ? 'on ' + corBotao(it, o) : ''}">${o}</button>`).join('')}</div>`;
    if (it.botao) h += `<a class="link" href="${esc(it.botao.url)}" target="_blank" rel="noopener">${esc(it.botao.texto)} ↗</a>`;
    if (it.tipo === 'sn' && v === 'Não' && !it.campo) h += `<label>Qual é o problema? *<textarea data-f="prob" data-id="${it.id}">${esc(S.prob[it.id] || '')}</textarea></label><label>Qual providência foi ou será tomada? *<textarea data-f="prov" data-id="${it.id}">${esc(S.prov[it.id] || '')}</textarea></label><p class="tip">Gera tarefa: ${FECH ? 'resolver antes de sair' : 'corrigir antes de abrir'}.</p>`;
    if (mostraCampo(it)) h += `<label>${esc(it.campo.rotulo)} ${it.campo.obrigatorio ? '*' : '<small style="font-weight:400;color:var(--muted)">opcional</small>'}<textarea data-f="campo" data-id="${it.id}" placeholder="${esc(it.campo.exemplo || '')}">${esc(S.campo[it.id] || '')}</textarea></label>`;
    if (it.tipo === 'pendencia' && v === 'Sim') h += `<label>Qual é a pendência e o que foi feito? *<textarea data-f="campo" data-id="${it.id}">${esc(S.campo[it.id] || '')}</textarea></label><p class="tip">Gera tarefa para resolver.</p>`;
    if (it.tipo === 'ocorrencia' && v === 'Sim') h += `<div class="chips">${OCOR.map(o => `<button type="button" data-tipo="${esc(o)}" data-id="${it.id}" class="${(S.tipos[it.id] || []).includes(o) ? 'on' : ''}">${esc(o)}</button>`).join('')}</div><label>O que aconteceu? *<textarea data-f="campo" data-id="${it.id}">${esc(S.campo[it.id] || '')}</textarea></label>`;
    if (it.tipo === 'material' && v && v !== 'OK') h += `<label>Motivo *<select data-f="motivo" data-id="${it.id}"><option value="">Selecione</option>${MOTIVOS.map(m => `<option ${S.motivo[it.id] === m ? 'selected' : ''}>${esc(m)}</option>`).join('')}</select></label>${S.motivo[it.id] === 'Outro' ? `<label>Explique *<textarea data-f="campo" data-id="${it.id}">${esc(S.campo[it.id] || '')}</textarea></label>` : ''}<p class="tip">Peça ao estoque e acompanhe.</p>`;
    if ((v === 'Sim' && it.tipo === 'sn' && !it.campo) || (v === 'OK' && it.tipo === 'material')) h += S.obs[it.id] != null ? `<label>Observação<textarea data-f="obs" data-id="${it.id}">${esc(S.obs[it.id])}</textarea></label>` : `<button type="button" class="obsbtn" data-addobs="${it.id}">+ Adicionar observação</button>`;
    return h + '</div>';
  }
  function render() {
    let h = `<section class="box" id="b-nome"><h2><i>01</i>Quem está conferindo</h2>
<div class="names">${[...EQ, 'Outro nome'].map(n => `<button type="button" data-nome="${esc(n)}" class="${S.nome === n ? 'on' : ''}">${esc(n)}</button>`).join('')}</div>
<input type="text" id="outro" placeholder="Digite seu nome" value="${esc(S.outro)}" ${S.nome === 'Outro nome' ? '' : 'hidden'} data-f="outro">
<button type="button" class="reset" id="reset">Apagar respostas e começar de novo</button></section>`;
    SECOES.forEach((s, i) => { h += `<section class="box"><h2><i>${String(i + 2).padStart(2, '0')}</i>${esc(s.titulo)}</h2>${s.dica ? `<p class="muted">${esc(s.dica)}</p>` : ''}${s.itens.map(x => itemHTML(ITENS.find(y => y.id === x.id))).join('')}</section>`; });
    E('corpo').innerHTML = h; sync();
  }
  function sync() {
    const n = ITENS.filter(i => S.r[i.id]).length;
    E('cnt').textContent = n + ' de ' + ITENS.length + ' respondidos';
    E('barra').style.width = Math.round(100 * n / ITENS.length) + '%';
    const ruins = erros().filter(e => !e.vazio);
    E('fix').hidden = !ruins.length;
    E('fix').textContent = '⚠️ ' + ruins.length + (ruins.length === 1 ? ' item precisa' : ' itens precisam') + ' de ajuste · toque para ver';
    E('enviar').textContent = enviado ? 'Nova conferência' : 'Revisar e enviar';
  }
  const irPara = id => { const el = E('b-' + id); if (el) el.scrollIntoView({ block: 'center', behavior: 'smooth' }); };
  function refreshAviso(id) { const box = E('b-' + id); if (!box) return; const o = box.querySelector('.warn'); if (o) o.remove(); const h = aviso(id); if (h) box.querySelector('.opts').insertAdjacentHTML('beforebegin', h); }

  E('corpo').addEventListener('click', e => {
    const b = e.target.closest('button'); if (!b) return;
    if (b.dataset.nome) { S.nome = b.dataset.nome; salvar(); render(); return; }
    if (b.id === 'reset') { if (confirm('Apagar todas as respostas e começar de novo?')) { S = vazio(); lembrar(); try { localStorage.removeItem(ST + '-draft'); } catch (x) {} render(); } return; }
    if (b.dataset.k) { marcar(); S.r[b.dataset.k] = b.dataset.v; salvar(); render(); return; }
    if (b.dataset.addobs) { S.obs[b.dataset.addobs] = ''; render(); return; }
    if (b.dataset.tipo) { const id = b.dataset.id, l = S.tipos[id] || []; S.tipos[id] = l.includes(b.dataset.tipo) ? l.filter(x => x !== b.dataset.tipo) : l.concat(b.dataset.tipo); marcar(); salvar(); render(); return; }
  });
  const aoDigitar = e => {
    const f = e.target.dataset.f; if (!f) return;
    const id = e.target.dataset.id;
    if (id) S[f][id] = e.target.value; else S[f] = e.target.value;
    if (f !== 'outro') marcar();
    salvar(); sync();
    if (f === 'motivo') render(); else if (id) refreshAviso(id);
  };
  E('corpo').addEventListener('input', aoDigitar);
  E('corpo').addEventListener('change', e => { if (e.target.tagName === 'SELECT') aoDigitar(e); });
  E('fix').onclick = () => { const e = erros().find(x => !x.vazio); if (e) irPara(e.id); };

  // ---------- montar linhas para a planilha ----------
  const segs = () => { if (!S.started) return 0; const ag = Date.now(), fim = S.ultimo && ag - S.ultimo > PAUSA ? S.ultimo : ag; return Math.max(0, Math.round((fim - S.started) / 1000)); };
  const fmtT = s => Math.floor(s / 60) + ' min ' + String(s % 60).padStart(2, '0') + ' s';
  function codigo() { const p = Object.fromEntries(new Intl.DateTimeFormat('pt-BR', { timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).formatToParts(new Date()).map(x => [x.type, x.value])); return (FECH ? 'FCH-' : 'CHK-') + p.year.slice(2) + p.month + p.day + '-' + p.hour + p.minute + '-' + Math.random().toString(36).slice(2, 4).toUpperCase(); }
  function montar(comp) {
    const base = { loja: LOJA, setor: SETOR, responsavel: quem(), comprovante: comp };
    const rows = [], novas = []; let ok = 0, pouco = 0, falta = 0;
    const tarefa = (it, item, cat, det) => novas.push({ id: comp + '|' + it.id, comp, item, nome: it.q, cat, det });
    ITENS.forEach(it => {
      const v = S.r[it.id], cat = it.categoria || 'corrigir', camp = t(S.campo[it.id]);
      if (it.tipo === 'material') {
        if (v === 'OK') ok++; else if (v === 'POUCO') pouco++; else falta++;
        if (v !== 'OK') { const ob = camp; rows.push({ ...base, status: v, item: it.q, motivo: S.motivo[it.id], observacao: ob, tempo: 'estoque' }); tarefa(it, it.q, 'estoque', v + ' · ' + S.motivo[it.id] + (ob ? ' · ' + ob : '')); }
        else if (t(S.obs[it.id])) rows.push({ ...base, status: 'OK', item: it.q, motivo: '', observacao: t(S.obs[it.id]), tempo: 'obs' });
        return;
      }
      const item = '[Funcionamento] ' + it.q;
      if (it.tipo === 'pendencia' || it.tipo === 'ocorrencia') {
        ok++;
        if (v === 'Sim') {
          const c = it.tipo === 'ocorrencia' ? 'obs' : 'corrigir';
          rows.push({ ...base, status: 'SIM', item: it.tipo === 'ocorrencia' ? 'Ocorrência do dia' : it.q, motivo: it.tipo === 'ocorrencia' ? (S.tipos[it.id] || []).join(', ') : '', observacao: camp, tempo: c });
          if (c === 'corrigir') tarefa(it, it.q, c, camp);
        }
        return;
      }
      if (v === 'Sim') ok++; else falta++;
      if (it.campo && mostraCampo(it) && camp) {
        const c = v === 'Não' ? cat : '';
        rows.push({ ...base, status: c ? 'NÃO' : 'NOTA', item: c ? item : (it.campo.item || it.q), motivo: '', observacao: camp, tempo: c });
        if (c) tarefa(it, item, c, camp);
      } else if (v === 'Não') {
        const ob = 'Problema: ' + t(S.prob[it.id]) + ' · Providência: ' + t(S.prov[it.id]);
        rows.push({ ...base, status: 'NÃO', item, motivo: '', observacao: ob, tempo: cat });
        tarefa(it, item, cat, ob);
      } else if (t(S.obs[it.id])) rows.push({ ...base, status: 'SIM', item, motivo: '', observacao: t(S.obs[it.id]), tempo: 'obs' });
    });
    rows.push({ ...base, status: ok + ' OK · ' + pouco + ' POUCO · ' + falta + ' FALTA', item: 'RESUMO', motivo: FECH ? 'Fechamento' : 'Abertura', observacao: ITENS.length + ' itens conferidos', tempo: fmtT(segs()) });
    return { rows, novas };
  }

  // ---------- envio (fila guardada no celular) ----------
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
  function mostraFila() { E('fila').hidden = !fila.length; E('fila').textContent = '⏳ Enviando ' + fila.length + ' linha(s)… não feche a página. Se estiver sem internet, abra a página de novo quando voltar a conexão.'; }
  function enfileirar(rows) { fila = fila.concat(rows); write(ST + '-fila', fila); mostraFila(); esvaziar(); }
  window.addEventListener('online', esvaziar);

  const ICON = { corrigir: '🛠️ ', estoque: '📦 ', obs: '📝 ' };
  const tarefasHTML = l => l.map(x => `<div class="task"><b>${ICON[x.cat] || '🛠️ '}${esc(x.nome)}</b><p>${esc(x.det)}</p><button type="button" data-done="${esc(x.id)}">Resolvido</button></div>`).join('');
  function mostraPend() { const box = E('pend'); box.hidden = !tasks.length; box.innerHTML = tasks.length ? `<div class="box"><h2>Pendências anteriores</h2><p class="muted">Toque em Resolvido só quando estiver feito de verdade.</p>${tarefasHTML(tasks)}</div>` : ''; }
  document.addEventListener('click', e => {
    const b = e.target.closest('[data-done]'); if (!b) return;
    const x = tasks.find(y => y.id === b.dataset.done); if (!x) return;
    const n = quem() || read(ST + '-name', '');
    if (!n) { alert('Escolha seu nome no início da página.'); return; }
    if (!confirm('Confirmar que "' + x.nome + '" foi resolvido?')) return;
    enfileirar([{ loja: LOJA, setor: SETOR, responsavel: n, comprovante: x.comp, item: x.item, status: 'RESOLVIDO', motivo: 'Resolvido pela equipe', observacao: '', tempo: '' }]);
    tasks = tasks.filter(y => y.id !== x.id); write(ST + '-tasks', tasks); mostraPend(); if (enviado) mostraFim();
  });

  function revisar() {
    const errs = erros();
    if (errs.length) { const e0 = errs[0]; render(); irPara(e0.id); const box = E('b-' + e0.id); if (box && e0.vazio) box.insertAdjacentHTML('afterbegin', `<div class="warn" role="alert">⚠️ ${esc(e0.msg)}</div>`); return; }
    const { rows } = montar('PREVIA');
    const linhas = rows.filter(r => r.item !== 'RESUMO').map(r => `<li><b>${esc(r.item.replace('[Funcionamento] ', ''))}</b> · ${esc(r.status)}${r.motivo ? ' · ' + esc(r.motivo) : ''}${r.observacao ? ' · ' + esc(r.observacao) : ''}</li>`).join('');
    E('fim').hidden = false; E('corpo').hidden = true;
    E('fim').innerHTML = `<section class="box"><h2>Revise antes de enviar</h2><p>${esc(quem())} · ${hm()} · ${ITENS.length} itens</p>${linhas ? `<ul>${linhas}</ul>` : '<p class="ok">✅ Tudo certo, sem problemas.</p>'}
<button type="button" class="send" id="confirmar" style="width:100%">Enviar checklist</button><button type="button" class="reset" id="voltar">← Voltar e corrigir</button></section>`;
    E('confirmar').onclick = confirmar; E('voltar').onclick = () => { E('fim').hidden = true; E('corpo').hidden = false; };
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }
  function confirmar() {
    const comp = codigo(), { rows, novas } = montar(comp);
    tasks = tasks.filter(x => !novas.some(n => n.item === x.item)).concat(novas); write(ST + '-tasks', tasks);
    enviado = { comp, hora: hm(), nome: quem() }; write(ST + '-ultimo', { day: day(), ...enviado });
    enfileirar(rows);
    try { localStorage.removeItem(ST + '-draft'); } catch (x) {}
    mostraFim();
  }
  function mostraFim() {
    E('corpo').hidden = true; E('fim').hidden = false; E('pend').hidden = true;
    E('fim').innerHTML = `<section class="box"><div class="ok"><b>✅ Checklist enviado</b><br>${esc(enviado.nome)} · ${esc(enviado.hora)} · comprovante ${esc(enviado.comp)}</div>${tasks.length ? `<h2 style="margin-top:16px">O que fazer agora</h2>${tarefasHTML(tasks)}` : '<p>Nada pendente.</p>'}</section>`;
    sync();
  }
  E('enviar').onclick = () => { if (enviado) { enviado = null; S = vazio(); lembrar(); E('fim').hidden = true; E('corpo').hidden = false; mostraPend(); render(); } else revisar(); };

  const ult = read(ST + '-ultimo', null);
  render(); mostraPend(); mostraFila(); esvaziar();
  if (ult && ult.day === day() && !rasc) { enviado = ult; mostraFim(); }
})();
