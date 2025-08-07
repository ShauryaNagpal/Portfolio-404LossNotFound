document.addEventListener("DOMContentLoaded", () => {
  fetch("dashboard.json")
    .then(res => res.json())
    .then(data => {
      populateCards(data.user);
      drawPieChart(data.assetAllocation);
      drawLineChart(data.performanceOverTime);
      populateHoldings(data.holdings);
      // You can re-enable this if you want topProfit and topLoss
      populateProfitTables(data.profitStats);
    });

  initTradeModal(); // Initialize modal after everything is loaded
});

function populateCards(user) {
  document.getElementById("total-value").textContent = `₹${user.totalValue}`;
  document.getElementById("invested").textContent = `₹${user.totalInvested}`;
  document.getElementById("returns").textContent = `₹${user.returns}`;
  document.getElementById("assets").textContent = user.assets;
}

function drawPieChart(data) {
  const ctx = document.getElementById("assetChart").getContext("2d");
  const labels = data.map(d => d.label);
  const percentages = data.map(d => d.percentage);

  const chart = new Chart(ctx, {
    type: "pie",
    data: {
      labels,
      datasets: [{
        data: percentages,
        backgroundColor: ["#4f46e5", "#10b981", "#f59e0b", "#ef4444"]
      }]
    },
    options: {
      responsive: false,
      maintainAspectRatio: false,
      onClick: function (e, elements) {
        if (elements.length > 0) {
          const index = elements[0].index;
          const clickedAsset = labels[index];
          showTradeModal(clickedAsset); // Trigger the modal
        }
      }
    }
  });
}
function showTradeModal(assetName) {
  const modal = document.getElementById("tradeModal");
  const stockNameElement = document.getElementById("stockName");
  const tradeQty = document.getElementById("tradeQty");

  stockNameElement.textContent = `Asset: ${assetName}`;
  tradeQty.value = 1;
  modal.style.display = "block";

  // Save this asset for submit action
  window.selectedAsset = assetName;
}


function drawLineChart(data) {
  const ctx = document.getElementById("lineChart").getContext("2d");
  new Chart(ctx, {
    type: "line",
    data: {
      labels: data.map(d => d.month),
      datasets: [{
        label: "Net Profit ₹",
        data: data.map(d => d.value),
        borderColor: "#4f46e5",
        backgroundColor: "rgba(79, 70, 229, 0.1)",
        fill: true,
        tension: 0.4,
        pointRadius: 5,
        pointBackgroundColor: "#4f46e5"
      }]
    },
    options: {
      responsive: false,
      maintainAspectRatio: false,
      scales: {
        y: {
          beginAtZero: true,
          ticks: {
            callback: value => `₹${value}`
          }
        }
      },
      plugins: {
        tooltip: {
          callbacks: {
            label: (ctx) => `₹${ctx.parsed.y}`
          }
        }
      }
    }
  });
}

function populateHoldings(holdings) {
  const tableBody = document.getElementById("holdings-body");
  tableBody.innerHTML = ""; // Clear existing rows
  holdings.forEach(h => {
    const row = document.createElement("tr");
    row.setAttribute("data-asset", h.asset);
    row.setAttribute("data-units", h.units);
    row.innerHTML = `
      <td>${h.asset}</td>
      <td>${h.type}</td>
      <td>${h.units}</td>
      <td>₹${h.invested}</td>
      <td>₹${h.current}</td>
      <td style="color: ${h.gainLoss >= 0 ? 'green' : 'red'}">₹${h.gainLoss}</td>
    `;
    tableBody.appendChild(row);
  });
}

// Optional: Can be re-enabled

function populateProfitTables(stats) {
  const most = document.getElementById("most-profitable");
  const least = document.getElementById("least-profitable");

  most.innerHTML = "";
  least.innerHTML = "";

  const sortedTopProfit = stats.topProfit.sort((a, b) => b.gain - a.gain);
  const sortedTopLoss = stats.topLoss.sort((a, b) => a.loss - b.loss); // most negative at top

  sortedTopProfit.forEach(item => {
    const li = document.createElement("li");
    li.textContent = `${item.asset}: +₹${item.gain.toLocaleString()}`;
    most.appendChild(li);
  });

  sortedTopLoss.forEach(item => {
    const li = document.createElement("li");
    li.textContent = `${item.asset}: ₹${item.loss.toLocaleString()}`;
    least.appendChild(li);
  });
}



function initTradeModal() {
  const table = document.querySelector("tbody");
  const modal = document.getElementById("tradeModal");
  const stockNameElement = document.getElementById("stockName");
  const tradeAction = document.getElementById("tradeAction");
  const tradeQty = document.getElementById("tradeQty");
  const submitTrade = document.getElementById("submitTrade");

  let selectedAsset = "";

  // Open modal on row click
  table.addEventListener("click", function (e) {
    const row = e.target.closest("tr");
    if (!row) return;

    selectedAsset = row.getAttribute("data-asset");
    const selectedUnits = row.getAttribute("data-units");

    stockNameElement.textContent = `Asset: ${selectedAsset} (You hold ${selectedUnits} unit${selectedUnits > 1 ? 's' : ''})`;
    tradeQty.value = 1;

    // Show modal
    modal.style.display = "block";
  });

  // Handle trade submit
  submitTrade.addEventListener("click", () => {
    const action = tradeAction.value;
    const quantity = tradeQty.value;

    alert(`${action} ${quantity} unit(s) of ${selectedAsset}`);
    modal.style.display = "none";
  });

  // Close modal on cancel or backdrop
  document.querySelectorAll(".btn-close, .btn-secondary").forEach(btn => {
    btn.addEventListener("click", () => {
      modal.style.display = "none";
    });
  });

  window.addEventListener("click", (e) => {
    if (e.target === modal) {
      modal.style.display = "none";
    }
  });
}
