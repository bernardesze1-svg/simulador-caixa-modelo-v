const INITIAL_BALANCE = 2450;
const INITIAL_CASH = 1200;
const WITHDRAWAL_LIMIT = 500;
const SESSION_LIMIT = 1000;
const EXPECTED_PIN = "1234";
const INITIAL_NOTES = { 100: 4, 50: 8, 20: 10, 10: 20 };
const CASE_COUNT = 12;
const CASE_LEVELS = {
  withdraw: ["AT-01", "ST-01", "IT-01", "UT-01"],
  invalid: ["ST-01", "UT-01"],
  bank: ["IT-01"],
  cash: ["IT-01", "UT-01"],
  dispenser: ["IT-01"],
  partial: ["IT-01"],
  pin: ["ST-01"],
  balance: ["ST-01"],
  limit: ["ST-01", "UT-01"],
  timeout: ["IT-01"],
  rollback: ["IT-01", "ST-01"],
  consult: ["AT-02"],
};

const state = {
  balance: INITIAL_BALANCE,
  notes: { ...INITIAL_NOTES },
  withdrawn: 0,
  transactionNumber: 0,
  audit: [],
  reconciliationPending: false,
  reconciliationType: null,
  reconciliationAmount: 0,
  lastTestRun: null,
};

const amountInput = document.querySelector("#amount");
const scenarioInput = document.querySelector("#scenario");
const pinInput = document.querySelector("#pin");
const form = document.querySelector("#withdraw-form");
const scenarioHelp = document.querySelector("#scenario-help");
const money = (value) => new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
}).format(value);
const cashTotal = () => Object.entries(state.notes)
  .reduce((total, [denomination, count]) => total + Number(denomination) * count, 0);

function updateState(before) {
  const cash = cashTotal();
  document.querySelector("#account-balance").textContent = money(state.balance);
  document.querySelector("#before-balance").textContent = money(before.balance);
  document.querySelector("#after-balance").textContent = money(state.balance);
  document.querySelector("#before-cash").textContent = money(before.cash);
  document.querySelector("#after-cash").textContent = money(cash);
  document.querySelector("#cash-total").textContent = money(cash);
  document.querySelector("#before-session").textContent = money(before.withdrawn);
  document.querySelector("#after-session").textContent = money(state.withdrawn);
  document.querySelectorAll("[data-denomination]").forEach((item) => {
    item.textContent = state.notes[item.dataset.denomination];
  });
}

function snapshot() {
  return {
    balance: state.balance,
    cash: cashTotal(),
    withdrawn: state.withdrawn,
    notes: { ...state.notes },
  };
}

function setTransactionFlow(steps = []) {
  document.querySelectorAll("#transaction-flow li").forEach((item, index) => {
    const status = steps[index] || "pending";
    item.classList.toggle("done", status === "done");
    item.classList.toggle("failed", status === "failed");
    item.classList.toggle("reversed", status === "reversed");
    item.classList.toggle("skipped", status === "skipped");
  });
}

function showResult({ type = "", title, description, expectation, steps = [] }) {
  const message = document.querySelector("#result-message");
  const indicator = document.querySelector("#result-indicator");
  const expectationBox = document.querySelector("#expectation");
  message.className = `result-message ${type}`.trim();
  indicator.className = `result-indicator ${type}`.trim();
  indicator.textContent = type === "success" ? "✓" : type === "warning" ? "!" : type === "error" ? "×" : "—";
  document.querySelector("#message-icon").textContent =
    type === "success" ? "✓" : type === "warning" ? "!" : type === "error" ? "×" : "↳";
  document.querySelector("#message-title").textContent = title;
  document.querySelector("#message-description").textContent = description;
  expectationBox.className = `expectation ${type}`.trim();
  expectationBox.querySelector(".expectation-mark").textContent =
    type === "warning" ? "!" : type === "error" ? "×" : "✓";
  document.querySelector("#expectation-copy").textContent = expectation;
  setTransactionFlow(steps);
}

function audit(transactionId, event, details, status = "Concluído") {
  state.audit.unshift({
    transactionId,
    timestamp: new Intl.DateTimeFormat("pt-BR", { timeStyle: "medium" }).format(new Date()),
    event,
    details,
    status,
  });
  state.audit = state.audit.slice(0, 30);
  renderAudit();
}

function renderAudit() {
  const list = document.querySelector("#audit-list");
  list.replaceChildren();
  if (state.audit.length === 0) {
    const empty = document.createElement("li");
    empty.className = "audit-empty";
    empty.textContent = "As operações e transições da simulação aparecerão aqui.";
    list.append(empty);
  } else {
    state.audit.forEach((entry) => {
      const item = document.createElement("li");
      item.className = "audit-entry";
      const time = document.createElement("time");
      time.textContent = entry.timestamp;
      const id = document.createElement("b");
      id.textContent = entry.transactionId;
      const event = document.createElement("strong");
      event.textContent = entry.event;
      const details = document.createElement("span");
      details.textContent = entry.details;
      const status = document.createElement("em");
      status.textContent = entry.status;
      item.append(time, id, event, details, status);
      list.append(item);
    });
  }
  document.querySelector("#audit-count").textContent = `${state.audit.length} eventos`;
}

