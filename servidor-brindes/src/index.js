/*
 * Servidor dos brindes do Fliperama Gabba (Cloudflare Worker + Durable Object com SQLite).
 * Separado do servidor do ponto: se der problema aqui, o ponto não é afetado.
 *
 * Como funciona:
 *  - A recepção lança os brindes do dia (ex.: 1 molho da casa, 1 batata, 1 refri). Eles formam uma fila, na ordem lançada.
 *  - Quando um cliente vence um jogo valendo prêmio, o jogo chama /ganhar: o PRIMEIRO brinde da fila fica reservado
 *    para ele, com um código curto (ex.: K7Q2). Se a fila estiver vazia, a resposta é "esgotado".
 *  - O cliente mostra o código na recepção, que toca em "Dar baixa". Se o cliente não aparecer, a recepção pode
 *    devolver o brinde ao estoque.
 *  - Tudo é por dia, no horário de Fortaleza. Um aparelho ganha no máximo 1 brinde por dia.
 *
 * Rotas públicas (jogos):    GET /status · POST /ganhar
 * Rotas com PIN:
 *   recepção ou dono  GET /recepcao · POST /baixa
 *   só o dono         POST /estoque · POST /remover · POST /devolver · POST /ajustes
 *   só o dono         GET /programa · POST /semana · POST /data
 * Ajustes (jogo do prêmio, prêmio ligado, pedido de memória) ficam aqui e vão para os jogos pelo /status.
 *
 * Programação (feita antes, pelo dono):
 *  - Semana fixa: para cada dia da semana, horário (abre/fecha) e brindes. Repete toda semana.
 *  - Datas especiais: uma data que troca a semana fixa (feriado, evento) ou "sem brindes neste dia".
 *  - Na hora de abrir, os brindes programados entram sozinhos na fila do dia (uma vez por dia).
 *  - Fora do horário ninguém ganha (os jogos ficam só pela diversão). Sem programação, vale o dia todo, como antes.
 *  - O horário vai até no máximo 23:59, porque a fila é por dia.
 * Os PINs ficam nos segredos PIN_RECEPCAO e PIN_DONO, configurados no painel do Cloudflare (nunca no código).
 */

import { DurableObject } from 'cloudflare:workers';

const ORIGENS = ['https://gabbaheyburger-alt.github.io'];
const MAX_ITENS = 60;          // brindes por dia, no máximo
const MAX_NOME = 60;           // letras no nome do brinde

function cors(req) {
  const o = req.headers.get('Origin') || '';
  const ok = ORIGENS.includes(o) || /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(o);
  return {
    'Access-Control-Allow-Origin': ok ? o : ORIGENS[0],
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, X-Pin, X-Relogio',
    'Access-Control-Max-Age': '86400',
    'Vary': 'Origin'
  };
}
const json = (req, data, status = 200) =>
  new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', ...cors(req) } });

// Data de hoje em Fortaleza (UTC-3, sem horário de verão)
function hoje() {
  const d = new Date(Date.now() - 3 * 3600 * 1000);
  return d.toISOString().slice(0, 10);
}
function horaAgora() {
  const d = new Date(Date.now() - 3 * 3600 * 1000);
  return d.toISOString().slice(11, 16);
}
// Comparação de PIN em tempo constante
function pinOk(dado, certo) {
  if (!certo || typeof dado !== 'string') return false;
  const a = new TextEncoder().encode(dado), b = new TextEncoder().encode(certo);
  let diff = a.length ^ b.length;
  for (let i = 0; i < Math.max(a.length, b.length); i++) diff |= (a[i] || 0) ^ (b[i] || 0);
  return diff === 0;
}
const HORA = /^([01]\d|2[0-3]):[0-5]\d$/;
const DATA = /^\d{4}-\d{2}-\d{2}$/;
// Dia da semana (0 = domingo) de uma data AAAA-MM-DD
const diaSemana = d => new Date(d + 'T12:00:00Z').getUTCDay();
const limpa = (s, n) => String(s == null ? '' : s).replace(/[\u0000-\u001f<>]/g, '').trim().slice(0, n);

