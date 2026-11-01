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

export const LOJAS = ['gabba', 'uau', 'feijuca', 'escritorio'];
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
const horaValida = t => typeof t === 'string' && /^([01]\d|2[0-3]):[0-5]\d$/.test(t);
const minHora = t => Number(t.slice(0,2)) * 60 + Number(t.slice(3));
function horarioValido(h) {
  return h === null || (Array.isArray(h) && h.length === 2 && horaValida(h[0]) && (horaValida(h[1]) || h[1] === '24:00') && h[0] !== h[1]);
}
function intervaloValido(i, h) {
  if (i === null) return true;
  if (!h || !Array.isArray(i) || i.length !== 2 || !i.every(horaValida)) return false;
  const ini = minHora(h[0]);
  let fim = minHora(h[1]), a = minHora(i[0]), b = minHora(i[1]);
  if (fim <= ini) fim += 1440;
  if (a < ini) a += 1440;
  if (b <= a) b += 1440;
  return a >= ini && b <= fim && b > a && b - a < fim - ini;
}
function dataAtualOuFutura(d) {
  return typeof d === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(d) && Number.isFinite(Date.parse(d + 'T12:00:00Z')) && new Date(d + 'T12:00:00Z').toISOString().slice(0,10) === d && d >= diaDo(Date.now());
}
function validaEscala(c) {
  const vigencia = String(c.vigencia || diaDo(Date.now()));
  if (!/^\d{4}-\d{2}-\d{2}$/.test(vigencia) || !Number.isFinite(Date.parse(vigencia + 'T12:00:00Z')) || new Date(vigencia + 'T12:00:00Z').toISOString().slice(0, 10) !== vigencia || vigencia < diaDo(Date.now())) return null;
  if (!c.horarios || typeof c.horarios !== 'object' || Array.isArray(c.horarios)) return null;
  const horarios = {};
  const hora = t => typeof t === 'string' && /^([01]\d|2[0-3]):[0-5]\d$/.test(t);
  for (let d = 0; d < 7; d++) {
    const h = c.horarios[d];
    if (h === null) horarios[d] = null;
    else {
      if (!Array.isArray(h) || h.length !== 2 || !hora(h[0]) || !(hora(h[1]) || h[1] === '24:00') || h[0] === h[1]) return null;
      horarios[d] = h;
    }
  }
  const intervalos = {};
  if (c.intervalos !== undefined) {
    if (!c.intervalos || typeof c.intervalos !== 'object' || Array.isArray(c.intervalos)) return null;
    for (let d = 0; d < 7; d++) {
      if (!intervaloValido(c.intervalos[d], horarios[d])) return null;
      intervalos[d] = c.intervalos[d];
    }
  }
  return { vigencia, horarios, ...(c.intervalos !== undefined ? { intervalos } : {}) };
}

