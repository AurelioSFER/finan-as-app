# Extratos

Extratos do banco guardados localmente para importar na app.
Os `.csv` estão no `.gitignore` — nunca vão para o repositório.

## Nomes

```
AAAA-MM-DD_AAAA-MM-DD_<conta>.csv
```

Primeira data e última data **dos dados** (não do dia do download). A conta
é `pessoal` ou `conjunta`.

Exemplo:

```
2026-01-01_2026-07-24_conjunta.csv
2026-01-01_2026-07-24_pessoal.csv
```

O ficheiro original da Revolut (`account-statement_2026-01-01_2026-07-24_pt-pt_44862f.csv`)
já traz o intervalo de datas no nome — basta copiá-lo para aqui e renomear com
o intervalo + a conta.