export default {
  async fetch(req, env) {
    if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors(req) });
    const url = new URL(req.url);
    const rota = url.pathname.replace(/\/+$/, '') || '/';
    const publica = rota === '/status' || rota === '/ganhar' || rota === '/';
    let papel = null;
    if (!publica) {
      const pin = req.headers.get('X-Pin') || '';
      if (pinOk(pin, env.PIN_DONO)) papel = 'dono';
      else if (pinOk(pin, env.PIN_RECEPCAO)) papel = 'recepcao';
      if (!papel) {
        if (!env.PIN_RECEPCAO && !env.PIN_DONO) return json(req, { erro: 'Os PINs ainda não foram configurados no Cloudflare.' }, 503);
        return json(req, { erro: 'PIN incorreto.' }, 401);
      }
      if (papel !== 'dono' && ['/estoque', '/remover', '/devolver', '/ajustes', '/programa', '/semana', '/data'].includes(rota)) return json(req, { erro: 'Só o dono pode mexer na fila de brindes.' }, 403);
    }
    let corpo = {};
    if (req.method === 'POST') {
      try { corpo = await req.json(); } catch (e) { return json(req, { erro: 'Pedido inválido.' }, 400); }
    }
    const stub = env.BRINDES.get(env.BRINDES.idFromName('gabba-hey-burger'));
    try {
      // Só no teste local (.dev.vars com RELOGIO_TESTE=1): o cabeçalho X-Relogio finge outra data/hora
      const relogio = env.RELOGIO_TESTE === '1' ? (req.headers.get('X-Relogio') || '') : '';
      const r = await stub.acao(rota, req.method, corpo, relogio);
      if (papel && r.data && typeof r.data === 'object') r.data.papel = papel;
      return json(req, r.data, r.status || 200);
    } catch (e) {
      return json(req, { erro: 'Erro no servidor dos brindes.' }, 500);
    }
  }
};

export class Brindes extends DurableObject {
  constructor(ctx, env) {
    super(ctx, env);
    this.sql = ctx.storage.sql;
    this.sql.exec(`CREATE TABLE IF NOT EXISTS estoque (
      id INTEGER PRIMARY KEY AUTOINCREMENT, dia TEXT NOT NULL, ordem INTEGER NOT NULL, nome TEXT NOT NULL,
      codigo TEXT, reservado_em TEXT, jogo TEXT, aparelho TEXT, entregue_em TEXT)`);
    this.sql.exec(`CREATE INDEX IF NOT EXISTS estoque_dia ON estoque (dia, ordem)`);
    this.sql.exec(`CREATE TABLE IF NOT EXISTS ajustes (id INTEGER PRIMARY KEY CHECK (id = 1), json TEXT NOT NULL, salvo_em TEXT)`);
    this.sql.exec(`CREATE TABLE IF NOT EXISTS semana (dia_semana INTEGER PRIMARY KEY, json TEXT NOT NULL)`);
    this.sql.exec(`CREATE TABLE IF NOT EXISTS datas (dia TEXT PRIMARY KEY, json TEXT NOT NULL)`);
    this.sql.exec(`CREATE TABLE IF NOT EXISTS gerado (dia TEXT PRIMARY KEY, em TEXT NOT NULL)`);
  }