function markCase(caseId, result, passed = true) {
  const row = document.querySelector(`[data-case="${caseId}"]`);
  if (!row) return;
  row.querySelector(".observed").textContent = result;
  const status = row.querySelector(".case-status");
  status.textContent = passed ? "Aprovado" : "Falhou";
  status.className = `case-status ${passed ? "passed" : "failed"}`;
  row.dataset.completed = "true";
  document.querySelector("#trace-progress").textContent =
    `${document.querySelectorAll(".trace-table tbody tr[data-completed='true']").length} de ${CASE_COUNT} cenários executados`;
  const levels = CASE_LEVELS[caseId] || [];
  levels.forEach((level) => {
    const badge = document.querySelector(`[data-test="${level}"]`);
    if (!badge) return;
    badge.textContent = passed ? `${level} · Aprovado` : `${level} · Falhou`;
    badge.className = `test-state ${passed ? "passed" : "failed"}`;
  });
}

function beginTransaction(amount) {
  state.transactionNumber += 1;
  const transactionId = `TX-${String(state.transactionNumber).padStart(3, "0")}`;
  audit(transactionId, "Operação iniciada", `Saque solicitado: ${money(amount)}.`);
  return transactionId;
}

function readAmount() {
  const rawAmount = amountInput.value.trim();
  const amount = Number(rawAmount);
  return rawAmount && Number.isFinite(amount) && amount > 0 && amount % 10 === 0 ? amount : null;
}

function invalidOperation(caseId, transactionId, title, description, expectation, steps, messageType = "warning", updateCase = true) {
  const before = snapshot();
  updateState(before);
  audit(transactionId, "Validação recusada", description, "Sem alteração financeira");
  showResult({ type: messageType, title, description, expectation, steps });
  if (updateCase) markCase(caseId, description);
}

function makeChange(amount, availableNotes = state.notes) {
  const denominations = [100, 50, 20, 10];
  const noteCount = (combination) => Object.values(combination)
    .reduce((total, count) => total + count, 0);
  let combinations = Array(amount + 1).fill(null);
  combinations[0] = {};
  for (const denomination of denominations) {
    const next = Array(amount + 1).fill(null);
    for (let total = 0; total <= amount; total += 10) {
      if (!combinations[total]) continue;
      const maxNotes = Math.min(availableNotes[denomination] || 0, Math.floor((amount - total) / denomination));
      for (let count = 0; count <= maxNotes; count += 1) {
        const newTotal = total + count * denomination;
        const candidate = { ...combinations[total] };
        if (count > 0) candidate[denomination] = count;
        if (next[newTotal] === null || noteCount(candidate) < noteCount(next[newTotal])) {
          next[newTotal] = candidate;
        }
      }
    }
    combinations = next;
  }
  return combinations[amount];
}

function removeNotes(notes) {
  Object.entries(notes).forEach(([denomination, count]) => {
    state.notes[denomination] -= count;
  });
}

function changeDescription(notes) {
  return Object.entries(notes)
    .map(([denomination, count]) => `${count}× R$ ${denomination}`)
    .join(", ");
}

function updateResultAndState(before, result) {
  updateState(before);
  showResult(result);
}

function consultBalance() {
  const before = snapshot();
  state.transactionNumber += 1;
  const transactionId = `TX-${String(state.transactionNumber).padStart(3, "0")}`;
  if (scenarioInput.value === "bank") {
    audit(transactionId, "Consulta ao banco", "Serviço indisponível; consulta não concluída.", "Falhou");
    updateResultAndState(before, {
      type: "error", title: "Banco indisponível",
      description: "Não foi possível consultar a conta. Nenhum valor foi alterado.",
      expectation: "A consulta falha; saldo, estoque e limite da sessão permanecem inalterados.",
      steps: ["done", "done", "failed"],
    });
    markCase("consult", "Consulta interrompida pelo banco indisponível.", false);
    return;
  }
  audit(transactionId, "Consulta de saldo", `Saldo consultado: ${money(state.balance)}.`);
  updateResultAndState(before, {
    type: "success", title: "Saldo consultado",
    description: `Seu saldo disponível é ${money(state.balance)}.`,
    expectation: "A consulta não altera o saldo da conta, o estoque de cédulas ou os limites.",
    steps: ["done", "done", "done"],
  });
  markCase("consult", `Saldo ${money(state.balance)} exibido sem alteração financeira.`);
}