function dataAusencia(d){return /^\d{4}-\d{2}-\d{2}$/.test(d)&&Number.isFinite(Date.parse(d+'T12:00:00Z'))&&new Date(d+'T12:00:00Z').toISOString().slice(0,10)===d;}
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
    this.sql.exec('CREATE TABLE IF NOT EXISTS registros_hub_identidade (registro INTEGER PRIMARY KEY, membro TEXT NOT NULL)');
    this.sql.exec('CREATE TABLE IF NOT EXISTS ausencias (loja TEXT NOT NULL,nome TEXT NOT NULL,dia TEXT NOT NULL,tipo TEXT NOT NULL,nota TEXT NOT NULL,revisao INTEGER NOT NULL,removido INTEGER NOT NULL DEFAULT 0,historico TEXT NOT NULL,PRIMARY KEY(loja,nome,dia))');
    this.sql.exec('CREATE TABLE IF NOT EXISTS intervalo_auditoria (registro INTEGER PRIMARY KEY, dados TEXT NOT NULL)');
    if(!this.meta('intervalos_regras_gabba'))this.meta('intervalos_regras_gabba',JSON.stringify({rev:1,versoes:[{vigencia:diaDo(Date.now()),horarios:{'Natália':'17:00',Marta:'17:30',Paulo:'18:00',Arthur:'17:00'},tolerancia:3}]}));
    if(!this.meta('intervalos_semanal_v1_gabba')){
      const anteriores=this.regrasIntervalo('gabba'),dia=diaDo(Date.now()),base=anteriores.versoes.filter(v=>v.vigencia<=dia).sort((a,b)=>b.vigencia.localeCompare(a.vigencia))[0]||{horarios:{},tolerancia:3};
      const semana={...base.semana,'Natália':{0:'17:00',1:null,2:'17:00',3:'17:30',4:'17:30',5:'17:00',6:'17:00'},Marta:{0:'17:30',1:'18:00',2:'17:30',3:'18:30',4:null,5:'17:30',6:'17:30'},Paulo:{0:'18:00',1:'17:30',2:'18:00',3:null,4:'18:00',5:'18:00',6:'18:00'},Arthur:{0:'17:00',1:'17:00',2:'17:00',3:'17:00',4:'17:00',5:'17:00',6:'17:00'}};
      this.meta('intervalos_regras_gabba',JSON.stringify({rev:anteriores.rev+1,versoes:[...anteriores.versoes.filter(v=>v.vigencia!==dia),{...base,vigencia:dia,semana}]}));this.meta('intervalos_semanal_v1_gabba','1');
    }
    this.sql.exec(`CREATE TABLE IF NOT EXISTS registros_hub_teste (id INTEGER PRIMARY KEY AUTOINCREMENT, sessao TEXT NOT NULL, membro TEXT NOT NULL, ts INTEGER NOT NULL, dia TEXT NOT NULL, acao TEXT NOT NULL, aparelho TEXT NOT NULL)`);
    this.sql.exec(`CREATE INDEX IF NOT EXISTS teste_sessao ON registros_hub_teste (sessao, dia)`);
    if(!this.meta('equipe_v1_uau'))this.meta('equipe_v1_uau',JSON.stringify([{"nome": "Tuany", "setor": "Cozinha", "ativo": true, "escalas": [{"vigencia": "2026-10-30", "horarios": {"0": ["15:30", "24:00"], "1": ["15:30", "23:00"], "2": null, "3": ["15:30", "23:00"], "4": ["15:30", "23:00"], "5": ["15:30", "24:00"], "6": ["15:30", "24:00"]}, "intervalos": {"0": null, "1": null, "2": null, "3": null, "4": null, "5": null, "6": null}}]}]));
    // Cópia inicial do cadastro existente. Depois da primeira execução, o banco é a fonte da equipe.
    if (!this.meta('equipe_v1_gabba')) this.meta('equipe_v1_gabba', JSON.stringify([
      { nome: 'Natália', setor: 'Cozinha' }, { nome: 'Paulo', setor: 'Cozinha' },
      { nome: 'Marta', setor: 'Cozinha' }, { nome: 'Inara', setor: 'Cozinha', ativo: false, obs: 'começa em alguns dias' },
      { nome: 'Dalva', setor: 'Recepção' }, { nome: 'Mayara', setor: 'Recepção' },
      { nome: 'Jandira', setor: 'Recepção', dias: [1, 2], obs: 'horista · no Gabba seg e ter' }
    ]));
    if (!this.meta('equipe_v1_escritorio')) this.meta('equipe_v1_escritorio', JSON.stringify([
      { nome: 'Eliza', setor: 'Estoque', ativo: true, escalas: [{ vigencia: '2026-10-23',
        horarios: { 0: null, 1: ['08:00','18:00'], 2: ['08:00','18:00'], 3: ['08:00','18:00'], 4: ['08:00','18:00'], 5: ['14:00','23:00'], 6: ['14:00','23:00'] },
        intervalos: { 0: null, 1: ['12:00','14:00'], 2: ['12:00','14:00'], 3: ['12:00','14:00'], 4: ['12:00','14:00'], 5: ['17:00','18:00'], 6: ['17:00','18:00'] }
      }] }
    ]));
  }
  meta(k, v) {
    if (v === undefined) { const r = [...this.sql.exec('SELECT v FROM meta WHERE k = ?', k)]; return r.length ? r[0].v : null; }
    this.sql.exec('INSERT INTO meta (k, v) VALUES (?, ?) ON CONFLICT(k) DO UPDATE SET v = excluded.v', k, String(v));
  }
  redeOk(loja, rede) { return !!rede && [...this.sql.exec('SELECT 1 FROM redes WHERE loja = ? AND rede = ?', loja, rede)].length > 0; }
  temRede(loja) { return [...this.sql.exec('SELECT 1 FROM redes WHERE loja = ?', loja)].length > 0; }
  equipe(loja) { return JSON.parse(this.meta('equipe_v1_' + loja) || '[]'); }
  regrasIntervalo(loja){return JSON.parse(this.meta('intervalos_regras_'+loja)||'{"rev":0,"versoes":[]}');}
  regraDiaIntervalo(loja,dia){
    const v=this.regrasIntervalo(loja).versoes.filter(v=>v.vigencia<=dia).sort((a,b)=>b.vigencia.localeCompare(a.vigencia))[0];if(!v)return null;
    const wd=new Date(dia+'T12:00:00Z').getUTCDay(),horarios={...v.horarios},folgas=[];
    for(const[nome,semana]of Object.entries(v.semana||{})){delete horarios[nome];if(semana[wd]===null)folgas.push(nome);else if(semana[wd])horarios[nome]=semana[wd];}
    return{horarios,folgas,tolerancia:v.tolerancia};
  }
  auditaIntervalo(loja,nome,acao,ts){
    if(acao!=='saida_intervalo')return null;
    const dia=diaDo(ts),v=this.regraDiaIntervalo(loja,dia),inicio=v?.horarios[nome];
    if(!inicio)return null;
    let previsto=Date.parse(dia+'T'+inicio+':00-03:00');if(inicio<'05:00')previsto+=864e5;
    const diferenca=Math.trunc((ts-previsto)/60000),atraso=Math.max(0,diferenca),antecipado=Math.max(0,-diferenca);
    const dados={inicio,previsto,atraso,antecipado,tolerancia:v.tolerancia,fora:diferenca>v.tolerancia?'atrasado':diferenca < -v.tolerancia?'antecipado':'no_horario'};
    const id=[...this.sql.exec('SELECT last_insert_rowid() id')][0].id;
    this.sql.exec('INSERT INTO intervalo_auditoria(registro,dados) VALUES(?,?)',id,JSON.stringify(dados));return dados;
  }
  ausencias(loja,de,ate){return [...this.sql.exec('SELECT nome,dia,tipo,nota,revisao,removido,historico FROM ausencias WHERE loja=? AND dia BETWEEN ? AND ? ORDER BY dia,nome',loja,de,ate)];}
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

    if(rota.startsWith('individual/'))return this.individual(req,corpo,rede,rota,json);
    if(loja==='uau'&&['estado','bater','desfazer'].includes(rota))return json({erro:'login',detalhe:'Na Uau, abra o ponto pela sua conta pessoal no HUB.'},401);
    if (rota.startsWith('hub-teste/')) return this.hubTeste(req, corpo, rede, rota, json);

    if (rota === 'estado') {
      if (!LOJAS.includes(loja)) return json({ erro: 'loja' }, 400);
      const ok = this.redeOk(loja, rede);
      const regraInicio=this.regraDiaIntervalo(loja,diaDo(Date.now()));
      return json({ regraInicio:ok?regraInicio:null, redeOk: ok, lojaTemRede: this.temRede(loja), agora: Date.now(), dia: diaDo(Date.now()), equipe: ok ? this.equipe(loja).filter(p => p.ativo !== false) : [], ultimos: ok ? this.ultimosHoje(loja) : {} });
    }

    if (rota === 'bater') {
      if (corpo.ticket) return json({erro:'teste',detalhe:'Acesso de teste só pode registrar na tela de teste.'},403);
      if (!LOJAS.includes(loja)) return json({ erro: 'loja' }, 400);
      const nome = limpa(corpo.nome, 40), acao = String(corpo.acao || ''), aparelho = limpa(corpo.aparelho, 40);
      if (!nome || !ACOES.includes(acao) || !aparelho) return json({ erro: 'dados' }, 400);
      if (!this.redeOk(loja, rede)) {
        this.sql.exec('INSERT INTO recusas (ts, loja, nome, rede) VALUES (?, ?, ?, ?)', Date.now(), loja, nome, rede);
        this.sql.exec('DELETE FROM recusas WHERE ts < ?', Date.now() - 30 * 864e5);
        return json({ erro: 'rede', detalhe: 'Conecte no Wi-Fi da loja para bater o ponto.' }, 403);
      }
      const ult = this.ultimosHoje(loja)[nome];
      if (!this.equipe(loja).some(p => p.nome === nome && p.ativo !== false)) return json({ erro: 'funcionario_inativo', detalhe: 'Funcionário não está ativo. Atualize a página ou fale com o gestor.' }, 403);
      if (ult && ult.acao === acao && Date.now() - ult.ts < 10 * 60 * 1000) return json({ erro: 'repetido', detalhe: 'Esse registro já foi feito agora há pouco.' }, 409);
      const ts = Date.now();
      this.sql.exec('INSERT INTO registros (ts, dia, loja, nome, acao, rede, aparelho, origem) VALUES (?, ?, ?, ?, ?, ?, ?, ?)', ts, diaDo(ts), loja, nome, acao, rede, aparelho, 'celular');
      const intervalo=this.auditaIntervalo(loja,nome,acao,ts);
      return json({ ok: true, ts, acao, nome, intervalo });
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

  async hubTeste(req, c, rede, rota, json) {
    if (req.method !== 'POST' || !['hub-teste/estado','hub-teste/bater'].includes(rota)) return json({erro:'rota'},405);
    if (!/^hpt_[\w-]{43}$/.test(c.ticket || '')) return json({erro:'login',detalhe:'Abra o teste pela conta do Paulo no HUB.'},401);
    let identidade;
    try {
      const r = await fetch('https://gabba-estoque-gpt.gabbaheyburger.workers.dev/api/hub/ponto-teste/validar', {
        method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({ticket:c.ticket}),signal:AbortSignal.timeout(5000)
      });
      if (!r.ok) return json({erro:'login',detalhe:'Teste expirado ou acesso desativado. Abra novamente pelo HUB.'},r.status === 403 ? 403 : 401);
      identidade = await r.json();
    } catch { return json({erro:'hub_indisponivel',detalhe:'Não foi possível conferir seu login. Tente novamente.'},503); }
    const u = identidade.user;
    if (!identidade.ok || identidade.teste !== true || !u?.id || u.username !== 'paulo' || u.nome !== 'Paulo' || u.loja !== 'gabba' || !(identidade.expiresAt > Date.now())) return json({erro:'identidade'},403);
    if ((c.nome !== undefined && c.nome !== u.nome) || (c.loja !== undefined && c.loja !== u.loja)) return json({erro:'outra_pessoa',detalhe:'Este login só pode registrar o ponto do Paulo no Gabba.'},403);
    const p = this.equipe('gabba').find(p => p.nome === u.nome && p.ativo !== false);
    if (!p) return json({erro:'inativo',detalhe:'Cadastro do ponto inativo. Fale com o gestor.'},403);
    const ok = this.redeOk('gabba',rede), dia = diaDo(Date.now());
    if (!ok) return json({erro:'rede',detalhe:'Conecte ao Wi-Fi autorizado do Gabba para testar.'},403);
    const hash = [...new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(c.ticket)))].map(b=>b.toString(16).padStart(2,'0')).join('');
    const ultimos = [...this.sql.exec('SELECT acao,ts FROM registros_hub_teste WHERE sessao=? AND membro=? AND dia=? ORDER BY id DESC LIMIT 1',hash,u.id,dia)];
    const ult = ultimos[0] || null;
    if (rota === 'hub-teste/estado') return json({ok:true,teste:true,nome:u.nome,loja:u.loja,pessoa:p,redeOk:true,ultimo:ult,dia,expiresAt:identidade.expiresAt});
    const aparelho = limpa(c.aparelho,40), acao = c.acao;
    if (!aparelho || !ACOES.includes(acao)) return json({erro:'dados'},400);
    const proximas = !ult || ult.acao === 'saida' ? ['entrada'] : ult.acao === 'saida_intervalo' ? ['volta_intervalo'] : ['saida_intervalo','saida'];
    if (!proximas.includes(acao)) return json({erro:'sequencia',detalhe:'Ação já registrada ou fora de sequência. Atualize a tela.'},409);
    if ([...this.sql.exec('SELECT COUNT(*) n FROM registros_hub_teste WHERE sessao=?',hash)][0].n >= 24) return json({erro:'limite',detalhe:'Teste concluído. Abra novamente pelo HUB para recomeçar.'},409);
    const ts = Date.now();
    this.sql.exec('DELETE FROM registros_hub_teste WHERE ts < ?',ts-864e5);
    this.sql.exec('INSERT INTO registros_hub_teste(sessao,membro,ts,dia,acao,aparelho) VALUES(?,?,?,?,?,?)',hash,u.id,ts,dia,acao,aparelho);
    return json({ok:true,teste:true,nome:u.nome,acao,ts});
  }

  async individual(req,c,rede,rota,json){
    if(req.method!=='POST'||!['individual/estado','individual/bater','individual/desfazer'].includes(rota))return json({erro:'rota'},405);
    if(!/^hpr_[\w-]{43}$/.test(c.ticket||''))return json({erro:'login',detalhe:'Abra seu ponto pela sua conta no HUB.'},401);
    let identidade;
    try{
      const r=await fetch('https://gabba-estoque-gpt.gabbaheyburger.workers.dev/api/hub/ponto/validar',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({ticket:c.ticket}),signal:AbortSignal.timeout(5000)});
      if(!r.ok)return json({erro:'login',detalhe:'Acesso expirado ou desativado. Volte ao HUB e abra seu ponto novamente.'},r.status===403?403:401);
      identidade=await r.json();
    }catch{return json({erro:'hub_indisponivel',detalhe:'Não foi possível conferir seu login. Tente novamente.'},503)}
    const u=identidade.user;
    if(!identidade.ok||identidade.individual!==true||!u?.id||!u.nome||u.loja!=='uau'||!(identidade.expiresAt>Date.now()))return json({erro:'identidade'},403);
    if((c.nome!==undefined&&c.nome!==u.nome)||(c.loja!==undefined&&c.loja!==u.loja))return json({erro:'identidade',detalhe:'Este acesso permite somente o seu próprio ponto.'},403);
    const pessoa=this.equipe(u.loja).find(p=>p.nome===u.nome&&p.ativo!==false);
    if(!pessoa)return json({erro:'inativo',detalhe:'Nome não encontrado ou inativo no ponto. Peça ao gestor para conferir o vínculo.'},403);
    if(!this.redeOk(u.loja,rede)){
      if(rota==='individual/bater')this.sql.exec('INSERT INTO recusas(ts,loja,nome,rede) VALUES(?,?,?,?)',Date.now(),u.loja,u.nome,rede);
      return json({erro:'rede',detalhe:'Conecte ao Wi-Fi autorizado da sua unidade para registrar o ponto.'},403);
    }
    const dia=diaDo(Date.now()),rows=[...this.sql.exec('SELECT id,acao,ts,aparelho FROM registros WHERE loja=? AND nome=? AND dia=? AND removido=0 ORDER BY ts DESC,id DESC LIMIT 1',u.loja,u.nome,dia)],ult=rows[0]||null;
    if(rota==='individual/estado')return json({ok:true,individual:true,nome:u.nome,loja:u.loja,pessoa,regraInicio:this.regraDiaIntervalo(u.loja,dia),ultimo:ult?{acao:ult.acao,ts:ult.ts}:null,dia,expiresAt:identidade.expiresAt});
    const aparelho=limpa(c.aparelho,40);
    if(!aparelho)return json({erro:'dados'},400);
    if(rota==='individual/desfazer'){
      if(!ult||ult.aparelho!==aparelho||Date.now()-ult.ts>DESFAZER_MS||![...this.sql.exec('SELECT 1 FROM registros_hub_identidade WHERE registro=? AND membro=?',ult.id,u.id)].length)return json({erro:'prazo',detalhe:'Só é possível desfazer sua última marcação neste celular em até 3 minutos. Fale com o gestor.'},409);
      this.sql.exec('UPDATE registros SET removido=1,nota=? WHERE id=?','desfeito pelo funcionário identificado no HUB',ult.id);return json({ok:true,individual:true,nome:u.nome});
    }
    const acao=c.acao,proximas=!ult||ult.acao==='saida'?['entrada']:ult.acao==='saida_intervalo'?['volta_intervalo']:['saida_intervalo','saida'];
    if(!ACOES.includes(acao))return json({erro:'dados'},400);
    if(!proximas.includes(acao))return json({erro:'sequencia',detalhe:'Esta etapa já foi registrada ou está fora de sequência. Atualize a tela.'},409);
    const ts=Date.now();
    this.sql.exec('INSERT INTO registros(ts,dia,loja,nome,acao,rede,aparelho,origem) VALUES(?,?,?,?,?,?,?,?)',ts,diaDo(ts),u.loja,u.nome,acao,rede,aparelho,'celular');
    const id=[...this.sql.exec('SELECT last_insert_rowid() id')][0].id;
    const intervalo=this.auditaIntervalo(u.loja,u.nome,acao,ts);
    this.sql.exec('INSERT INTO registros_hub_identidade(registro,membro) VALUES(?,?)',id,u.id);
    return json({ok:true,individual:true,nome:u.nome,acao,ts,intervalo});
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
      case 'ausencias': {
        const de=String(c.de||diaDo(Date.now())),ate=String(c.ate||de);
        if(!dataAusencia(de)||!dataAusencia(ate)||ate<de)return json({erro:'data',detalhe:'Confira as datas.'},400);
        return json({ok:true,ausencias:this.ausencias(L,de,ate),equipe:this.equipe(L)});
      }
      case 'ausencia_salvar': {
        const nome=String(c.nome||''),dia=String(c.dia||''),tipos=['Doença informada','Atestado apresentado','Ausência justificada pelo gestor','Ausência sem justificativa','Outro motivo'];
        if(!dataAusencia(dia)||!this.equipe(L).some(p=>p.nome===nome)||!Number.isInteger(c.revisao)||typeof c.nota!=='string'||c.nota.length>500||typeof c.tipo!=='string'||!tipos.includes(c.tipo)||!c.nota.trim()||typeof c.removido!=='boolean')return json({erro:'dados',detalhe:'Confira funcionário, data, motivo e observação (até 500 caracteres).'},400);
        const anterior=this.ausencias(L,dia,dia).find(a=>a.nome===nome),rev=anterior?.revisao||0;
        if(c.revisao!==rev)return json({erro:'conflito',detalhe:'Este registro mudou. Consulte a data novamente antes de salvar.'},409);
        if(c.removido&&!anterior)return json({erro:'dados'},400);
        const nota=c.nota.trim(),historico=JSON.parse(anterior?.historico||'[]');
        historico.push({ts:Date.now(),tipo:c.tipo,nota,removido:c.removido,revisao:rev+1});
        this.sql.exec('INSERT INTO ausencias(loja,nome,dia,tipo,nota,revisao,removido,historico) VALUES(?,?,?,?,?,?,?,?) ON CONFLICT(loja,nome,dia) DO UPDATE SET tipo=excluded.tipo,nota=excluded.nota,revisao=excluded.revisao,removido=excluded.removido,historico=excluded.historico',L,nome,dia,c.tipo,nota,rev+1,c.removido?1:0,JSON.stringify(historico));
        return json({ok:true});
      }
      case 'intervalos': return json({ok:true,regras:this.regrasIntervalo(L),equipe:this.equipe(L)});
      case 'intervalos_salvar': {
        const anterior=this.regrasIntervalo(L);
        if(c.revisao!==anterior.rev)return json({erro:'conflito',detalhe:'Os horários mudaram. Atualize esta aba antes de salvar.'},409);
        if(!dataAtualOuFutura(c.vigencia)||!Number.isInteger(c.tolerancia)||c.tolerancia<0||c.tolerancia>30||!c.horarios||typeof c.horarios!=='object'||Array.isArray(c.horarios))return json({erro:'dados',detalhe:'Confira a vigência, horários e tolerância (0 a 30 min).'},400);
        const nomes=new Set([...this.equipe(L).map(p=>p.nome),...anterior.versoes.flatMap(v=>[...Object.keys(v.horarios),...Object.keys(v.semana||{})])]),horarios={},semana={};
        for(const[nome,hora]of Object.entries(c.horarios)){if(!nomes.has(nome)||!horaValida(hora))return json({erro:'dados',detalhe:'Funcionário ou horário inválido.'},400);horarios[nome]=hora;}
        if(c.semana!==undefined){if(!c.semana||typeof c.semana!=='object'||Array.isArray(c.semana))return json({erro:'dados'},400);for(const[nome,dias]of Object.entries(c.semana)){if(!nomes.has(nome)||!dias||typeof dias!=='object'||Array.isArray(dias))return json({erro:'dados'},400);semana[nome]={};for(let d=0;d<7;d++){if(dias[d]!==null&&dias[d]!==''&&!horaValida(dias[d]))return json({erro:'dados',detalhe:'Confira os sete dias da semana.'},400);semana[nome][d]=dias[d];}}}
        const regras={rev:anterior.rev+1,versoes:[...anterior.versoes.filter(v=>v.vigencia!==c.vigencia),{vigencia:c.vigencia,tolerancia:c.tolerancia,horarios,...(c.semana!==undefined?{semana}:{})}]};
        this.meta('intervalos_regras_'+L,JSON.stringify(regras));return json({ok:true,regras});
      }
      case 'equipe': return json({ ok: true, equipe: this.equipe(L) });
      case 'equipe_excecao': {
        const equipe = this.equipe(L), p = equipe.find(p => p.nome === String(c.nome || ''));
        if (!p || !dataAtualOuFutura(c.dia)) return json({ erro: 'data', detalhe: 'Escolha um funcionário e uma data válida a partir de hoje.' }, 400);
        if (c.remover !== undefined && typeof c.remover !== 'boolean') return json({ erro: 'dados' }, 400);
        if (!c.remover && (!horarioValido(c.horario) || !intervaloValido(c.intervalo, c.horario))) return json({ erro: 'escala', detalhe: 'Confira entrada, saída e intervalo. O intervalo deve estar dentro do turno.' }, 400);
        p.excecoes = p.excecoes || {};
        if (c.remover) delete p.excecoes[c.dia];
        else {
          if (!p.excecoes[c.dia] && Object.keys(p.excecoes).length >= 1000) return json({ erro: 'limite', detalhe: 'Limite de exceções atingido.' }, 400);
          p.excecoes[c.dia] = { horario: c.horario, intervalo: c.intervalo, nota: limpa(c.nota, 120), atualizado: Date.now() };
        }
        this.meta('equipe_v1_' + L, JSON.stringify(equipe));
        return json({ ok: true, equipe });
      }
      case 'equipe_adicionar': {
        const equipe = this.equipe(L), nome = limpa(c.nome, 40), setor = limpa(c.setor, 40);
        if (!nome || !setor) return json({ erro: 'dados', detalhe: 'Preencha nome e setor.' }, 400);
        const escala = c.horarios ? validaEscala(c) : null;
        if (c.horarios && !escala) return json({ erro: 'escala', detalhe: 'Confira os sete dias, os horários e a data de início da escala.' }, 400);
        if (equipe.some(p => p.nome.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase() === nome.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase())) return json({ erro: 'duplicado', detalhe: 'Já existe esse nome, inclusive nos inativos. Reative o cadastro ou diferencie o nome com sobrenome.' }, 409);
        if (equipe.length >= 300) return json({ erro: 'limite', detalhe: 'Limite de cadastros atingido.' }, 400);
        equipe.push({ nome, setor, ativo: true, criado: Date.now(), ...(escala ? { escalas: [escala] } : {}) });
        this.meta('equipe_v1_' + L, JSON.stringify(equipe));
        return json({ ok: true, equipe });
      }
      case 'equipe_status': {
        const equipe = this.equipe(L), p = equipe.find(p => p.nome === String(c.nome || ''));
        if (!p || typeof c.ativo !== 'boolean') return json({ erro: 'dados' }, 400);
        p.ativo = c.ativo; p.atualizado = Date.now();
        this.meta('equipe_v1_' + L, JSON.stringify(equipe));
        return json({ ok: true, equipe });
      }
      case 'equipe_escala': {
        const equipe = this.equipe(L), p = equipe.find(p => p.nome === String(c.nome || ''));
        const escala = validaEscala(c), setor = limpa(c.setor, 40);
        if (!p || !escala || !setor) return json({ erro: 'escala', detalhe: 'Informe setor, horários por dia e início da escala a partir de hoje.' }, 400);
        const anteriores = (p.escalas || []).filter(e => e.vigencia !== escala.vigencia);
        if (anteriores.length >= 100) return json({ erro: 'limite', detalhe: 'Limite de versões de escala atingido. Fale com o suporte.' }, 400);
        p.escalas = [...anteriores, escala].sort((a, b) => a.vigencia.localeCompare(b.vigencia));
        p.setor = setor; p.atualizado = Date.now();
        this.meta('equipe_v1_' + L, JSON.stringify(equipe));
        return json({ ok: true, equipe });
      }
      case 'entrar': return json({ ok: true, redeAgora: rede, redeAgoraOk: this.redeOk(L, rede) });
      case 'trocar_pin': {
        if (!/^\d{4,8}$/.test(String(c.novo || ''))) return json({ erro: 'pin_invalido' }, 400);
        const s = crypto.randomUUID(); this.meta('pin_sal', s); this.meta('pin_hash', await hashPin(String(c.novo), s));
        return json({ ok: true });
      }
      case 'registros': {
        const de = String(c.de || diaDo(Date.now())), ate = String(c.ate || de);
        const regs = [...this.sql.exec('SELECT id, ts, dia, nome, acao, aparelho, origem, nota, removido FROM registros WHERE loja = ? AND dia BETWEEN ? AND ? ORDER BY ts', L, de, ate)];
        for(const r of regs){const a=[...this.sql.exec('SELECT dados FROM intervalo_auditoria WHERE registro=?',r.id)][0];if(a)r.intervalo=JSON.parse(a.dados);}
        return json({ ok: true, registros: regs, ausencias:this.ausencias(L,de,ate) });
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
        this.auditaIntervalo(L,nome,acao,ts);
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


