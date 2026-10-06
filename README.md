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
- **Caça ao Burger:** 30 segundos para tocar nos burgers (+1) e fugir dos queimados (−2).
- Atalho para o **Desafio da Espera**.

Os recordes ficam salvos no celular de cada cliente. As perguntas do quiz ficam na lista `BANK` dentro de `jogos/index.html`.

## Chapa do Gabba (teste)

Jogo em teste, fora do Fliperama, no endereço `/chapa/`. O jogador monta os pedidos seguindo a comanda e tira a carne da chapa no ponto certo. Perdeu 3 pedidos por tempo, acaba o turno.

## Obby do Gabba (teste)

Percurso 3D no navegador, fora do Fliperama, no endereço `/obby/`. O personagem atravessa burgers, batatas, copos de chopp e plataformas móveis sem cair no mar de ketchup, com 3 bandeiras de checkpoint e moedas. Usa a biblioteca three.js.

## Arquivos

- `index.html`: a roleta inteira (visual, regras, relatório e animação) em um único arquivo.
- `desafio/index.html`: o jogo Desafio da Espera.
- `jogos/index.html`: o Fliperama Gabba.
- `chapa/index.html`: o jogo Chapa do Gabba (teste).
- `obby/index.html`: o Obby do Gabba em 3D (teste).
