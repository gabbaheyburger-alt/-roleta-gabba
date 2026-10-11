/*
 * Ponto interno do Grupo Gabba (controle interno, não é ponto eletrônico legal).
 *
 * Rotas (todas sob /ponto/, chamadas pelas páginas do GitHub Pages):
 *   GET  /ponto/estado?loja=gabba&aparelho=…   → a internet de agora é a da loja? + último registro de hoje de cada pessoa
 *   POST /ponto/bater    {loja, nome, acao, aparelho}   → registra (só se a internet for a da loja)
 *   POST /ponto/desfazer {loja, aparelho}               → apaga o último registro deste aparelho, até 3 min depois
 *   POST /ponto/adm      {pin, op, …}                   → área do dono (registros, rede da loja, ajustes, PIN)
 *
 * "Internet da loja": o serviço compara o endereço de internet (IP) de quem bate o ponto com os endereços
 * cadastrados pelo dono. IPv4 compara o número inteiro; IPv6 compara a rede (/64), porque o celular troca o final.
 * Os dados ficam num Durable Object (banco SQLite da própria Cloudflare), sem planilha e sem chave externa.
 */

export const LOJAS = ['gabba', 'uau', 'feijuca'];
const ACOES = ['entrada', 'saida_intervalo', 'volta_intervalo', 'saida'];
const DESFAZER_MS = 3 * 60 * 1000;
const FUSO = -3 * 3600 * 1000;           // Fortaleza, sem horário de verão
const VIRADA = 5 * 3600 * 1000;          // registros até 05:00 contam para o dia anterior (turno que passa da meia-noite)

export const diaDo = ts => new Date(ts + FUSO - VIRADA).toISOString().slice(0, 10);
export function redeDe(ip) {
  ip = String(ip || '').trim();
  if (!ip) return '';
  if (ip.includes(':')) {
    // expande o IPv6 e fica com os 4 primeiros blocos (/64)
    let [a, b] = ip.split('::');
    const ea = a ? a.split(':') : [], eb = b !== undefined ? (b ? b.split(':') : []) : [];
    const meio = b !== undefined ? Array(8 - ea.length - eb.length).fill('0') : [];
    const full = [...ea, ...meio, ...eb].map(x => (x || '0').toLowerCase().replace(/^0+(?=.)/, ''));
    return full.slice(0, 4).join(':') + '::/64';
  }
  return ip;
}
const limpa = (s, n) => String(s == null ? '' : s).replace(/\s+/g, ' ').trim().slice(0, n);

async function hashPin(pin, sal) {
  const d = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(sal + ':' + pin));
  return [...new Uint8Array(d)].map(b => b.toString(16).padStart(2, '0')).join('');
}

export class PontoDB {
  constructor(ctx, env) {
    this.ctx = ctx; this.sql = ctx.storage.sql;
    this.sql.exec(`CREATE TABLE IF NOT EXISTS registros (id INTEGER PRIMARY KEY AUTOINCREMENT, ts INTEGER, dia TEXT, loja TEXT, nome TEXT, acao TEXT,
      rede TEXT, aparelho TEXT, origem TEXT, nota TEXT, removido INTEGER DEFAULT 0)`);
    this.sql.exec(`CREATE INDEX IF NOT EXISTS reg_dia ON registros (loja, dia)`);
    this.sql.exec(`CREATE TABLE IF NOT EXISTS redes (loja TEXT, rede TEXT, rotulo TEXT, criado INTEGER, PRIMARY KEY (loja, rede))`);
    this.sql.exec(`CREATE TABLE IF NOT EXISTS recusas (ts INTEGER, loja TEXT, nome TEXT, rede TEXT)`);
    this.sql.exec(`CREATE TABLE IF NOT EXISTS meta (k TEXT PRIMARY KEY, v TEXT)`);
  }
  meta(k, v) {
    if (v === undefined) { const r = [...this.sql.exec('SELECT v FROM meta WHERE k = ?', k)]; return r.length ? r[0].v : null; }
    this.sql.exec('INSERT INTO meta (k, v) VALUES (?, ?) ON CONFLICT(k) DO UPDATE SET v = excluded.v', k, String(v));
  }
  redeOk(loja, rede) { return !!rede && [...this.sql.exec('SELECT 1 FROM redes WHERE loja = ? AND rede = ?', loja, rede)].length > 0; }
  temRede(loja) { return [...this.sql.exec('SELECT 1 FROM redes WHERE loja = ?', loja)].length > 0; }
  ultimosHoje(loja) {
    const dia = diaDo(Date.now()), out = {};
    for (const r of this.sql.exec('SELECT nome, acao, ts FROM registros WHERE loja = ? AND dia = ? AND removido = 0 ORDER BY ts', loja, dia)) out[r.nome] = { acao: r.acao, ts: r.ts };
    return out;
  }