function withdraw(event) {
  event.preventDefault();
  if (state.reconciliationPending) {
    const transactionId = `TX-${String(state.transactionNumber).padStart(3, "0")}`;
    const before = snapshot();
    audit(transactionId, "Operação bloqueada", "Resolva a reconciliação pendente antes de iniciar outro saque.", "Sem alteração financeira");
    updateResultAndState(before, {
      type: "warning",
      title: "Reconciliação pendente",
      description: "Um débito ou uma entrega ainda precisa ser reconciliado antes de continuar.",
      expectation: "Nenhuma nova operação é iniciada enquanto o estado financeiro estiver pendente.",
    });
    return;
  }
  const amount = readAmount();
  if (amount === null) {
    const transactionId = beginTransaction(Number(amountInput.value) || 0);
    invalidOperation("invalid", transactionId, "Valor inválido",
      "Informe um valor positivo, em múltiplos de R$ 10,00.",
      "A operação é rejeitada antes de autenticar ou consultar o banco; nenhum valor muda.",
      ["failed"]);
    amountInput.focus();
    return;
  }

  const before = snapshot();
  const transactionId = beginTransaction(amount);
  audit(transactionId, "Validação do valor", `${money(amount)} atende ao múltiplo de R$ 10,00.`);

  if (scenarioInput.value === "pin" || pinInput.value !== EXPECTED_PIN) {
    invalidOperation("pin", transactionId, "Autenticação recusada",
      "PIN inválido. Use o PIN fictício 1234 para autorizar a simulação.",
      "A autenticação falha antes da autorização; saldo, caixa e limite permanecem iguais.",
      ["done", "failed"], "error");
    return;
  }
  audit(transactionId, "Autenticação", "PIN de demonstração validado.");

  if (scenarioInput.value === "bank") {
    invalidOperation("bank", transactionId, "Banco indisponível",
      "O serviço de autorização não respondeu; o saque foi interrompido.",
      "Sem autorização, nenhum débito ocorre e nenhuma cédula é dispensada.",
      ["done", "done", "failed"], "error");
    return;
  }
  if (scenarioInput.value === "timeout") {
    invalidOperation("timeout", transactionId, "Tempo esgotado",
      "A autorização não respondeu dentro do tempo simulado; o saque foi interrompido.",
      "O tempo esgotado ocorre antes do débito e da entrega; saldo e caixa permanecem inalterados.",
      ["done", "done", "failed"], "error");
    return;
  }
  audit(transactionId, "Autorização", "Conta e serviço disponíveis para validação.");

  const availableBalance = scenarioInput.value === "balance"
    ? Math.min(state.balance, 50)
    : state.balance;
  if (scenarioInput.value === "balance" && amount <= availableBalance) {
    invalidOperation("balance", transactionId, "Aumente o valor do teste",
      `Para acionar a recusa, informe um saque maior que o saldo de teste de ${money(availableBalance)}.`,
      "Este cenário é um fixture de teste; nenhuma operação é executada enquanto o valor não exceder R$ 50,00.",
      ["done", "done", "pending"], "warning", false);
    return;
  }
  if (amount > availableBalance) {
    const balanceCase = scenarioInput.value === "balance";
    invalidOperation("balance", transactionId, "Saldo insuficiente",
      balanceCase
        ? `A conta de teste dispõe de ${money(availableBalance)}; o saque solicitado é maior.`
        : `O saque excede o saldo fictício de ${money(state.balance)}.`,
      "A autorização é recusada; nenhum débito ou entrega ocorre.",
      ["done", "done", "failed"]);
    return;
  }
  if (amount > WITHDRAWAL_LIMIT || state.withdrawn + amount > SESSION_LIMIT) {
    invalidOperation("limit", transactionId, "Limite excedido",
      amount > WITHDRAWAL_LIMIT
        ? `O limite didático por saque é ${money(WITHDRAWAL_LIMIT)}.`
        : `Restam ${money(SESSION_LIMIT - state.withdrawn)} do limite fictício desta sessão.`,
      "O saque excede um limite configurado; saldo e caixa não mudam.",
      ["done", "done", "failed"]);
    return;
  }

  let availableNotes = state.notes;
  if (scenarioInput.value === "cash") {
    availableNotes = { 100: 0, 50: 1, 20: 1, 10: 1 };
  }
  const notes = makeChange(amount, availableNotes);
  if (!notes) {
    invalidOperation("cash", transactionId, "Cédulas insuficientes",
      scenarioInput.value === "cash"
        ? "O cenário indisponibiliza temporariamente parte das cédulas; não há composição exata para este valor."
        : "O estoque atual não contém uma combinação exata de cédulas para este valor.",
      "O dispensador recusa antes do débito; saldo e estoque permanecem inalterados.",
      ["done", "done", "done", "skipped", "failed"]);
    return;
  }

  if (scenarioInput.value === "dispenser") {
    invalidOperation("dispenser", transactionId, "Falha no dispensador",
      "A autorização foi obtida, mas a falha ocorreu antes de qualquer cédula sair.",
      "Nenhuma cédula saiu; o débito não é confirmado e o saldo fica inalterado.",
      ["done", "done", "done", "skipped", "failed"], "error");
    return;
  }

  if (scenarioInput.value === "partial" && amount < 20) {
    invalidOperation("partial", transactionId, "Valor baixo para falha parcial",
      "Use R$ 20,00 ou mais para observar uma entrega parcial de cédulas.",
      "O caso de entrega parcial não é iniciado; nenhum valor é debitado ou entregue.",
      ["done", "done", "done", "skipped", "failed"], "warning", false);
    return;
  }

  state.balance -= amount;
  state.withdrawn += amount;
  audit(transactionId, "Débito confirmado", `${money(amount)} debitados na simulação.`);

  if (scenarioInput.value === "rollback") {
    state.reconciliationPending = true;
    state.reconciliationType = "rollback";
    state.reconciliationAmount = amount;
    const reconcileButton = document.querySelector("#reconcile-button");
    reconcileButton.textContent = "Estornar débito pendente";
    reconcileButton.hidden = false;
    audit(transactionId, "Falha no estorno", `Nenhuma cédula foi entregue; o débito de ${money(amount)} permanece pendente de reconciliação.`, "Pendente");
    updateResultAndState(before, {
      type: "error",
      title: "Estorno não concluído",
      description: `Nenhuma cédula foi entregue. O débito de ${money(amount)} permanece temporariamente registrado até a reconciliação.`,
      expectation: "A falha deixa uma pendência explícita; a reconciliação estorna o débito sem alterar o estoque.",
      steps: ["done", "done", "done", "done", "failed"],
    });
    markCase("rollback", `Débito de ${money(amount)} pendente; sem entrega; aguardando reconciliação.`);
    return;
  }

  if (scenarioInput.value === "partial") {
    const deliveredAmount = Math.max(10, Math.floor(amount / 20) * 10);
    const deliveredNotes = makeChange(deliveredAmount);
    if (!deliveredNotes) {
      state.balance += amount;
      state.withdrawn -= amount;
      audit(transactionId, "Estorno", "A composição parcial indisponível levou à reversão do débito.");
      invalidOperation("partial", transactionId, "Entrega parcial não disponível",
        "Não foi possível montar a entrega parcial simulada; o débito foi revertido.",
        "Sem cédulas entregues, o estorno restaura o saldo e não altera o estoque.",
        ["done", "done", "done", "reversed", "failed", "done"], "error", false);
      return;
    }
    removeNotes(deliveredNotes);
    const refundedAmount = amount - deliveredAmount;
    state.balance += refundedAmount;
    state.withdrawn -= refundedAmount;
    audit(transactionId, "Entrega parcial", `${money(deliveredAmount)} entregues (${changeDescription(deliveredNotes)}); divergência detectada.`, "Parcial");
    audit(transactionId, "Estorno parcial", `${money(refundedAmount)} devolvidos pelas cédulas não entregues.`);
    state.reconciliationPending = true;
    state.reconciliationType = "partial";
    state.reconciliationAmount = refundedAmount;
    const reconcileButton = document.querySelector("#reconcile-button");
    reconcileButton.textContent = "Concluir reconciliação simulada";
    reconcileButton.hidden = false;
    updateResultAndState(before, {
      type: "error", title: "Entrega parcial — estorno parcial",
      description: `${money(deliveredAmount)} entregues; ${money(refundedAmount)} devolvidos. O débito final corresponde ao valor recebido.`,
      expectation: `Saldo e caixa diminuem ${money(deliveredAmount)}. A trilha registra a entrega parcial e aguarda confirmação da reconciliação.`,
      steps: ["done", "done", "done", "done", "failed", "done"],
    });
    markCase("partial", `${money(deliveredAmount)} entregues; estorno de ${money(refundedAmount)}; reconciliação pendente.`);
    return;
  }

  removeNotes(notes);
  audit(transactionId, "Cédulas dispensadas", `${money(amount)} entregues (${changeDescription(notes)}).`);
  updateResultAndState(before, {
    type: "success", title: "Saque realizado",
    description: `${money(amount)} dispensados com sucesso: ${changeDescription(notes)}.`,
    expectation: "O débito só é considerado concluído após a entrega integral; saldo e estoque diminuem pelo mesmo valor.",
    steps: ["done", "done", "done", "done", "done"],
  });
  markCase("withdraw", `Débito e entrega de ${money(amount)}; ${changeDescription(notes)}.`);
}

