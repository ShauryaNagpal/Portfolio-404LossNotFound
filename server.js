const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const cors = require('cors');
const axios = require('axios');
const path = require('path');

const app = express();
const PORT = 3000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static('public'));

// Initialize SQLite Database
const db = new sqlite3.Database('portfolio.db');

// Create tables
db.serialize(() => {
  // Portfolio table
  db.run(`CREATE TABLE IF NOT EXISTS portfolio (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    symbol TEXT NOT NULL,
    name TEXT NOT NULL,
    type TEXT NOT NULL, -- 'stock' or 'bond'
    quantity INTEGER NOT NULL,
    purchase_price REAL NOT NULL,
    purchase_date DATE NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);

  // Stock prices cache table
  db.run(`CREATE TABLE IF NOT EXISTS stock_prices (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    symbol TEXT NOT NULL,
    price REAL NOT NULL,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);

  // Wallet table
  db.run(`CREATE TABLE IF NOT EXISTS wallet (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    balance REAL DEFAULT 100000.00,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);

  // Initialize wallet with default balance if empty
  db.get('SELECT COUNT(*) as count FROM wallet', (err, row) => {
    if (!err && row.count === 0) {
      db.run('INSERT INTO wallet (balance) VALUES (100000.00)');
    }
  });
});

// API Key - You'll need to get this from Alpha Vantage (free)
const ALPHA_VANTAGE_KEY = 'PX4F8BSQ6JUFFMPV'; // Replace with your actual API key

// Routes

// Get all portfolio items
app.get('/api/portfolio', (req, res) => {
  db.all('SELECT * FROM portfolio ORDER BY created_at DESC', (err, rows) => {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    res.json(rows);
  });
});

// Add new portfolio item
app.post('/api/portfolio', (req, res) => {
  const { symbol, name, type, quantity, purchase_price } = req.body;
  const purchase_date = new Date().toISOString().split('T')[0];
  const totalCost = quantity * purchase_price;

  // Check wallet balance first
  db.get('SELECT balance FROM wallet ORDER BY id DESC LIMIT 1', (err, wallet) => {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }

    if (!wallet || wallet.balance < totalCost) {
      res.status(400).json({ error: 'Insufficient wallet balance' });
      return;
    }

    // Add to portfolio and update wallet
    db.run(
      'INSERT INTO portfolio (symbol, name, type, quantity, purchase_price, purchase_date) VALUES (?, ?, ?, ?, ?, ?)',
      [symbol, name, type, quantity, purchase_price, purchase_date],
      function(err) {
        if (err) {
          res.status(500).json({ error: err.message });
          return;
        }

        // Update wallet balance
        db.run(
          'UPDATE wallet SET balance = balance - ?, updated_at = CURRENT_TIMESTAMP WHERE id = (SELECT MAX(id) FROM wallet)',
          [totalCost],
          (walletErr) => {
            if (walletErr) {
              res.status(500).json({ error: 'Portfolio added but wallet update failed' });
              return;
            }
            res.json({ 
              id: this.lastID, 
              message: 'Investment added successfully',
              cost: totalCost,
              remaining_balance: wallet.balance - totalCost
            });
          }
        );
      }
    );
  });
});

// Get wallet balance
app.get('/api/wallet', (req, res) => {
  db.get('SELECT balance FROM wallet ORDER BY id DESC LIMIT 1', (err, row) => {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    res.json({ balance: row ? row.balance : 0 });
  });
});

// Add money to wallet
app.post('/api/wallet/add', (req, res) => {
  const { amount } = req.body;
  
  if (!amount || amount <= 0) {
    res.status(400).json({ error: 'Invalid amount' });
    return;
  }

  db.run(
    'UPDATE wallet SET balance = balance + ?, updated_at = CURRENT_TIMESTAMP WHERE id = (SELECT MAX(id) FROM wallet)',
    [amount],
    function(err) {
      if (err) {
        res.status(500).json({ error: err.message });
        return;
      }
      
      // Get updated balance
      db.get('SELECT balance FROM wallet ORDER BY id DESC LIMIT 1', (err, row) => {
        if (err) {
          res.status(500).json({ error: err.message });
          return;
        }
        res.json({ 
          message: 'Money added successfully', 
          balance: row.balance,
          added: amount
        });
      });
    }
  );
});

// Delete portfolio item -> SELL portfolio item
app.post('/api/portfolio/sell/:id', (req, res) => {
  const { id } = req.params;
  
  // First get the portfolio item details
  db.get('SELECT * FROM portfolio WHERE id = ?', [id], async (err, item) => {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    
    if (!item) {
      res.status(404).json({ error: 'Investment not found' });
      return;
    }

    try {
      // Get current market price for this stock/bond
      let currentPrice = item.purchase_price; // fallback
      
      // Get realistic current price
      const upperSymbol = item.symbol.toUpperCase();
      const basePrice = INDIAN_STOCK_PRICES[upperSymbol] || INDIAN_BOND_PRICES[upperSymbol];
      
      if (basePrice) {
        // Add small random variation to simulate real-time changes
        const variation = (Math.random() - 0.5) * 0.05; // ±2.5% variation
        currentPrice = basePrice * (1 + variation);
      } else {
        // Simulate price movement from purchase price
        const priceChange = (Math.random() - 0.5) * 0.1; // ±5% from purchase price
        currentPrice = item.purchase_price * (1 + priceChange);
      }

      const sellValue = item.quantity * currentPrice;
      const originalInvestment = item.quantity * item.purchase_price;
      const profitLoss = sellValue - originalInvestment;

      // Delete the portfolio item and add money back to wallet
      db.run('DELETE FROM portfolio WHERE id = ?', [id], function(deleteErr) {
        if (deleteErr) {
          res.status(500).json({ error: deleteErr.message });
          return;
        }

        // Add sell proceeds to wallet
        db.run(
          'UPDATE wallet SET balance = balance + ?, updated_at = CURRENT_TIMESTAMP WHERE id = (SELECT MAX(id) FROM wallet)',
          [sellValue],
          (walletErr) => {
            if (walletErr) {
              res.status(500).json({ error: 'Stock sold but wallet update failed' });
              return;
            }

            // Get updated wallet balance
            db.get('SELECT balance FROM wallet ORDER BY id DESC LIMIT 1', (balanceErr, wallet) => {
              if (balanceErr) {
                res.status(500).json({ error: 'Stock sold but could not fetch balance' });
                return;
              }

              res.json({ 
                message: 'Investment sold successfully',
                details: {
                  symbol: item.symbol,
                  quantity: item.quantity,
                  purchase_price: item.purchase_price,
                  sell_price: currentPrice.toFixed(2),
                  original_investment: originalInvestment,
                  sell_value: sellValue,
                  profit_loss: profitLoss,
                  profit_loss_percentage: ((profitLoss / originalInvestment) * 100).toFixed(2),
                  new_wallet_balance: wallet.balance
                }
              });
            });
          }
        );
      });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });
});

// Preloaded Indian stock prices (realistic data)
const INDIAN_STOCK_PRICES = {
  'RELIANCE': 2485.50,
  'TCS': 3890.25,
  'INFY': 1654.80,
  'HDFCBANK': 1598.75,
  'ITC': 456.30,
  'KOTAKBANK': 1789.40,
  'LT': 3421.60,
  'AXISBANK': 1156.85,
  'SBIN': 598.20,
  'BHARTIARTL': 1189.95,
  'MARUTI': 10845.30,
  'ASIANPAINT': 3256.70,
  'TATAMOTORS': 789.45,
  'WIPRO': 587.25,
  'ULTRACEMCO': 8956.40,
  'SUNPHARMA': 1234.60,
  'POWERGRID': 289.75,
  'NESTLEIND': 24567.80,
  'TITAN': 3142.35,
  'TECHM': 1567.90
};

const INDIAN_BOND_PRICES = {
  'NHAI-2031': 1015.50,
  'IRFC-2030': 1008.25,
  'HUDCO-2029': 1012.80,
  'PFC-2032': 1018.75,
  'REC-2031': 1009.30,
  'NTPC-2030': 1014.40,
  'PGCIL-2029': 1007.60,
  'IIFCL-2028': 1011.85
};

// Get current stock price with realistic data
app.get('/api/price/:symbol', async (req, res) => {
  const { symbol } = req.params;
  
  try {
    // Check if we have preloaded price
    let basePrice = INDIAN_STOCK_PRICES[symbol] || INDIAN_BOND_PRICES[symbol];
    
    if (basePrice) {
      // Add small random variation to simulate real-time changes
      const variation = (Math.random() - 0.5) * 0.05; // ±2.5% variation
      const currentPrice = basePrice * (1 + variation);
      
      res.json({ 
        symbol, 
        price: parseFloat(currentPrice.toFixed(2)), 
        basePrice: basePrice,
        source: 'realistic_simulation' 
      });
      return;
    }

    // First check if we have recent price data (within last hour)
    db.get(
      'SELECT * FROM stock_prices WHERE symbol = ? AND updated_at > datetime("now", "-1 hour")',
      [symbol],
      async (err, row) => {
        if (err) {
          res.status(500).json({ error: err.message });
          return;
        }

        if (row) {
          // Return cached price with small variation
          const variation = (Math.random() - 0.5) * 0.02;
          const currentPrice = row.price * (1 + variation);
          res.json({ symbol, price: parseFloat(currentPrice.toFixed(2)), cached: true });
          return;
        }

        // Fallback with realistic demo data based on symbol
        let demoPrice = 1000; // Default
        if (symbol.includes('BANK') || symbol.includes('HDFC') || symbol.includes('AXIS')) {
          demoPrice = 800 + Math.random() * 1000; // Bank range
        } else if (symbol.includes('TCS') || symbol.includes('INFY') || symbol.includes('WIPRO')) {
          demoPrice = 1200 + Math.random() * 2000; // IT range
        } else {
          demoPrice = 500 + Math.random() * 1500; // General range
        }
        
        res.json({ symbol, price: parseFloat(demoPrice.toFixed(2)), demo: true });
      }
    );
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get suggested price for a symbol
app.get('/api/suggest-price/:symbol', (req, res) => {
  const { symbol } = req.params;
  const upperSymbol = symbol.toUpperCase();
  
  const suggestedPrice = INDIAN_STOCK_PRICES[upperSymbol] || INDIAN_BOND_PRICES[upperSymbol];
  
  if (suggestedPrice) {
    // Add small variation for realism
    const variation = (Math.random() - 0.5) * 0.03;
    const price = suggestedPrice * (1 + variation);
    res.json({ 
      symbol: upperSymbol, 
      suggested_price: parseFloat(price.toFixed(2)),
      source: 'market_data'
    });
  } else {
    res.json({ symbol: upperSymbol, suggested_price: null });
  }
});

// Get market news (REAL NEWS API)
app.get('/api/news', async (req, res) => {
  try {
    // Using NewsAPI for real Indian business news
    const NEWS_API_KEY = 'e234e44792854b048e3a1bb49480b1b6'; // Get free key from https://newsapi.org
    
    // Try to get real news first
    if (NEWS_API_KEY && NEWS_API_KEY !== 'e234e44792854b048e3a1bb49480b1b6') {
      try {
        const response = await axios.get(
          `https://newsapi.org/v2/top-headlines?country=in&category=business&pageSize=10&apiKey=${NEWS_API_KEY}`
        );
        
        if (response.data && response.data.articles) {
          const formattedNews = response.data.articles.map((article, index) => ({
            id: index + 1,
            headline: article.title,
            summary: article.description || 'No summary available',
            source: article.source.name,
            time: formatTimeAgo(new Date(article.publishedAt)),
            category: 'business',
            url: article.url
          })).filter(item => item.headline && item.headline !== '[Removed]');
          
          res.json(formattedNews);
          return;
        }
      } catch (apiError) {
        console.log('News API error, falling back to mock data:', apiError.message);
      }
    }

    // Fallback to enhanced mock news if API fails or no key
    const mockNews = [
      {
        id: 1,
        headline: "Sensex surges 480 points as banking stocks rally",
        summary: "Indian benchmark indices closed higher led by strong performance in banking and IT sectors. HDFC Bank, ICICI Bank were among top gainers.",
        source: "Economic Times",
        time: generateRandomTime(),
        category: "markets"
      },
      {
        id: 2,
        headline: "Reliance Industries reports record quarterly profits",
        summary: "RIL posted a 15% increase in net profit for Q3, driven by robust performance across retail, telecom and petrochemicals segments.",
        source: "Business Standard",
        time: generateRandomTime(),
        category: "earnings"
      },
      {
        id: 3,
        headline: "RBI keeps repo rate unchanged at 6.50%, maintains accommodative stance",
        summary: "The Reserve Bank of India maintained status quo on policy rates, citing need to balance growth and inflation dynamics.",
        source: "Mint",
        time: generateRandomTime(),
        category: "policy"
      },
      {
        id: 4,
        headline: "Foreign investors pump ₹18,500 crore into Indian equities",
        summary: "Strong FPI inflows continue as foreign investors show confidence in India's economic recovery and growth prospects.",
        source: "Financial Express",
        time: generateRandomTime(),
        category: "markets"
      },
      {
        id: 5,
        headline: "Nifty 50 hits fresh all-time high, crosses 22,200 mark",
        summary: "The benchmark Nifty index reached a new record high on positive global cues and strong domestic fundamentals.",
        source: "CNBC-TV18",
        time: generateRandomTime(),
        category: "markets"
      },
      {
        id: 6,
        headline: "TCS announces mega deal worth $2.1 billion from European client",
        summary: "India's largest IT services company TCS secured a major transformation deal, boosting investor confidence in the sector.",
        source: "Livemint",
        time: generateRandomTime(),
        category: "earnings"
      },
      {
        id: 7,
        headline: "Adani Group stocks rebound strongly after recent volatility",
        summary: "Adani portfolio companies gained up to 8% as institutional investors show renewed interest following clarifications.",
        source: "India Today",
        time: generateRandomTime(),
        category: "markets"
      }
    ];

    res.json(mockNews);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Helper function to format time ago
function formatTimeAgo(date) {
  const now = new Date();
  const diffMs = now - date;
  const diffMinutes = Math.floor(diffMs / (1000 * 60));
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
  
  if (diffMinutes < 60) {
    return `${diffMinutes} minutes ago`;
  } else if (diffHours < 24) {
    return `${diffHours} hours ago`;
  } else {
    return `${Math.floor(diffHours / 24)} days ago`;
  }
}

// Helper function to generate random recent times
function generateRandomTime() {
  const times = ['2 hours ago', '45 minutes ago', '1 hour ago', '3 hours ago', '30 minutes ago', '1 day ago', '4 hours ago'];
  return times[Math.floor(Math.random() * times.length)];
}

// Get portfolio summary
app.get('/api/portfolio/summary', async (req, res) => {
  try {
    db.all('SELECT * FROM portfolio', async (err, portfolio) => {
      if (err) {
        res.status(500).json({ error: err.message });
        return;
      }

      let totalInvested = 0;
      let currentValue = 0;
      const holdings = [];

      for (const item of portfolio) {
        const invested = item.quantity * item.purchase_price;
        totalInvested += invested;

        // Get current price (simplified for demo)
        const currentPrice = item.purchase_price * (0.95 + Math.random() * 0.1); // Simulate price movement
        const currentItemValue = item.quantity * currentPrice;
        currentValue += currentItemValue;

        holdings.push({
          ...item,
          current_price: currentPrice,
          current_value: currentItemValue,
          gain_loss: currentItemValue - invested,
          gain_loss_percentage: ((currentItemValue - invested) / invested) * 100
        });
      }

      res.json({
        total_invested: totalInvested,
        current_value: currentValue,
        total_gain_loss: currentValue - totalInvested,
        total_gain_loss_percentage: totalInvested > 0 ? ((currentValue - totalInvested) / totalInvested) * 100 : 0,
        holdings
      });
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Serve the frontend
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
  console.log('Portfolio Management System is ready!');
});