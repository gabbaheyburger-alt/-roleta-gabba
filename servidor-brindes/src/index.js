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
 *   só o dono         POST /estoque · POST /remover · POST /devolver
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
    'Access-Control-Allow-Headers': 'Content-Type, X-Pin',
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
      if (papel !== 'dono' && ['/estoque', '/remover', '/devolver'].includes(rota)) return json(req, { erro: 'Só o dono pode mexer na fila de brindes.' }, 403);
    }
    let corpo = {};
    if (req.method === 'POST') {
      try { corpo = await req.json(); } catch (e) { return json(req, { erro: 'Pedido inválido.' }, 400); }
    }
    const stub = env.BRINDES.get(env.BRINDES.idFromName('gabba-hey-burger'));
    try {
      const r = await stub.acao(rota, req.method, corpo);
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
  }

  linhas(q, ...p) { return this.sql.exec(q, ...p).toArray(); }

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

  async acao(rota, metodo, corpo) {
    const dia = hoje();

    if (rota === '/' || (rota === '/status' && metodo === 'GET')) {
      const { livres, itens } = this.resumo(dia);
      return { data: { dia, restantes: livres.length, total: itens.length, proximo: livres[0] ? livres[0].nome : null } };
    }

    if (rota === '/ganhar' && metodo === 'POST') {
      const aparelho = limpa(corpo.aparelho, 64);
      const jogo = limpa(corpo.jogo, 20) || 'jogo';
      if (!aparelho) return { status: 400, data: { erro: 'Aparelho não informado.' } };
      // Um brinde por aparelho por dia: se já ganhou, devolve o mesmo
      const ja = this.linhas(`SELECT nome, codigo, entregue_em FROM estoque WHERE dia = ? AND aparelho = ?`, dia, aparelho);
      if (ja.length) return { data: { ok: true, repetido: true, brinde: ja[0].nome, codigo: ja[0].codigo, entregue: !!ja[0].entregue_em } };
      const livre = this.linhas(`SELECT id, nome FROM estoque WHERE dia = ? AND codigo IS NULL ORDER BY ordem LIMIT 1`, dia)[0];
      if (!livre) return { data: { ok: false, esgotado: true } };
      const codigo = this.novoCodigo(dia);
      this.sql.exec(`UPDATE estoque SET codigo = ?, reservado_em = ?, jogo = ?, aparelho = ? WHERE id = ?`, codigo, horaAgora(), jogo, aparelho, livre.id);
      return { data: { ok: true, brinde: livre.nome, codigo, restantes: this.resumo(dia).livres.length } };
    }

    if (rota === '/recepcao' && metodo === 'GET') {
      const { itens, livres } = this.resumo(dia);
      return { data: { dia, itens, restantes: livres.length } };
    }

    if (rota === '/estoque' && metodo === 'POST') {
      // Adiciona brindes ao fim da fila de hoje. corpo.itens = [{ nome, qtd }]
      const lista = Array.isArray(corpo.itens) ? corpo.itens : [];
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
      this.sql.exec(`UPDATE estoque SET entregue_em = ? WHERE id = ?`, horaAgora(), it.id);
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
