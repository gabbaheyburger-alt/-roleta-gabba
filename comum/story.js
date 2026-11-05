/* Story "Hoje fui premiado no Gabba" — modelo Jackpot do Fliperama.
   GabbaStory.preparar(premio): assim que a tela de PARABÉNS aparece, monta a foto (1080x1920)
   e grava um vídeo curto (6 s, 720x1280): luzes correndo, roleta sorteando, JACKPOT! com confete e o prêmio.
   GabbaStory.postar(): abre o menu de compartilhar do celular (Instagram > Story).
   Vai o vídeo se ficou pronto e o celular aceita; senão vai a foto; senão mostra a foto para salvar. */
(function () {
  var W = 1080, H = 1920, SEG = 6, FPS = 30;
  var foto = null, video = null, dataUrl = '', pronto = null, geracao = 0;
  var mascote = new Image(); mascote.src = '../corre/mascote.png';
  var FONTE = 'Bungee, Impact, sans-serif';
  var PARA = 2.3;                                   // quando a roleta para
  var JAN = { x: 120, y: 900, w: 840, h: 400 };     // janela da roleta
  var ITENS = ['🍔', '🍟', '🥤', '🍺', '🎁', '🌭', '🍦', '⭐'];

  function tela(w, h) { var c = document.createElement('canvas'); c.width = Math.max(1, Math.round(w)); c.height = Math.max(1, Math.round(h)); return c; }
  function caixa(ctx, x, y, w, h, r) { ctx.beginPath(); if (ctx.roundRect) ctx.roundRect(x, y, w, h, r); else ctx.rect(x, y, w, h); }
  function tamanho(ctx, t, max, s) {
    do { ctx.font = '400 ' + s + 'px ' + FONTE; s -= 4; } while (ctx.measureText(t).width > max && s > 30);
    return s + 4;
  }
  function linhas(ctx, t, max, inicio) {
    var p = t.split(/\s+/), melhor = null;
    for (var corte = 0; corte < p.length; corte++) {
      var ls = corte === 0 ? [t] : [p.slice(0, corte).join(' '), p.slice(corte).join(' ')];
      var s = Math.min.apply(null, ls.map(function (l) { return tamanho(ctx, l, max, inicio); }));
      if (!melhor || s > melhor.s) melhor = { ls: ls, s: s };
    }
    return melhor;
  }
  function escrever(ctx, t, x, y, cor, sombra, blur) {
    ctx.shadowColor = sombra; ctx.shadowBlur = blur; ctx.fillStyle = cor;
    ctx.fillText(t, x, y); if (blur) ctx.fillText(t, x, y);
    ctx.shadowBlur = 0;
  }
  function rnd(s) { return function () { s = (s * 16807) % 2147483647; return (s - 1) / 2147483646; }; }
  var R = rnd(7), CONF = [];
  for (var i = 0; i < 140; i++) CONF.push({ a: R() * Math.PI * 2, v: 700 + R() * 1300, rot: R() * 6, vr: (R() - .5) * 14, c: ['#ffd23f', '#ff2d6f', '#3ddc84', '#29d3ff', '#b14dff', '#ff8a00'][i % 6], w: 14 + R() * 14 });
  var LAMP = (function () {
    var l = [], m = 46, p = 66, a, b;
    for (a = m; a <= W - m; a += p) l.push([a, m]);
    for (b = m + p; b <= H - m; b += p) l.push([W - m, b]);
    for (a = W - m - p; a >= m; a -= p) l.push([a, H - m]);
    for (b = H - m - p; b > m; b -= p) l.push([m, b]);
    return l;
  })();

  /* Partes desenhadas uma vez, já no tamanho final (k = escala) */
  function camadas(premio, k) {
    var L = { k: k, w: Math.round(W * k), h: Math.round(H * k) };
    function cheia() { var c = tela(L.w, L.h), x = c.getContext('2d'); x.scale(k, k); x.textAlign = 'center'; x.textBaseline = 'middle'; return { c: c, x: x }; }
    function peca(w, h) { var c = tela(w * k, h * k), x = c.getContext('2d'); x.scale(k, k); x.textAlign = 'center'; x.textBaseline = 'middle'; return { c: c, x: x, w: w, h: h }; }

    // fundo: céu, sol, títulos, mascote, rodapé
    var f = cheia(), x = f.x;
    var g = x.createLinearGradient(0, 0, 0, H); g.addColorStop(0, '#0b0420'); g.addColorStop(.55, '#1a0630'); g.addColorStop(1, '#05010d');
    x.fillStyle = g; x.fillRect(0, 0, W, H);
    var sol = x.createRadialGradient(W / 2, 1450, 0, W / 2, 1450, 700); sol.addColorStop(0, 'rgba(255,45,111,.45)'); sol.addColorStop(1, 'rgba(0,0,0,0)');
    x.fillStyle = sol; x.fillRect(0, 0, W, H);
    x.font = '400 ' + tamanho(x, 'HOJE FUI PREMIADO', 900, 96) + 'px ' + FONTE;
    escrever(x, 'HOJE FUI PREMIADO', W / 2, 250, '#ffffff', '#29d3ff', 34);
    x.font = '400 72px ' + FONTE; escrever(x, 'NO', W / 2, 350, '#29d3ff', '#29d3ff', 30);
    L.fundo = f.c;
    var fr = cheia(); x = fr.x;
    if (mascote.complete && mascote.naturalWidth) {
      var mh = 220, mw = mascote.naturalWidth * mh / mascote.naturalHeight;
      x.shadowColor = 'rgba(255,45,111,.9)'; x.shadowBlur = 40; x.drawImage(mascote, W / 2 - mw / 2, 1420, mw, mh); x.shadowBlur = 0;
    }
    var d = new Date(), p2 = function (n) { return (n < 10 ? '0' : '') + n; };
    x.font = '600 44px Barlow, sans-serif'; x.fillStyle = '#efe6ff';
    x.fillText('Fliperama Gabba · ' + p2(d.getDate()) + '/' + p2(d.getMonth() + 1) + '/' + d.getFullYear(), W / 2, 1760);
    L.frente = fr.c;

    // GABBA aceso e apagado
    function gabba(aceso) {
      var c = cheia(), y = c.x;
      y.font = '400 ' + tamanho(y, 'GABBA', 880, 270) + 'px ' + FONTE;
      var gg = y.createLinearGradient(150, 0, 930, 0); gg.addColorStop(0, '#ffd23f'); gg.addColorStop(.5, '#ff2d6f'); gg.addColorStop(1, '#b14dff');
      escrever(y, 'GABBA', W / 2, 530, aceso ? gg : '#40203a', '#ff2d6f', aceso ? 60 : 0);
      return c.c;
    }
    L.gabbaOn = gabba(true); L.gabbaOff = gabba(false);

    // lâmpadas
    function lamp(aceso) {
      var c = peca(80, 80), y = c.x; y.beginPath(); y.arc(40, 40, 13, 0, Math.PI * 2);
      y.fillStyle = aceso ? '#fff3b0' : '#5a4a1a'; y.shadowColor = '#ffd23f'; y.shadowBlur = aceso ? 26 : 0; y.fill(); return c;
    }
    L.lampOn = lamp(true); L.lampOff = lamp(false);

    // JACKPOT!
    var j = peca(900, 260); j.x.font = '400 120px ' + FONTE; escrever(j.x, 'JACKPOT!', 450, 130, '#ffd23f', '#ff8a00', 50); L.jackpot = j;

    // moldura da janela
    var mo = peca(JAN.w + 200, JAN.h + 200), y = mo.x;
    caixa(y, 82, 82, JAN.w + 36, JAN.h + 36, 60);
    var mg = y.createLinearGradient(0, 82, 0, 82 + JAN.h + 36); mg.addColorStop(0, '#ffd23f'); mg.addColorStop(1, '#ff8a00');
    y.fillStyle = mg; y.shadowColor = '#ffb300'; y.shadowBlur = 50; y.fill(); y.shadowBlur = 0;
    caixa(y, 100, 100, JAN.w, JAN.h, 44); y.fillStyle = '#0d0618'; y.fill();
    L.moldura = mo;

    // prêmio
    var pr = peca(JAN.w, JAN.h + 80), P = linhas(pr.x, premio.toUpperCase(), JAN.w - 70, 150);
    pr.x.font = '400 ' + P.s + 'px ' + FONTE;
    P.ls.forEach(function (l, q) { escrever(pr.x, l, JAN.w / 2, (JAN.h + 80) / 2 + (q - (P.ls.length - 1) / 2) * P.s * 1.1, '#fff1a8', '#ffd23f', 45); });
    L.premio = pr;
    return L;
  }

  function sprite(ctx, s, cx, cy, esc) { // desenha uma peça centrada em (cx, cy), em coordenadas de 1080
    var w = s.w * esc, h = s.h * esc; ctx.drawImage(s.c, cx - w / 2, cy - h / 2, w, h);
  }

  /* Um quadro do vídeo no tempo t (segundos) */
  function quadro(ctx, L, t) {
    var k = L.k, dep = t - PARA, i;
    ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.globalAlpha = 1; ctx.shadowBlur = 0;
    ctx.drawImage(L.fundo, 0, 0);
    ctx.setTransform(k, 0, 0, k, 0, 0); ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    // chão em grade andando
    ctx.strokeStyle = 'rgba(41,211,255,.45)'; ctx.lineWidth = 4; var hz = 1480;
    for (i = -10; i <= 10; i++) { ctx.beginPath(); ctx.moveTo(W / 2 + i * 40, hz); ctx.lineTo(W / 2 + i * 260, H); ctx.stroke(); }
    for (i = 0; i < 9; i++) { var pp = (i + (t * 1.2) % 1) / 9, yy = hz + (H - hz) * pp * pp; ctx.beginPath(); ctx.moveTo(0, yy); ctx.lineTo(W, yy); ctx.stroke(); }
    // lâmpadas correndo
    var fase = Math.floor(t * 12);
    LAMP.forEach(function (l, n) { sprite(ctx, (n + fase) % 3 === 0 ? L.lampOn : L.lampOff, l[0], l[1], 1); });
    // GABBA com piscada de letreiro
    var c = t % 2.5, pis = c > 2.2 && c < 2.3;
    ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.drawImage(pis ? L.gabbaOff : L.gabbaOn, 0, 0); ctx.setTransform(k, 0, 0, k, 0, 0);
    // SORTEANDO... ou JACKPOT!
    if (dep > 0) {
      var e = Math.min(1, dep / .35), s = .4 + .6 * (1 - Math.pow(1 - e, 3)) + .05 * Math.sin(dep * 6);
      ctx.save(); ctx.translate(W / 2, 790); ctx.rotate(-.05); sprite(ctx, L.jackpot, 0, 0, s); ctx.restore();
    } else {
      ctx.font = '700 54px Barlow, sans-serif'; ctx.fillStyle = 'rgba(255,255,255,' + (.5 + .5 * Math.sin(t * 10)) + ')';
      ctx.fillText('SORTEANDO...', W / 2, 790);
    }
    // janela da roleta
    ctx.globalAlpha = dep > 0 ? .85 + .15 * Math.sin(dep * 5) : .85;
    sprite(ctx, L.moldura, JAN.x + JAN.w / 2, JAN.y + JAN.h / 2, 1); ctx.globalAlpha = 1;
    ctx.save(); caixa(ctx, JAN.x, JAN.y, JAN.w, JAN.h, 44); ctx.clip();
    if (dep <= 0) {
      var pos = 26 * (1 - Math.pow(1 - t / PARA, 3)), alt = 260, of = (pos % 1) * alt;
      ctx.font = '200px sans-serif'; ctx.fillStyle = '#fff';
      for (var n = -1; n <= 2; n++) {
        var idx = Math.floor(pos) + n;
        ctx.fillText(ITENS[((idx % ITENS.length) + ITENS.length) % ITENS.length], W / 2, JAN.y + JAN.h / 2 - n * alt + of);
      }
      var sb = ctx.createLinearGradient(0, JAN.y, 0, JAN.y + JAN.h);
      sb.addColorStop(0, 'rgba(13,6,24,1)'); sb.addColorStop(.3, 'rgba(13,6,24,0)'); sb.addColorStop(.7, 'rgba(13,6,24,0)'); sb.addColorStop(1, 'rgba(13,6,24,1)');
      ctx.fillStyle = sb; ctx.fillRect(JAN.x, JAN.y, JAN.w, JAN.h);
    } else {
      sprite(ctx, L.premio, W / 2, JAN.y + JAN.h / 2, Math.min(1, dep / .25) * (1 + .05 * Math.sin(dep * 5)));
    }
    ctx.restore();
    // clarão e confete
    if (dep > 0 && dep < .35) { ctx.fillStyle = 'rgba(255,255,255,' + (1 - dep / .35) * .8 + ')'; ctx.fillRect(0, 0, W, H); }
    if (dep > 0) {
      CONF.forEach(function (q) {
        var px = W / 2 + Math.cos(q.a) * q.v * dep * .6, py = JAN.y + JAN.h / 2 + Math.sin(q.a) * q.v * dep * .6 + 900 * dep * dep;
        if (py > H + 40) return;
        ctx.save(); ctx.translate(px, py); ctx.rotate(q.rot + q.vr * dep); ctx.fillStyle = q.c; ctx.fillRect(-q.w / 2, -q.w / 4, q.w, q.w / 2); ctx.restore();
      });
    }
    ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.drawImage(L.frente, 0, 0);
  }

  function tipoVideo() {
    if (!window.MediaRecorder || !HTMLCanvasElement.prototype.captureStream) return '';
    var t = ['video/mp4;codecs=avc1.42E01E', 'video/mp4;codecs=avc1', 'video/mp4'];
    for (var i = 0; i < t.length; i++) { try { if (MediaRecorder.isTypeSupported(t[i])) return t[i]; } catch (e) {} }
    return ''; // só webm: o Instagram não aceita bem, fica a foto
  }
  function gravar(premio, minha) {
    var tipo = tipoVideo();
    if (!tipo) return Promise.resolve();
    return new Promise(function (ok) {
      try {
        var L = camadas(premio, 2 / 3), c = tela(L.w, L.h), ctx = c.getContext('2d');
        quadro(ctx, L, 0);
        var rec = new MediaRecorder(c.captureStream(FPS), { mimeType: tipo, videoBitsPerSecond: 5000000 }), partes = [];
        rec.ondataavailable = function (e) { if (e.data && e.data.size) partes.push(e.data); };
        rec.onstop = function () {
          if (minha === geracao && partes.length) {
            try { video = new File([new Blob(partes, { type: 'video/mp4' })], 'premio-gabba.mp4', { type: 'video/mp4' }); } catch (e) {}
          }
          ok();
        };
        rec.start(250);
        var t0 = performance.now();
        (function passo() {
          var t = (performance.now() - t0) / 1000;
          if (minha !== geracao) { rec.stop(); return; }
          quadro(ctx, L, Math.min(t, SEG));
          if (t < SEG) requestAnimationFrame(passo); else rec.stop();
        })();
      } catch (e) { ok(); }
    });
  }
  function preparar(premio) {
    var minha = ++geracao; foto = null; video = null; dataUrl = '';
    var fontes = document.fonts && document.fonts.load ? Promise.all([
      document.fonts.load('400 100px Bungee'), document.fonts.load('700 40px Barlow'), document.fonts.load('600 40px Barlow')
    ]).catch(function () {}) : Promise.resolve();
    var img = new Promise(function (ok) { if (mascote.complete) ok(); else { mascote.onload = mascote.onerror = ok; } });
    pronto = Promise.all([fontes, img]).then(function () {
      var L = camadas(premio, 1), c = tela(L.w, L.h);
      quadro(c.getContext('2d'), L, 3.3); // quadro logo depois do JACKPOT, com confete
      dataUrl = c.toDataURL('image/png');
      return new Promise(function (ok) {
        c.toBlob(function (b) {
          try { if (b && minha === geracao) foto = new File([b], 'premio-gabba.png', { type: 'image/png' }); } catch (e) {}
          ok();
        }, 'image/png');
      });
    }).then(function () { return gravar(premio, minha); });
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
  function pode(f) { try { return !!(f && navigator.canShare && navigator.canShare({ files: [f] })); } catch (e) { return false; } }
  function postar() {
    var f = pode(video) ? video : pode(foto) ? foto : null;
    if (f) return navigator.share({ files: [f] }).catch(function () {});
    if (dataUrl) { mostrar(); return Promise.resolve(); }
    if (pronto) return pronto.then(mostrar);
    return Promise.resolve();
  }
  window.GabbaStory = {
    preparar: preparar, postar: postar,
    _estado: function () { return { foto: !!foto, video: video ? video.size : 0, tipo: tipoVideo() }; },
    _video: function () { return video; }, _camadas: camadas, _quadro: quadro
  };
})();