  async fetch(req) {
    const url = new URL(req.url), rota = url.pathname.replace(/^\/ponto\//, '');
    const rede = redeDe(req.headers.get('X-Ip'));
    const json = (o, s = 200) => new Response(JSON.stringify(o), { status: s, headers: { 'Content-Type': 'application/json' } });
    let corpo = {};
    if (req.method === 'POST') { try { corpo = await req.json(); } catch (e) { return json({ erro: 'formato_invalido' }, 400); } }
    const loja = String((req.method === 'GET' ? url.searchParams.get('loja') : corpo.loja) || '').toLowerCase();

    if (rota === 'estado') {
      if (!LOJAS.includes(loja)) return json({ erro: 'loja' }, 400);
      const ok = this.redeOk(loja, rede);
      return json({ redeOk: ok, lojaTemRede: this.temRede(loja), agora: Date.now(), dia: diaDo(Date.now()), ultimos: ok ? this.ultimosHoje(loja) : {} });
    }

    if (rota === 'bater') {
      if (!LOJAS.includes(loja)) return json({ erro: 'loja' }, 400);
      const nome = limpa(corpo.nome, 40), acao = String(corpo.acao || ''), aparelho = limpa(corpo.aparelho, 40);
      if (!nome || !ACOES.includes(acao) || !aparelho) return json({ erro: 'dados' }, 400);
      if (!this.redeOk(loja, rede)) {
        this.sql.exec('INSERT INTO recusas (ts, loja, nome, rede) VALUES (?, ?, ?, ?)', Date.now(), loja, nome, rede);
        this.sql.exec('DELETE FROM recusas WHERE ts < ?', Date.now() - 30 * 864e5);
        return json({ erro: 'rede', detalhe: 'Conecte no Wi-Fi da loja para bater o ponto.' }, 403);
      }
      const ult = this.ultimosHoje(loja)[nome];
      if (ult && ult.acao === acao && Date.now() - ult.ts < 10 * 60 * 1000) return json({ erro: 'repetido', detalhe: 'Esse registro já foi feito agora há pouco.' }, 409);
      const ts = Date.now();
      this.sql.exec('INSERT INTO registros (ts, dia, loja, nome, acao, rede, aparelho, origem) VALUES (?, ?, ?, ?, ?, ?, ?, ?)', ts, diaDo(ts), loja, nome, acao, rede, aparelho, 'celular');
      return json({ ok: true, ts, acao, nome });
    }

    if (rota === 'desfazer') {
      const aparelho = limpa(corpo.aparelho, 40);
      const r = [...this.sql.exec('SELECT id, ts FROM registros WHERE loja = ? AND aparelho = ? AND removido = 0 AND origem = ? ORDER BY ts DESC LIMIT 1', loja, aparelho, 'celular')];
      if (!r.length || Date.now() - r[0].ts > DESFAZER_MS) return json({ erro: 'prazo', detalhe: 'Só dá para desfazer até 3 minutos depois. Fale com o gerente.' }, 409);
      this.sql.exec('UPDATE registros SET removido = 1, nota = ? WHERE id = ?', 'desfeito pelo funcionário', r[0].id);
      return json({ ok: true });
    }

    if (rota === 'adm') return this.adm(corpo, rede, loja, json);
    return json({ erro: 'nao_encontrado' }, 404);
  }

  async adm(c, rede, loja, json) {
    // trava contra chute de PIN: 5 erros seguidos = 15 minutos bloqueado
    const trava = +(this.meta('trava_ate') || 0);
    if (Date.now() < trava) return json({ erro: 'bloqueado', detalhe: 'Muitas tentativas. Espere 15 minutos.' }, 429);
    const pin = String(c.pin || '');
    const salvo = this.meta('pin_hash'), sal = this.meta('pin_sal');
    if (!salvo) {
      if (c.op !== 'criar_pin') return json({ erro: 'sem_pin' }, 401);
      if (!/^\d{4,8}$/.test(pin)) return json({ erro: 'pin_invalido', detalhe: 'O PIN precisa ter de 4 a 8 números.' }, 400);
      const s = crypto.randomUUID(); this.meta('pin_sal', s); this.meta('pin_hash', await hashPin(pin, s));
      return json({ ok: true });
    }
    if (!pin) return json({ erro: 'precisa_pin' }, 401);
    if ((await hashPin(pin, sal)) !== salvo) {
      const n = +(this.meta('erros') || 0) + 1; this.meta('erros', n);
      if (n >= 5) { this.meta('trava_ate', Date.now() + 15 * 60 * 1000); this.meta('erros', 0); }
      return json({ erro: 'pin_errado' }, 401);
    }
    this.meta('erros', 0);
    if (loja && !LOJAS.includes(loja)) return json({ erro: 'loja' }, 400);
    const L = loja || 'gabba';

    switch (c.op) {
      case 'entrar': return json({ ok: true, redeAgora: rede, redeAgoraOk: this.redeOk(L, rede) });
      case 'trocar_pin': {
        if (!/^\d{4,8}$/.test(String(c.novo || ''))) return json({ erro: 'pin_invalido' }, 400);
        const s = crypto.randomUUID(); this.meta('pin_sal', s); this.meta('pin_hash', await hashPin(String(c.novo), s));
        return json({ ok: true });
      }
      case 'registros': {
        const de = String(c.de || diaDo(Date.now())), ate = String(c.ate || de);
        const regs = [...this.sql.exec('SELECT id, ts, dia, nome, acao, aparelho, origem, nota, removido FROM registros WHERE loja = ? AND dia BETWEEN ? AND ? ORDER BY ts', L, de, ate)];
        return json({ ok: true, registros: regs });
      }
      case 'redes': {
        const redes = [...this.sql.exec('SELECT rede, rotulo, criado FROM redes WHERE loja = ? ORDER BY criado', L)];
        const recusas = [...this.sql.exec('SELECT rede, COUNT(*) AS n, MAX(ts) AS ult, GROUP_CONCAT(DISTINCT nome) AS nomes FROM recusas WHERE loja = ? AND ts > ? GROUP BY rede ORDER BY ult DESC LIMIT 10', L, Date.now() - 7 * 864e5)];
        return json({ ok: true, redes, recusas, redeAgora: rede, redeAgoraOk: this.redeOk(L, rede) });
      }
      case 'add_rede': {
        const r = c.rede ? limpa(c.rede, 60) : rede;
        if (!r) return json({ erro: 'sem_rede' }, 400);
        this.sql.exec('INSERT OR REPLACE INTO redes (loja, rede, rotulo, criado) VALUES (?, ?, ?, ?)', L, r, limpa(c.rotulo || 'Internet da loja', 40), Date.now());
        this.sql.exec('DELETE FROM recusas WHERE loja = ? AND rede = ?', L, r);
        return json({ ok: true });
      }
      case 'del_rede': this.sql.exec('DELETE FROM redes WHERE loja = ? AND rede = ?', L, String(c.rede || '')); return json({ ok: true });
      case 'ajuste': {
        const nome = limpa(c.nome, 40), acao = String(c.acao || ''), ts = +c.ts;
        if (!nome || !ACOES.includes(acao) || !ts) return json({ erro: 'dados' }, 400);
        this.sql.exec('INSERT INTO registros (ts, dia, loja, nome, acao, rede, aparelho, origem, nota) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)', ts, diaDo(ts), L, nome, acao, '', '', 'ajuste', limpa(c.nota || 'lançado pelo gerente', 120));
        return json({ ok: true });
      }
      case 'remover': this.sql.exec('UPDATE registros SET removido = 1, nota = ? WHERE id = ? AND loja = ?', limpa(c.nota || 'removido pelo gerente', 120), +c.id, L); return json({ ok: true });
      case 'restaurar': this.sql.exec('UPDATE registros SET removido = 0 WHERE id = ? AND loja = ?', +c.id, L); return json({ ok: true });
      default: return json({ erro: 'op' }, 400);
    }
  }
}

// Encaminha /ponto/* do Worker para o banco (um só, para todas as lojas)
export async function rotaPonto(req, env, cors) {
  const resp = (o, s) => new Response(JSON.stringify(o), { status: s, headers: { ...cors, 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' } });
  if (!env.PONTO) return resp({ erro: 'ponto_desligado' }, 503);
  const b = req.method === 'POST' ? await req.text() : null;
  if (b && b.length > 4000) return resp({ erro: 'grande' }, 413);
  const h = new Headers({ 'Content-Type': 'application/json', 'X-Ip': req.headers.get('CF-Connecting-IP') || '' });
  const stub = env.PONTO.get(env.PONTO.idFromName('grupo-gabba'));
  const r = await stub.fetch(new Request(req.url, { method: req.method, headers: h, body: b }));
  return new Response(r.body, { status: r.status, headers: { ...cors, 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' } });
}