  /* ---------- Programação ---------- */
  ler(q, ...p) { const r = this.linhas(q, ...p)[0]; try { return r ? JSON.parse(r.json) : null; } catch (e) { return null; } }
  // Plano de um dia: a data especial vale mais que a semana fixa. null = sem programação.
  plano(dia) {
    const d = this.ler(`SELECT json FROM datas WHERE dia = ?`, dia);
    if (d) return Object.assign({ origem: 'data' }, d);
    const s = this.ler(`SELECT json FROM semana WHERE dia_semana = ?`, diaSemana(dia));
    return s ? Object.assign({ origem: 'semana' }, s) : null;
  }
  // Situação agora: aberto, antes (ainda não abriu), depois (já fechou) ou folga (dia sem brindes)
  horario(dia, hora) {
    const p = this.plano(dia);
    const h = { estado: 'aberto', abre: '', fecha: '', origem: p ? p.origem : '' };
    if (!p) return h;
    if (!p.ligado) { h.estado = 'folga'; return h; }
    if (p.abre && p.fecha) {
      h.abre = p.abre; h.fecha = p.fecha;
      h.estado = hora < p.abre ? 'antes' : hora > p.fecha ? 'depois' : 'aberto';
    }
    return h;
  }
  qtdPlano(p) { return p && p.ligado ? (p.itens || []).reduce((a, i) => a + i.qtd, 0) : 0; }
  // Na hora de abrir, coloca os brindes programados na fila (uma vez por dia)
  gerar(dia, hora) {
    if (this.linhas(`SELECT 1 FROM gerado WHERE dia = ?`, dia).length) return;
    const p = this.plano(dia);
    if (!p) return;
    const h = this.horario(dia, hora);
    if (h.estado === 'antes') return;
    if (h.estado === 'aberto' && p.ligado) this.adicionar(dia, p.itens || []);
    this.sql.exec(`INSERT INTO gerado (dia, em) VALUES (?, ?)`, dia, hora);
  }
  adicionar(dia, lista) {
    const atual = this.resumo(dia).itens.length;
    let ordem = (this.linhas(`SELECT MAX(ordem) AS m FROM estoque WHERE dia = ?`, dia)[0].m || 0);
    let n = 0;
    for (const it of lista) {
      const nome = limpa(it && it.nome, MAX_NOME);
      const qtd = Math.max(0, Math.min(20, Math.floor(+(it && it.qtd) || 0)));
      if (!nome || !qtd) continue;
      for (let k = 0; k < qtd; k++) {
        if (atual + n >= MAX_ITENS) break;
        this.sql.exec(`INSERT INTO estoque (dia, ordem, nome) VALUES (?, ?, ?)`, dia, ++ordem, nome);
        n++;
      }
    }
    return n;
  }
  // Confere e limpa um plano vindo da tela do dono. Devolve { cfg } ou { erro }.
  validar(c) {
    if (!c || typeof c !== 'object') return { erro: 'Programação inválida.' };
    const ligado = c.ligado !== false;
    let abre = String(c.abre || ''), fecha = String(c.fecha || '');
    if (!ligado) return { cfg: { ligado: false, abre: '', fecha: '', itens: [] } };
    if (abre || fecha) {
      if (!HORA.test(abre) || !HORA.test(fecha)) return { erro: 'Horário inválido. Use o formato 19:00.' };
      if (fecha <= abre) return { erro: 'O horário de fechar precisa ser depois do de abrir (até 23:59).' };
    }
    const itens = [];
    let total = 0;
    for (const it of Array.isArray(c.itens) ? c.itens.slice(0, 20) : []) {
      const nome = limpa(it && it.nome, MAX_NOME), qtd = Math.max(0, Math.min(20, Math.floor(+(it && it.qtd) || 0)));
      if (!nome || !qtd) continue;
      total += qtd; itens.push({ nome, qtd });
    }
    if (total > MAX_ITENS) return { erro: 'No máximo ' + MAX_ITENS + ' brindes por dia.' };
    return { cfg: { ligado: true, abre, fecha, itens } };
  }
  programa(dia) {
    const semana = [0, 1, 2, 3, 4, 5, 6].map(n => this.ler(`SELECT json FROM semana WHERE dia_semana = ?`, n));
    const datas = this.linhas(`SELECT dia, json FROM datas WHERE dia >= ? ORDER BY dia`, dia).map(r => { try { return Object.assign({ dia: r.dia }, JSON.parse(r.json)); } catch (e) { return null; } }).filter(Boolean);
    return { semana, datas, hoje: { dia, dia_semana: diaSemana(dia), gerado: !!this.linhas(`SELECT 1 FROM gerado WHERE dia = ?`, dia).length } };
  }

  linhas(q, ...p) { return this.sql.exec(q, ...p).toArray(); }

  ajustes() {
    const r = this.linhas(`SELECT json FROM ajustes WHERE id = 1`)[0];
    try { return r ? JSON.parse(r.json) : null; } catch (e) { return null; }
  }

  resumo(dia) {
    const itens = this.linhas(`SELECT id, ordem, nome, codigo, reservado_em, jogo, entregue_em FROM estoque WHERE dia = ? ORDER BY ordem`, dia);
    const livres = itens.filter(i => !i.codigo);
    return { itens, livres };
  }

