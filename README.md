# Yuri Coimbra Finance

Live: https://theliongab.github.io/index.html

Mesa de cotações estática (GitHub Pages), sem build.

Fontes, em ordem fixa por linha (`src` em `universe.js`):

- `edge`: https://yc-finance-api.vercel.app, Yahoo Finance. Variação do
  dia contra o fechamento de ontem (detalhes no README da API); soja e
  milho em ¢/bu, algodão em ¢/lb; cripto contra 24 h antes.
- `awesome`: AwesomeAPI. Único de BTC/BRL e primeiro de dólar e euro
  (seguem o dia brasileiro; o Yahoo troca o dia às 23:00 UTC e zera a
  variação à noite). Fallback de BTC/USD.

Regras:

- Linha sem cotação válida mostra "—". Nunca copia preço de outro contrato.
- Linha esmaecida: contrato sem negócio há mais de 5 dias, ou fonte fora
  do ar mostrando o último dado guardado.
- Variação acima de 40% no dia é tratada como erro de leitura ("—").
- Sob o preço vai a hora (Brasília) da cotação, ou dd/mm se não é de hoje.
- Contrato vencido sai do `universe.js`; o teste barra símbolo repetido.

Testes: `node --test`.
