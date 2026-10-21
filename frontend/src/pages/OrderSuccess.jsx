import React, { useEffect, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { FaCheckCircle, FaShoppingBag, FaArrowRight, FaFileInvoice } from 'react-icons/fa';
import Invoice from '../components/Invoice';
import { api } from '../utils/api';

export default function OrderSuccess() {
  const navigate = useNavigate();
  const location = useLocation();
  const [countdown, setCountdown] = useState(10);
  const [isPaused, setIsPaused] = useState(false);
  const [showInvoice, setShowInvoice] = useState(false);
  const [orderData, setOrderData] = useState(null);
  const [loadingInvoice, setLoadingInvoice] = useState(false);

  const orderId = location.state?.orderId || null;
  const orderNumber = location.state?.orderNumber || null;

  useEffect(() => {
    if (isPaused) return;
    const timer = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          navigate('/profile?tab=orders', { replace: true });
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [navigate, isPaused]);

  const handleOpenInvoice = async () => {
    setIsPaused(true);
    if (!orderId) {
      alert('Order ID not available to generate invoice preview.');
      return;
    }
    try {
      setLoadingInvoice(true);
      const data = await api.getOrder(orderId);
      setOrderData(data);
      setShowInvoice(true);
    } catch (err) {
      console.error('Failed to load order for invoice:', err);
      alert('Could not load invoice details right now. You can download it anytime from My Orders.');
    } finally {
      setLoadingInvoice(false);
    }
  };

  const handleGoToOrders = () => {
    navigate('/profile?tab=orders', { replace: true });
  };

  const handleContinueShopping = () => {
    navigate('/', { replace: true });
  };

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4 py-12">
      <div className="max-w-2xl w-full bg-white rounded-2xl shadow-xl p-8 md:p-12 text-center">
        {/* Success Icon */}
        <div className="mb-6 flex justify-center">
          <div className="relative">
            <div className="absolute inset-0 bg-green-100 rounded-full animate-ping opacity-75"></div>
            <FaCheckCircle className="relative text-green-500 text-6xl md:text-7xl" />
          </div>
        </div>

        {/* Success Message */}
        <h1 className="text-3xl md:text-4xl font-bold text-gray-900 mb-4">
          Order Placed Successfully!
        </h1>

        <p className="text-lg text-gray-600 mb-2">
          Thank you for shopping with Crumblecut! We've received your order and will begin processing it right away.
        </p>

        {orderId && (
          <p className="text-sm text-gray-500 mb-6">
            Order ID: <span className="font-mono font-semibold text-gray-800">#{String(orderId).slice(-8).toUpperCase()}</span>
          </p>
        )}

        {/* Order Info Box */}
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-6 mb-8 text-left sm:text-center">
          <div className="flex items-center justify-center gap-3 mb-2">
            <FaShoppingBag className="text-amber-700 text-2xl" />
            <h2 className="text-xl font-semibold text-amber-900">
              {orderNumber ? 'Payment Received' : 'Order Confirmed'}
            </h2>
          </div>
          <p className="text-amber-800 text-sm">
            A confirmation email with your tax invoice will be sent to your registered email address shortly.
          </p>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-col sm:flex-row gap-3 justify-center mb-6">
          {orderId && (
            <button
              onClick={handleOpenInvoice}
              disabled={loadingInvoice}
              className="flex items-center justify-center gap-2 bg-blue-600 text-white px-6 py-3 rounded-xl font-semibold hover:bg-blue-700 transition-colors shadow-sm cursor-pointer disabled:opacity-50"
            >
              <FaFileInvoice className="text-base" />
              <span>{loadingInvoice ? 'Loading...' : 'Download Invoice'}</span>
            </button>
          )}

          <button
            onClick={handleGoToOrders}
            className="flex items-center justify-center gap-2 bg-black text-white px-6 py-3 rounded-xl font-semibold hover:bg-gray-800 transition-colors cursor-pointer"
          >
            <span>View My Orders</span>
            <FaArrowRight className="text-xs" />
          </button>

          <button
            onClick={handleContinueShopping}
            className="flex items-center justify-center gap-2 bg-gray-100 text-gray-900 px-6 py-3 rounded-xl font-semibold hover:bg-gray-200 transition-colors cursor-pointer"
          >
            Continue Shopping
          </button>
        </div>

        {/* Auto-redirect notice */}
        {!isPaused && (
          <p className="text-xs text-gray-500">
            Redirecting to orders page in <span className="font-semibold text-gray-700">{countdown}</span> seconds...
          </p>
        )}
      </div>

      {/* Invoice Modal Preview */}
      {showInvoice && orderData && (
        <div 
          className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm overflow-y-auto p-2 sm:p-4 md:p-6 flex justify-center items-start"
          onClick={() => {
            setShowInvoice(false);
            setIsPaused(false);
          }}
        >
          <div 
            className="max-w-4xl w-full my-auto sm:my-4"
            onClick={(e) => e.stopPropagation()}
          >
            <Invoice
              order={orderData}
              user={orderData.user}
              onClose={() => {
                setShowInvoice(false);
                setIsPaused(false);
              }}
            />
          </div>
        </div>
      )}
    </div>
  );
}
