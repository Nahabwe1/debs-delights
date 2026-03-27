require('dotenv').config();

const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

const app = express();

// ================= MIDDLEWARE =================
app.use(cors({
  origin: '*'
}));
app.use(express.json());

// ================= DATABASE =================
mongoose.connect(process.env.MONGO_URI)
  .then(() => console.log('✅ MongoDB Atlas Connected'))
  .catch((err) => console.error('❌ MongoDB Error:', err.message));

// ================= MODELS =================
const User = mongoose.model('User', {
  email: { type: String, unique: true, required: true },
  password: { type: String, required: true },
  role: { type: String, default: 'staff' },
  createdAt: { type: Date, default: Date.now }
});

const Product = mongoose.model('Product', {
  name: { type: String, required: true },
  category: { type: String, default: 'General' },
  price: { type: Number, required: true },
  stock: { type: Number, required: true },
  createdAt: { type: Date, default: Date.now }
});

const Sale = mongoose.model('Sale', {
  productName: { type: String, required: true },
  quantity: { type: Number, required: true },
  price: { type: Number, required: true },
  total: { type: Number, required: true },
  createdAt: { type: Date, default: Date.now }
});

const Expense = mongoose.model('Expense', {
  title: { type: String, required: true },
  amount: { type: Number, required: true },
  createdAt: { type: Date, default: Date.now }
});

const Invoice = mongoose.model('Invoice', {
  customerName: { type: String, required: true },
  items: { type: [String], default: [] },
  total: { type: Number, required: true },
  createdAt: { type: Date, default: Date.now }
});

// ================= TEST ROUTE =================
app.get('/', (req, res) => {
  res.send("Deb's Delights Backend is running 🚀");
});

// ================= AUTH MIDDLEWARE =================
const auth = (req, res, next) => {
  try {
    const token = req.headers.authorization;

    if (!token) {
      return res.status(401).json({ message: 'Access denied. No token provided.' });
    }

    const verified = jwt.verify(token, process.env.JWT_SECRET);
    req.user = verified;
    next();
  } catch (error) {
    res.status(403).json({ message: 'Invalid or expired token' });
  }
};

// Optional admin-only middleware if you want later
const adminOnly = (req, res, next) => {
  if (req.user.role !== 'admin') {
    return res.status(403).json({ message: 'Admins only' });
  }
  next();
};

// ================= AUTH ROUTES =================