function reconcile() {
  if (!state.reconciliationPending) return;
  const transactionId = `TX-${String(state.transactionNumber).padStart(3, "0")}`;
  const reconciliationType = state.reconciliationType;
  const before = snapshot();
  if (reconciliationType === "rollback") {
    state.balance += state.reconciliationAmount;
    state.withdrawn -= state.reconciliationAmount;
    audit(transactionId, "Estorno após reconciliação", `${money(state.reconciliationAmount)} estornados; não houve alteração do estoque.`);
  }
  state.reconciliationPending = false;
  state.reconciliationType = null;
  state.reconciliationAmount = 0;
  document.querySelector("#reconcile-button").hidden = true;
  if (reconciliationType === "partial") {
    audit(transactionId, "Reconciliação física", "Conferência da entrega parcial registrada; débito líquido corresponde às cédulas entregues.", "Conferido");
    updateResultAndState(before, {
      type: "success",
      title: "Reconciliação concluída",
      description: "A entrega e o débito líquido foram conferidos; nenhum valor foi alterado novamente.",
      expectation: "A reconciliação registra a conferência sem duplicar o estorno nem modificar o caixa.",
      steps: ["done", "done", "done", "done", "failed", "done"],
    });
    markCase("partial", "Entrega parcial conferida; sem novo débito ou alteração do estoque.");
    return;
  }
  updateResultAndState(before, {
    type: "success",
    title: "Débito estornado",
    description: "O débito pendente foi revertido após a confirmação de que nenhuma cédula foi entregue.",
    expectation: "Saldo restaurado, estoque inalterado e pendência encerrada.",
    steps: ["done", "done", "done", "reversed", "failed", "done"],
  });
  markCase("rollback", "Débito estornado após reconciliação; saldo restaurado e estoque inalterado.");
}

