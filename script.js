const STORAGE_KEY = "everyday-transactions";
const categories = {
    expense: ["Food & dining", "Transport", "Shopping", "Bills", "Health", "Entertainment","Rent" ,"Other"],
    income: ["Salary", "Freelance", "Investments", "Gifts", "Other"]
};

const currencyFormatter = new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 2
});

const transactionList = document.querySelector("#transactionList");
const emptyState = document.querySelector("#emptyState");
const transactionDialog = document.querySelector("#transactionDialog");
const transactionForm = document.querySelector("#transactionForm");
const transactionType = document.querySelector("#transactionType");
const categorySelect = document.querySelector("#category");
const categoryFilter = document.querySelector("#categoryFilter");
const dateInput = document.querySelector("#date");
const amountInput = document.querySelector("#amount");
const descriptionInput = document.querySelector("#description");

let transactions = loadTransactions();
let editingId = null;
let selectedMonth = new Date();
selectedMonth = new Date(selectedMonth.getFullYear(), selectedMonth.getMonth(), 1);

function loadTransactions() {
    try {
        const savedTransactions = localStorage.getItem(STORAGE_KEY);
        if (!savedTransactions) {
            return [];
        }

        const parsedTransactions = JSON.parse(savedTransactions);
        if (!Array.isArray(parsedTransactions)) {
            throw new Error("Saved transactions are not in the expected format.");
        }

        return parsedTransactions.filter(isValidTransaction);
    } catch (error) {
        console.error("Could not load saved transactions:", error);
        window.alert("Your saved transactions could not be loaded. The data in this browser may be damaged.");
        return [];
    }
}

function isValidTransaction(transaction) {
    return transaction
        && typeof transaction.id === "string"
        && (transaction.type === "income" || transaction.type === "expense")
        && Number.isFinite(Number(transaction.amount))
        && Number(transaction.amount) > 0
        && typeof transaction.category === "string"
        && typeof transaction.description === "string"
        && typeof transaction.date === "string";
}

function saveTransactions() {
    try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(transactions));
        return true;
    } catch (error) {
        console.error("Could not save transactions:", error);
        return false;
    }
}

function formatCurrency(amount) {
    return currencyFormatter.format(amount);
}

function formatDate(date) {
    const parsedDate = new Date(`${date}T00:00:00`);
    if (Number.isNaN(parsedDate.getTime())) {
        return date;
    }

    return new Intl.DateTimeFormat("en-IN", {
        day: "numeric",
        month: "short",
        year: "numeric"
    }).format(parsedDate);
}

function setCategoryOptions(type, selectedCategory = "") {
    categorySelect.innerHTML = categories[type]
        .map(category => `<option value="${category}">${category}</option>`)
        .join("");

    if (selectedCategory) {
        categorySelect.value = selectedCategory;
    }
}

function updateCategoryFilter() {
    const currentValue = categoryFilter.value;
    const availableCategories = [...new Set(
        transactions.map(transaction => transaction.category)
    )].sort();

    categoryFilter.innerHTML = `
        <option value="all">All categories</option>
        ${availableCategories
            .map(category => `<option value="${category}">${category}</option>`)
            .join("")}
    `;
}


function updateSummary() {
    const income = transactions
        .filter((transaction) => transaction.type === "income")
        .reduce((total, transaction) => total + Number(transaction.amount), 0);
    const expenses = transactions
        .filter((transaction) => transaction.type === "expense")
        .reduce((total, transaction) => total + Number(transaction.amount), 0);

    document.querySelector("#balance").textContent = formatCurrency(income - expenses);
    document.querySelector("#income").textContent = formatCurrency(income);
    document.querySelector("#expense").textContent = formatCurrency(expenses);
}

function getSelectedMonthTransactions() {
    const year = selectedMonth.getFullYear();
    const month = selectedMonth.getMonth();

    return transactions.filter((transaction) => {
        const date = new Date(`${transaction.date}T00:00:00`);
        return date.getFullYear() === year && date.getMonth() === month;
    });
}

