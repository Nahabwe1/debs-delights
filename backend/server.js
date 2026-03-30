const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
require('dotenv').config();

const app = express();

// ===================== MIDDLEWARE =====================
app.use(cors());
app.use(express.json());

// ===================== DATABASE =====================
mongoose
  .connect(process.env.MONGO_URI)
  .then(() => console.log('✅ MongoDB Atlas Connected'))
  .catch((err) => console.error('❌ MongoDB Error:', err.message));

// ===================== MODELS =====================

// User
const User = mongoose.model('User', {
  name: { type: String, default: 'User' },
  email: { type: String, unique: true },
  password: String,
  role: { type: String, default: 'staff' }, // admin or staff
  createdAt: { type: Date, default: Date.now }
});

// Product
const Product = mongoose.model('Product', {
  name: String,
  category: String,
  price: Number,
  stock: Number,
  createdAt: { type: Date, default: Date.now }
});

// Sale
const Sale = mongoose.model('Sale', {
  productId: String,
  productName: String,
  quantity: Number,
  price: Number,
  total: Number,
  createdAt: { type: Date, default: Date.now }
});

// Expense
const Expense = mongoose.model('Expense', {
  title: String,
  amount: Number,
  createdAt: { type: Date, default: Date.now }
});

// Invoice
const Invoice = mongoose.model('Invoice', {
  customerName: String,
  items: [String],
  total: Number,
  createdBy: String,
  createdAt: { type: Date, default: Date.now }
});

// Payment
const Payment = mongoose.model('Payment', {
  phoneNumber: String,
  amount: Number,
  provider: String, // MTN / Airtel
  status: { type: String, default: 'success' },
  transactionId: String,
  createdAt: { type: Date, default: Date.now }
});