function resetSimulation() {
  state.balance = INITIAL_BALANCE;
  state.notes = { ...INITIAL_NOTES };
  state.withdrawn = 0;
  state.transactionNumber = 0;
  state.audit = [];
  state.reconciliationPending = false;
  state.reconciliationType = null;
  state.reconciliationAmount = 0;
  state.lastTestRun = null;
  amountInput.value = "100";
  pinInput.value = EXPECTED_PIN;
  scenarioInput.value = "normal";
  document.querySelector("#reconcile-button").hidden = true;
  document.querySelectorAll(".trace-table tbody tr").forEach((row) => {
    row.dataset.completed = "false";
    row.querySelector(".observed").textContent = "Ainda não executado";
    const status = row.querySelector(".case-status");
    status.textContent = "Pendente";
    status.className = "case-status";
  });
  document.querySelectorAll(".test-state").forEach((item) => {
    item.textContent = "Ainda não executado";
    item.className = "test-state";
  });
  document.querySelector("#trace-progress").textContent = `0 de ${CASE_COUNT} cenários executados`;
  document.querySelector("#test-suite-status").textContent =
    "Os resultados começam como não executados; a suíte roda cada cenário em estado isolado.";
  document.querySelector("#reconcile-button").textContent = "Concluir reconciliação simulada";
  document.querySelector("#guided-panel").hidden = true;
  clearGuidedTarget();
  updateState(snapshot());
  renderAudit();
  showResult({
    title: "Pronto para simular",
    description: "Escolha um cenário e realize uma operação para ver a resposta do sistema.",
    expectation: "A simulação começa com valores fictícios. Nenhuma operação bancária real é realizada.",
  });
}

function executeWithdrawal(scenario, amount, pin = EXPECTED_PIN) {
  scenarioInput.value = scenario;
  amountInput.value = String(amount);
  pinInput.value = pin;
  withdraw({ preventDefault() {} });
  return {
    snapshot: snapshot(),
    title: document.querySelector("#message-title").textContent,
    description: document.querySelector("#message-description").textContent,
  };
}

function noFinancialChanges(before, after) {
  return before.balance === after.balance
    && before.cash === after.cash
    && before.withdrawn === after.withdrawn
    && Object.keys(before.notes).every((denomination) => before.notes[denomination] === after.notes[denomination]);
}

