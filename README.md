# Roleta Gabba

Roleta de prêmios do Gabba Hey Burger, em Paracuru (CE).

## Como usar

- Abra o site da roleta no tablet ou celular da loja e toque em **GIRAR**.
- Use sempre o mesmo aparelho: prêmios, PIN e registro de giros ficam salvos só nele.

## Área da loja

- Toque em **Área da loja**. Na primeira vez, crie um PIN de 4 a 8 números.
- **Giros do dia:** quantos giros saíram, quais prêmios e quanto custaram. Dá para escolher outro dia, copiar o resumo para o WhatsApp ou baixar a planilha com todos os giros.
- **Prêmios:** nome, peso (chance) e custo de cada prêmio. Peso 2 sai duas vezes mais que peso 1.
- A área tranca sozinha depois de 10 minutos sem uso, ou no botão **Trancar**.

O PIN é uma trava contra clientes curiosos, não uma proteção forte. Não guarde nada sigiloso aqui.

## Desafio da Espera

Jogo para o cliente jogar no celular enquanto espera o lanche, pelo QR code da mesa. As camadas do burger passam deslizando e o cliente toca para soltar cada uma. Quem montar 15 camadas ganha o prêmio do dia.

- Endereço: `/desafio/` dentro do site da roleta.
- A meta e o prêmio ficam no topo do script de `desafio/index.html` (`TARGET` e `PRIZE`).
- A tela do prêmio mostra a data e um relógio correndo, para o atendente conferir que não é print. O atendente toca em "marcar como entregue" para o prêmio não ser usado duas vezes no mesmo celular.

## Fliperama Gabba

Central de jogos rápidos para o cliente passar o tempo enquanto espera, no endereço `/jogos/`:

- **Memória Gabba:** achar os 8 pares de itens do cardápio.
- **Quiz do Gabba:** 8 perguntas sorteadas sobre hambúrguer, rock e Ceará, com 15 segundos cada. Responder rápido vale mais pontos.
- **Gabba Hero:** jogo de ritmo com 3 músicas.
- **Corre, Gabba!:** corrida com o mascote.
- **Obby do Gabba:** percurso 3D.
- **Gabba Crush:** combinar 3 iguais e estourar o item sorteado.
- Atalho para o **Desafio da Espera**.

Os recordes ficam salvos no celular de cada cliente. As perguntas do quiz ficam na lista `BANK` dentro de `jogos/index.html`.

## Área do dono (prêmio do Desafio)

`adm/index.html` permite ao dono trocar, pelo celular, o prêmio do Desafio da Espera, a quantidade de camadas e se o desafio está valendo prêmio. A página grava `desafio/config.json` neste repositório pela API do GitHub, usando uma chave pessoal (fine-grained token, só este repositório, Contents: Read and write) que fica salva apenas no celular do dono. O Desafio lê esse arquivo ao abrir; se não conseguir, usa os valores padrão do código.

## Fliperama Delivery

`delivery/index.html` é o Fliperama para clientes de delivery: igual ao da mesa, **sem o Desafio da Espera** (que dá prêmio na mesa) e com o texto "Seu pedido tá a caminho". O arquivo é **gerado** a partir de `jogos/index.html`; depois de mudar o Fliperama, rode `python3 scripts/gerar-delivery.py`. O bloco que só existe na mesa fica entre os marcadores `SO-MESA-INICIO` e `SO-MESA-FIM`. Dentro dos jogos, o botão "‹ Jogos" volta para a versão em que o cliente entrou.

## Monte o Combo (teste)

Substituto em teste do Desafio da Espera, no endereço `/combo/`, ainda fora do Fliperama. Três fases na mesma partida: **Burger** (empilhar 7 camadas), **Batata** (tocar à esquerda ou à direita para mudar a caixinha de faixa, entre 3 faixas, e pegar 12 batatas, fugindo da pimenta; 3 erros e perde) e **Refri** (segurar para encher e soltar dentro da faixa verde). Só ganha quem completa as três.