function updateMonthlySummary() {
    const monthTransactions = getSelectedMonthTransactions();
    const income = monthTransactions
        .filter((transaction) => transaction.type === "income")
        .reduce((total, transaction) => total + Number(transaction.amount), 0);
    const expenses = monthTransactions
        .filter((transaction) => transaction.type === "expense")
        .reduce((total, transaction) => total + Number(transaction.amount), 0);
    const monthName = new Intl.DateTimeFormat("en", { month: "long", year: "numeric" }).format(selectedMonth);
    const isCurrentMonth = selectedMonth.getFullYear() === new Date().getFullYear()
        && selectedMonth.getMonth() === new Date().getMonth();

    document.querySelector("#selectedMonth").textContent = isCurrentMonth ? "This month" : monthName;
    document.querySelector("#chartPeriod").textContent = isCurrentMonth ? "This month" : monthName;
    document.querySelector("#monthlyIncome").textContent = formatCurrency(income);
    document.querySelector("#monthlyExpense").textContent = formatCurrency(expenses);

    const total = income + expenses;
    const incomeWidth = total ? (income / total) * 100 : 0;
    const expenseWidth = total ? (expenses / total) * 100 : 0;
    document.querySelector("#monthlyIncomeBar").style.width = `${incomeWidth}%`;
    document.querySelector("#monthlyExpenseBar").style.width = `${expenseWidth}%`;

    const caption = document.querySelector("#monthlyCaption");
    if (!total) {
        caption.textContent = "No activity recorded for this month yet.";
    } else if (income >= expenses) {
        caption.textContent = `${formatCurrency(income - expenses)} left after this month’s expenses.`;
    } else {
        caption.textContent = `Expenses are ${formatCurrency(expenses - income)} higher than income this month.`;
    }

    updateCategoryChart(monthTransactions);
}

function updateCategoryChart(monthTransactions) {
    const expenseTotals = {};
    monthTransactions
        .filter((transaction) => transaction.type === "expense")
        .forEach((transaction) => {
            expenseTotals[transaction.category] = (expenseTotals[transaction.category] || 0) + Number(transaction.amount);
        });

    const sortedCategories = Object.entries(expenseTotals).sort((first, second) => second[1] - first[1]);
    const chart = document.querySelector("#categoryChart");
    chart.replaceChildren();

    if (!sortedCategories.length) {
        const message = document.createElement("p");
        message.className = "chart-empty";
        message.textContent = "Your category breakdown will appear here.";
        chart.append(message);
        return;
    }

    const largestExpense = sortedCategories[0][1];
    sortedCategories.slice(0, 5).forEach(([category, amount]) => {
        const row = document.createElement("div");
        row.className = "category-row";

        const name = document.createElement("span");
        name.className = "category-name";
        name.textContent = category;

        const track = document.createElement("div");
        track.className = "category-track";
        

        const fill = document.createElement("div");
        fill.className = "category-fill";
        fill.style.width = `${(amount / largestExpense) * 100}%`;
        track.append(fill);

        const value = document.createElement("span");
        value.className = "category-value";
        value.textContent = formatCurrency(amount);

        row.append(name, track, value);
        chart.append(row);
    });
}

function getVisibleTransactions() {
    const type = document.querySelector("#typeFilter").value;
    const category = categoryFilter.value;

    return [...transactions]
        .filter((transaction) => type === "all" || transaction.type === type)
        .filter((transaction) => category === "all" || transaction.category === category)
        .sort((first, second) => second.date.localeCompare(first.date));
}