  novoCodigo(dia) {
    const L = 'ACDEFGHJKMNPQRTUWXY34679';    // sem letras e números que se confundem (0/O, 1/I, 5/S, U/V…)
    for (let t = 0; t < 50; t++) {
      let c = '';
      const r = crypto.getRandomValues(new Uint8Array(4));
      for (const b of r) c += L[b % L.length];
      if (!this.linhas(`SELECT 1 FROM estoque WHERE dia = ? AND codigo = ?`, dia, c).length) return c;
    }
    throw new Error('sem código');
  }

  async acao(rota, metodo, corpo, relogio) {
    const teste = /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}$/.test(relogio || '');
    const dia = teste ? relogio.slice(0, 10) : hoje(), hora = teste ? relogio.slice(11) : horaAgora();
    this.gerar(dia, hora);
    const hor = this.horario(dia, hora);
    const gerou = !!this.linhas(`SELECT 1 FROM gerado WHERE dia = ?`, dia).length;

    if (rota === '/' || (rota === '/status' && metodo === 'GET')) {
      const { livres, itens } = this.resumo(dia);
      const aberto = hor.estado === 'aberto';
      const previstos = livres.length + (gerou ? 0 : this.qtdPlano(this.plano(dia)));
      return { data: { dia, restantes: aberto ? livres.length : 0, total: itens.length, proximo: aberto && livres[0] ? livres[0].nome : null, horario: hor, previstos, ajustes: this.ajustes() } };
    }

    if (rota === '/ganhar' && metodo === 'POST') {
      const aparelho = limpa(corpo.aparelho, 64);
      const jogo = limpa(corpo.jogo, 20) || 'jogo';
      if (!aparelho) return { status: 400, data: { erro: 'Aparelho não informado.' } };
      // Um brinde por aparelho por dia: se já ganhou, devolve o mesmo
      const ja = this.linhas(`SELECT nome, codigo, entregue_em FROM estoque WHERE dia = ? AND aparelho = ?`, dia, aparelho);
      if (ja.length) return { data: { ok: true, repetido: true, brinde: ja[0].nome, codigo: ja[0].codigo, entregue: !!ja[0].entregue_em } };
      if (hor.estado !== 'aberto') return { data: { ok: false, fechado: true, horario: hor } };
      const livre = this.linhas(`SELECT id, nome FROM estoque WHERE dia = ? AND codigo IS NULL ORDER BY ordem LIMIT 1`, dia)[0];
      if (!livre) return { data: { ok: false, esgotado: true } };
      const codigo = this.novoCodigo(dia);
      this.sql.exec(`UPDATE estoque SET codigo = ?, reservado_em = ?, jogo = ?, aparelho = ? WHERE id = ?`, codigo, hora, jogo, aparelho, livre.id);
      return { data: { ok: true, brinde: livre.nome, codigo, restantes: this.resumo(dia).livres.length } };
    }

    if (rota === '/recepcao' && metodo === 'GET') {
      const { itens, livres } = this.resumo(dia);
      const previstos = gerou ? 0 : this.qtdPlano(this.plano(dia));
      return { data: { dia, hora, itens, restantes: livres.length, horario: hor, previstos, ajustes: this.ajustes() } };
    }

    if (rota === '/programa' && metodo === 'GET') return { data: this.programa(dia) };

    if (rota === '/semana' && metodo === 'POST') {
      // corpo = { dia_semana: 0..6, cfg: {...} | null (apaga) }
      const n = Math.floor(+corpo.dia_semana);
      if (!(n >= 0 && n <= 6)) return { status: 400, data: { erro: 'Dia da semana inválido.' } };
      if (corpo.cfg == null) this.sql.exec(`DELETE FROM semana WHERE dia_semana = ?`, n);
      else {
        const v = this.validar(corpo.cfg);
        if (v.erro) return { status: 400, data: { erro: v.erro } };
        this.sql.exec(`INSERT INTO semana (dia_semana, json) VALUES (?, ?) ON CONFLICT(dia_semana) DO UPDATE SET json = excluded.json`, n, JSON.stringify(v.cfg));
      }
      return { data: { ok: true, ...this.programa(dia) } };
    }

