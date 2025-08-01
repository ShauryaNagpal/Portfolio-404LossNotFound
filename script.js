const pieCtx = document.getElementById('assetChart').getContext('2d');
new Chart(pieCtx, {
  type: 'pie',
  data: {
    labels: ['SBI', 'HSBC', 'Random bank', 'FDS'],
    datasets: [{
      data: [40, 30, 20, 10],
      backgroundColor: ['#4f46e5', '#10b981', '#f59e0b', '#ef4444']
    }]
  },
  options: {
    responsive: false,
    maintainAspectRatio: false
  }
});

const lineCtx = document.getElementById('lineChart').getContext('2d');
new Chart(lineCtx, {
  type: 'line',
  data: {
    labels: ['March', 'April', 'May', 'June', 'July', 'August'],
    datasets: [{
      label: 'Net Profit ₹',
      data: [5000, 10000, 12000, 15000, 25000, 30000],
      borderColor: '#4f46e5',
      backgroundColor: 'rgba(79, 70, 229, 0.1)',
      fill: true,
      tension: 0.4,
      pointRadius: 5,
      pointBackgroundColor: '#4f46e5'
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
document.addEventListener("DOMContentLoaded", () => {
  fetch("dashboard.json")
    .then(res => res.json())
    .then(data => {
      populateCards(data.user);
      drawPieChart(data.assetAllocation);
      drawLineChart(data.performanceOverTime);
      populateHoldings(data.holdings);
      populateProfitTables(data.profitStats);
    });
});

function populateCards(user) {
  document.getElementById("total-value").textContent = `₹${user.totalValue}`;
  document.getElementById("invested").textContent = `₹${user.totalInvested}`;
  document.getElementById("returns").textContent = `₹${user.returns}`;
  document.getElementById("assets").textContent = user.assets;
}

function drawPieChart(data) {
  const ctx = document.getElementById("pieChart").getContext("2d");
  new Chart(ctx, {
    type: "pie",
    data: {
      labels: data.map(d => d.label),
      datasets: [{
        data: data.map(d => d.percentage),
        backgroundColor: ["#FF6384", "#36A2EB", "#FFCE56", "#66bb6a"]
      }]
    }
  });
}

function drawLineChart(data) {
  const ctx = document.getElementById("lineChart").getContext("2d");
  new Chart(ctx, {
    type: "line",
    data: {
      labels: data.map(d => d.month),
      datasets: [{
        label: "Portfolio Value",
        data: data.map(d => d.value),
        borderColor: "#42a5f5",
        backgroundColor: "rgba(66,165,245,0.2)",
        tension: 0.3,
        fill: true
      }]
    }
  });
}

function populateHoldings(holdings) {
  const tableBody = document.getElementById("holdings-body");
  holdings.forEach(h => {
    const row = document.createElement("tr");
    row.innerHTML = `
      <td>${h.asset}</td>
      <td>${h.type}</td>
      <td>₹${h.invested}</td>
      <td>₹${h.current}</td>
      <td style="color: ${h.gainLoss >= 0 ? 'green' : 'red'}">₹${h.gainLoss}</td>
    `;
    tableBody.appendChild(row);
  });
}

function populateProfitTables(stats) {
  const most = document.getElementById("most-profitable");
  const least = document.getElementById("least-profitable");

  stats.topProfit.forEach(item => {
    const li = document.createElement("li");
    li.textContent = `${item.asset}: +₹${item.gain}`;
    most.appendChild(li);
  });

  stats.topLoss.forEach(item => {
    const li = document.createElement("li");
    li.textContent = `${item.asset}: ₹${item.loss}`;
    least.appendChild(li);
  });
}
