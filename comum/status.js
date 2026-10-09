/*
 * Status das solicitações (Pendente / Resolvido).
 * Lê a aba "Status" da planilha, publicada na web como CSV (sem nomes de pessoas),
 * e cruza com os pedidos que este celular enviou: mesmo tipo, loja e item, horário até 5 min de diferença.
 */
(function () {
  function parseCSV(txt) {
    const rows = []; let row = [], cell = '', q = false;
    for (let i = 0; i < txt.length; i++) {
      const c = txt[i];
      if (q) { if (c === '"') { if (txt[i + 1] === '"') { cell += '"'; i++; } else q = false; } else cell += c; }
      else if (c === '"') q = true;
      else if (c === ',') { row.push(cell); cell = ''; }
      else if (c === '\n') { row.push(cell); rows.push(row); row = []; cell = ''; }
      else if (c !== '\r') cell += c;
    }
    if (cell || row.length) { row.push(cell); rows.push(row); }
    return rows;
  }
  const norm = (s) => String(s || '').trim().toLowerCase();
  function hora(s) { const m = String(s).match(/(\d+)-(\d+)-(\d+)\s+(\d+):(\d+):(\d+)/); return m ? new Date(+m[1], m[2] - 1, +m[3], +m[4], +m[5], +m[6]).getTime() : NaN; }

  // url: endereço CSV publicado; pedidos: [{tipo, loja, item, quando(ISO)}]. Devolve Map(quando -> 'pendente'|'resolvido')
  window.gabbaStatus = async function (url, pedidos) {
    const out = new Map();
    if (!url || !pedidos.length) return out;
    const r = await fetch(url + (url.includes('?') ? '&' : '?') + 't=' + Date.now(), { cache: 'no-store' });
    if (!r.ok) throw new Error('status ' + r.status);
    const linhas = parseCSV(await r.text()).slice(1).filter((l) => l[0])
      .map((l) => ({ t: hora(l[0]), tipo: norm(l[1]), loja: norm(l[2]), item: norm(l[3]), status: norm(l[4]), usado: false }));
    for (const p of pedidos) {
      const t = new Date(p.quando).getTime();
      let melhor = null, dif = 5 * 60 * 1000;
      for (const l of linhas) {
        if (l.usado || l.tipo !== norm(p.tipo) || l.loja !== norm(p.loja) || l.item !== norm(p.item)) continue;
        const d = Math.abs(l.t - t);
        if (d <= dif) { dif = d; melhor = l; }
      }
      if (melhor) { melhor.usado = true; out.set(p.quando, melhor.status); }
    }
    return out;
  };
  // Todas as linhas da aba Status (de todos os celulares), para mostrar o histórico da loja.
  // Devolve [{ms, tipo, loja, item, status, quantidade, urgencia}] — sem nomes de pessoas.
  window.gabbaLinhasStatus = async function (url) {
    if (!url) return [];
    const r = await fetch(url + (url.includes('?') ? '&' : '?') + 't=' + Date.now(), { cache: 'no-store' });
    if (!r.ok) throw new Error('status ' + r.status);
    return parseCSV(await r.text()).slice(1).filter((l) => l[0] && !isNaN(hora(l[0])))
      .map((l) => ({ ms: hora(l[0]), tipo: String(l[1] || '').trim(), loja: String(l[2] || '').trim(), item: String(l[3] || '').trim(),
        status: norm(l[4]), quantidade: String(l[5] || '').trim(), urgencia: String(l[6] || '').trim() }));
  };
  // Diz se um pedido guardado neste celular já está na planilha (mesmo tipo, loja e item, até 5 min de diferença)
  window.gabbaJaNaPlanilha = function (linhas, p) {
    const t = new Date(p.quando).getTime();
    return linhas.some((l) => norm(l.tipo) === norm(p.tipo) && norm(l.loja) === norm(p.loja) && norm(l.item) === norm(p.item) && Math.abs(l.ms - t) <= 5 * 60 * 1000);
  };
})();