function createTransactionRow(transaction) {
    const row = document.createElement("tr");

    const titleCell = document.createElement("td");
    const title = document.createElement("div");
    title.className = "transaction-title-cell";

    const symbol = document.createElement("span");
    symbol.className = `transaction-symbol ${transaction.type}`;


    const titleText = document.createElement("span");
    const description = document.createElement("span");
    description.className = "transaction-description";
    description.textContent = transaction.description;

    const typeLabel = document.createElement("span");
    typeLabel.className = "transaction-type";
    typeLabel.textContent = transaction.type === "income" ? "-Income" : "-Expense";
    titleText.append(description, typeLabel);
    title.append(titleText);
    titleCell.append(title);

    const categoryCell = document.createElement("td");
    categoryCell.textContent = transaction.category;

    const dateCell = document.createElement("td");
    dateCell.textContent = formatDate(transaction.date);

    const amountCell = document.createElement("td");
    amountCell.className = `amount-cell ${transaction.type}`;
    const sign = transaction.type === "income" ? "+" : "−";
    amountCell.textContent = `${sign}${formatCurrency(Number(transaction.amount))}`;

    const actionsCell = document.createElement("td");
    const actions = document.createElement("div");
    actions.className = "transaction-actions";

    const editButton = document.createElement("button");
    editButton.className = "action-button";
    editButton.type = "button";
    editButton.title = "Edit transaction";
    editButton.textContent = "edit";
    editButton.addEventListener("click", () => openEditDialog(transaction.id));

    const deleteButton = document.createElement("button");
    deleteButton.className = "action-button delete";
    deleteButton.type = "button";
    deleteButton.title = "Delete transaction";
    deleteButton.textContent = "delete";
    deleteButton.addEventListener("click", () => deleteTransaction(transaction.id));

    actions.append(editButton, deleteButton);
    actionsCell.append(actions);
    row.append(titleCell, categoryCell, dateCell, amountCell, actionsCell);
    return row;
}

function renderTransactions() {
    const visibleTransactions = getVisibleTransactions();

    const rows = visibleTransactions.map(createTransactionRow);
    transactionList.replaceChildren(...rows);

    const hasTransactions = visibleTransactions.length > 0;

    if (hasTransactions) {
        emptyState.hidden = true;
        document.querySelector(".transaction-table").hidden = false;
    } else {
        emptyState.hidden = false;
        document.querySelector(".transaction-table").hidden = true;
    }

    const count = visibleTransactions.length;

    if (count === 1) {
        document.querySelector("#transactionCount").textContent = "1 transaction";
    } else {
        document.querySelector("#transactionCount").textContent = `${count} transactions`;
    }

    if (!hasTransactions && transactions.length > 0) {
        emptyState.querySelector("h3").textContent = "No matching transactions";
        emptyState.querySelector("p").textContent = "Try changing or clearing your filters.";
        document.querySelector("#emptyAddButton").hidden = true;
    } else {
        emptyState.querySelector("h3").textContent = "No transactions yet";
        emptyState.querySelector("p").textContent = "Add your first transaction and it’ll show up here.";
        document.querySelector("#emptyAddButton").hidden = false;
    }
}

function renderApp() {
    updateSummary();
    updateMonthlySummary();
    updateCategoryFilter();
    renderTransactions();
}

function clearErrors() {
    document.querySelectorAll(".field-error").forEach((error) => {
        error.textContent = "";
    });
    document.querySelector("#formMessage").textContent = "";
}

function openAddDialog() {
    editingId = null;
    transactionForm.reset();
    clearErrors();
    document.querySelector("#dialogTitle").textContent = "Add a transaction";
    document.querySelector("#saveTransaction").textContent = "Save transaction";
    transactionType.value = "expense";
    setCategoryOptions("expense");
    dateInput.value = new Date().toISOString().slice(0, 10);
    setSelectedTypeButton("expense");
    transactionDialog.showModal();
    amountInput.focus();
}

function openEditDialog(id) {
    const transaction = transactions.find((item) => item.id === id);
    if (!transaction) {
        return;
    }

    editingId = id;
    clearErrors();
    document.querySelector("#dialogTitle").textContent = "Edit transaction";
    document.querySelector("#saveTransaction").textContent = "Save changes";
    transactionType.value = transaction.type;
    setCategoryOptions(transaction.type, transaction.category);
    amountInput.value = transaction.amount;
    dateInput.value = transaction.date;
    descriptionInput.value = transaction.description;
    setSelectedTypeButton(transaction.type);
    transactionDialog.showModal();
    amountInput.focus();
}

