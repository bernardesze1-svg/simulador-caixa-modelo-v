# Simulador de caixa eletrônico

Demonstração educativa do caixa eletrônico estruturada pelo Modelo V: especificação
e projeto ficam à esquerda, os níveis de verificação e validação correspondentes à
direita, e os casos de teste registram evidências observadas. A aplicação é estática,
executa localmente no navegador e não realiza operações bancárias reais.

## Como executar

No Windows, abra o terminal na pasta do projeto e inicie um servidor local:

```powershell
py -m http.server 8765 --bind 127.0.0.1
```

Abra `http://127.0.0.1:8765/` no navegador. Mantenha o terminal aberto durante
a demonstração e pressione `Ctrl+C` para encerrar. Não é necessário instalar
dependências; o simulador não tem backend nem conexão bancária.

## Recursos de demonstração e verificação

- **Roteiro guiado:** percorre a operação normal, a entrega parcial, a matriz de
  rastreabilidade e a suíte automatizada.
- **Suíte automatizada:** executa 12 casos em estados financeiros isolados; ao
  final, restaura saldo e estoque, mantendo os resultados e evidências na matriz.
- **Relatório JSON:** exporta o estado atual, a matriz de requisitos/testes, o
  resultado da última suíte e a trilha de auditoria da sessão.
- **Acessibilidade:** atalho para pular ao conteúdo, navegação por teclado,
  foco visível, mensagens de estado anunciadas e respeito à preferência por
  movimento reduzido.

## Cenários

- **Operação normal:** debita o saque do saldo e reduz o dinheiro disponível no caixa.
- **Banco indisponível:** impede a consulta ou autorização, sem alterar valores.
- **Cédulas insuficientes:** limita temporariamente o estoque de teste a R$ 80,00 e
  recusa saques sem composição exata, antes do débito.
- **Falha no dispensador:** falha antes da entrega e não mantém débito.
- **Entrega parcial + estorno:** debita, entrega parte das cédulas, estorna o débito
  referente às cédulas não entregues e deixa a reconciliação simulada pendente. O
  débito líquido equivale ao dinheiro efetivamente entregue.
- **PIN inválido:** interrompe o fluxo antes de consultar ou debitar.
- **Saldo insuficiente:** usa um fixture de conta com saldo disponível de R$ 50,00.
- **Limites excedidos:** até R$ 500,00 por saque e R$ 1.000,00 por conta na sessão.
- **Tempo esgotado:** interrompe a autorização antes de débito ou entrega.
- **Falha no estorno:** mantém um débito pendente explicitamente sinalizado; a
  reconciliação simulada restaura o saldo sem alterar o estoque e bloqueia novos
  saques enquanto a pendência não for resolvida.
- **Consulta de saldo:** exibe o saldo sem alterar o estado financeiro.

O saldo inicial, o estoque de cédulas, o PIN e os limites são fictícios e editáveis
somente por meio do código; não representam regras universais de instituições
financeiras. O estoque inicial contém 4 cédulas de R$ 100, 8 de R$ 50, 10 de R$ 20
e 20 de R$ 10 (total de R$ 1.200). Uma falha parcial não devolve ao cliente o valor
das cédulas recebidas: somente a parcela não entregue é estornada; a reconciliação
registra o resultado sem alterar novamente o saldo. A trilha de auditoria existe
apenas durante a sessão do navegador e é apagada ao reiniciar.

Use **Consultar saldo** para testar a consulta, **Executar suíte automatizada** para
preencher a matriz com evidências isoladas, **Exportar relatório JSON** para salvar
os resultados ou **Reiniciar simulação** para limpar os dados da sessão.