- Prêmio e liga/desliga vêm do mesmo `desafio/config.json` da área do dono.
- Cada celular tem **3 chances por dia** valendo prêmio; depois disso joga só pela diversão.
- A dificuldade fica no topo do script de `combo/index.html` (`CHANCES`, `BURGER_META`, `BATATA_META`, `BATATA_ERROS`, `REFRI_FAIXA`).
- Abrir com `/combo/?teste` joga sem gastar chance, sem prêmio e sem contar no GoatCounter.
- Eventos: `partida-combo`, `combo-passou-<fase>`, `combo-perdeu-<fase>`, `combo-venceu` e `combo-completou-sem-premio`, para ver em qual fase o pessoal para.

## Gabba Crush

Jogo de combinar 3 iguais (estilo Candy Crush), no Fliperama, no endereço `/crush/`. Por enquanto é **só mais um jogo, sem prêmio** (`VALE_PREMIO = false`). O cliente arrasta um item (ou toca em um e depois no vizinho) para trocar de lugar e formar fileiras de 3 ou mais iguais. A cada partida é sorteado um item (batata, burger, refri, chopp ou queijo) e a meta é estourar **25 dele em 12 jogadas** (numa simulação, um jogador razoável ganha em cerca de 11 a 14% das partidas). O placar mostra quantas vezes o cliente já venceu.

- Para virar jogo de prêmio: `VALE_PREMIO = true`. Aí usa o prêmio do `desafio/config.json` e 3 chances por dia por celular.
- `?teste` joga sem contar no GoatCounter.
- Dificuldade no topo do script de `crush/index.html` (`META`, `JOGADAS`, `CHANCES`).
- Eventos: `partida-crush`, `crush-venceu-sem-premio` (ou `crush-venceu` quando valer prêmio), `crush-perdeu` e `crush-perdeu-faltou-1a2` / `3a5` / `mais5`.

## Brindes do dia (servidor + tela da recepção)

Servidor próprio, separado do servidor do ponto: `servidor-brindes/` (Cloudflare Worker `gabba-brindes`, com Durable Object e SQLite). A recepção lança os brindes do dia em `/recepcao/` (PIN, funciona no celular e no notebook ao mesmo tempo). Eles formam uma fila, na ordem lançada. Quando um cliente vence o jogo do prêmio (Pedido Certo ou Quiz), o jogo reserva **o primeiro brinde da fila** e mostra um **código de 4 letras**; a recepção digita o código (ou toca em "Dar baixa" na lista) e entrega. Se o cliente não aparecer, "Devolver" põe o brinde de volta no começo da fila. Fila vazia = os jogos avisam "brindes de hoje esgotados" e não prometem prêmio; o Fliperama mostra quantos restam.

- Liga quando `desafio/config.json` tem `"servidor": "https://gabba-brindes.<conta>.workers.dev"`. Sem esse campo, tudo funciona como antes (prêmio único da área do dono, baixa no celular do cliente).
- PIN da recepção: segredo `PIN_RECEPCAO` no painel do Cloudflare (Settings › Variables & Secrets). Nunca no código.
- Um aparelho ganha no máximo 1 brinde por dia; a reserva é feita no servidor, então dois clientes nunca levam o mesmo último brinde (testado com 10 vitórias simultâneas).
- Publicação: Workers Builds ligado a este repositório, com *Root directory* `servidor-brindes` e *Build watch paths* `servidor-brindes/*`. Teste local: `cd servidor-brindes && npm install && npx wrangler dev` (o PIN de teste fica em `.dev.vars`, fora do git).
- Ligação dos jogos: `comum/brindes.js`.

## Jogo que vale prêmio (escolhido na área do dono)

