/*
 * Ligação dos jogos com o servidor dos brindes (servidor-brindes/, Cloudflare).
 * O endereço vem do campo "servidor" de desafio/config.json. Sem esse campo, os jogos
 * continuam como antes (prêmio único escrito na área do dono, sem fila de brindes).
 *
 *   GabbaBrindes.usar(url)        liga o servidor
 *   GabbaBrindes.ativo()          true se há servidor
 *   GabbaBrindes.status()         -> { restantes, total, proximo }
 *   GabbaBrindes.ganhar('pedido') -> { ok, brinde, codigo } | { ok:false, esgotado:true }
 */
(function () {
  let SRV = '';
  let aparelho = '';
  try {
    aparelho = localStorage.getItem('gabba-aparelho') || '';
    if (!aparelho) {
      const r = crypto.getRandomValues(new Uint8Array(12));
      aparelho = Array.from(r, b => b.toString(16).padStart(2, '0')).join('');
      localStorage.setItem('gabba-aparelho', aparelho);
    }
  } catch (e) { aparelho = 'sem-armazenamento-' + Math.random().toString(36).slice(2); }

  async function chamar(rota, corpo) {
    const op = { method: corpo ? 'POST' : 'GET', cache: 'no-store' };
    if (corpo) { op.headers = { 'Content-Type': 'application/json' }; op.body = JSON.stringify(corpo); }
    if (window.AbortSignal && AbortSignal.timeout) op.signal = AbortSignal.timeout(10000);
    const r = await fetch(SRV + rota, op);
    const d = await r.json();
    if (!r.ok) throw new Error(d.erro || 'HTTP ' + r.status);
    return d;
  }
  window.GabbaBrindes = {
    usar(url) { SRV = String(url || '').replace(/\/+$/, ''); },
    ativo() { return !!SRV; },
    status() { return chamar('/status'); },
    ganhar(jogo) { return chamar('/ganhar', { aparelho, jogo }); }
  };
})();
