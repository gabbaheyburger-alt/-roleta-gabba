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

Jogo para o cliente jogar no celular enquanto espera o lanche, pelo QR code da mesa. As camadas do burger passam deslizando e o cliente toca para soltar cada uma. Quem montar 18 camadas ganha o prêmio do dia. Cada celular tem 3 tentativas por dia.

- Endereço: `/desafio/` dentro do site da roleta.
- A meta e o prêmio ficam no topo do script de `desafio/index.html` (`TARGET`, `PRIZE` e `MAX_TRIES`).
- A tela do prêmio mostra a data e um relógio correndo, para o atendente conferir que não é print. O atendente toca em "marcar como entregue" para o prêmio não ser usado duas vezes no mesmo celular.

## Arquivos

- `index.html`: a roleta inteira (visual, regras, relatório e animação) em um único arquivo.
- `desafio/index.html`: o jogo Desafio da Espera.