A área do dono (`/adm/`) grava em `desafio/config.json`: `premio`, `ativo` (liga/desliga), **`jogo`** (`pedido` ou `quiz`: qual jogo vale prêmio) e **`memoria`** (liga/desliga o pedido de memória do Pedido Certo). Sem o campo `jogo`, vale o Pedido Certo. O Fliperama da mesa mostra em destaque o jogo escolhido (selo "Vale prêmio") e esconde o cartão comum dele; no delivery nenhum jogo vale prêmio.

## Quiz do Gabba (estilo Show do Milhão)

Página `/quiz/`. São 10 perguntas que ficam mais difíceis e mais rápidas: 3 fáceis (10 s), 3 médias (9 s), 3 difíceis (8 s) e a pergunta do prêmio (9 s). Errou ou acabou o tempo, a partida termina. Dá para pular 1 pergunta por partida (menos a do prêmio). Quando o Quiz é o jogo do prêmio, quem acerta a 10ª ganha (3 chances por dia por celular, mesma tela de PARABÉNS / RESGATAR AGORA do Pedido Certo). As perguntas (91, incluindo as do nome Gabba e dos Ramones) ficam na lista `BANCO` (uma lista por nível, a primeira opção é a certa) e os tempos em `NIVEIS`, no topo do script. Eventos: `partida-quiz`, `quiz-parou-<n>` (em qual pergunta parou), `quiz-venceu` e `quiz-venceu-sem-premio`.

O quiz antigo de 8 perguntas, dentro de `jogos/index.html`, não é mais aberto pelo Fliperama.

## Pedido Certo (jogo do prêmio)

**Desde 04/11/2026 é o jogo que vale prêmio no Fliperama da mesa, no lugar do Desafio da Espera.** O endereço antigo `/desafio/` redireciona para `/pedido/`, então QRs antigos continuam funcionando. O prêmio e o liga/desliga continuam no `desafio/config.json`, alterados pela área do dono (`/adm/`); o campo de camadas ficou escondido porque o Pedido Certo não usa.

Jogo de cozinha (estilo Cooking Fever) no endereço `/pedido/`. Chega uma comanda e o cliente toca nos ingredientes na ordem certa (pão, recheios, pão e às vezes batata, refri ou chopp junto). Meta: **8 pedidos em 60 segundos**, com +2 s por pedido certo; 3 erros encerram o turno. Os pedidos crescem, a partir do 4º os botões trocam de lugar e no 6º vem um pedido de memória: a comanda some depois de alguns segundos (só uma vez por partida; depois volta ao normal).

- Vale prêmio (`VALE_PREMIO = true`): 3 chances por dia por celular; depois joga pela diversão. Com `false` vira jogo sem prêmio e o placar mostra o recorde de pedidos.
- Dificuldade no topo do script de `pedido/index.html` (`META`, `TEMPO`, `BONUS`, `ERROS`, `EMBARALHA_DESDE`, `DECORAR_DESDE`).
- `?teste` joga sem contar no GoatCounter.
- Eventos: `partida-pedido`, `pedido-venceu-sem-premio` (ou `pedido-venceu`), `pedido-perdeu-tempo` e `pedido-perdeu-erros`.

## Chapa do Gabba (teste)

Jogo em teste, fora do Fliperama, no endereço `/chapa/`. O jogador monta os pedidos seguindo a comanda e tira a carne da chapa no ponto certo. Perdeu 3 pedidos por tempo, acaba o turno.

## Obby do Gabba

Percurso 3D no navegador, dentro do Fliperama, no endereço `/obby/`. O personagem atravessa burgers, batatas, copos de chopp e plataformas móveis sem cair no mar de ketchup, com 3 bandeiras de checkpoint e moedas. Usa a biblioteca three.js.

## Corre, Gabba!

Jogo de corrida com o mascote do Gabba Hey Burger, dentro do Fliperama, no endereço `/corre/`. Toque para pular (toque de novo no ar para pulo duplo), desvie de caixas de som, pimentas e cones e pegue batatas. A velocidade aumenta com o tempo. A imagem do mascote fica em `corre/mascote.png`.

