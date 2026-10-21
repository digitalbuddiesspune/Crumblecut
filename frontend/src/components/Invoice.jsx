import React, { useRef, useState } from 'react';
import { FiDownload, FiPrinter, FiX, FiCheckCircle } from 'react-icons/fi';
import { COMPANY_INFO } from '../config/companyInfo';
import { INVOICE_EXPORT_CSS } from '../utils/invoiceExportStyles';
import { downloadInvoicePdf } from '../utils/downloadInvoicePdf';
import { printInvoice } from '../utils/printInvoice';
import logoImg from '../assets/CRUMBLECUT Red Geometric Wordmark.png';

const formatINR = (val) => `₹${Number(val || 0).toLocaleString('en-IN')}`;

export const formatInvoiceDate = (dateVal) => {
  const d = dateVal ? new Date(dateVal) : new Date();
  return d.toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
};

export default function Invoice({
  order = {},
  user = {},
  totals = null,
  invoiceNumber = null,
  forExport = false,
  onPrint = null,
  onClose = null,
}) {
  const exportRef = useRef(null);
  const [downloading, setDownloading] = useState(false);

  // Derived or provided values
  const invNum =
    invoiceNumber ||
    (order?._id
      ? `INV-${String(order._id).slice(-8).toUpperCase()}`
      : `INV-${Date.now().toString().slice(-8)}`);

  const invDate = formatInvoiceDate(order?.createdAt);

  const customerName =
    order?.shippingAddress?.fullName ||
    user?.name ||
    user?.firstName
      ? `${user?.firstName || ''} ${user?.lastName || ''}`.trim()
      : 'Valued Customer';

  const customerPhone =
    order?.shippingAddress?.mobileNumber ||
    user?.phone ||
    user?.mobile ||
    '—';

  const customerEmail =
    order?.shippingAddress?.email ||
    user?.email ||
    '—';

  const shippingAddr = order?.shippingAddress
    ? [
        order.shippingAddress.address,
        order.shippingAddress.locality,
        order.shippingAddress.city,
        order.shippingAddress.state,
        order.shippingAddress.pincode ? `PIN: ${order.shippingAddress.pincode}` : '',
      ]
        .filter(Boolean)
        .join(', ')
    : 'Standard Delivery';

  const paymentMethod = (
    order?.paymentMethod ||
    (order?.airpayOrderId ? 'Airpay (UPI/QR)' : order?.razorpayPaymentId ? 'Razorpay' : 'COD')
  ).toUpperCase();

  const paymentStatus = (
    order?.paymentStatus ||
    (order?.status === 'paid' ? 'PAID' : 'PENDING')
  ).toUpperCase();

  // Calculate items and financial breakdown
  const items = (order?.items || []).map((it) => {
    const title = it?.product?.title || it?.title || 'Product Item';
    const qty = Number(it?.quantity || 1);
    const price = Number(it?.price || 0);
    const size = it?.size || it?.selectedSize || '';
    const lineTotal = price * qty;
    return { title, qty, price, size, lineTotal };
  });

  const calculatedSubtotal = items.reduce((acc, it) => acc + it.lineTotal, 0);
  const subtotal = totals?.subtotal !== undefined ? totals.subtotal : calculatedSubtotal;
  const gstAmount = totals?.gst !== undefined ? totals.gst : 0;
  const shippingAmount = totals?.shipping !== undefined ? totals.shipping : (subtotal >= 500 ? 0 : 49);
  const grandTotal =
    totals?.total !== undefined
      ? totals.total
      : order?.amount !== undefined
      ? Number(order.amount)
      : subtotal + gstAmount + shippingAmount;

  const handleDownload = async () => {
    if (!exportRef.current) return;
    try {
      setDownloading(true);
      await downloadInvoicePdf(exportRef.current, `${invNum}.pdf`);
    } catch (err) {
      console.error('Invoice download error:', err);
      alert('Failed to generate PDF. Please try again.');
    } finally {
      setDownloading(false);
    }
  };

  const handlePrint = () => {
    if (onPrint) {
      onPrint();
    } else if (exportRef.current) {
      printInvoice(exportRef.current);
    } else {
      window.print();
    }
  };

  // -------------------------------------------------------------
  // 1. PURE EXPORT MODE (for html2canvas / A4 printing)
  // -------------------------------------------------------------
  if (forExport) {
    return (
      <div className="invoice-export" ref={exportRef}>
        <style dangerouslySetInnerHTML={{ __html: INVOICE_EXPORT_CSS }} />

        {/* Top Header */}
        <div className="invoice-export-top">
          <div>
            <img src={logoImg} alt={COMPANY_INFO.brandName} className="invoice-export-logo" />
            <div className="invoice-export-company">
              <strong>{COMPANY_INFO.legalName}</strong>
              <br />
              {COMPANY_INFO.registeredAddress}
              <br />
              GSTIN: <strong>{COMPANY_INFO.gstin}</strong> | CIN: {COMPANY_INFO.cin}
              <br />
              Email: {COMPANY_INFO.email} | Web: {COMPANY_INFO.website}
            </div>
          </div>
          <div style={{ textAlign: 'right' }}>
            <h1 className="invoice-export-doc-title">TAX INVOICE</h1>
            <div className="invoice-export-badge">{paymentStatus}</div>
            <div style={{ marginTop: '12px', fontSize: '12px', color: '#4B5563' }}>
              <div><strong>Invoice #:</strong> {invNum}</div>
              <div><strong>Date:</strong> {invDate}</div>
              <div><strong>Place of Supply:</strong> {COMPANY_INFO.placeOfSupply}</div>
            </div>
          </div>
        </div>

        {/* 2-Column Details: Bill/Ship To & Order Summary */}
        <div className="invoice-export-grid-2">
          <div className="invoice-export-block">
            <div className="invoice-export-block-title">BILLED & SHIPPED TO</div>
            <div className="invoice-export-body-text">
              <div style={{ fontWeight: 700, color: '#111827', fontSize: '13px' }}>{customerName}</div>
              <div>{shippingAddr}</div>
              <div style={{ marginTop: '4px' }}>Phone: {customerPhone}</div>
              <div>Email: {customerEmail}</div>
            </div>
          </div>

          <div className="invoice-export-block">
            <div className="invoice-export-block-title">ORDER & PAYMENT SUMMARY</div>
            <table className="invoice-export-details-table">
              <tbody>
                <tr>
                  <td>Order ID</td>
                  <td>#{order?._id ? String(order._id).slice(-8).toUpperCase() : invNum}</td>
                </tr>
                <tr>
                  <td>Payment Mode</td>
                  <td>{paymentMethod}</td>
                </tr>
                <tr>
                  <td>Payment Status</td>
                  <td><strong style={{ color: paymentStatus === 'PAID' ? '#15803D' : '#B45309' }}>{paymentStatus}</strong></td>
                </tr>
                {order?.transactionId && (
                  <tr>
                    <td>Transaction Ref</td>
                    <td><span style={{ fontSize: '11px', fontFamily: 'monospace' }}>{order.transactionId}</span></td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Line Items Table */}
        <table className="invoice-export-table">
          <thead>
            <tr>
              <th style={{ width: '40px' }} className="center">#</th>
              <th>Description / Item</th>
              <th style={{ width: '80px' }} className="center">Size</th>
              <th style={{ width: '90px' }} className="right">Unit Price</th>
              <th style={{ width: '60px' }} className="center">Qty</th>
              <th style={{ width: '100px' }} className="right">Total</th>
            </tr>
          </thead>
          <tbody>
            {items.length === 0 ? (
              <tr>
                <td colSpan="6" className="center" style={{ padding: '16px', color: '#6B7280' }}>
                  No items in this invoice
                </td>
              </tr>
            ) : (
              items.map((it, idx) => (
                <tr key={idx}>
                  <td className="center">{idx + 1}</td>
                  <td>
                    <strong>{it.title}</strong>
                  </td>
                  <td className="center">{it.size || '—'}</td>
                  <td className="right">{formatINR(it.price)}</td>
                  <td className="center">{it.qty}</td>
                  <td className="right"><strong>{formatINR(it.lineTotal)}</strong></td>
                </tr>
              ))
            )}
          </tbody>
        </table>

        {/* Totals Breakdown */}
        <div className="invoice-export-totals">
          <div className="invoice-export-totals-box">
            <div className="invoice-export-totals-row">
              <span>Subtotal</span>
              <span>{formatINR(subtotal)}</span>
            </div>
            {gstAmount > 0 && (
              <div className="invoice-export-totals-row">
                <span>GST (18% Included/Applicable)</span>
                <span>{formatINR(gstAmount)}</span>
              </div>
            )}
            <div className="invoice-export-totals-row">
              <span>Shipping & Handling</span>
              <span>{shippingAmount === 0 ? 'FREE' : formatINR(shippingAmount)}</span>
            </div>
            <div className="invoice-export-totals-grand">
              <span>Grand Total</span>
              <span>{formatINR(grandTotal)}</span>
            </div>
          </div>
        </div>

        {/* Bottom Section: Terms & Signatory */}
        <div className="invoice-export-bottom-grid">
          <div>
            <div style={{ fontWeight: 700, fontSize: '12px', marginBottom: '4px' }}>Terms & Conditions:</div>
            <div style={{ fontSize: '11px', color: '#6B7280', lineHeight: 1.5 }}>
              1. This is a computer generated invoice and requires no physical signature under IT Act 2000.
              <br />
              2. For returns or exchanges, refer to our return policy within 7 days of delivery.
              <br />
              3. All disputes are subject to Mumbai jurisdiction.
            </div>
          </div>
          <div className="invoice-export-signatory">
            <div>For <strong>{COMPANY_INFO.legalName}</strong></div>
            <div className="invoice-export-signatory-line">{COMPANY_INFO.authorizedSignatory}</div>
          </div>
        </div>

        <div className="invoice-export-footer">
          Thank you for choosing {COMPANY_INFO.brandName}! For support, write to {COMPANY_INFO.email} or call {COMPANY_INFO.phone}.
        </div>
      </div>
    );
  }

  // -------------------------------------------------------------
  // 2. INTERACTIVE UI MODE (Modal / Preview with Print & PDF actions)
  // -------------------------------------------------------------
  return (
    <div className="relative bg-white rounded-2xl shadow-2xl border border-gray-200 overflow-hidden w-full max-w-4xl">
      {/* Hidden export version ready for PDF capture */}
      <div style={{ position: 'fixed', left: '-9999px', top: 0, opacity: 0, pointerEvents: 'none' }}>
        <div ref={exportRef}>
          <Invoice
            order={order}
            user={user}
            totals={totals}
            invoiceNumber={invNum}
            forExport={true}
          />
        </div>
      </div>

      {/* Action Toolbar - Sticky at the top so it never scrolls off */}
      <div className="sticky top-0 z-30 bg-gray-900 text-white px-4 py-3 sm:px-6 sm:py-3.5 flex items-center justify-between gap-2 shadow-md">
        <div className="flex items-center gap-2 min-w-0">
          <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-lg bg-white/10 flex items-center justify-center font-bold text-xs sm:text-sm shrink-0">
            CC
          </div>
          <div className="min-w-0">
            <h3 className="font-semibold text-xs sm:text-sm truncate">Tax Invoice Preview</h3>
            <p className="text-[11px] text-gray-400 font-mono truncate">{invNum}</p>
          </div>
        </div>
        <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
          <button
            onClick={handlePrint}
            className="flex items-center gap-1.5 px-2.5 py-1.5 sm:px-3 sm:py-1.5 bg-white/10 hover:bg-white/20 text-white text-xs font-semibold rounded-lg transition-colors cursor-pointer"
            title="Print Invoice"
          >
            <FiPrinter className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Print</span>
          </button>
          <button
            onClick={handleDownload}
            disabled={downloading}
            className="flex items-center gap-1.5 px-3 py-1.5 sm:px-4 sm:py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded-lg transition-colors cursor-pointer shadow-sm disabled:opacity-50"
            title="Download PDF"
          >
            <FiDownload className="w-3.5 h-3.5" />
            <span>{downloading ? 'Exporting...' : 'Download PDF'}</span>
          </button>
          {onClose && (
            <button
              onClick={onClose}
              className="p-1 sm:p-1.5 hover:bg-white/10 text-gray-300 hover:text-white rounded-lg transition-colors ml-1 cursor-pointer"
              title="Close"
            >
              <FiX className="w-5 h-5" />
            </button>
          )}
        </div>
      </div>

      {/* Interactive Clean Preview */}
      <div className="p-4 sm:p-6 md:p-8 space-y-5 sm:space-y-6 max-h-[82vh] overflow-y-auto">
        {/* Header */}
        <div className="flex flex-col sm:flex-row justify-between items-start gap-4 pb-5 border-b border-gray-200">
          <div>
            <img src={logoImg} alt={COMPANY_INFO.brandName} className="h-8 sm:h-10 w-auto object-contain mb-2" />
            <div className="text-xs text-gray-500 leading-relaxed max-w-sm">
              <strong className="text-gray-800">{COMPANY_INFO.legalName}</strong>
              <br />
              {COMPANY_INFO.registeredAddress}
              <br />
              GSTIN: <span className="font-mono font-medium">{COMPANY_INFO.gstin}</span> | CIN: {COMPANY_INFO.cin}
            </div>
          </div>
          <div className="sm:text-right w-full sm:w-auto flex flex-col sm:items-end">
            <span className="text-xl sm:text-2xl font-black tracking-tight text-gray-900 block">TAX INVOICE</span>
            <span className="inline-block mt-1 px-2.5 py-0.5 rounded text-xs font-bold uppercase bg-emerald-100 text-emerald-800 self-start sm:self-end">
              {paymentStatus}
            </span>
            <div className="mt-2.5 text-xs text-gray-600 space-y-1">
              <div>Invoice #: <strong className="font-mono text-gray-900">{invNum}</strong></div>
              <div>Date: <strong className="text-gray-900">{invDate}</strong></div>
              <div>Place of Supply: <strong>{COMPANY_INFO.placeOfSupply}</strong></div>
            </div>
          </div>
        </div>

        {/* Details Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 sm:gap-4">
          <div className="p-4 rounded-xl bg-gray-50 border border-gray-200">
            <h4 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Billed & Shipped To</h4>
            <div className="text-sm font-bold text-gray-900">{customerName}</div>
            <div className="text-xs text-gray-600 mt-1 leading-relaxed">{shippingAddr}</div>
            <div className="text-xs text-gray-600 mt-2">
              <div>Phone: <span className="font-medium text-gray-800">{customerPhone}</span></div>
              <div>Email: <span className="font-medium text-gray-800">{customerEmail}</span></div>
            </div>
          </div>

          <div className="p-4 rounded-xl bg-gray-50 border border-gray-200">
            <h4 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Order & Payment Info</h4>
            <div className="text-xs space-y-2">
              <div className="flex justify-between">
                <span className="text-gray-500">Order ID:</span>
                <span className="font-mono font-bold text-gray-900">
                  #{order?._id ? String(order._id).slice(-8).toUpperCase() : invNum}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Payment Mode:</span>
                <span className="font-medium text-gray-900">{paymentMethod}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Payment Status:</span>
                <span className="font-bold text-emerald-700">{paymentStatus}</span>
              </div>
              {order?.transactionId && (
                <div className="flex justify-between">
                  <span className="text-gray-500">Txn Ref:</span>
                  <span className="font-mono text-gray-700">{order.transactionId}</span>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Item Table (Responsive Scrollable Container) */}
        <div className="border border-gray-200 rounded-xl overflow-x-auto">
          <table className="w-full text-left border-collapse min-w-[500px]">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200 text-xs font-bold uppercase text-gray-600 tracking-wider">
                <th className="py-3 px-4 text-center w-12">#</th>
                <th className="py-3 px-4">Item</th>
                <th className="py-3 px-4 text-center">Size</th>
                <th className="py-3 px-4 text-right">Price</th>
                <th className="py-3 px-4 text-center">Qty</th>
                <th className="py-3 px-4 text-right">Total</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 text-sm">
              {items.length === 0 ? (
                <tr>
                  <td colSpan="6" className="py-8 text-center text-gray-500 text-sm">
                    No items in this invoice
                  </td>
                </tr>
              ) : (
                items.map((it, idx) => (
                  <tr key={idx} className="hover:bg-gray-50/50">
                    <td className="py-3 px-4 text-center text-xs text-gray-400">{idx + 1}</td>
                    <td className="py-3 px-4 font-medium text-gray-900">{it.title}</td>
                    <td className="py-3 px-4 text-center text-xs font-semibold text-gray-600">{it.size || '—'}</td>
                    <td className="py-3 px-4 text-right text-gray-700">{formatINR(it.price)}</td>
                    <td className="py-3 px-4 text-center font-medium">{it.qty}</td>
                    <td className="py-3 px-4 text-right font-bold text-gray-900">{formatINR(it.lineTotal)}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Totals */}
        <div className="flex justify-end">
          <div className="w-full sm:max-w-xs border border-gray-200 rounded-xl p-4 bg-gray-50 space-y-2 text-sm">
            <div className="flex justify-between text-gray-600">
              <span>Subtotal</span>
              <span>{formatINR(subtotal)}</span>
            </div>
            {gstAmount > 0 && (
              <div className="flex justify-between text-gray-600">
                <span>GST (18%)</span>
                <span>{formatINR(gstAmount)}</span>
              </div>
            )}
            <div className="flex justify-between text-gray-600">
              <span>Shipping Charges</span>
              <span className="font-medium text-gray-800">
                {shippingAmount === 0 ? <span className="text-emerald-700 font-bold">FREE</span> : formatINR(shippingAmount)}
              </span>
            </div>
            <div className="pt-2 border-t border-gray-200 flex justify-between font-bold text-base text-gray-900">
              <span>Grand Total</span>
              <span>{formatINR(grandTotal)}</span>
            </div>
          </div>
        </div>

        {/* Footer Note */}
        <div className="text-center text-xs text-gray-400 pt-3 border-t border-gray-100">
          This is an electronically generated invoice from {COMPANY_INFO.legalName}.
        </div>
      </div>
    </div>
  );
}
