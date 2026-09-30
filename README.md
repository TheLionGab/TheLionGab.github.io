# Yuri Coimbra Finance

Live: https://theliongab.github.io/index.html

Mesa de cotações estática (GitHub Pages), sem build.

Abas (menu único, embaixo): Grãos, Ações, Câmbio e Chicago. Cada aba se
divide em grupos por mercado, com título dourado ("Soja", "B3 · Bancos e
bolsa", "EUA · Big techs"). Chicago é o painel CBOT (soja e milho); essas
4 linhas também aparecem em Grãos, junto de algodão e Brent.

Em `universe.js`, cada linha tem:

- `tabs`: lista de abas em que aparece.
- `group`: rótulo único no universo (o teste barra grupo de uma linha só
  na aba Ações e grupo repetido).
- `q`: ordem; o grupo vale pelo maior `q` das suas linhas.

Busca: vale para todas as abas (ticker, nome ou grupo, sem acento e sem
caixa). Trocar de aba limpa a busca.

Fontes, em ordem fixa por linha (`src` em `universe.js`):

- `edge`: https://yc-finance-api.vercel.app, Yahoo Finance. Variação do
  dia contra o fechamento de ontem (detalhes no README da API); soja e
  milho em ¢/bu, algodão em ¢/lb; cripto contra 24 h antes.
- `awesome`: AwesomeAPI. Único de BTC/BRL e primeiro de dólar e euro
  (seguem o dia brasileiro; o Yahoo troca o dia às 23:00 UTC e zera a
  variação à noite). Fallback de BTC/USD. Se a AwesomeAPI falhar, dólar
  e euro caem para o Yahoo, que à noite mostra variação perto de 0%.

Regras:

- Linha sem cotação válida mostra "—". Nunca copia preço de outro contrato.
- Linha esmaecida: contrato sem negócio há mais de 5 dias, ou fonte fora
  do ar mostrando o último dado guardado.
- Variação acima de 40% no dia é tratada como erro de leitura ("—").
- Sob o preço vai a hora (Brasília) da cotação, ou dd/mm se não é de hoje.
- Contrato vencido sai do `universe.js`; o teste barra símbolo repetido.
- O `?v=N` dos quatro assets em `index.html` é o mesmo número; subir
  junto ao mudar qualquer asset (o teste barra versões diferentes).

Testes: `node --test`.