// ===================== AUTH MIDDLEWARE =====================
const auth = (req, res, next) => {
  try {
    const token = req.headers.authorization;

    if (!token) {
      return res.status(401).json({ message: 'Access denied. No token provided.' });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded;
    next();
  } catch (error) {
    return res.status(403).json({ message: 'Invalid or expired token.' });
  }
};

const adminOnly = (req, res, next) => {
  if (req.user.role !== 'admin') {
    return res.status(403).json({ message: 'Admins only.' });
  }
  next();
};

// ===================== TEST ROUTE =====================
app.get('/', (req, res) => {
  res.send("Deb's Delights Premium Backend is running 🚀");
});

// ===================== AUTH ROUTES =====================

// Register
app.post('/auth/register', async (req, res) => {
  try {
    const { name, email, password, role } = req.body;

    if (!name || !email || !password) {
      return res.status(400).json({ message: 'Name, email and password are required.' });
    }

    const existingUser = await User.findOne({ email });

    if (existingUser) {
      return res.status(400).json({ message: 'User already exists.' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const user = await User.create({
      name,
      email,
      password: hashedPassword,
      role: role || 'staff'
    });

    res.json({
      message: 'Account created successfully',
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role
      }
    });
  } catch (error) {
    res.status(500).json({ message: 'Registration failed', error: error.message });
  }
});

// Login
app.post('/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    const user = await User.findOne({ email });

    if (!user) {
      return res.status(400).json({ message: 'User not found.' });
    }

    const validPassword = await bcrypt.compare(password, user.password);

    if (!validPassword) {
      return res.status(400).json({ message: 'Invalid password.' });
    }

    const token = jwt.sign(
      {
        id: user._id,
        role: user.role,
        name: user.name,
        email: user.email
      },
      process.env.JWT_SECRET,
      { expiresIn: '7d' }
    );

    res.json({
      token,
      role: user.role,
      email: user.email,
      name: user.name
    });
  } catch (error) {
    res.status(500).json({ message: 'Login failed', error: error.message });
  }
});

// ===================== PRODUCTS =====================

// Get all products
app.get('/products', auth, async (req, res) => {
  try {
    const products = await Product.find().sort({ createdAt: -1 });
    res.json(products);
  } catch (error) {
    res.status(500).json({ message: 'Failed to fetch products.' });
  }
});

// Add product
app.post('/products', auth, async (req, res) => {
  try {
    const { name, category, price, stock } = req.body;

    if (!name || !category || price === undefined || stock === undefined) {
      return res.status(400).json({ message: 'All product fields are required.' });
    }

    const product = await Product.create({
      name,
      category,
      price: Number(price),
      stock: Number(stock)
    });

    res.json(product);
  } catch (error) {
    res.status(500).json({ message: 'Failed to add product.' });
  }
});

// Update product
app.put('/products/:id', auth, async (req, res) => {
  try {
    const { name, category, price, stock } = req.body;

    const updatedProduct = await Product.findByIdAndUpdate(
      req.params.id,
      {
        name,
        category,
        price: Number(price),
        stock: Number(stock)
      },
      { new: true }
    );

    if (!updatedProduct) {
      return res.status(404).json({ message: 'Product not found.' });
    }

    res.json(updatedProduct);
  } catch (error) {
    res.status(500).json({ message: 'Failed to update product.' });
  }
});

// Delete product (Admin only)
app.delete('/products/:id', auth, adminOnly, async (req, res) => {
  try {
    const deleted = await Product.findByIdAndDelete(req.params.id);

    if (!deleted) {
      return res.status(404).json({ message: 'Product not found.' });
    }

    res.json({ message: 'Product deleted successfully.' });
  } catch (error) {
    res.status(500).json({ message: 'Failed to delete product.' });
  }
});

// ===================== SALES =====================

// Get all sales
app.get('/sales', auth, async (req, res) => {
  try {
    const sales = await Sale.find().sort({ createdAt: -1 });
    res.json(sales);
  } catch (error) {
    res.status(500).json({ message: 'Failed to fetch sales.' });
  }
});

// Add sale and reduce stock
app.post('/sales', auth, async (req, res) => {
  try {
    const { productId, quantity } = req.body;

    if (!productId || !quantity) {
      return res.status(400).json({ message: 'Product and quantity are required.' });
    }

    const product = await Product.findById(productId);

    if (!product) {
      return res.status(404).json({ message: 'Product not found.' });
    }

    if (product.stock < Number(quantity)) {
      return res.status(400).json({ message: 'Not enough stock available.' });
    }

    const total = product.price * Number(quantity);

    const sale = await Sale.create({
      productId: product._id.toString(),
      productName: product.name,
      quantity: Number(quantity),
      price: product.price,
      total
    });

    product.stock = product.stock - Number(quantity);
    await product.save();

    res.json(sale);
  } catch (error) {
    res.status(500).json({ message: 'Failed to record sale.' });
  }
});

// ===================== EXPENSES =====================

// Get all expenses
app.get('/expenses', auth, async (req, res) => {
  try {
    const expenses = await Expense.find().sort({ createdAt: -1 });
    res.json(expenses);
  } catch (error) {
    res.status(500).json({ message: 'Failed to fetch expenses.' });
  }
});

// Add expense
app.post('/expenses', auth, async (req, res) => {
  try {
    const { title, amount } = req.body;

    if (!title || amount === undefined) {
      return res.status(400).json({ message: 'Expense title and amount are required.' });
    }

    const expense = await Expense.create({
      title,
      amount: Number(amount)
    });

    res.json(expense);
  } catch (error) {
    res.status(500).json({ message: 'Failed to add expense.' });
  }
});

// ===================== INVOICES =====================

// Get all invoices
app.get('/invoices', auth, async (req, res) => {
  try {
    const invoices = await Invoice.find().sort({ createdAt: -1 });
    res.json(invoices);
  } catch (error) {
    res.status(500).json({ message: 'Failed to fetch invoices.' });
  }
});

// Create invoice
app.post('/invoices', auth, async (req, res) => {
  try {
    const { customerName, items, total } = req.body;

    if (!customerName || !items || total === undefined) {
      return res.status(400).json({ message: 'Customer, items and total are required.' });
    }

    const invoice = await Invoice.create({
      customerName,
      items,
      total: Number(total),
      createdBy: req.user.email
    });

    res.json(invoice);
  } catch (error) {
    res.status(500).json({ message: 'Failed to create invoice.' });
  }
});

// ===================== PAYMENTS =====================

// Simulated Mobile Money Payment Route
// (Can later connect to real MTN / Airtel APIs)
app.post('/payments', auth, async (req, res) => {
  try {
    const { phoneNumber, amount, provider } = req.body;

    if (!phoneNumber || !amount || !provider) {
      return res.status(400).json({ message: 'Phone number, amount and provider are required.' });
    }

    const payment = await Payment.create({
      phoneNumber,
      amount: Number(amount),
      provider,
      status: 'success',
      transactionId: `TXN-${Date.now()}`
    });

    res.json({
      message: 'Payment processed successfully.',
      payment
    });
  } catch (error) {
    res.status(500).json({ message: 'Payment failed.' });
  }
});

// Get all payments
app.get('/payments', auth, adminOnly, async (req, res) => {
  try {
    const payments = await Payment.find().sort({ createdAt: -1 });
    res.json(payments);
  } catch (error) {
    res.status(500).json({ message: 'Failed to fetch payments.' });
  }
});

// ===================== SUMMARY =====================
app.get('/summary', auth, async (req, res) => {
  try {
    const products = await Product.find();
    const sales = await Sale.find();
    const expenses = await Expense.find();

    const totalProducts = products.length;
    const totalStockValue = products.reduce((sum, p) => sum + (p.price * p.stock), 0);
    const totalSales = sales.reduce((sum, item) => sum + item.total, 0);
    const totalExpenses = expenses.reduce((sum, item) => sum + item.amount, 0);
    const profit = totalSales - totalExpenses;

    res.json({
      totalProducts,
      totalStockValue,
      totalSales,
      totalExpenses,
      profit
    });
  } catch (error) {
    res.status(500).json({ message: 'Failed to load summary.' });
  }
});

// ===================== AI BUSINESS ANALYST =====================
app.get('/ai/business-health', auth, async (req, res) => {
  try {
    const products = await Product.find();
    const sales = await Sale.find();
    const expenses = await Expense.find();

    const totalProducts = products.length;
    const totalSales = sales.reduce((sum, item) => sum + item.total, 0);
    const totalExpenses = expenses.reduce((sum, item) => sum + item.amount, 0);
    const profit = totalSales - totalExpenses;

    const totalStock = products.reduce((sum, p) => sum + p.stock, 0);
    const lowStockItems = products.filter((p) => p.stock <= 5);
    const averageSaleValue = sales.length > 0 ? totalSales / sales.length : 0;

    let healthStatus = 'Stable';
    let recommendation = [];

    if (profit <= 0) {
      healthStatus = 'At Risk';
      recommendation.push('Your business is not yet breaking even. Increase sales or reduce unnecessary expenses.');
    }

    if (profit > 0 && totalSales > totalExpenses) {
      healthStatus = 'Growing';
      recommendation.push('Your business is profitable. Focus on scaling high-performing products.');
    }

    if (lowStockItems.length > 0) {
      recommendation.push('Some products are running low in stock. Restock your best sellers quickly.');
    }

    if (sales.length < 5) {
      recommendation.push('Sales volume is still low. Promote offers, bundles, and repeat customer incentives.');
    }

    if (totalExpenses > totalSales * 0.7) {
      recommendation.push('Expenses are consuming too much revenue. Audit operating costs immediately.');
    }

    if (averageSaleValue < 20000) {
      recommendation.push('Average sale value is low. Introduce premium bundles or upsell snack + juice combos.');
    }

    if (recommendation.length === 0) {
      recommendation.push('Business performance is healthy. Maintain stock, customer retention, and smart promotions.');
    }

    res.json({
      healthStatus,
      totalProducts,
      totalSales,
      totalExpenses,
      profit,
      totalStock,
      averageSaleValue,
      lowStockItems,
      recommendation
    });
  } catch (error) {
    res.status(500).json({ message: 'Failed to analyze business health.' });
  }
});

// ===================== ADMIN USERS VIEW =====================
app.get('/users', auth, adminOnly, async (req, res) => {
  try {
    const users = await User.find().select('-password').sort({ createdAt: -1 });
    res.json(users);
  } catch (error) {
    res.status(500).json({ message: 'Failed to fetch users.' });
  }
});

// ===================== START SERVER =====================
const PORT = process.env.PORT || 5001;

app.listen(PORT, () => {
  console.log(`🚀 Deb's Delights Backend running on http://localhost:${PORT}`);
});