// Register
app.post('/auth/register', async (req, res) => {
  try {
    const { email, password, role } = req.body;

    if (!email || !password) {
      return res.status(400).json({ message: 'Email and password are required' });
    }

    const existingUser = await User.findOne({ email });

    if (existingUser) {
      return res.status(400).json({ message: 'User already exists' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const user = await User.create({
      email,
      password: hashedPassword,
      role: role || 'staff'
    });

    res.json({
      message: 'Account created successfully',
      user: {
        id: user._id,
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

    if (!email || !password) {
      return res.status(400).json({ message: 'Email and password are required' });
    }

    const user = await User.findOne({ email });

    if (!user) {
      return res.status(400).json({ message: 'User not found' });
    }

    const validPassword = await bcrypt.compare(password, user.password);

    if (!validPassword) {
      return res.status(400).json({ message: 'Invalid password' });
    }

    const token = jwt.sign(
      { id: user._id, role: user.role, email: user.email },
      process.env.JWT_SECRET,
      { expiresIn: '7d' }
    );

    res.json({
      token,
      role: user.role,
      email: user.email
    });
  } catch (error) {
    res.status(500).json({ message: 'Login failed', error: error.message });
  }
});

// ================= PRODUCT ROUTES =================

// Get all products
app.get('/products', async (req, res) => {
  try {
    const products = await Product.find().sort({ createdAt: -1 });
    res.json(products);
  } catch (error) {
    res.status(500).json({ message: 'Failed to fetch products' });
  }
});

// Add product
app.post('/products', async (req, res) => {
  try {
    const { name, category, price, stock } = req.body;

    if (!name || price === undefined || stock === undefined) {
      return res.status(400).json({ message: 'Name, price and stock are required' });
    }

    const product = await Product.create({
      name,
      category: category || 'General',
      price: Number(price),
      stock: Number(stock)
    });

    res.json(product);
  } catch (error) {
    res.status(500).json({ message: 'Failed to add product', error: error.message });
  }
});

// Update product
app.put('/products/:id', async (req, res) => {
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
      return res.status(404).json({ message: 'Product not found' });
    }

    res.json(updatedProduct);
  } catch (error) {
    res.status(500).json({ message: 'Failed to update product', error: error.message });
  }
});

// Delete product
app.delete('/products/:id', async (req, res) => {
  try {
    const deleted = await Product.findByIdAndDelete(req.params.id);

    if (!deleted) {
      return res.status(404).json({ message: 'Product not found' });
    }

    res.json({ message: 'Product deleted successfully' });
  } catch (error) {
    res.status(500).json({ message: 'Failed to delete product', error: error.message });
  }
});

// ================= SALES ROUTES =================

// Get all sales
app.get('/sales', async (req, res) => {
  try {
    const sales = await Sale.find().sort({ createdAt: -1 });
    res.json(sales);
  } catch (error) {
    res.status(500).json({ message: 'Failed to fetch sales' });
  }
});

// Add sale and reduce stock
app.post('/sales', async (req, res) => {
  try {
    const { productId, quantity } = req.body;

    if (!productId || !quantity) {
      return res.status(400).json({ message: 'Product and quantity are required' });
    }

    const product = await Product.findById(productId);

    if (!product) {
      return res.status(404).json({ message: 'Product not found' });
    }

    if (product.stock < Number(quantity)) {
      return res.status(400).json({ message: 'Not enough stock available' });
    }

    const total = product.price * Number(quantity);

    const sale = await Sale.create({
      productName: product.name,
      quantity: Number(quantity),
      price: product.price,
      total
    });

    product.stock = product.stock - Number(quantity);
    await product.save();

    res.json(sale);
  } catch (error) {
    res.status(500).json({ message: 'Failed to record sale', error: error.message });
  }
});

// ================= EXPENSE ROUTES =================

// Get all expenses
app.get('/expenses', async (req, res) => {
  try {
    const expenses = await Expense.find().sort({ createdAt: -1 });
    res.json(expenses);
  } catch (error) {
    res.status(500).json({ message: 'Failed to fetch expenses' });
  }
});

// Add expense
app.post('/expenses', async (req, res) => {
  try {
    const { title, amount } = req.body;

    if (!title || amount === undefined) {
      return res.status(400).json({ message: 'Title and amount are required' });
    }

    const expense = await Expense.create({
      title,
      amount: Number(amount)
    });

    res.json(expense);
  } catch (error) {
    res.status(500).json({ message: 'Failed to add expense', error: error.message });
  }
});

// ================= SUMMARY ROUTE =================
app.get('/summary', async (req, res) => {
  try {
    const products = await Product.find();
    const sales = await Sale.find();
    const expenses = await Expense.find();

    const totalProducts = products.length;
    const totalSales = sales.reduce((sum, item) => sum + item.total, 0);
    const totalExpenses = expenses.reduce((sum, item) => sum + item.amount, 0);
    const profit = totalSales - totalExpenses;

    res.json({
      totalProducts,
      totalSales,
      totalExpenses,
      profit
    });
  } catch (error) {
    res.status(500).json({ message: 'Failed to load summary', error: error.message });
  }
});

// ================= INVOICE ROUTES =================

// Get all invoices
app.get('/invoices', async (req, res) => {
  try {
    const invoices = await Invoice.find().sort({ createdAt: -1 });
    res.json(invoices);
  } catch (error) {
    res.status(500).json({ message: 'Failed to fetch invoices' });
  }
});

// Create invoice
app.post('/invoices', async (req, res) => {
  try {
    const { customerName, items, total } = req.body;

    if (!customerName || total === undefined) {
      return res.status(400).json({ message: 'Customer name and total are required' });
    }

    const invoice = await Invoice.create({
      customerName,
      items: items || [],
      total: Number(total)
    });

    res.json(invoice);
  } catch (error) {
    res.status(500).json({ message: 'Failed to create invoice', error: error.message });
  }
});

// ================= START SERVER =================
const PORT = process.env.PORT || 5001;

app.listen(PORT, () => {
  console.log(`🚀 Deb's Delights Backend running on port ${PORT}`);
});