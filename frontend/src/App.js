import { useEffect, useMemo, useState } from 'react';
import axios from 'axios';
import './App.css';

import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  ArcElement,
  Tooltip,
  Legend,
  Title
} from 'chart.js';

import { Bar, Doughnut } from 'react-chartjs-2';

ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  ArcElement,
  Tooltip,
  Legend,
  Title
);

export default function App() {
  const [token, setToken] = useState(localStorage.getItem('token'));
  const [role, setRole] = useState(localStorage.getItem('role'));
  const [email, setEmail] = useState(localStorage.getItem('email'));

  const [isLogin, setIsLogin] = useState(true);
  const [activePage, setActivePage] = useState('dashboard');

  const [form, setForm] = useState({
    email: '',
    password: '',
    role: 'staff'
  });

  const [productForm, setProductForm] = useState({
    name: '',
    category: '',
    price: '',
    stock: ''
  });

  const [editingProductId, setEditingProductId] = useState(null);
  const [productSearch, setProductSearch] = useState('');

  const [saleForm, setSaleForm] = useState({
    productId: '',
    quantity: ''
  });

  const [expenseForm, setExpenseForm] = useState({
    title: '',
    amount: ''
  });

  const [invoiceForm, setInvoiceForm] = useState({
    customerName: '',
    items: '',
    total: ''
  });

  const [products, setProducts] = useState([]);
  const [sales, setSales] = useState([]);
  const [expenses, setExpenses] = useState([]);
  const [invoices, setInvoices] = useState([]);
  const [summary, setSummary] = useState({
    totalProducts: 0,
    totalSales: 0,
    totalExpenses: 0,
    profit: 0
  });

  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);

  const API = 'http://localhost:5001';

  useEffect(() => {
    setToken(localStorage.getItem('token'));
    setRole(localStorage.getItem('role'));
    setEmail(localStorage.getItem('email'));

    if (localStorage.getItem('token')) {
      loadAllData();
    }
  }, []);

  const handleChange = (e) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  const handleProductChange = (e) => {
    setProductForm({ ...productForm, [e.target.name]: e.target.value });
  };

  const handleSaleChange = (e) => {
    setSaleForm({ ...saleForm, [e.target.name]: e.target.value });
  };

  const handleExpenseChange = (e) => {
    setExpenseForm({ ...expenseForm, [e.target.name]: e.target.value });
  };

  const handleInvoiceChange = (e) => {
    setInvoiceForm({ ...invoiceForm, [e.target.name]: e.target.value });
  };

  const handleAuth = async () => {
    setLoading(true);
    setMessage('');

    try {
      if (isLogin) {
        const res = await axios.post(`${API}/auth/login`, {
          email: form.email,
          password: form.password
        });

        localStorage.setItem('token', res.data.token);
        localStorage.setItem('role', res.data.role);
        localStorage.setItem('email', res.data.email);

        setToken(res.data.token);
        setRole(res.data.role);
        setEmail(res.data.email);

        loadAllData();
      } else {
        const res = await axios.post(`${API}/auth/register`, form);
        setMessage(res.data.message + ' — You can now sign in.');
        setIsLogin(true);
      }
    } catch (error) {
      setMessage(error.response?.data?.message || 'Something went wrong');
    } finally {
      setLoading(false);
    }
  };

  const logout = () => {
    localStorage.clear();
    setToken(null);
    setRole(null);
    setEmail(null);
    setProducts([]);
    setSales([]);
    setExpenses([]);
    setInvoices([]);
    setSummary({
      totalProducts: 0,
      totalSales: 0,
      totalExpenses: 0,
      profit: 0
    });
    setForm({ email: '', password: '', role: 'staff' });
    setMessage('');
  };

  const loadAllData = async () => {
    try {
      const [productsRes, salesRes, expensesRes, summaryRes, invoicesRes] = await Promise.all([
        axios.get(`${API}/products`),
        axios.get(`${API}/sales`),
        axios.get(`${API}/expenses`),
        axios.get(`${API}/summary`),
        axios.get(`${API}/invoices`)
      ]);

      setProducts(productsRes.data);
      setSales(salesRes.data);
      setExpenses(expensesRes.data);
      setSummary(summaryRes.data);
      setInvoices(invoicesRes.data);
    } catch (error) {
      console.error('Failed to load data');
    }
  };

  const addOrUpdateProduct = async () => {
    try {
      const payload = {
        name: productForm.name,
        category: productForm.category,
        price: Number(productForm.price),
        stock: Number(productForm.stock)
      };

      if (editingProductId) {
        await axios.put(`${API}/products/${editingProductId}`, payload);
      } else {
        await axios.post(`${API}/products`, payload);
      }

      setProductForm({
        name: '',
        category: '',
        price: '',
        stock: ''
      });
      setEditingProductId(null);

      loadAllData();
    } catch (error) {
      alert('Failed to save product');
    }
  };

  const startEditProduct = (product) => {
    setProductForm({
      name: product.name,
      category: product.category,
      price: product.price,
      stock: product.stock
    });
    setEditingProductId(product._id);
    setActivePage('products');
  };

  const cancelEdit = () => {
    setProductForm({
      name: '',
      category: '',
      price: '',
      stock: ''
    });
    setEditingProductId(null);
  };

  const deleteProduct = async (id) => {
    try {
      await axios.delete(`${API}/products/${id}`);
      loadAllData();
    } catch (error) {
      alert('Failed to delete product');
    }
  };

  const addSale = async () => {
    try {
      await axios.post(`${API}/sales`, {
        productId: saleForm.productId,
        quantity: Number(saleForm.quantity)
      });

      setSaleForm({
        productId: '',
        quantity: ''
      });

      loadAllData();
    } catch (error) {
      alert(error.response?.data?.message || 'Failed to record sale');
    }
  };

  const addExpense = async () => {
    try {
      await axios.post(`${API}/expenses`, {
        title: expenseForm.title,
        amount: Number(expenseForm.amount)
      });

      setExpenseForm({
        title: '',
        amount: ''
      });

      loadAllData();
    } catch (error) {
      alert('Failed to add expense');
    }
  };

  const addInvoice = async () => {
    try {
      await axios.post(`${API}/invoices`, {
        customerName: invoiceForm.customerName,
        items: invoiceForm.items.split(',').map(item => item.trim()),
        total: Number(invoiceForm.total)
      });

      setInvoiceForm({
        customerName: '',
        items: '',
        total: ''
      });

      loadAllData();
    } catch (error) {
      alert('Failed to create invoice');
    }
  };

  const printInvoice = (invoice) => {
    const receiptWindow = window.open('', '_blank');
    receiptWindow.document.write(`
      <html>
        <head>
          <title>Deb's Delights Receipt</title>
          <style>
            body {
              font-family: Arial, sans-serif;
              padding: 30px;
              background: #fff;
              color: #000;
            }
            h1 { color: #b8860b; }
            .receipt {
              max-width: 500px;
              margin: auto;
              border: 1px solid #ddd;
              padding: 20px;
              border-radius: 12px;
            }
            ul { padding-left: 20px; }
            .total {
              font-size: 20px;
              font-weight: bold;
              margin-top: 20px;
            }
          </style>
        </head>
        <body>
          <div class="receipt">
            <h1>Deb’s Delights</h1>
            <p><strong>Luxury in Every Taste</strong></p>
            <hr />
            <p><strong>Customer:</strong> ${invoice.customerName}</p>
            <p><strong>Date:</strong> ${new Date(invoice.createdAt).toLocaleString()}</p>
            <h3>Items</h3>
            <ul>
              ${invoice.items.map(item => `<li>${item}</li>`).join('')}
            </ul>
            <p class="total">Total: UGX ${invoice.total}</p>
          </div>
        </body>
      </html>
    `);
    receiptWindow.document.close();
    receiptWindow.print();
  };

  const filteredProducts = useMemo(() => {
    return products.filter((product) =>
      product.name.toLowerCase().includes(productSearch.toLowerCase()) ||
      product.category.toLowerCase().includes(productSearch.toLowerCase())
    );
  }, [products, productSearch]);

  const salesExpenseChart = {
    labels: ['Sales', 'Expenses', 'Profit'],
    datasets: [
      {
        label: 'Business Overview',
        data: [summary.totalSales, summary.totalExpenses, summary.profit],
        backgroundColor: ['#d4af37', '#8b0000', '#228b22'],
        borderRadius: 10
      }
    ]
  };

  const productStockChart = {
    labels: products.map(product => product.name),
    datasets: [
      {
        label: 'Stock Available',
        data: products.map(product => product.stock),
        backgroundColor: ['#d4af37', '#b8860b', '#f4c430', '#ffd700', '#daa520', '#c9a227']
      }
    ]
  };

  if (!token) {
    return (
      <div className="app">
        <div className="login-card">
          <div className="brand">
            <h1>Deb’s Delights</h1>
            <p>Luxury in Every Taste</p>
          </div>

          <div className="form-group">
            <input type="email" name="email" placeholder="Email address" value={form.email} onChange={handleChange} />
            <input type="password" name="password" placeholder="Password" value={form.password} onChange={handleChange} />

            {!isLogin && (
              <select name="role" value={form.role} onChange={handleChange} className="role-select">
                <option value="staff">Staff</option>
                <option value="admin">Admin</option>
              </select>
            )}

            <button onClick={handleAuth} disabled={loading}>
              {loading ? 'Please wait...' : isLogin ? 'Sign In' : 'Create Account'}
            </button>
          </div>

          <p className="switch-auth" onClick={() => setIsLogin(!isLogin)}>
            {isLogin ? "Don't have an account? Sign Up" : 'Already have an account? Sign In'}
          </p>

          {message && <p className="status-message">{message}</p>}

          <p className="footer-text">Premium business management for Deb’s Delights</p>
        </div>
      </div>
    );
  }

  return (
    <div className="dashboard">
      <aside className="sidebar">
        <div>
          <h2 className="logo">Deb’s Delights</h2>
          <p className="tagline">Luxury in Every Taste</p>

          <nav className="nav-links">
            <button className={`nav-btn ${activePage === 'dashboard' ? 'active' : ''}`} onClick={() => setActivePage('dashboard')}>Dashboard</button>
            <button className={`nav-btn ${activePage === 'products' ? 'active' : ''}`} onClick={() => setActivePage('products')}>Products</button>
            <button className={`nav-btn ${activePage === 'sales' ? 'active' : ''}`} onClick={() => setActivePage('sales')}>Sales</button>
            <button className={`nav-btn ${activePage === 'expenses' ? 'active' : ''}`} onClick={() => setActivePage('expenses')}>Expenses</button>
            <button className={`nav-btn ${activePage === 'invoices' ? 'active' : ''}`} onClick={() => setActivePage('invoices')}>Invoices</button>
          </nav>
        </div>

        <button className="logout-btn" onClick={logout}>Logout</button>
      </aside>

      <main className="main-content">
        <div className="top-bar">
          <div>
            <h1>Welcome back</h1>
            <p>{email} • {role}</p>
          </div>
        </div>

        {activePage === 'dashboard' && (
          <>
            <section className="cards-grid">
              <div className="summary-card"><h3>Total Products</h3><p>{summary.totalProducts}</p></div>
              <div className="summary-card"><h3>Total Sales</h3><p>UGX {summary.totalSales}</p></div>
              <div className="summary-card"><h3>Total Expenses</h3><p>UGX {summary.totalExpenses}</p></div>
              <div className="summary-card"><h3>Profit</h3><p>UGX {summary.profit}</p></div>
            </section>

            <section className="charts-grid">
              <div className="chart-card">
                <h2>Business Performance</h2>
                <Bar data={salesExpenseChart} />
              </div>

              <div className="chart-card">
                <h2>Stock Distribution</h2>
                <Doughnut data={productStockChart} />
              </div>
            </section>

            <section className="welcome-panel premium-glow">
              <h2>Executive Business Insights</h2>
              <p>
                Deb’s Delights is now operating with a premium control dashboard
                for products, sales, expenses, invoices, and business performance.
              </p>
            </section>
          </>
        )}

        {activePage === 'products' && (
          <div className="products-page">
            <section className="form-panel">
              <h2>{editingProductId ? 'Edit Product' : 'Add Product'}</h2>

              <div className="form-grid">
                <input name="name" placeholder="Product name" value={productForm.name} onChange={handleProductChange} />
                <input name="category" placeholder="Category" value={productForm.category} onChange={handleProductChange} />
                <input name="price" placeholder="Price" value={productForm.price} onChange={handleProductChange} />
                <input name="stock" placeholder="Stock" value={productForm.stock} onChange={handleProductChange} />
              </div>

              <div className="action-row">
                <button className="gold-btn" onClick={addOrUpdateProduct}>
                  {editingProductId ? 'Update Product' : 'Add Product'}
                </button>

                {editingProductId && (
                  <button className="cancel-btn" onClick={cancelEdit}>
                    Cancel
                  </button>
                )}
              </div>
            </section>

            <section className="products-list-panel">
              <div className="products-header">
                <h2>Product List</h2>
                <input
                  className="search-input"
                  placeholder="Search products..."
                  value={productSearch}
                  onChange={(e) => setProductSearch(e.target.value)}
                />
              </div>

              {filteredProducts.length === 0 ? (
                <p className="empty-text">No matching products found.</p>
              ) : (
                <div className="products-grid">
                  {filteredProducts.map((product) => (
                    <div className="product-card premium-card" key={product._id}>
                      <h3>{product.name}</h3>
                      <p>Category: {product.category}</p>
                      <p>Price: UGX {product.price}</p>
                      <p>Stock: {product.stock}</p>

                      <div className="action-row">
                        <button className="edit-btn" onClick={() => startEditProduct(product)}>Edit</button>
                        <button className="delete-btn" onClick={() => deleteProduct(product._id)}>Delete</button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </section>
          </div>
        )}

        {activePage === 'sales' && (
          <div className="products-page">
            <section className="form-panel">
              <h2>Record Sale</h2>
              <div className="form-grid">
                <select name="productId" value={saleForm.productId} onChange={handleSaleChange} className="role-select">
                  <option value="">Select Product</option>
                  {products.map((product) => (
                    <option key={product._id} value={product._id}>
                      {product.name} (Stock: {product.stock})
                    </option>
                  ))}
                </select>
                <input name="quantity" placeholder="Quantity sold" value={saleForm.quantity} onChange={handleSaleChange} />
              </div>
              <button className="gold-btn" onClick={addSale}>Record Sale</button>
            </section>

            <section className="products-list-panel">
              <h2>Sales History</h2>
              {sales.length === 0 ? (
                <p className="empty-text">No sales recorded yet.</p>
              ) : (
                <div className="products-grid">
                  {sales.map((sale) => (
                    <div className="product-card premium-card" key={sale._id}>
                      <h3>{sale.productName}</h3>
                      <p>Quantity: {sale.quantity}</p>
                      <p>Unit Price: UGX {sale.price}</p>
                      <p>Total: UGX {sale.total}</p>
                    </div>
                  ))}
                </div>
              )}
            </section>
          </div>
        )}

        {activePage === 'expenses' && (
          <div className="products-page">
            <section className="form-panel">
              <h2>Add Expense</h2>
              <div className="form-grid">
                <input name="title" placeholder="Expense title" value={expenseForm.title} onChange={handleExpenseChange} />
                <input name="amount" placeholder="Amount" value={expenseForm.amount} onChange={handleExpenseChange} />
              </div>
              <button className="gold-btn" onClick={addExpense}>Add Expense</button>
            </section>

            <section className="products-list-panel">
              <h2>Expense History</h2>
              {expenses.length === 0 ? (
                <p className="empty-text">No expenses recorded yet.</p>
              ) : (
                <div className="products-grid">
                  {expenses.map((expense) => (
                    <div className="product-card premium-card" key={expense._id}>
                      <h3>{expense.title}</h3>
                      <p>Amount: UGX {expense.amount}</p>
                    </div>
                  ))}
                </div>
              )}
            </section>
          </div>
        )}

        {activePage === 'invoices' && (
          <div className="products-page">
            <section className="form-panel">
              <h2>Create Invoice</h2>
              <div className="form-grid">
                <input name="customerName" placeholder="Customer name" value={invoiceForm.customerName} onChange={handleInvoiceChange} />
                <input name="items" placeholder="Items (comma separated)" value={invoiceForm.items} onChange={handleInvoiceChange} />
                <input name="total" placeholder="Total amount" value={invoiceForm.total} onChange={handleInvoiceChange} />
              </div>
              <button className="gold-btn" onClick={addInvoice}>Create Invoice</button>
            </section>

            <section className="products-list-panel">
              <h2>Invoice History</h2>
              {invoices.length === 0 ? (
                <p className="empty-text">No invoices created yet.</p>
              ) : (
                <div className="products-grid">
                  {invoices.map((invoice) => (
                    <div className="product-card premium-card" key={invoice._id}>
                      <h3>{invoice.customerName}</h3>
                      <p>Items: {invoice.items.join(', ')}</p>
                      <p>Total: UGX {invoice.total}</p>
                      <button className="gold-btn" onClick={() => printInvoice(invoice)}>
                        Print Receipt
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </section>
          </div>
        )}
      </main>
    </div>
  );
}