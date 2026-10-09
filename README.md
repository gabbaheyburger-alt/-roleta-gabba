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
- Atalho para o **Desafio da Espera**.

Os recordes ficam salvos no celular de cada cliente. As perguntas do quiz ficam na lista `BANK` dentro de `jogos/index.html`.

## Área do dono (prêmio do Desafio)

`adm/index.html` permite ao dono trocar, pelo celular, o prêmio do Desafio da Espera, a quantidade de camadas e se o desafio está valendo prêmio. A página grava `desafio/config.json` neste repositório pela API do GitHub, usando uma chave pessoal (fine-grained token, só este repositório, Contents: Read and write) que fica salva apenas no celular do dono. O Desafio lê esse arquivo ao abrir; se não conseguir, usa os valores padrão do código.

## Fliperama Delivery

`delivery/index.html` é o Fliperama para clientes de delivery: igual ao da mesa, **sem o Desafio da Espera** (que dá prêmio na mesa) e com o texto "Seu pedido tá a caminho". O arquivo é **gerado** a partir de `jogos/index.html`; depois de mudar o Fliperama, rode `python3 scripts/gerar-delivery.py`. O bloco que só existe na mesa fica entre os marcadores `SO-MESA-INICIO` e `SO-MESA-FIM`. Dentro dos jogos, o botão "‹ Jogos" volta para a versão em que o cliente entrou.

## Chapa do Gabba (teste)

Jogo em teste, fora do Fliperama, no endereço `/chapa/`. O jogador monta os pedidos seguindo a comanda e tira a carne da chapa no ponto certo. Perdeu 3 pedidos por tempo, acaba o turno.

## Obby do Gabba

Percurso 3D no navegador, dentro do Fliperama, no endereço `/obby/`. O personagem atravessa burgers, batatas, copos de chopp e plataformas móveis sem cair no mar de ketchup, com 3 bandeiras de checkpoint e moedas. Usa a biblioteca three.js.

## Corre, Gabba!

Jogo de corrida com o mascote do Gabba Hey Burger, dentro do Fliperama, no endereço `/corre/`. Toque para pular (toque de novo no ar para pulo duplo), desvie de caixas de som, pimentas e cones e pegue batatas. A velocidade aumenta com o tempo. A imagem do mascote fica em `corre/mascote.png`.

## Contador de uso

`contador.js` conta, sem cookies e sem dados pessoais, os acessos a cada página e as partidas iniciadas em cada jogo, usando o GoatCounter. Fica desligado enquanto a variável `CODIGO` estiver vazia; para ligar, coloque nela o código da conta (o `xxx` de `xxx.goatcounter.com`). O relatório por dia fica no painel do GoatCounter.

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

`bio3/adm/` edita `bio3/vitrine.json`: os **Especiais do mês** (o primeiro vira o card grande), os carrosséis de **Comida** e **Drinks** (nome, descrição, preço, foto, foto alternada, esconder, ordem, apagar, adicionar) e os **títulos** das seções em cada horário. Fotos novas vêm da galeria do celular, são reduzidas para no máximo 900 px e enviadas para `bio3/fotos/`. Mesma chave do GitHub das outras áreas do dono. Vídeos continuam sendo preparados à parte (em `bio2/vid/`) e escolhidos numa lista.