## Visual padrão (neon)

Todos os jogos usam `comum/neon.css` e `comum/neon.js`: fundo escuro com brilho verde e laranja, botões em degradê laranja e telas de início/fim (`.overlay`) dentro de um cartão com brilho e ícone redondo. Nas telas de início o cartão flutua, o título fica em degradê e as regras viram mini cartões coloridos.

- Cor do brilho pela tela: `data-kind="start"` (laranja), `win` (verde), `err` (vermelho), `time` (amarelo), `info` (azul).
- Ícone: `data-icon="🎁"` na `.overlay`. Para trocar na hora pelo código do jogo: `neonKind('over', 'win', '🏆')`.
- Jogo novo: colocar `<link rel="stylesheet" href="../comum/neon.css">` e `<script src="../comum/neon.js" defer></script>` no fim do `<head>`.
- O Fliperama (`jogos/`) e o Pedido Certo têm o mesmo visual feito direto na página.

## Contador de uso

`contador.js` conta, sem cookies e sem dados pessoais, os acessos a cada página e as partidas iniciadas em cada jogo, usando o GoatCounter. Está ligado com a conta `gabbajogos` (variável `CODIGO`); para desligar, deixe a variável vazia. O relatório por dia fica no painel do GoatCounter.

Eventos registrados: `partida-memoria`, `partida-quiz`, `partida-corre`, `partida-obby`, `partida-desafio`, `partida-chapa` e `desafio-venceu`.

## Termômetro da Loja (teste, só Gabba Hey Burger)

Página `/avalie/` para o cliente avaliar a visita com um toque (😍 Amei, 😐 Foi ok, 😡 Não curti). Cada voto vira um evento no GoatCounter no formato `aval-gabba-<turno>-<voto>`, com turno `almoco` (6h às 16h) ou `noite`. Quem toca em "Foi ok" ou "Não curti" recebe um botão para falar no WhatsApp do dono. Cada celular avalia uma vez por dia.

## Vire um Gabba (teste)

Filtro de câmera no endereço `/vire/`: coloca o moicano e os óculos do mascote no rosto do cliente (detecção de rosto MediaPipe, roda no próprio celular, nada é enviado) e gera uma foto 4:5 com a moldura "Eu virei um Gabba! @gabbaburger" para compartilhar. Sem detecção, os acessórios ficam fixos e o cliente encaixa o rosto. Eventos: `vire-abriu`, `vire-foto`, `vire-compartilhou`, `vire-salvou`.

## Gabba Hero

Jogo de ritmo no endereço `/hero/`, com 3 músicas originais tocadas pelo próprio aparelho: **Chapa Quente** (punk, 168 BPM), **Baião do Gabba** (forró rock com sanfona e zabumba, 138 BPM) e **Moicano Metal** (bumbo duplo, 150 BPM). As notas do jogador seguem a melodia: quem acerta toca o solo. Modos Fácil e Rock, notas estrela que enchem o GABBA POWER (pontos em dobro por 8 s), plateia pulando, anúncio de seção e virada de bateria. Evento: `partida-hero`.

## Checklist de abertura (lojas)

Página para o funcionário conferir o setor ao chegar, no endereço `/checklist/` (hoje: chapa do Gabba Hey Burger, prazo 17h00).

- Cada item tem OK / POUCO / FALTA. FALTA exige motivo. Qualquer item pode ter observação.
- Envia para o formulário "Checklist Abertura", que grava na planilha CHECKLISTS: uma linha por item com problema ou observação e uma linha RESUMO no fim.
- Itens de reposição em FALTA podem ir também como pedido de insumo, no mesmo formulário da página de pedidos.
- Nomes da equipe, itens e prazo ficam em `checklist/config.json`. Novos setores ou lojas entram no mesmo arquivo; abrir com `?loja=gabba&setor=chapa`.

## Arquivos

