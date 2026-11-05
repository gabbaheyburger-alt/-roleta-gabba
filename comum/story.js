/* Story "Hoje fui premiado no Gabba".
   GabbaStory.preparar(premio): assim que a tela de PARABÉNS aparece, monta a foto (1080x1920)
   e grava um vídeo curto (6 s, 720x1280) com o prêmio pulsando e o GABBA piscando em neon.
   GabbaStory.postar(): abre o menu de compartilhar do celular (Instagram > Story).
   Vai o vídeo se ficou pronto e o celular aceita; senão vai a foto; senão mostra a foto para salvar. */
(function () {
  var W = 1080, H = 1920, SEG = 6, FPS = 30;
  var foto = null, video = null, dataUrl = '', pronto = null, geracao = 0;
  var mascote = new Image(); mascote.src = '../corre/mascote.png';
  var FONTE = 'Bungee, Impact, sans-serif';

  function tela(w, h) { var c = document.createElement('canvas'); c.width = w; c.height = h; return c; }
  function glow(ctx, x, y, r, cor) {
    var g = ctx.createRadialGradient(x, y, 0, x, y, r);
    g.addColorStop(0, cor); g.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
  }
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
  function caixa(ctx, x, y, w, h, r) { ctx.beginPath(); if (ctx.roundRect) ctx.roundRect(x, y, w, h, r); else ctx.rect(x, y, w, h); }

  var CARD = { x: 90, y: 1030, w: W - 180, h: 420 };
  var PREMIO_Y = CARD.y + 100 + (CARD.h - 100) / 2;
  var BRILHOS = [[120, 560], [960, 520], [180, 980], [930, 990], [70, 1300], [1010, 1250], [250, 1520], [840, 1560], [540, 250], [140, 760], [950, 760], [700, 1480]];

  /* Camadas desenhadas uma vez (no tamanho final k = escala) */
  function camadas(premio, k) {
    var w = Math.round(W * k), h = Math.round(H * k), L = {};
    function nova() { var c = tela(w, h), x = c.getContext('2d'); x.scale(k, k); x.textAlign = 'center'; x.textBaseline = 'middle'; return { c: c, x: x }; }

    var b = nova(), ctx = b.x;
    ctx.fillStyle = '#07080a'; ctx.fillRect(0, 0, W, H);
    glow(ctx, 160, 420, 700, 'rgba(61,220,132,.28)');
    glow(ctx, 960, 1000, 700, 'rgba(255,45,111,.26)');
    glow(ctx, 300, 1650, 700, 'rgba(255,170,0,.24)');
    ctx.font = '170px sans-serif'; ctx.fillStyle = '#fff'; ctx.fillText('🎁', W / 2, 380);
    ctx.font = '400 ' + tamanho(ctx, 'HOJE FUI PREMIADO', 940, 104) + 'px ' + FONTE;
    escrever(ctx, 'HOJE FUI PREMIADO', W / 2, 580, '#ffffff', 'rgba(255,255,255,.6)', 24);
    ctx.font = '400 86px ' + FONTE;
    escrever(ctx, 'NO', W / 2, 690, '#ffffff', 'rgba(255,255,255,.5)', 20);
    caixa(ctx, CARD.x, CARD.y, CARD.w, CARD.h, 48); ctx.fillStyle = 'rgba(20,40,28,.55)'; ctx.fill();
    ctx.font = '700 46px Barlow, sans-serif'; ctx.fillStyle = '#3ddc84';
    ctx.fillText('G A N H E I', W / 2, CARD.y + 80);
    if (mascote.complete && mascote.naturalWidth) {
      var mh = 230, mw = mascote.naturalWidth * mh / mascote.naturalHeight;
      ctx.shadowColor = 'rgba(232,16,46,.8)'; ctx.shadowBlur = 40;
      ctx.drawImage(mascote, W / 2 - mw / 2, 1500, mw, mh); ctx.shadowBlur = 0;
    }
    var d = new Date(), p = function (n) { return (n < 10 ? '0' : '') + n; };
    ctx.font = '600 44px Barlow, sans-serif'; ctx.fillStyle = '#e9e3dd';
    ctx.fillText('Fliperama Gabba · ' + p(d.getDate()) + '/' + p(d.getMonth() + 1) + '/' + d.getFullYear(), W / 2, 1790);
    L.base = b.c;

    function gabba(forte) {
      var g = nova(), x = g.x;
      x.font = '400 ' + tamanho(x, 'GABBA', 900, 280) + 'px ' + FONTE;
      var gr = x.createLinearGradient(160, 0, 920, 0);
      if (forte) { gr.addColorStop(0, '#ffc45c'); gr.addColorStop(.5, '#ff6a33'); gr.addColorStop(1, '#ff1f3d'); }
      else { gr.addColorStop(0, '#7a5320'); gr.addColorStop(.5, '#7a3418'); gr.addColorStop(1, '#6e0a18'); }
      escrever(x, 'GABBA', W / 2, 860, gr, forte ? 'rgba(255,100,40,.95)' : 'rgba(255,90,40,.25)', forte ? 60 : 14);
      return g.c;
    }
    L.gabbaOn = gabba(true); L.gabbaOff = gabba(false);

    function prem(forte) {
      var g = nova(), x = g.x, P = linhas(x, premio.toUpperCase(), W - 280, 132), lh = P.s * 1.12;
      x.font = '400 ' + P.s + 'px ' + FONTE;
      P.ls.forEach(function (l, i) {
        var y = PREMIO_Y + (i - (P.ls.length - 1) / 2) * lh;
        escrever(x, l, W / 2, y, forte ? '#ffe680' : '#f2c230', forte ? 'rgba(255,190,0,1)' : 'rgba(255,170,0,.6)', forte ? 56 : 22);
      });
      return g.c;
    }
    L.premOn = prem(true); L.premOff = prem(false);
    L.w = w; L.h = h; L.k = k;
    return L;
  }

  /* Um quadro do vídeo no tempo t (segundos) */
  function quadro(ctx, L, t) {
    var k = L.k, pulso = .5 + .5 * Math.sin(t * Math.PI * 2 / 1.6);
    ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.globalAlpha = 1;
    ctx.drawImage(L.base, 0, 0);
    // GABBA: aceso, pulsando, com uma piscada de letreiro a cada 3 s
    var c = t % 3, apagado = (c > 2.1 && c < 2.18) || (c > 2.28 && c < 2.34);
    ctx.drawImage(L.gabbaOff, 0, 0);
    if (!apagado) { ctx.globalAlpha = .75 + .25 * pulso; ctx.drawImage(L.gabbaOn, 0, 0); ctx.globalAlpha = 1; }
    // moldura tracejada andando
    ctx.setTransform(k, 0, 0, k, 0, 0);
    ctx.save(); ctx.setLineDash([22, 16]); ctx.lineDashOffset = -t * 60; ctx.lineWidth = 6;
    ctx.strokeStyle = 'rgba(61,220,132,' + (.65 + .35 * pulso) + ')';
    ctx.shadowColor = 'rgba(61,220,132,.8)'; ctx.shadowBlur = 18 + 16 * pulso;
    caixa(ctx, CARD.x, CARD.y, CARD.w, CARD.h, 48); ctx.stroke(); ctx.restore();
    // prêmio crescendo e brilhando
    var s = 1 + .07 * pulso, cx = W / 2 * k, cy = PREMIO_Y * k;
    ctx.setTransform(s, 0, 0, s, cx - cx * s, cy - cy * s);
    ctx.drawImage(L.premOff, 0, 0);
    ctx.globalAlpha = pulso; ctx.drawImage(L.premOn, 0, 0); ctx.globalAlpha = 1;
    // estrelinhas piscando
    ctx.setTransform(k, 0, 0, k, 0, 0);
    BRILHOS.forEach(function (b, i) {
      var a = Math.max(0, Math.sin(t * 2.4 + i * 1.7));
      if (a < .05) return;
      var r = 10 + 8 * a;
      ctx.globalAlpha = a; ctx.fillStyle = i % 3 ? '#ffe680' : '#ffffff';
      ctx.shadowColor = '#ffd23f'; ctx.shadowBlur = 20;
      ctx.beginPath(); ctx.moveTo(b[0], b[1] - r); ctx.lineTo(b[0] + r / 4, b[1] - r / 4); ctx.lineTo(b[0] + r, b[1]);
      ctx.lineTo(b[0] + r / 4, b[1] + r / 4); ctx.lineTo(b[0], b[1] + r); ctx.lineTo(b[0] - r / 4, b[1] + r / 4);
      ctx.lineTo(b[0] - r, b[1]); ctx.lineTo(b[0] - r / 4, b[1] - r / 4); ctx.closePath(); ctx.fill();
    });
    ctx.globalAlpha = 1; ctx.shadowBlur = 0; ctx.setTransform(1, 0, 0, 1, 0, 0);
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
      quadro(c.getContext('2d'), L, .4); // quadro com o brilho no alto
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
