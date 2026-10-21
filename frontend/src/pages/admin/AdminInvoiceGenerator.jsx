import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  FiFileText,
  FiPlus,
  FiTrash2,
  FiPrinter,
  FiDownload,
  FiSearch,
  FiCheck,
  FiRefreshCw,
  FiUser,
  FiMapPin,
  FiDollarSign,
  FiEye,
} from 'react-icons/fi';
import { api } from '../../utils/api';
import Invoice from '../../components/Invoice';
import { downloadInvoicePdf } from '../../utils/downloadInvoicePdf';

export default function AdminInvoiceGenerator() {
  const invoiceRef = useRef(null);

  // Form state
  const [invoiceNumber, setInvoiceNumber] = useState(
    () => `INV-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}-${Math.floor(1000 + Math.random() * 9000)}`
  );
  const [invoiceDate, setInvoiceDate] = useState(() => new Date().toISOString().slice(0, 10));

  // Customer state
  const [customer, setCustomer] = useState({
    fullName: '',
    email: '',
    phone: '',
    address: '',
    locality: '',
    city: '',
    state: 'Maharashtra',
    pincode: '',
  });

  // Payment state
  const [paymentMethod, setPaymentMethod] = useState('Airpay');
  const [paymentStatus, setPaymentStatus] = useState('PAID');
  const [transactionId, setTransactionId] = useState('');

  // Items state
  const [items, setItems] = useState([
    { title: '', price: 0, quantity: 1, size: 'Free Size' },
  ]);

  // Financial options
  const [applyGst, setApplyGst] = useState(false);
  const [customShipping, setCustomShipping] = useState('');
  const [downloading, setDownloading] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);

  // Products from catalog
  const [catalogProducts, setCatalogProducts] = useState([]);
  const [loadingCatalog, setLoadingCatalog] = useState(false);
  const [catalogSearch, setCatalogSearch] = useState('');

  // Existing orders (for quick autofill)
  const [recentOrders, setRecentOrders] = useState([]);
  const [loadingOrders, setLoadingOrders] = useState(false);

  useEffect(() => {
    // Load catalog products
    (async () => {
      try {
        setLoadingCatalog(true);
        const res = await api.admin.listProducts();
        const prods = Array.isArray(res) ? res : res?.products || [];
        setCatalogProducts(prods);
      } catch (err) {
        console.error('Failed to load products for invoice generator:', err);
      } finally {
        setLoadingCatalog(false);
      }
    })();

    // Load recent orders for autofill
    (async () => {
      try {
        setLoadingOrders(true);
        const res = await api.admin.listOrders();
        const ords = Array.isArray(res) ? res : res?.orders || [];
        setRecentOrders(ords.slice(0, 20));
      } catch (err) {
        console.error('Failed to load recent orders:', err);
      } finally {
        setLoadingOrders(false);
      }
    })();
  }, []);

  // Autofill from existing order
  const handleSelectOrder = (orderId) => {
    if (!orderId) return;
    const ord = recentOrders.find((o) => String(o._id) === String(orderId));
    if (!ord) return;

    setInvoiceNumber(`INV-${String(ord._id).slice(-8).toUpperCase()}`);
    if (ord.createdAt) setInvoiceDate(new Date(ord.createdAt).toISOString().slice(0, 10));

    const addr = ord.shippingAddress || {};
    setCustomer({
      fullName: addr.fullName || ord.user?.name || '',
      email: addr.email || ord.user?.email || '',
      phone: addr.mobileNumber || ord.user?.phone || '',
      address: addr.address || '',
      locality: addr.locality || '',
      city: addr.city || '',
      state: addr.state || 'Maharashtra',
      pincode: addr.pincode || '',
    });

    setPaymentMethod(
      ord.paymentMethod === 'cod'
        ? 'COD'
        : ord.paymentMethod === 'airpay'
        ? 'Airpay'
        : 'Online'
    );
    setPaymentStatus(ord.paymentStatus === 'paid' || ord.status === 'paid' ? 'PAID' : 'PENDING');
    setTransactionId(ord.transactionId || ord.airpayTransactionId || '');

    if (Array.isArray(ord.items) && ord.items.length > 0) {
      setItems(
        ord.items.map((it) => ({
          title: it.product?.title || it.title || 'Product',
          price: Number(it.price || 0),
          quantity: Number(it.quantity || 1),
          size: it.size || 'Free Size',
        }))
      );
    }
  };

  // Add Item
  const handleAddItem = (prod = null) => {
    if (prod) {
      const price = Number(prod.price || prod.discountPrice || 0);
      setItems((prev) => [
        ...prev,
        {
          title: prod.title || 'Catalog Product',
          price,
          quantity: 1,
          size: prod.product_info?.tshirtSize || 'Free Size',
        },
      ]);
    } else {
      setItems((prev) => [
        ...prev,
        { title: '', price: 0, quantity: 1, size: 'Free Size' },
      ]);
    }
  };

  const handleUpdateItem = (index, field, value) => {
    setItems((prev) => {
      const copy = [...prev];
      copy[index] = { ...copy[index], [field]: value };
      return copy;
    });
  };

  const handleRemoveItem = (index) => {
    setItems((prev) => prev.filter((_, idx) => idx !== index));
  };

  // Calculations
  const subtotal = useMemo(() => {
    return items.reduce((acc, it) => acc + (Number(it.price) || 0) * (Number(it.quantity) || 1), 0);
  }, [items]);

  const gstAmount = useMemo(() => {
    if (!applyGst) return 0;
    return Math.round(subtotal * 0.18);
  }, [subtotal, applyGst]);

  const shippingAmount = useMemo(() => {
    if (customShipping !== '') return Number(customShipping) || 0;
    return subtotal >= 500 ? 0 : 49;
  }, [subtotal, customShipping]);

  const grandTotal = subtotal + gstAmount + shippingAmount;

  // Synthesize order object for the Invoice component
  const syntheticOrder = useMemo(
    () => ({
      _id: invoiceNumber,
      createdAt: invoiceDate,
      items: items.map((it) => ({
        title: it.title,
        price: Number(it.price),
        quantity: Number(it.quantity),
        size: it.size,
      })),
      amount: grandTotal,
      paymentMethod,
      paymentStatus,
      transactionId,
      shippingAddress: {
        fullName: customer.fullName,
        email: customer.email,
        mobileNumber: customer.phone,
        address: customer.address,
        locality: customer.locality,
        city: customer.city,
        state: customer.state,
        pincode: customer.pincode,
      },
    }),
    [
      invoiceNumber,
      invoiceDate,
      items,
      grandTotal,
      paymentMethod,
      paymentStatus,
      transactionId,
      customer,
    ]
  );

  const totalsObj = useMemo(
    () => ({
      subtotal,
      gst: gstAmount,
      shipping: shippingAmount,
      total: grandTotal,
    }),
    [subtotal, gstAmount, shippingAmount, grandTotal]
  );

  // Actions
  const handlePrint = () => {
    window.print();
  };

  const handleDownload = async () => {
    if (!invoiceRef.current) return;
    try {
      setDownloading(true);
      await downloadInvoicePdf(invoiceRef.current, `${invoiceNumber}.pdf`);
    } catch (err) {
      console.error('Invoice download failed:', err);
      alert('Failed to download invoice PDF');
    } finally {
      setDownloading(false);
    }
  };

  const filteredCatalog = useMemo(() => {
    if (!catalogSearch) return catalogProducts.slice(0, 10);
    const q = catalogSearch.toLowerCase();
    return catalogProducts
      .filter((p) => p.title?.toLowerCase().includes(q) || p.category?.toLowerCase().includes(q))
      .slice(0, 10);
  }, [catalogProducts, catalogSearch]);

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Top Banner */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 bg-white p-6 rounded-2xl shadow-sm border border-gray-200">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <FiFileText className="text-blue-600" />
            Manual Invoice Generator
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            Create, calculate, preview, print, or download compliant tax invoices for Crumblecut.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => setPreviewOpen(true)}
            className="flex items-center gap-2 px-4 py-2.5 bg-gray-100 hover:bg-gray-200 text-gray-800 text-sm font-semibold rounded-xl transition-colors cursor-pointer"
          >
            <FiEye className="w-4 h-4" />
            <span>Preview</span>
          </button>
          <button
            onClick={handlePrint}
            className="flex items-center gap-2 px-4 py-2.5 bg-gray-800 hover:bg-gray-900 text-white text-sm font-semibold rounded-xl transition-colors cursor-pointer"
          >
            <FiPrinter className="w-4 h-4" />
            <span>Print</span>
          </button>
          <button
            onClick={handleDownload}
            disabled={downloading}
            className="flex items-center gap-2 px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold rounded-xl transition-colors cursor-pointer shadow-sm disabled:opacity-50"
          >
            <FiDownload className="w-4 h-4" />
            <span>{downloading ? 'Exporting PDF...' : 'Download PDF'}</span>
          </button>
        </div>
      </div>

      {/* Autofill from recent orders */}
      {recentOrders.length > 0 && (
        <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <div className="text-xs text-blue-900">
            <strong>Quick Fill:</strong> Load customer and line items directly from a recently placed order.
          </div>
          <select
            onChange={(e) => handleSelectOrder(e.target.value)}
            defaultValue=""
            className="text-xs bg-white border border-blue-300 rounded-lg px-3 py-1.5 text-gray-800 font-medium outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="" disabled>
              Select an existing order...
            </option>
            {recentOrders.map((ord) => (
              <option key={ord._id} value={ord._id}>
                #{String(ord._id).slice(-8).toUpperCase()} — {ord.shippingAddress?.fullName || 'Customer'} (₹{ord.amount})
              </option>
            ))}
          </select>
        </div>
      )}

      {/* Main Form Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column: Customer & Invoice Details (2 cols) */}
        <div className="lg:col-span-2 space-y-6">
          {/* Metadata Card */}
          <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-200 space-y-4">
            <h2 className="text-sm font-bold uppercase tracking-wider text-gray-500 flex items-center gap-2">
              <FiFileText className="w-4 h-4" />
              Invoice Metadata
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">Invoice Number</label>
                <input
                  type="text"
                  value={invoiceNumber}
                  onChange={(e) => setInvoiceNumber(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg font-mono focus:ring-2 focus:ring-blue-500 outline-none"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">Invoice Date</label>
                <input
                  type="date"
                  value={invoiceDate}
                  onChange={(e) => setInvoiceDate(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                />
              </div>
            </div>
          </div>

          {/* Customer Details Card */}
          <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-200 space-y-4">
            <h2 className="text-sm font-bold uppercase tracking-wider text-gray-500 flex items-center gap-2">
              <FiUser className="w-4 h-4" />
              Customer Information
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-sm">
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">Customer Full Name *</label>
                <input
                  type="text"
                  placeholder="e.g. Rahul Sharma"
                  value={customer.fullName}
                  onChange={(e) => setCustomer({ ...customer, fullName: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">Mobile Number</label>
                <input
                  type="text"
                  placeholder="e.g. 9876543210"
                  value={customer.phone}
                  onChange={(e) => setCustomer({ ...customer, phone: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">Email Address</label>
                <input
                  type="email"
                  placeholder="customer@example.com"
                  value={customer.email}
                  onChange={(e) => setCustomer({ ...customer, email: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm pt-2">
              <div className="sm:col-span-2">
                <label className="block text-xs font-semibold text-gray-700 mb-1">Street Address</label>
                <input
                  type="text"
                  placeholder="Flat / Building, Street"
                  value={customer.address}
                  onChange={(e) => setCustomer({ ...customer, address: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">City</label>
                <input
                  type="text"
                  placeholder="City"
                  value={customer.city}
                  onChange={(e) => setCustomer({ ...customer, city: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">State</label>
                  <input
                    type="text"
                    value={customer.state}
                    onChange={(e) => setCustomer({ ...customer, state: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">Pincode</label>
                  <input
                    type="text"
                    placeholder="400001"
                    value={customer.pincode}
                    onChange={(e) => setCustomer({ ...customer, pincode: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Line Items Card */}
          <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-200 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-bold uppercase tracking-wider text-gray-500">
                Invoice Line Items ({items.length})
              </h2>
              <button
                onClick={() => handleAddItem()}
                className="flex items-center gap-1.5 text-xs font-semibold text-blue-600 hover:text-blue-800 bg-blue-50 px-3 py-1.5 rounded-lg transition-colors cursor-pointer"
              >
                <FiPlus className="w-3.5 h-3.5" />
                Add Custom Item
              </button>
            </div>

            {/* Catalog quick-search picker */}
            <div className="p-3 bg-gray-50 border border-gray-200 rounded-xl space-y-2">
              <div className="flex items-center gap-2 text-xs font-semibold text-gray-600">
                <FiSearch className="text-gray-400" />
                <span>Search & Add From Product Catalog:</span>
              </div>
              <input
                type="text"
                placeholder="Type saree, shirt, pants title to quickly pick..."
                value={catalogSearch}
                onChange={(e) => setCatalogSearch(e.target.value)}
                className="w-full px-3 py-1.5 text-xs bg-white border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
              />
              {filteredCatalog.length > 0 && (
                <div className="flex flex-wrap gap-2 pt-1 max-h-32 overflow-y-auto">
                  {filteredCatalog.map((prod) => (
                    <button
                      key={prod._id}
                      onClick={() => handleAddItem(prod)}
                      className="text-left text-xs bg-white hover:bg-blue-50 border border-gray-200 hover:border-blue-300 rounded-lg px-2.5 py-1.5 flex items-center gap-2 transition-all cursor-pointer"
                    >
                      <span className="font-medium text-gray-800 truncate max-w-[200px]">{prod.title}</span>
                      <span className="text-blue-600 font-bold">₹{prod.price}</span>
                      <FiPlus className="text-gray-400 w-3 h-3" />
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Items Table Form */}
            <div className="space-y-3">
              {items.map((it, idx) => (
                <div
                  key={idx}
                  className="flex flex-col sm:flex-row items-start sm:items-center gap-3 p-3.5 bg-gray-50 border border-gray-200 rounded-xl text-sm"
                >
                  <div className="flex-1 w-full sm:w-auto">
                    <input
                      type="text"
                      placeholder="Product Name / Description"
                      value={it.title}
                      onChange={(e) => handleUpdateItem(idx, 'title', e.target.value)}
                      className="w-full px-3 py-2 bg-white border border-gray-300 rounded-lg text-sm font-medium focus:ring-2 focus:ring-blue-500 outline-none"
                    />
                  </div>
                  <div className="w-24">
                    <input
                      type="text"
                      placeholder="Size"
                      value={it.size}
                      onChange={(e) => handleUpdateItem(idx, 'size', e.target.value)}
                      className="w-full px-3 py-2 bg-white border border-gray-300 rounded-lg text-xs text-center focus:ring-2 focus:ring-blue-500 outline-none"
                    />
                  </div>
                  <div className="w-24">
                    <input
                      type="number"
                      placeholder="Price"
                      min="0"
                      value={it.price}
                      onChange={(e) => handleUpdateItem(idx, 'price', e.target.value)}
                      className="w-full px-3 py-2 bg-white border border-gray-300 rounded-lg text-xs text-right font-medium focus:ring-2 focus:ring-blue-500 outline-none"
                    />
                  </div>
                  <div className="w-16">
                    <input
                      type="number"
                      placeholder="Qty"
                      min="1"
                      value={it.quantity}
                      onChange={(e) => handleUpdateItem(idx, 'quantity', e.target.value)}
                      className="w-full px-3 py-2 bg-white border border-gray-300 rounded-lg text-xs text-center font-medium focus:ring-2 focus:ring-blue-500 outline-none"
                    />
                  </div>
                  <div className="w-24 text-right font-bold text-gray-900 pr-2">
                    ₹{(Number(it.price || 0) * Number(it.quantity || 1)).toLocaleString('en-IN')}
                  </div>
                  <button
                    onClick={() => handleRemoveItem(idx)}
                    disabled={items.length <= 1}
                    className="p-2 text-gray-400 hover:text-red-600 rounded-lg transition-colors cursor-pointer disabled:opacity-30"
                  >
                    <FiTrash2 className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Right Column: Payment & Totals Summary (1 col) */}
        <div className="space-y-6">
          {/* Payment Details */}
          <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-200 space-y-4">
            <h2 className="text-sm font-bold uppercase tracking-wider text-gray-500">
              Payment & Status
            </h2>
            <div className="space-y-3 text-sm">
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">Payment Method</label>
                <select
                  value={paymentMethod}
                  onChange={(e) => setPaymentMethod(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg font-medium focus:ring-2 focus:ring-blue-500 outline-none"
                >
                  <option value="Airpay">Airpay (UPI/QR)</option>
                  <option value="COD">Cash on Delivery (COD)</option>
                  <option value="Razorpay">Razorpay</option>
                  <option value="Online">Online / Cards</option>
                  <option value="Bank Transfer">Bank Transfer</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">Payment Status</label>
                <select
                  value={paymentStatus}
                  onChange={(e) => setPaymentStatus(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg font-medium focus:ring-2 focus:ring-blue-500 outline-none"
                >
                  <option value="PAID">PAID</option>
                  <option value="PENDING">PENDING</option>
                  <option value="FAILED">FAILED</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">Transaction Ref (Optional)</label>
                <input
                  type="text"
                  placeholder="e.g. TXN_291048102"
                  value={transactionId}
                  onChange={(e) => setTransactionId(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg font-mono text-xs focus:ring-2 focus:ring-blue-500 outline-none"
                />
              </div>
            </div>
          </div>

          {/* Pricing & GST Breakdown */}
          <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-200 space-y-4">
            <h2 className="text-sm font-bold uppercase tracking-wider text-gray-500">
              Totals Calculation
            </h2>

            <div className="space-y-3 text-sm">
              <div className="flex justify-between text-gray-600">
                <span>Items Subtotal:</span>
                <span className="font-semibold text-gray-900">₹{subtotal.toLocaleString('en-IN')}</span>
              </div>

              {/* GST Toggle */}
              <div className="pt-2 border-t border-gray-100 flex items-center justify-between">
                <label className="flex items-center gap-2 cursor-pointer text-xs font-semibold text-gray-700">
                  <input
                    type="checkbox"
                    checked={applyGst}
                    onChange={(e) => setApplyGst(e.target.checked)}
                    className="w-4 h-4 text-blue-600 rounded cursor-pointer"
                  />
                  <span>Add 18% GST</span>
                </label>
                <span className="font-semibold text-gray-900">
                  {applyGst ? `₹${gstAmount.toLocaleString('en-IN')}` : '₹0'}
                </span>
              </div>

              {/* Shipping Override */}
              <div className="pt-2 border-t border-gray-100 space-y-1">
                <div className="flex items-center justify-between text-xs font-semibold text-gray-700">
                  <span>Shipping Fee:</span>
                  <span className="font-semibold text-gray-900">
                    {shippingAmount === 0 ? <span className="text-emerald-600">FREE</span> : `₹${shippingAmount}`}
                  </span>
                </div>
                <input
                  type="number"
                  placeholder="Override shipping (auto: free > ₹500)"
                  value={customShipping}
                  onChange={(e) => setCustomShipping(e.target.value)}
                  className="w-full px-2.5 py-1 text-xs border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                />
              </div>

              {/* Grand Total */}
              <div className="pt-4 border-t-2 border-gray-200 flex justify-between items-baseline">
                <span className="font-bold text-gray-900 text-base">Grand Total:</span>
                <span className="font-black text-2xl text-blue-600">
                  ₹{grandTotal.toLocaleString('en-IN')}
                </span>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="pt-4 space-y-2">
              <button
                onClick={handleDownload}
                disabled={downloading}
                className="w-full flex items-center justify-center gap-2 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold transition-all shadow-md cursor-pointer disabled:opacity-50"
              >
                <FiDownload className="w-5 h-5" />
                <span>{downloading ? 'Exporting PDF...' : 'Download Invoice PDF'}</span>
              </button>
              <button
                onClick={handlePrint}
                className="w-full flex items-center justify-center gap-2 py-2.5 bg-gray-100 hover:bg-gray-200 text-gray-800 rounded-xl font-semibold transition-all cursor-pointer"
              >
                <FiPrinter className="w-4 h-4" />
                <span>Browser Print (A4)</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Hidden container dedicated for window.print() and html2canvas PDF capture */}
      <div id="admin-invoice-print-root" ref={invoiceRef}>
        <Invoice
          order={syntheticOrder}
          user={{ name: customer.fullName, email: customer.email, phone: customer.phone }}
          totals={totalsObj}
          invoiceNumber={invoiceNumber}
          forExport={true}
        />
      </div>

      {/* Modal Preview */}
      {previewOpen && (
        <div 
          className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm overflow-y-auto p-2 sm:p-4 md:p-6 flex justify-center items-start"
          onClick={() => setPreviewOpen(false)}
        >
          <div 
            className="max-w-4xl w-full my-auto sm:my-4"
            onClick={(e) => e.stopPropagation()}
          >
            <Invoice
              order={syntheticOrder}
              user={{ name: customer.fullName, email: customer.email, phone: customer.phone }}
              totals={totalsObj}
              invoiceNumber={invoiceNumber}
              forExport={false}
              onClose={() => setPreviewOpen(false)}
              onPrint={handlePrint}
            />
          </div>
        </div>
      )}
    </div>
  );
}