function runAutomatedSuite() {
  const button = document.querySelector("#test-suite-button");
  const status = document.querySelector("#test-suite-status");
  const results = [];
  const startedAt = new Date().toISOString();
  button.disabled = true;
  status.textContent = "Executando cada caso com estado financeiro isolado…";

  const tests = [
    {
      caseId: "withdraw",
      id: "AT-01",
      label: "Saque autorizado",
      run: () => executeWithdrawal("normal", 100),
      passed: (result) => result.title === "Saque realizado"
        && result.snapshot.balance === INITIAL_BALANCE - 100
        && result.snapshot.cash === INITIAL_CASH - 100
        && result.snapshot.withdrawn === 100,
      evidence: (result) => `${result.title}; saldo ${money(result.snapshot.balance)}; caixa ${money(result.snapshot.cash)}.`,
    },
    {
      caseId: "invalid",
      id: "ST-02",
      label: "Valor inválido",
      run: () => executeWithdrawal("normal", 105),
      passed: (result) => result.title === "Valor inválido" && noFinancialChanges(snapshotInitial, result.snapshot),
      evidence: (result) => `${result.title}; valores e cédulas sem alteração.`,
    },
    {
      caseId: "bank",
      id: "IT-01",
      label: "Banco indisponível",
      run: () => executeWithdrawal("bank", 100),
      passed: (result) => result.title === "Banco indisponível" && noFinancialChanges(snapshotInitial, result.snapshot),
      evidence: (result) => `${result.title}; sem débito ou entrega.`,
    },
    {
      caseId: "cash",
      id: "IT-02",
      label: "Estoque insuficiente",
      run: () => executeWithdrawal("cash", 100),
      passed: (result) => result.title === "Cédulas insuficientes" && noFinancialChanges(snapshotInitial, result.snapshot),
      evidence: (result) => `${result.title}; sem débito ou alteração das cédulas.`,
    },
    {
      caseId: "balance",
      id: "ST-03",
      label: "Saldo insuficiente",
      run: () => executeWithdrawal("balance", 100),
      passed: (result) => result.title === "Saldo insuficiente" && noFinancialChanges(snapshotInitial, result.snapshot),
      evidence: (result) => `${result.title}; conta de teste recusada sem alteração financeira.`,
    },
    {
      caseId: "dispenser",
      id: "IT-03",
      label: "Falha no dispensador",
      run: () => executeWithdrawal("dispenser", 100),
      passed: (result) => result.title === "Falha no dispensador" && noFinancialChanges(snapshotInitial, result.snapshot),
      evidence: (result) => `${result.title}; saldo e estoque preservados.`,
    },
    {
      caseId: "partial",
      id: "IT-04",
      label: "Entrega parcial e reconciliação",
      run: () => {
        const result = executeWithdrawal("partial", 100);
        const deliveredState = snapshot();
        const pending = state.reconciliationPending;
        reconcile();
        return { ...result, deliveredState, pending, reconciledState: snapshot(), pendingAfter: state.reconciliationPending };
      },
      passed: (result) => result.title === "Entrega parcial — estorno parcial"
        && result.pending
        && result.deliveredState.balance === INITIAL_BALANCE - 50
        && result.deliveredState.cash === INITIAL_CASH - 50
        && result.deliveredState.withdrawn === 50
        && !result.pendingAfter
        && result.reconciledState.balance === result.deliveredState.balance
        && result.reconciledState.cash === result.deliveredState.cash,
      evidence: (result) => `R$ 50,00 entregues; R$ 50,00 estornados; reconciliação sem nova alteração financeira.`,
    },
    {
      caseId: "pin",
      id: "ST-04",
      label: "PIN inválido",
      run: () => executeWithdrawal("pin", 100),
      passed: (result) => result.title === "Autenticação recusada" && noFinancialChanges(snapshotInitial, result.snapshot),
      evidence: (result) => `${result.title}; sem autorização, débito ou entrega.`,
    },
    {
      caseId: "limit",
      id: "ST-05",
      label: "Limite por saque e por sessão",
      run: () => {
        const perWithdrawal = executeWithdrawal("normal", WITHDRAWAL_LIMIT + 100);
        resetSimulation();
        state.withdrawn = SESSION_LIMIT - 100;
        const beforeSessionLimit = snapshot();
        const session = executeWithdrawal("normal", 200);
        return { perWithdrawal, beforeSessionLimit, session };
      },
      passed: (result) => result.perWithdrawal.title === "Limite excedido"
        && result.perWithdrawal.snapshot.balance === INITIAL_BALANCE
        && result.beforeSessionLimit.balance === result.session.snapshot.balance
        && result.beforeSessionLimit.cash === result.session.snapshot.cash
        && result.beforeSessionLimit.withdrawn === result.session.snapshot.withdrawn
        && result.session.title === "Limite excedido",
      evidence: (result) => `Limite por saque e acumulado recusados; estado financeiro preservado.`,
    },
    {
      caseId: "timeout",
      id: "IT-05",
      label: "Tempo esgotado na autorização",
      run: () => executeWithdrawal("timeout", 100),
      passed: (result) => result.title === "Tempo esgotado" && noFinancialChanges(snapshotInitial, result.snapshot),
      evidence: (result) => `${result.title}; operação interrompida antes do débito.`,
    },
    {
      caseId: "rollback",
      id: "IT-06",
      label: "Falha no estorno e reconciliação",
      run: () => {
        const result = executeWithdrawal("rollback", 100);
        const pendingState = snapshot();
        const pending = state.reconciliationPending;
        const blocked = executeWithdrawal("normal", 100);
        reconcile();
        return {
          ...result,
          pendingState,
          pending,
          blockedTitle: blocked.title,
          blockedState: blocked.snapshot,
          reconciledState: snapshot(),
          pendingAfter: state.reconciliationPending,
        };
      },
      passed: (result) => result.title === "Estorno não concluído"
        && result.pending
        && result.pendingState.balance === INITIAL_BALANCE - 100
        && result.pendingState.cash === INITIAL_CASH
        && result.blockedTitle === "Reconciliação pendente"
        && noFinancialChanges(result.pendingState, result.blockedState)
        && !result.pendingAfter
        && result.reconciledState.balance === INITIAL_BALANCE
        && result.reconciledState.cash === INITIAL_CASH,
      evidence: (result) => `Débito pendente identificado e estornado na reconciliação; nenhuma cédula foi dispensada.`,
    },
    {
      caseId: "consult",
      id: "AT-02",
      label: "Consultar saldo",
      run: () => {
        consultBalance();
        return { snapshot: snapshot(), title: document.querySelector("#message-title").textContent };
      },
      passed: (result) => result.title === "Saldo consultado" && noFinancialChanges(snapshotInitial, result.snapshot),
      evidence: (result) => `${result.title}; saldo exibido sem alteração financeira.`,
    },
  ];

  const snapshotInitial = {
    balance: INITIAL_BALANCE,
    cash: INITIAL_CASH,
    withdrawn: 0,
    notes: { ...INITIAL_NOTES },
  };

  try {
    tests.forEach((test) => {
      resetSimulation();
      const result = test.run();
      const passed = test.passed(result);
      results.push({
        caseId: test.caseId,
        testId: test.id,
        label: test.label,
        passed,
        evidence: test.evidence(result),
      });
    });
  } finally {
    const finishedAt = new Date().toISOString();
    resetSimulation();
    state.lastTestRun = {
      startedAt,
      finishedAt,
      total: results.length,
      passed: results.filter((result) => result.passed).length,
      failed: results.filter((result) => !result.passed).length,
      results,
    };
    const suiteStatus = results.length === tests.length
      ? (state.lastTestRun.failed === 0 ? "Aprovado" : "Com falhas")
      : "Interrompido";
    audit(
      "SUITE",
      "Suíte automatizada",
      `${state.lastTestRun.passed} aprovados, ${state.lastTestRun.failed} falharam; ${results.length} de ${tests.length} casos executados.`,
      suiteStatus,
    );
    results.forEach((result) => markCase(result.caseId, result.evidence, result.passed));
    updateTestLevelStatuses(results);
    status.textContent = results.length === tests.length
      ? `Suíte concluída: ${state.lastTestRun.passed} de ${tests.length} aprovados; ${state.lastTestRun.failed} falharam.`
      : `Suíte interrompida: ${results.length} de ${tests.length} casos concluídos; o restante permanece não executado.`;
    button.disabled = false;
  }
}