- `contador.js`: contador de uso dos jogos.
- `index.html`: a roleta inteira (visual, regras, relatório e animação) em um único arquivo.
- `desafio/index.html`: o jogo Desafio da Espera.
- `desafio/config.json`: prêmio, camadas e liga/desliga do Desafio (alterado pela área do dono).
- `adm/index.html`: área do dono para trocar o prêmio.
- `jogos/index.html`: o Fliperama Gabba (versão mesa).
- `delivery/index.html`: o Fliperama Delivery (gerado por `scripts/gerar-delivery.py`).
- `combo/index.html`: o jogo Monte o Combo (teste).
- `crush/index.html`: o jogo Gabba Crush.
- `pedido/index.html`: o jogo Pedido Certo (jogo do prêmio).
- `chapa/index.html`: o jogo Chapa do Gabba (teste).
- `obby/index.html`: o Obby do Gabba em 3D.
- `avalie/index.html`: o Termômetro da Loja.
- `vire/index.html`: o filtro Vire um Gabba (teste).
- `hero/index.html`: o jogo Gabba Hero.
- `corre/index.html` e `corre/mascote.png`: o jogo Corre, Gabba!.

## Link da bio (Instagram)

Página `/bio/` para colocar no link da bio do Instagram, no lugar do bio.site. Botão principal **Pedir delivery** (cardápio online do Saipos), WhatsApp, Jam Session, cardápio da loja, como chegar e o Fliperama Delivery. Cada clique vira um evento no GoatCounter O topo mostra a logo (`bio/logo.png`), "Aberto agora" ou "Fechado" pelo horário (seg a qui 17h–22h30, sex a dom 17h–23h30) e destaca o happy hour (seg a sex 17h–20h); os horários ficam no script do fim da página. (`bio-pedir`, `bio-whatsapp`, `bio-jam`, `bio-cardapio-loja`, `bio-localizacao`, `bio-fliperama`, `bio-instagram`), para saber qual botão os clientes mais usam. Os links ficam direto no `bio/index.html`.

### Área do dono da bio

`bio/adm/` deixa o dono mudar pelo celular, sem mexer em código: **fechado hoje** (volta ao normal sozinho no dia seguinte), **aviso no topo**, **horário de cada dia**, **happy hour** (dias e horário), a promoção **Poste e ganhe** do Vire um Gabba (aparece na bio e no filtro) e os **links dos botões**. Grava `bio/config.json` pela API do GitHub, com a mesma chave da área do Desafio (`adm/`). A bio lê esse arquivo ao abrir; se não conseguir, usa os valores padrão do script.

## Bio realista (teste)

`/bio2/` é uma versão da bio com fotos e vídeos reais da casa: capa com foto em tela cheia, destaques em vídeo (estilo stories), carrosséis "Da cozinha" e "Do bar", happy hour, Vire um Gabba, horários e mapa. Usa o mesmo `bio/config.json` (status, aviso, happy hour, Poste e ganhe e links), então o `bio/adm/` controla as duas. Fotos em `bio2/img/`, vídeos (H.264, 720p, sem som) em `bio2/vid/`. Nomes, descrições e preços ficam nas listas `COZINHA`, `BAR` e `VIDEOS` no fim de `bio2/index.html`; preço vazio não aparece. Cliques contam como `bio2-*` no GoatCounter.

## Bio "O Gabba agora" (teste)

`/bio3/` tem a seção **Especiais do mês** (Burger do mês, No Bread e Harmonização, editável direto no HTML) e a primeira tela inteira com vídeo ou foto, que muda conforme o horário: **antes de abrir** (cozinha se preparando, "Abrimos às 17h", botão Ver cardápio), **happy hour** (caipirinha, "Happy hour rolando", botão Como chegar, drinks primeiro), **noite** (Fritas Cordel, "A chapa tá quente", botão Pedir delivery, comida primeiro) e **fechado** (brownie, "Até amanhã!"). Usa as fotos e vídeos de `bio2/` e o mesmo `bio/config.json`. Para ver cada momento: `/bio3/?momento=antes`, `happy`, `noite` ou `fechado`. Eventos `bio3-*`, incluindo `bio3-momento-<momento>`.

