
    let allocationChart = null;
    let typeChart = null;
    let stockChart = null;
    let bondChart = null;

    // API Base URL
    const API_BASE = '';

    // Initialize the app
    document.addEventListener('DOMContentLoaded', function() {
        loadDashboard();
        loadWallet();
        loadNews();
        setupForm();
        initializeCharts();
    });

    // Load wallet balance
    async function loadWallet() {
        try {
            const response = await fetch(`${API_BASE}/api/wallet`);
            const data = await response.json();
            document.getElementById('walletBalance').textContent = `₹${formatNumber(data.balance)}`;
        } catch (error) {
            console.error('Error loading wallet:', error);
        }
    }

    // Show add money modal
    function showAddMoneyModal() {
        document.getElementById('addMoneyModal').style.display = 'block';
    }

    // Close add money modal
    function closeAddMoneyModal() {
        document.getElementById('addMoneyModal').style.display = 'none';
        document.getElementById('addAmount').value = '';
    }

    // Add money to wallet
    async function addMoney() {
        const amount = parseFloat(document.getElementById('addAmount').value);
        
        if (!amount || amount <= 0) {
            alert('Please enter a valid amount');
            return;
        }

        try {
            const response = await fetch(`${API_BASE}/api/wallet/add`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ amount: amount })
            });

            const result = await response.json();
            
            if (response.ok) {
                alert(`₹${formatNumber(amount)} added successfully!`);
                closeAddMoneyModal();
                loadWallet();
            } else {
                alert('Error: ' + result.error);
            }
        } catch (error) {
            alert('Error adding money: ' + error.message);
        }
    }

    // Load news
    async function loadNews() {
        try {
            const response = await fetch(`${API_BASE}/api/news`);
            const news = await response.json();
            
            const newsContainer = document.getElementById('newsContainer');
            
            if (news.length === 0) {
                newsContainer.innerHTML = '<div class="loading">No news available</div>';
                return;
            }

            const newsHTML = news.map(item => `
                <div class="news-item">
                    <div class="news-headline">${item.headline}</div>
                    <div class="news-summary">${item.summary}</div>
                    <div class="news-meta">
                        <span>${item.source}</span>
                        <span>${item.time}</span>
                        <span class="news-category">${item.category}</span>
                    </div>
                </div>
            `).join('');
            
            newsContainer.innerHTML = newsHTML;
        } catch (error) {
            console.error('Error loading news:', error);
            document.getElementById('newsContainer').innerHTML = 
                '<div class="loading">Error loading news</div>';
        }
    }

    // Get price suggestion when symbol changes
    async function onSymbolChange() {
        const symbol = document.getElementById('symbol').value.toUpperCase();
        const priceInput = document.getElementById('purchasePrice');
        const priceHint = document.getElementById('priceHint');
        
        if (symbol.length < 2) {
            priceHint.textContent = '';
            return;
        }

        try {
            const response = await fetch(`${API_BASE}/api/suggest-price/${symbol}`);
            const data = await response.json();
            
            if (data.suggested_price) {
                priceHint.textContent = `💡 Current market price: ₹${data.suggested_price}`;
                priceInput.placeholder = data.suggested_price;
            } else {
                priceHint.textContent = '';
            }
        } catch (error) {
            priceHint.textContent = '';
        }
    }

    // Setup form submission
    function setupForm() {
        // Add symbol change listener
        document.getElementById('symbol').addEventListener('input', onSymbolChange);
        
        document.getElementById('investmentForm').addEventListener('submit', async function(e) {
            e.preventDefault();
            
            const formData = {
                symbol: document.getElementById('symbol').value.toUpperCase(),
                name: document.getElementById('name').value,
                type: document.getElementById('type').value,
                quantity: parseInt(document.getElementById('quantity').value),
                purchase_price: parseFloat(document.getElementById('purchasePrice').value)
            };

            // Calculate total cost
            const totalCost = formData.quantity * formData.purchase_price;
            
            if (!confirm(`This will cost ₹${formatNumber(totalCost)}. Continue?`)) {
                return;
            }

            try {
                const response = await fetch(`${API_BASE}/api/portfolio`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify(formData)
                });

                const result = await response.json();
                
                if (response.ok) {
                    alert(`Investment added successfully! Remaining balance: ₹${formatNumber(result.remaining_balance)}`);
                    document.getElementById('investmentForm').reset();
                    loadDashboard();
                    loadWallet();
                } else {
                    alert('Error: ' + result.error);
                }
            } catch (error) {
                alert('Error adding investment: ' + error.message);
            }
        });
    }

    // Load dashboard data
    async function loadDashboard() {
        try {
            const response = await fetch(`${API_BASE}/api/portfolio/summary`);
            const data = await response.json();

            // Update dashboard cards
            document.getElementById('totalInvested').textContent = `₹${formatNumber(data.total_invested)}`;
            document.getElementById('currentValue').textContent = `₹${formatNumber(data.current_value)}`;
            
            const gainLossElement = document.getElementById('totalGainLoss');
            const returnElement = document.getElementById('totalReturn');
            
            gainLossElement.textContent = `₹${formatNumber(data.total_gain_loss)}`;
            returnElement.textContent = `${data.total_gain_loss_percentage.toFixed(2)}%`;
            
            // Color coding for gain/loss
            const isPositive = data.total_gain_loss >= 0;
            gainLossElement.className = `value ${isPositive ? 'positive' : 'negative'}`;
            returnElement.className = `value ${isPositive ? 'positive' : 'negative'}`;

            // Update holdings table
            updateHoldingsTable(data.holdings);
            
            // Update charts
            updateAllCharts(data.holdings);

        } catch (error) {
            console.error('Error loading dashboard:', error);
            document.getElementById('holdingsContainer').innerHTML = 
                '<div class="loading">Error loading data. Please refresh the page.</div>';
        }
    }

    // Update holdings table
    function updateHoldingsTable(holdings) {
        const container = document.getElementById('holdingsContainer');
        
        if (holdings.length === 0) {
            container.innerHTML = '<div class="loading">No investments added yet.</div>';
            return;
        }

        const table = `
            <table>
                <thead>
                    <tr>
                        <th>Symbol</th>
                        <th>Name</th>
                        <th>Type</th>
                        <th>Quantity</th>
                        <th>Purchase Price</th>
                        <th>Current Price</th>
                        <th>Investment</th>
                        <th>Current Value</th>
                        <th>Gain/Loss</th>
                        <th>Return %</th>
                        <th>Action</th>
                    </tr>
                </thead>
                <tbody>
                    ${holdings.map(holding => `
                        <tr>
                            <td><strong>${holding.symbol}</strong></td>
                            <td>${holding.name}</td>
                            <td><span style="background: ${holding.type === 'stock' ? '#3498db' : '#f39c12'}; color: white; padding: 2px 8px; border-radius: 3px; font-size: 12px;">${holding.type.toUpperCase()}</span></td>
                            <td>${holding.quantity}</td>
                            <td>₹${holding.purchase_price.toFixed(2)}</td>
                            <td>₹${holding.current_price.toFixed(2)}</td>
                            <td>₹${formatNumber(holding.quantity * holding.purchase_price)}</td>
                            <td>₹${formatNumber(holding.current_value)}</td>
                            <td class="${holding.gain_loss >= 0 ? 'positive' : 'negative'}">₹${formatNumber(holding.gain_loss)}</td>
                            <td class="${holding.gain_loss_percentage >= 0 ? 'positive' : 'negative'}">${holding.gain_loss_percentage.toFixed(2)}%</td>
                            <td><button class="sell-btn" onclick="sellHolding(${holding.id}, '${holding.symbol}')">💰 Sell</button></td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
        `;
        
        container.innerHTML = table;
    }

    // Initialize all charts
    function initializeCharts() {
        // Portfolio allocation chart
        const ctx1 = document.getElementById('allocationChart').getContext('2d');
        allocationChart = new Chart(ctx1, {
            type: 'doughnut',
            data: {
                labels: [],
                datasets: [{
                    data: [],
                    backgroundColor: [
                        '#FF6384', '#36A2EB', '#FFCE56', '#4BC0C0', '#9966FF',
                        '#FF9F40', '#FF6384', '#C9CBCF', '#4BC0C0', '#FF6384'
                    ]
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: { position: 'right' },
                    tooltip: {
                        callbacks: {
                            label: function(context) {
                                const value = context.parsed;
                                const total = context.dataset.data.reduce((a, b) => a + b, 0);
                                const percentage = ((value / total) * 100).toFixed(1);
                                return `${context.label}: ₹${formatNumber(value)} (${percentage}%)`;
                            }
                        }
                    }
                }
            }
        });

        // Type distribution chart
        const ctx2 = document.getElementById('typeChart').getContext('2d');
        typeChart = new Chart(ctx2, {
            type: 'pie',
            data: {
                labels: ['Stocks', 'Bonds'],
                datasets: [{
                    data: [0, 0],
                    backgroundColor: ['#3498db', '#f39c12']
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: { position: 'bottom' }
                }
            }
        });

        // Stock holdings chart
        const ctx3 = document.getElementById('stockChart').getContext('2d');
        stockChart = new Chart(ctx3, {
            type: 'doughnut',
            data: {
                labels: [],
                datasets: [{
                    data: [],
                    backgroundColor: ['#3498db', '#2980b9', '#1abc9c', '#16a085', '#27ae60', '#229954']
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: { position: 'right' }
                }
            }
        });

        // Bond holdings chart
        const ctx4 = document.getElementById('bondChart').getContext('2d');
        bondChart = new Chart(ctx4, {
            type: 'doughnut',
            data: {
                labels: [],
                datasets: [{
                    data: [],
                    backgroundColor: ['#f39c12', '#e67e22', '#d35400', '#f1c40f', '#f4d03f', '#f7dc6f']
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: { position: 'right' }
                }
            }
        });
    }

    // Update all charts
    function updateAllCharts(holdings) {
        if (holdings.length === 0) return;

        // Update portfolio allocation chart
        const labels = holdings.map(h => h.symbol);
        const data = holdings.map(h => h.current_value);
        
        allocationChart.data.labels = labels;
        allocationChart.data.datasets[0].data = data;
        allocationChart.update();

        // Update type distribution chart
        const stocks = holdings.filter(h => h.type === 'stock');
        const bonds = holdings.filter(h => h.type === 'bond');
        const stockValue = stocks.reduce((sum, h) => sum + h.current_value, 0);
        const bondValue = bonds.reduce((sum, h) => sum + h.current_value, 0);
        
        typeChart.data.datasets[0].data = [stockValue, bondValue];
        typeChart.update();

        // Update stock chart
        if (stocks.length > 0) {
            stockChart.data.labels = stocks.map(s => s.symbol);
            stockChart.data.datasets[0].data = stocks.map(s => s.current_value);
        } else {
            stockChart.data.labels = ['No Stocks'];
            stockChart.data.datasets[0].data = [1];
        }
        stockChart.update();

        // Update bond chart
        if (bonds.length > 0) {
            bondChart.data.labels = bonds.map(b => b.symbol);
            bondChart.data.datasets[0].data = bonds.map(b => b.current_value);
        } else {
            bondChart.data.labels = ['No Bonds'];
            bondChart.data.datasets[0].data = [1];
        }
        bondChart.update();
    }

    // Sell holding (replaces delete)
    async function sellHolding(id, symbol) {
        if (!confirm(`Are you sure you want to sell your ${symbol} investment?\nYou'll receive money back in your wallet based on current market price.`)) return;

        try {
            const response = await fetch(`${API_BASE}/api/portfolio/sell/${id}`, {
                method: 'POST'
            });

            const result = await response.json();
            
            if (response.ok) {
                const details = result.details;
                const profitLoss = parseFloat(details.profit_loss);
                const profitLossText = profitLoss >= 0 ? `Profit: ₹${formatNumber(Math.abs(profitLoss))}` : `Loss: ₹${formatNumber(Math.abs(profitLoss))}`;
                const profitLossEmoji = profitLoss >= 0 ? '🎉' : '📉';
                
                alert(`${profitLossEmoji} Investment Sold Successfully!\n\n` +
                      `📊 ${details.symbol}: ${details.quantity} shares\n` +
                      `💰 Sold at: ₹${details.sell_price} per share\n` +
                      `📈 ${profitLossText} (${details.profit_loss_percentage}%)\n` +
                      `💳 Received: ₹${formatNumber(details.sell_value)}\n` +
                      `🏦 New wallet balance: ₹${formatNumber(details.new_wallet_balance)}`);
                
                loadDashboard();
                loadWallet();
            } else {
                alert('Error selling investment: ' + result.error);
            }
        } catch (error) {
            alert('Error selling investment: ' + error.message);
        }
    }

    // Format number for display
    function formatNumber(num) {
        return new Intl.NumberFormat('en-IN', {
            maximumFractionDigits: 2,
            minimumFractionDigits: 0
        }).format(num);
    }

    // Auto-refresh data every 30 seconds
    setInterval(() => {
        loadDashboard();
        loadNews();
    }, 30000);

    // Close modal when clicking outside
    window.onclick = function(event) {
        const modal = document.getElementById('addMoneyModal');
        if (event.target === modal) {
            closeAddMoneyModal();
        }
    }