function updateTestLevelStatuses(results) {
  document.querySelectorAll(".test-state").forEach((badge) => {
    const level = badge.dataset.test;
    const linked = results.filter((result) => (CASE_LEVELS[result.caseId] || []).includes(level));
    if (linked.length === 0) {
      badge.textContent = "Ainda não executado";
      badge.className = "test-state";
      return;
    }
    const passed = linked.every((result) => result.passed);
    badge.textContent = `${level} · ${passed ? "Aprovado" : "Falhou"}`;
    badge.className = `test-state ${passed ? "passed" : "failed"}`;
  });
}

function exportReport() {
  const rows = [...document.querySelectorAll(".trace-table tbody tr")];
  const report = {
    title: "Relatório do simulador de caixa eletrônico — Modelo V",
    generatedAt: new Date().toISOString(),
    financialState: {
      accountBalance: state.balance,
      cashTotal: cashTotal(),
      cashByDenomination: { ...state.notes },
      sessionWithdrawn: state.withdrawn,
      reconciliationPending: state.reconciliationPending,
      pendingReconciliationType: state.reconciliationType,
    },
    traceability: rows.map((row) => ({
      requirement: row.cells[0].querySelector("b").textContent,
      level: row.cells[0].querySelector("small").textContent,
      test: row.cells[1].textContent,
      expected: row.cells[2].textContent,
      observed: row.querySelector(".observed").textContent,
      status: row.querySelector(".case-status").textContent,
    })),
    automatedTestRun: state.lastTestRun,
    auditTrail: state.audit.map((entry) => ({ ...entry })),
    disclaimer: "Demonstração educativa com valores fictícios; sem integração ou transação bancária real.",
  };
  const blob = new Blob([JSON.stringify(report, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  link.href = url;
  link.download = `relatorio-simulador-modelo-v-${timestamp}.json`;
  document.body.append(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 0);
  document.querySelector("#test-suite-status").textContent = "Relatório JSON da sessão exportado.";
}

const GUIDED_STEPS = [
  {
    target: "#scenario",
    title: "1. Escolha um cenário",
    copy: "Comece pela operação normal. O roteiro preenche o valor de R$ 100,00 para você observar o fluxo feliz.",
    scenario: "normal",
  },
  {
    target: "#withdraw-form button[type='submit']",
    title: "2. Execute o saque",
    copy: "Clique em Realizar saque. Confira o saldo, as cédulas entregues e os passos concluídos no resultado.",
    scenario: "normal",
  },
  {
    target: "#scenario",
    title: "3. Prepare uma falha parcial",
    copy: "Selecione Entrega parcial + estorno. O exemplo entrega R$ 50,00, estorna o restante e sinaliza a reconciliação.",
    scenario: "partial",
  },
  {
    target: "#withdraw-form button[type='submit']",
    title: "4. Observe a recuperação",
    copy: "Execute o caso e compare o débito líquido com o valor entregue. Depois conclua a reconciliação simulada.",
    scenario: "partial",
  },
  {
    target: "#trace-title",
    title: "5. Leia a rastreabilidade",
    copy: "Na matriz, cada requisito se liga a um teste, ao resultado esperado e à evidência observada.",
    scenario: "normal",
  },
  {
    target: "#test-suite-button",
    title: "6. Automatize a verificação",
    copy: "Execute a suíte para rodar os 12 casos em estados isolados. A matriz registra aprovados e falhas sem deixar o caixa alterado.",
    scenario: "normal",
  },
];

let guidedStepIndex = -1;

function clearGuidedTarget() {
  document.querySelectorAll(".guided-target").forEach((element) => element.classList.remove("guided-target"));
}

function showGuidedStep(index) {
  clearGuidedTarget();
  if (index >= GUIDED_STEPS.length) {
    endGuidedTour();
    return;
  }
  guidedStepIndex = index;
  const step = GUIDED_STEPS[index];
  scenarioInput.value = step.scenario;
  amountInput.value = "100";
  document.querySelector("#guided-title").textContent = step.title;
  document.querySelector("#guided-copy").textContent = step.copy;
  document.querySelector("#guided-progress").textContent = `${index + 1} de ${GUIDED_STEPS.length}`;
  document.querySelector("#guided-next").textContent = index === GUIDED_STEPS.length - 1 ? "Concluir roteiro" : "Próxima etapa";
  document.querySelector("#guided-panel").hidden = false;
  const target = document.querySelector(step.target);
  target.classList.add("guided-target");
  target.scrollIntoView({ block: "center", behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth" });
  target.focus({ preventScroll: true });
  scenarioHelp.textContent = scenarioDescriptions[scenarioInput.value] || scenarioDescriptions.normal;
}

function endGuidedTour() {
  clearGuidedTarget();
  guidedStepIndex = -1;
  document.querySelector("#guided-panel").hidden = true;
  document.querySelector("#guided-start").focus();
}

const scenarioDescriptions = {
  normal: "Operação normal: valida, autoriza, debita e entrega as cédulas.",
  bank: "Simula indisponibilidade do banco antes de autorizar o saque.",
  cash: "O cenário de estoque limitado disponibiliza até R$ 80,00 em cédulas.",
  dispenser: "Simula falha do dispensador após a autorização e antes da entrega.",
  partial: "Entrega R$ 50,00 de R$ 100,00 e estorna o valor não entregue.",
  pin: "Recusa a operação antes da autorização por PIN inválido.",
  balance: "Usa uma conta de teste com saldo disponível de R$ 50,00.",
  timeout: "Simula tempo esgotado na autorização, sem débito nem entrega.",
  rollback: "Simula falha no estorno; o débito fica pendente até reconciliação.",
};

function updateScenarioHelp() {
  scenarioHelp.textContent = scenarioDescriptions[scenarioInput.value] || scenarioDescriptions.normal;
}

form.addEventListener("submit", withdraw);
document.querySelector("#balance-button").addEventListener("click", consultBalance);
document.querySelector("#reset-button").addEventListener("click", resetSimulation);
document.querySelector("#reconcile-button").addEventListener("click", reconcile);
document.querySelector("#test-suite-button").addEventListener("click", runAutomatedSuite);
document.querySelector("#export-report-button").addEventListener("click", exportReport);
document.querySelector("#guided-start").addEventListener("click", () => showGuidedStep(0));
document.querySelector("#guided-next").addEventListener("click", () => showGuidedStep(guidedStepIndex + 1));
document.querySelector("#guided-end").addEventListener("click", endGuidedTour);
scenarioInput.addEventListener("change", updateScenarioHelp);
document.addEventListener("keydown", (event) => {
  if (event.key === "Escape" && guidedStepIndex >= 0) endGuidedTour();
});
updateState(snapshot());
updateScenarioHelp();