### Vitrine da bio3 (área do dono)

`bio3/adm/` edita `bio3/vitrine.json`: os **Especiais do mês** (o primeiro vira o card grande), os carrosséis de **Comida** e **Drinks** (nome, descrição, preço, foto, foto alternada, esconder, ordem, apagar, adicionar) , a **Agenda de eventos** (data, horário, nome, detalhes e cartaz; some sozinho depois que passa e aparece na capa no dia) , os **títulos** das seções em cada horário e a **ordem** das partes da página (arrastando pelo ☰; os cards também podem ser arrastados). Fotos novas vêm da galeria do celular, são reduzidas para no máximo 900 px e enviadas para `bio3/fotos/`. Mesma chave do GitHub das outras áreas do dono. Vídeos continuam sendo preparados à parte (em `bio2/vid/`) e escolhidos numa lista.

## Assistente de escolha (bio3)

**Desligado (out/2026).** Para religar: em `bio3/index.html`, tirar o `hidden` do bloco `.ass-home` e voltar a carregar `../assistente/assistente.js`. Era um card "Não sabe o que pedir?" na capa da bio3. Abre uma janela com campo de texto, atalhos (Pouca fome, Muita fome, Sem carne, Sem pão) e "Encontrar minha pedida".

- `assistente/cardapio.json`: o cardápio oficial transcrito (fonte única do assistente). Para mudar preço ou produto, edite aqui; não precisa mexer no serviço.
- `assistente/worker.js`: o serviço separado (Cloudflare Worker) que chama a OpenAI. A chave fica só na Cloudflare, na variável secreta `OPENAI_API_KEY`. Tem limite por pessoa (6 por minuto, 40 por dia), limite diário total (`LIMITE_DIA_TOTAL`, padrão 800), mensagem de até 300 letras, tempo máximo de 15 s e só aceita pedidos vindos do site. Nome e preço mostrados sempre saem do cardápio, nunca da IA.
- `assistente/config.json`: endereço do serviço (`url`). **Vazio = modo demonstração sem IA**, com regras simples, identificado na tela por uma etiqueta amarela.
- `assistente/assistente.js`: a janela na página.
- `assistente/copiar.html`: página de apoio com botão para copiar o código do serviço.
- Eventos no GoatCounter: `bio3-assistente-abriu`, `bio3-assistente-pediu`, `bio3-assistente-cardapio`, `bio3-assistente-whatsapp`.

## Ponto interno (Gabba)

Controle interno de horário da equipe, **não é ponto eletrônico legal**.

- `ponto/?loja=gabba`: página da equipe. A pessoa toca no nome e em Entrada, Saída para intervalo, Volta do intervalo ou Saída. Só registra se o celular estiver na **internet da loja** (o serviço compara o IP: IPv4 inteiro, IPv6 pela rede /64). Dá para desfazer até 3 minutos depois.
- `ponto/adm/`: painel do dono, com PIN (5 erros = 15 min bloqueado). Abas Hoje (status, atraso, intervalo, horas), Semana (horas por dia, alertas, CSV), Registros (remover/restaurar, lançar esquecido) e Internet (liberar a internet da loja, recusas, trocar PIN).
- `ponto/config.json`: equipe, setores, dias (ex.: Jandira só seg e ter no Gabba), horários e tolerância de atraso.
- Serviço: `assistente/ponto.js`, dentro do mesmo Worker da Cloudflare (`gabba-assistente`), com os dados num Durable Object (SQLite). Publicado automaticamente quando há mudança na pasta `assistente/` do GitHub.
- Registros até 05:00 contam para o dia anterior (turno que passa da meia-noite).
