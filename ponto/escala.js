/* Regras de escala compartilhadas pelo funcionário e pelo relatório do dono. */
(function (root) {
  const minutos = t => Number(t.split(':')[0]) * 60 + Number(t.split(':')[1]);
  function detalhe(p, dia, loja, apenasBase = false) {
    const wd = new Date(dia + 'T12:00:00Z').getUTCDay();
    const versao = (p.escalas || []).filter(v => v.vigencia <= dia).sort((a,b) => b.vigencia.localeCompare(a.vigencia))[0];
    const excecao = !apenasBase && p.excecoes && p.excecoes[dia];
    const horario = excecao ? excecao.horario : versao ? versao.horarios[wd] : ((!p.dias || p.dias.includes(wd)) ? loja.horarios[wd] : null);
    const intervalos = versao && versao.intervalos !== undefined ? versao.intervalos : (loja.intervalos || {});
    const intervalo = horario ? (excecao ? excecao.intervalo : intervalos[wd]) || null : null;
    let intervaloMin = horario ? (loja.intervalo_min ?? 30) : 0;
    if (intervalo) intervaloMin = (minutos(intervalo[1]) - minutos(intervalo[0]) + 1440) % 1440;
    return { horario, intervalo, intervaloMin, excecao: !!excecao, nota: excecao ? excecao.nota || '' : '' };
  }
  root.PontoEscala = { detalhe };
})(typeof window !== 'undefined' ? window : globalThis);
