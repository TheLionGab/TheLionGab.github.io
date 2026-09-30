# Yuri Coimbra Finance

Live: https://theliongab.github.io/index.html

Mesa de cotações estática (GitHub Pages), sem build.

Fontes, em ordem fixa por linha (`src` em `universe.js`):

- `edge`: https://yc-finance-api.vercel.app, Yahoo Finance. Variação
  contra o último fechamento anterior ao dia; soja e milho em US$/bu;
  algodão em ¢/lb; cripto contra 24 h antes.
- `awesome`: AwesomeAPI. Único de BTC/BRL; fallback de dólar, euro e BTC.

Regras:

- Linha sem cotação válida mostra "—". Nunca copia preço de outro contrato.
- Variação acima de 40% no dia é tratada como erro de leitura ("—").
- Sob o preço vai a hora (Brasília) da cotação, ou dd/mm se não é de hoje.
- Contrato vencido sai do `universe.js`; o teste barra símbolo repetido.

Testes: `node --test`.