function setSelectedTypeButton(type) {
    const buttons = document.querySelectorAll(".type-button");

    buttons.forEach(button => {
        if (button.dataset.type === type) {
            button.classList.add("selected");
        } else {
            button.classList.remove("selected");
        }
    });
}

function validateForm() {
    clearErrors();

    let isValid = true;

    const amount = Number(amountInput.value);
    const description = descriptionInput.value.trim();
    const date = new Date(`${dateInput.value}T00:00:00`);

   
    if (!amountInput.value || !Number.isFinite(amount) || amount <= 0) {
        document.querySelector("#amountError").textContent =
            "Enter an amount greater than zero.";
        isValid = false;
    }

   
    if (!categorySelect.value) {
        document.querySelector("#categoryError").textContent =
            "Choose a category.";
        isValid = false;
    }

    if (!dateInput.value || Number.isNaN(date.getTime())) {
        document.querySelector("#dateError").textContent =
            "Choose a valid date.";
        isValid = false;
    }

   
    if (!description) {
        document.querySelector("#descriptionError").textContent =
            "Add a short description.";
        isValid = false;
    }

    if (description.length > 80) {
        document.querySelector("#descriptionError").textContent =
            "Keep the description under 80 characters.";
        isValid = false;
    }

    return isValid;
}
function handleFormSubmit(event) {
    event.preventDefault();
    if (!validateForm()) {
        return;
    }

    const transaction = {
        id: editingId || `${Date.now()}-${Math.random().toString(16).slice(2)}`,
        type: transactionType.value,
        amount: Number(amountInput.value),
        category: categorySelect.value,
        date: dateInput.value,
        description: descriptionInput.value.trim()
    };

    const previousTransactions = transactions;
    if (editingId) {
        transactions = transactions.map((item) => item.id === editingId ? transaction : item);
    } else {
        transactions.push(transaction);
    }

    if (!saveTransactions()) {
        transactions = previousTransactions;
        document.querySelector("#formMessage").textContent =
            "We couldn’t save this transaction. Check your browser storage and try again.";
        return;
    }

    transactionDialog.close();
    renderApp();
}

function deleteTransaction(id) {
    const transaction = transactions.find((item) => item.id === id);
    if (!transaction || !window.confirm(`Delete "${transaction.description}"? This can’t be undone.`)) {
        return;
    }

    const previousTransactions = transactions;
    transactions = transactions.filter((item) => item.id !== id);
    if (!saveTransactions()) {
        transactions = previousTransactions;
        window.alert("This transaction could not be deleted because browser storage is unavailable.");
        return;
    }

    renderApp();
}

document.querySelectorAll(".type-button").forEach(button => {
    button.addEventListener("click", () => {
        const type = button.dataset.type;

        transactionType.value = type;
        setCategoryOptions(type);
        setSelectedTypeButton(type);
    });
});

const addButton = document.querySelector("#transadd");
const emptyAddButton = document.querySelector("#emptyAddButton");
const closeButton = document.querySelector("#closeDialog");
const cancelButton = document.querySelector("#cancelDialog");
const typeFilter = document.querySelector("#typeFilter");
const clearButton = document.querySelector("#clearFilters");

addButton.addEventListener("click", openAddDialog);
emptyAddButton.addEventListener("click", openAddDialog);

closeButton.addEventListener("click", () => transactionDialog.close());
cancelButton.addEventListener("click", () => transactionDialog.close());

transactionForm.addEventListener("submit", handleFormSubmit);

typeFilter.addEventListener("change", renderTransactions);
categoryFilter.addEventListener("change", renderTransactions);

clearButton.addEventListener("click", () => {
    typeFilter.value = "all";
    categoryFilter.value = "all";
    renderTransactions();
});

document.querySelector("#previousMonth").addEventListener("click", () => {
    selectedMonth.setMonth(selectedMonth.getMonth() - 1);
    updateMonthlySummary();
});

document.querySelector("#nextMonth").addEventListener("click", () => {
    selectedMonth.setMonth(selectedMonth.getMonth() + 1);
    updateMonthlySummary();
});


setCategoryOptions("expense");
dateInput.value = new Date().toISOString().slice(0, 10);
renderApp();