    if (rota === '/data' && metodo === 'POST') {
      // corpo = { dia: 'AAAA-MM-DD', cfg: {...} | null (apaga) }
      const d = String(corpo.dia || '');
      if (!DATA.test(d) || isNaN(Date.parse(d + 'T12:00:00Z'))) return { status: 400, data: { erro: 'Data inválida.' } };
      if (d < dia) return { status: 400, data: { erro: 'Essa data já passou.' } };
      if (corpo.cfg == null) this.sql.exec(`DELETE FROM datas WHERE dia = ?`, d);
      else {
        const v = this.validar(corpo.cfg);
        if (v.erro) return { status: 400, data: { erro: v.erro } };
        this.sql.exec(`INSERT INTO datas (dia, json) VALUES (?, ?) ON CONFLICT(dia) DO UPDATE SET json = excluded.json`, d, JSON.stringify(v.cfg));
      }
      return { data: { ok: true, ...this.programa(dia) } };
    }

    if (rota === '/ajustes' && metodo === 'POST') {
      const a = { jogo: corpo.jogo === 'quiz' ? 'quiz' : 'pedido', ativo: corpo.ativo === true, memoria: corpo.memoria !== false };
      this.sql.exec(`INSERT INTO ajustes (id, json, salvo_em) VALUES (1, ?, ?) ON CONFLICT(id) DO UPDATE SET json = excluded.json, salvo_em = excluded.salvo_em`, JSON.stringify(a), dia + ' ' + horaAgora());
      return { data: { ok: true, ajustes: a } };
    }

    if (rota === '/estoque' && metodo === 'POST') {
      // Adiciona brindes ao fim da fila de hoje. corpo.itens = [{ nome, qtd }]
      const n = this.adicionar(dia, Array.isArray(corpo.itens) ? corpo.itens : []);
      return { data: { ok: true, adicionados: n, ...this.resumo(dia) } };
    }

    if (rota === '/remover' && metodo === 'POST') {
      // Tira da fila um brinde ainda livre (lançado por engano)
      const id = Math.floor(+corpo.id || 0);
      this.sql.exec(`DELETE FROM estoque WHERE id = ? AND dia = ? AND codigo IS NULL`, id, dia);
      return { data: { ok: true, ...this.resumo(dia) } };
    }

    if (rota === '/baixa' && metodo === 'POST') {
      const codigo = limpa(corpo.codigo, 8).toUpperCase();
      const it = this.linhas(`SELECT id, nome, entregue_em FROM estoque WHERE dia = ? AND codigo = ?`, dia, codigo)[0];
      if (!it) return { status: 404, data: { erro: 'Código não encontrado hoje. Confira as letras ou se o prêmio é de outro dia.' } };
      if (it.entregue_em) return { status: 409, data: { erro: 'Este brinde já foi entregue às ' + it.entregue_em + '.' } };
      this.sql.exec(`UPDATE estoque SET entregue_em = ? WHERE id = ?`, hora, it.id);
      return { data: { ok: true, brinde: it.nome, ...this.resumo(dia) } };
    }

    if (rota === '/devolver' && metodo === 'POST') {
      // Cliente não apareceu: o brinde volta para o começo da fila
      const codigo = limpa(corpo.codigo, 8).toUpperCase();
      const it = this.linhas(`SELECT id, entregue_em FROM estoque WHERE dia = ? AND codigo = ?`, dia, codigo)[0];
      if (!it) return { status: 404, data: { erro: 'Código não encontrado.' } };
      if (it.entregue_em) return { status: 409, data: { erro: 'Este brinde já foi entregue; não dá para devolver.' } };
      const min = this.linhas(`SELECT MIN(ordem) AS m FROM estoque WHERE dia = ?`, dia)[0].m || 1;
      this.sql.exec(`UPDATE estoque SET codigo = NULL, reservado_em = NULL, jogo = NULL, aparelho = NULL, ordem = ? WHERE id = ?`, min - 1, it.id);
      return { data: { ok: true, ...this.resumo(dia) } };
    }

    return { status: 404, data: { erro: 'Rota não encontrada.' } };
  }
}
