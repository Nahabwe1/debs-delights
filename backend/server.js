const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
require('dotenv').config();

const app = express();

// ================= MIDDLEWARE =================
app.use(cors());
app.use(express.json());

// ================= DATABASE =================
mongoose.connect(process.env.MONGO_URI)
  .then(() => console.log('✅ MongoDB Atlas Connected'))
  .catch((err) => console.error('❌ MongoDB Error:', err.message));

// ================= MODELS =================
const UserSchema = new mongoose.Schema({
  name: { type: String, default: 'User' },
  email: { type: String, unique: true, required: true },
  password: { type: String, required: true },
  role: { type: String, default: 'staff' }
}, { timestamps: true });

const ProductSchema = new mongoose.Schema({
  name: { type: String, required: true },
  category: { type: String, default: 'General' },
  price: { type: Number, required: true },
  stock: { type: Number, required: true }
}, { timestamps: true });

const SaleSchema = new mongoose.Schema({
  productId: { type: mongoose.Schema.Types.ObjectId, ref: 'Product' },
  productName: String,
  quantity: Number,
  price: Number,
  total: Number,
  soldBy: String
}, { timestamps: true });

const ExpenseSchema = new mongoose.Schema({
  title: { type: String, required: true },
  amount: { type: Number, required: true },
  addedBy: String
}, { timestamps: true });

const InvoiceSchema = new mongoose.Schema({
  customerName: { type: String, required: true },
  items: [String],
  total: { type: Number, required: true },
  createdBy: String
}, { timestamps: true });

const User = mongoose.model('User', UserSchema);
const Product = mongoose.model('Product', ProductSchema);
const Sale = mongoose.model('Sale', SaleSchema);
const Expense = mongoose.model('Expense', ExpenseSchema);
const Invoice = mongoose.model('Invoice', InvoiceSchema);

// ================= AUTH MIDDLEWARE =================
const auth = (req, res, next) => {
  try {
    const token = req.headers.authorization;

    if (!token) {
      return res.status(401).json({ message: 'Access denied. No token provided.' });
    }

    const cleanToken = token.startsWith('Bearer ')
      ? token.split(' ')[1]
      : token;

    const verified = jwt.verify(cleanToken, process.env.JWT_SECRET);
    req.user = verified;
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

// ================= TEST ROUTE =================
app.get('/', (req, res) => {
  res.send("Deb's Delights Backend is running 🚀");
});

// ================= AUTH ROUTES =================

// Register
app.post('/auth/register', async (req, res) => {
  try {
    const { name, email, password, role } = req.body;

    if (!email || !password) {
      return res.status(400).json({ message: 'Email and password are required.' });
    }

    const existingUser = await User.findOne({ email });

    if (existingUser) {
      return res.status(400).json({ message: 'User already exists.' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const user = await User.create({
      name: name || 'User',
      email,
      password: hashedPassword,
      role: role || 'staff'
    });

    res.status(201).json({
      message: 'Account created successfully',
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role
      }
    });
  } catch (error) {
    res.status(500).json({
      message: 'Registration failed',
      error: error.message
    });
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
        email: user.email,
        name: user.name
      },
      process.env.JWT_SECRET,
      { expiresIn: '7d' }
    );

    res.json({
      message: 'Login successful',
      token,
      role: user.role,
      email: user.email,
      name: user.name
    });
  } catch (error) {
    res.status(500).json({
      message: 'Login failed',
      error: error.message
    });
  }
});

// ================= USER PROFILE =================
app.get('/me', auth, async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select('-password');
    res.json(user);
  } catch (error) {
    res.status(500).json({ message: 'Failed to fetch profile.' });
  }
});

// ================= PRODUCTS =================

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

    if (!name || price === undefined || stock === undefined) {
      return res.status(400).json({ message: 'Name, price and stock are required.' });
    }

    const product = await Product.create({
      name,
      category: category || 'General',
      price: Number(price),
      stock: Number(stock)
    });

    res.status(201).json(product);
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
    const deletedProduct = await Product.findByIdAndDelete(req.params.id);

    if (!deletedProduct) {
      return res.status(404).json({ message: 'Product not found.' });
    }

    res.json({ message: 'Product deleted successfully.' });
  } catch (error) {
    res.status(500).json({ message: 'Failed to delete product.' });
  }
});

// ================= SALES =================

// Get all sales
app.get('/sales', auth, async (req, res) => {
  try {
    const sales = await Sale.find().sort({ createdAt: -1 });
    res.json(sales);
  } catch (error) {
    res.status(500).json({ message: 'Failed to fetch sales.' });
  }
});

// Add sale
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
      productId: product._id,
      productName: product.name,
      quantity: Number(quantity),
      price: product.price,
      total,
      soldBy: req.user.email
    });

    product.stock = product.stock - Number(quantity);
    await product.save();

    res.status(201).json(sale);
  } catch (error) {
    res.status(500).json({ message: 'Failed to record sale.' });
  }
});

// ================= EXPENSES =================

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
      return res.status(400).json({ message: 'Title and amount are required.' });
    }

    const expense = await Expense.create({
      title,
      amount: Number(amount),
      addedBy: req.user.email
    });

    res.status(201).json(expense);
  } catch (error) {
    res.status(500).json({ message: 'Failed to add expense.' });
  }
});

// ================= INVOICES =================

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

    res.status(201).json(invoice);
  } catch (error) {
    res.status(500).json({ message: 'Failed to create invoice.' });
  }
});

// ================= SUMMARY =================
app.get('/summary', auth, async (req, res) => {
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
    res.status(500).json({ message: 'Failed to load summary.' });
  }
});

// ================= START SERVER =================
const PORT = process.env.PORT || 5001;

app.listen(PORT, () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);
});