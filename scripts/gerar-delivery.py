"""
Gera delivery/index.html (Fliperama para clientes de delivery) a partir de jogos/index.html.
A versão delivery é igual à da mesa, sem o Desafio da Espera (que dá prêmio na mesa).
Rode sempre que mudar jogos/index.html:  python3 scripts/gerar-delivery.py
"""
import pathlib, re
raiz = pathlib.Path(__file__).resolve().parent.parent
s = (raiz / 'jogos' / 'index.html').read_text(encoding='utf-8')
s, n = re.subn(r'\s*<!-- SO-MESA-INICIO -->.*?<!-- SO-MESA-FIM -->', '', s, flags=re.S)
assert n == 1, 'marcadores SO-MESA não encontrados'
s, n = re.subn(r'<!-- TEXTO-SUB -->.*?<!-- /TEXTO-SUB -->', 'Seu pedido tá a caminho. Enquanto isso, bora jogar?', s, flags=re.S)
assert n == 1, 'marcador TEXTO-SUB não encontrado'
s = s.replace('<html lang="pt-BR">', '<html lang="pt-BR">\n<!-- ARQUIVO GERADO por scripts/gerar-delivery.py a partir de jogos/index.html. Não edite aqui. -->', 1)
(raiz / 'delivery').mkdir(exist_ok=True)
(raiz / 'delivery' / 'index.html').write_text(s, encoding='utf-8')
print('delivery/index.html gerado')
