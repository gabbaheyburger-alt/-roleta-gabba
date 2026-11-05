/* Figurinha de story "Hoje fui premiado no Gabba".
   GabbaStory.preparar(premio) monta a imagem (1080x1920) assim que a tela de PARABÉNS aparece.
   GabbaStory.postar() abre o menu de compartilhar do celular (Instagram > Story).
   Se o celular não deixar compartilhar imagem, mostra a imagem para a pessoa salvar. */
(function () {
  var W = 1080, H = 1920, arquivo = null, dataUrl = '', pronto = null;
  var mascote = new Image(); mascote.src = '../corre/mascote.png';

  function glow(ctx, x, y, r, cor) {
    var g = ctx.createRadialGradient(x, y, 0, x, y, r);
    g.addColorStop(0, cor); g.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
  }
  function tamanho(ctx, texto, max, inicio, peso) {
    var s = inicio;
    do { ctx.font = (peso || '400') + ' ' + s + 'px Bungee, Impact, sans-serif'; s -= 4; } while (ctx.measureText(texto).width > max && s > 30);
    return s + 4;
  }
  function linhas(ctx, texto, max, inicio) {
    // até 2 linhas, letra o maior possível
    var palavras = texto.split(/\s+/), melhor = null;
    for (var corte = 0; corte < palavras.length; corte++) {
      var ls = corte === 0 ? [texto] : [palavras.slice(0, corte).join(' '), palavras.slice(corte).join(' ')];
      var s = Math.min.apply(null, ls.map(function (l) { return tamanho(ctx, l, max, inicio); }));
      if (!melhor || s > melhor.s) melhor = { ls: ls, s: s };
    }
    return melhor;
  }
  function texto(ctx, t, x, y, cor, sombra, blur) {
    ctx.shadowColor = sombra; ctx.shadowBlur = blur;
    ctx.fillStyle = cor; ctx.fillText(t, x, y); ctx.fillText(t, x, y);
    ctx.shadowBlur = 0;
  }
  function desenhar(premio) {
    var c = document.createElement('canvas'); c.width = W; c.height = H;
    var ctx = c.getContext('2d');
    ctx.fillStyle = '#07080a'; ctx.fillRect(0, 0, W, H);
    glow(ctx, 160, 420, 700, 'rgba(61,220,132,.28)');
    glow(ctx, 960, 1000, 700, 'rgba(255,45,111,.26)');
    glow(ctx, 300, 1650, 700, 'rgba(255,170,0,.24)');
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';

    ctx.font = '170px sans-serif'; ctx.fillText('🎁', W / 2, 380);

    ctx.font = '400 ' + tamanho(ctx, 'HOJE FUI PREMIADO', 940, 104) + 'px Bungee, Impact, sans-serif';
    texto(ctx, 'HOJE FUI PREMIADO', W / 2, 580, '#ffffff', 'rgba(255,255,255,.6)', 24);
    ctx.font = '400 86px Bungee, Impact, sans-serif';
    texto(ctx, 'NO', W / 2, 690, '#ffffff', 'rgba(255,255,255,.5)', 20);

    ctx.font = '400 ' + tamanho(ctx, 'GABBA', 900, 280) + 'px Bungee, Impact, sans-serif';
    var gr = ctx.createLinearGradient(160, 0, 920, 0);
    gr.addColorStop(0, '#ffb340'); gr.addColorStop(.5, '#ff5a2b'); gr.addColorStop(1, '#e8102e');
    texto(ctx, 'GABBA', W / 2, 860, gr, 'rgba(255,90,40,.9)', 50);

    // cartão do prêmio
    var y0 = 1030, h = 420;
    ctx.save(); ctx.setLineDash([22, 16]); ctx.lineWidth = 6; ctx.strokeStyle = 'rgba(61,220,132,.85)';
    ctx.shadowColor = 'rgba(61,220,132,.7)'; ctx.shadowBlur = 30;
    ctx.beginPath(); if (ctx.roundRect) ctx.roundRect(90, y0, W - 180, h, 48); else ctx.rect(90, y0, W - 180, h);
    ctx.fillStyle = 'rgba(20,40,28,.55)'; ctx.fill(); ctx.stroke(); ctx.restore();
    ctx.font = '700 46px Barlow, sans-serif'; ctx.fillStyle = '#3ddc84';
    ctx.fillText('G A N H E I', W / 2, y0 + 80);
    var L = linhas(ctx, premio.toUpperCase(), W - 280, 132), lh = L.s * 1.12;
    ctx.font = '400 ' + L.s + 'px Bungee, Impact, sans-serif';
    var meio = y0 + 100 + (h - 100) / 2;
    L.ls.forEach(function (l, i) {
      texto(ctx, l, W / 2, meio + (i - (L.ls.length - 1) / 2) * lh, '#ffd23f', 'rgba(255,170,0,.95)', 40);
    });

    if (mascote.complete && mascote.naturalWidth) {
      var mh = 230, mw = mascote.naturalWidth * mh / mascote.naturalHeight;
      ctx.shadowColor = 'rgba(232,16,46,.8)'; ctx.shadowBlur = 40;
      ctx.drawImage(mascote, W / 2 - mw / 2, 1500, mw, mh); ctx.shadowBlur = 0;
    }
    var d = new Date(), p = function (n) { return (n < 10 ? '0' : '') + n; };
    ctx.font = '600 44px Barlow, sans-serif'; ctx.fillStyle = '#e9e3dd';
    ctx.fillText('Fliperama Gabba · ' + p(d.getDate()) + '/' + p(d.getMonth() + 1) + '/' + d.getFullYear(), W / 2, 1790);
    return c;
  }
  function preparar(premio) {
    arquivo = null; dataUrl = '';
    var fontes = document.fonts && document.fonts.load ? Promise.all([
      document.fonts.load('400 100px Bungee'), document.fonts.load('700 40px Barlow'), document.fonts.load('600 40px Barlow')
    ]).catch(function () {}) : Promise.resolve();
    var img = new Promise(function (ok) { if (mascote.complete) ok(); else { mascote.onload = mascote.onerror = ok; } });
    pronto = Promise.all([fontes, img]).then(function () {
      var c = desenhar(premio);
      dataUrl = c.toDataURL('image/png');
      return new Promise(function (ok) {
        c.toBlob(function (b) {
          try { if (b) arquivo = new File([b], 'premio-gabba.png', { type: 'image/png' }); } catch (e) {}
          ok();
        }, 'image/png');
      });
    });
    return pronto;
  }
  function mostrar() {
    var o = document.createElement('div');
    o.style.cssText = 'position:fixed;inset:0;z-index:9999;background:rgba(0,0,0,.92);display:flex;flex-direction:column;align-items:center;justify-content:center;gap:14px;padding:20px;text-align:center;color:#fff;font:600 1rem Barlow,sans-serif';
    o.innerHTML = '<b style="font:400 1.2rem Bungee,sans-serif">Segure a imagem e toque em Salvar</b>' +
      '<img alt="Hoje fui premiado no Gabba" style="max-height:68vh;max-width:100%;border-radius:16px;box-shadow:0 0 30px rgba(255,45,111,.5)">' +
      '<span>Depois poste no seu story e marque o Gabba.</span>' +
      '<button type="button" style="min-height:48px;padding:0 26px;border-radius:12px;border:1px solid #555;background:#111;color:#fff;font:700 1rem Barlow,sans-serif">Fechar</button>';
    o.querySelector('img').src = dataUrl;
    o.querySelector('button').onclick = function () { o.remove(); };
    document.body.appendChild(o);
  }
  function postar() {
    if (arquivo && navigator.canShare && navigator.canShare({ files: [arquivo] })) {
      return navigator.share({ files: [arquivo] }).catch(function () {});
    }
    if (dataUrl) { mostrar(); return Promise.resolve(); }
    if (pronto) return pronto.then(mostrar);
    return Promise.resolve();
  }
  window.GabbaStory = { preparar: preparar, postar: postar, _desenhar: desenhar };
})();
