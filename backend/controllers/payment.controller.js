import crypto from 'crypto';
import Cart from '../models/Cart.js';
import Order from '../models/Order.js';
import PendingPayment from '../models/PendingPayment.js';
import { Address } from '../models/Address.js';
import {
  generateUpiQr,
  verifyAirpayOrder,
  verifyIpnSecureHash,
} from '../services/airpay.service.js';
import { sendOrderInvoiceEmail } from '../services/invoiceEmail.service.js';

function buildCartItems(cart) {
  return cart.items.map((i) => {
    const p = i.product;
    let base = 0;
    if (p && typeof p.price === 'number') {
      base = Number(p.price) || 0;
    } else {
      const mrp = Number(p?.mrp) || 0;
      const discountPercent = Number(p?.discountPercent) || 0;
      base = Math.round(mrp - (mrp * discountPercent) / 100) || 0;
    }
    return {
      product: p._id,
      quantity: i.quantity,
      price: base,
      size: i.size || undefined,
    };
  });
}

function computePayable(items) {
  const subtotal = items.reduce((sum, it) => sum + it.price * it.quantity, 0);
  const shippingCharge = subtotal < 5000 ? 99 : 0;
  const tax = Math.round(subtotal * 0.05);
  return {
    subtotal,
    shippingCharge,
    tax,
    amount: subtotal + shippingCharge + tax,
  };
}

async function loadShippingAddress(userId) {
  const addr = await Address.findOne({ userId });
  if (!addr) return null;
  const {
    fullName,
    mobileNumber,
    pincode,
    locality,
    address,
    city,
    state,
    landmark,
    alternatePhone,
    addressType,
  } = addr;
  return {
    fullName,
    mobileNumber,
    pincode,
    locality,
    address,
    city,
    state,
    landmark,
    alternatePhone,
    addressType,
  };
}

function makeOrderId() {
  const stamp = Date.now().toString(36).toUpperCase();
  const rand = crypto.randomBytes(3).toString('hex').toUpperCase();
  return `VR${stamp}${rand}`.slice(0, 20);
}

function extractOrderIdFromIpn(fields = {}) {
  return (
    fields.TRANSACTIONID ||
    fields.merchant_txn_id ||
    fields.MERCHANT_TXN_ID ||
    fields.ORDERID ||
    fields.orderid ||
    fields.CUSTOMVAR ||
    null
  );
}

/** Airpay dashboard sometimes logs fields with missing '=' (MERCID59568). Repair those. */
function normalizeIpnFields(input = {}) {
  let fields = { ...(input || {}) };

  // Rare: whole query string parsed as a single key
  const keys = Object.keys(fields);
  if (keys.length === 1) {
    const onlyKey = keys[0];
    const onlyVal = fields[onlyKey];
    const candidate =
      onlyKey.includes('TRANSACTION') && onlyKey.includes('&')
        ? onlyKey
        : typeof onlyVal === 'string' && onlyVal.includes('TRANSACTION')
          ? onlyVal
          : null;
    if (candidate) {
      fields = Object.fromEntries(new URLSearchParams(candidate));
    }
  }

  const PREFIXES = [
    'TRANSACTIONPAYMENTSTATUS',
    'APTRANSACTIONID',
    'TRANSACTIONSTATUS',
    'TRANSACTIONID',
    'CURRENCYCODE',
    'CHARGE_TYPE',
    'CUSTOMERPHONE',
    'TXN_MODE',
    'CUSTOMER',
    'MESSAGE',
    'MERCID',
    'AMOUNT',
    'CHMOD',
  ];

  const out = {};
  for (const [rawKey, rawVal] of Object.entries(fields)) {
    const key = String(rawKey || '').trim();
    let val = rawVal;
    if (typeof val === 'string') val = val.trim();

    let handled = false;
    for (const prefix of PREFIXES) {
      if (key === prefix) {
        out[prefix] = val;
        handled = true;
        break;
      }
      if (key.startsWith(prefix) && key.length > prefix.length) {
        const glued = key.slice(prefix.length).replace(/^[=:\s]+/, '');
        const emptyVal = val === '' || val == null || val === true;
        if (emptyVal && glued && /^[\w.-]+$/.test(glued)) {
          out[prefix] = glued;
          handled = true;
          break;
        }
      }
    }
    if (!handled) out[key] = val;
  }

  return out;
}

function isAirpayIpnSuccess(fields = {}) {
  const txnStatus = String(fields.TRANSACTIONSTATUS || fields.transactionstatus || '').trim();
  const payStatus = String(
    fields.TRANSACTIONPAYMENTSTATUS || fields.transactionpaymentstatus || ''
  )
    .trim()
    .toLowerCase();
  const message = String(fields.MESSAGE || fields.message || '').trim().toLowerCase();

  return (
    txnStatus === '200' ||
    txnStatus === '0' ||
    payStatus === 'success' ||
    payStatus === 'capture' ||
    payStatus === 'authorize' ||
    payStatus === 'sale' ||
    message === 'success'
  );
}

/**
 * Create final Order from a PendingPayment snapshot (idempotent).
 */
async function fulfillPendingPayment(pending, { apTransactionId, transactionId, raw } = {}) {
  if (!pending) return null;

  if (pending.status === 'paid' && pending.order) {
    const existing = await Order.findById(pending.order);
    if (existing) return existing;
  }

  const existingByAirpay = await Order.findOne({ airpayOrderId: pending.orderid });
  if (existingByAirpay) {
    pending.status = 'paid';
    pending.order = existingByAirpay._id;
    if (apTransactionId) pending.apTransactionId = apTransactionId;
    if (raw) pending.rawVerify = raw;
    await pending.save();
    return existingByAirpay;
  }

  const order = await Order.create({
    user: pending.user,
    items: pending.items,
    amount: pending.amount,
    currency: pending.currency || 'INR',
    status: 'paid',
    orderStatus: 'confirmed',
    paymentStatus: 'paid',
    paymentMethod: 'airpay',
    transactionId: apTransactionId || transactionId || pending.apTransactionId || pending.orderid,
    airpayOrderId: pending.orderid,
    airpayTransactionId: apTransactionId || pending.apTransactionId || '',
    shippingAddress: pending.shippingAddress,
  });

  pending.status = 'paid';
  pending.order = order._id;
  if (apTransactionId) pending.apTransactionId = apTransactionId;
  if (raw) pending.rawVerify = raw;
  await pending.save();

  // Clear cart for this user after successful payment
  try {
    const cart = await Cart.findOne({ user: pending.user });
    if (cart) {
      cart.items = [];
      await cart.save();
    }
  } catch (cartErr) {
    console.error('Failed to clear cart after Airpay payment:', cartErr?.message || cartErr);
  }

  console.log('Airpay order placed:', order._id.toString(), 'orderid=', pending.orderid);
  // Send invoice email asynchronously
  sendOrderInvoiceEmail(order._id).catch((err) =>
    console.error('[Invoice Email Error]:', err?.message || err)
  );
  return order;
}

/** Airpay V3 — create UPI QR for checkout */
export const createOrder = async (req, res) => {
  try {
    const userId = req.userId;
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });

    const cart = await Cart.findOne({ user: userId }).populate('items.product');
    if (!cart || !Array.isArray(cart.items) || cart.items.length === 0) {
      return res.status(400).json({ error: 'Cart is empty' });
    }

    const items = buildCartItems(cart);
    const { amount } = computePayable(items);
    if (!amount || amount <= 0) {
      return res.status(400).json({ error: 'Invalid cart amount' });
    }

    const shippingAddress = await loadShippingAddress(userId);
    if (!shippingAddress?.mobileNumber) {
      return res.status(400).json({
        error: 'Shipping address with mobile number is required before payment',
      });
    }

    const orderid = makeOrderId();
    const buyerPhone = shippingAddress.mobileNumber;
    const buyerEmail =
      req.body?.email ||
      req.body?.notes?.email ||
      `${buyerPhone}@crumblecut.customer`;

    const airpay = await generateUpiQr({
      orderid,
      amount,
      buyerPhone,
      buyerEmail,
    });

    if (!airpay.qrcode_string) {
      console.error('Airpay generateOrder missing QR:', airpay.raw);
      return res.status(502).json({
        error: 'Airpay did not return a UPI QR. Check merchant domain whitelist / credentials.',
        detail: airpay.raw,
      });
    }

    await PendingPayment.findOneAndUpdate(
      { orderid },
      {
        orderid,
        user: userId,
        items,
        amount,
        currency: 'INR',
        shippingAddress,
        apTransactionId: airpay.ap_transactionid || '',
        status: 'pending',
      },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );

    return res.json({
      gateway: 'airpay',
      version: 3,
      orderid: airpay.orderid,
      amount: airpay.amount,
      qrcode_string: airpay.qrcode_string,
      ap_transactionid: airpay.ap_transactionid,
      mercid: airpay.mercid,
    });
  } catch (err) {
    console.error('Airpay createOrder error:', err?.message || err);
    return res.status(500).json({ error: err?.message || 'Failed to create Airpay order' });
  }
};

/** Airpay V3 — poll/verify payment then place order */
export const verifyPayment = async (req, res) => {
  try {
    const userId = req.userId;
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });

    const { orderid, ap_transactionid } = req.body || {};
    if (!orderid) {
      return res.status(400).json({ error: 'Missing orderid' });
    }

    // Already placed
    const existingOrder = await Order.findOne({ airpayOrderId: orderid, user: userId });
    if (existingOrder) {
      return res.json({ success: true, order: existingOrder, alreadyPaid: true });
    }

    let pending = await PendingPayment.findOne({ orderid, user: userId });
    if (!pending) {
      // Fallback: older QR without pending snapshot — use live cart once
      const cart = await Cart.findOne({ user: userId }).populate('items.product');
      if (!cart || !Array.isArray(cart.items) || cart.items.length === 0) {
        return res.status(404).json({
          error: 'Payment session not found. If money was deducted, contact support with order id.',
          orderid,
        });
      }
      const items = buildCartItems(cart);
      const { amount } = computePayable(items);
      const shippingAddress = await loadShippingAddress(userId);
      pending = await PendingPayment.create({
        orderid,
        user: userId,
        items,
        amount,
        shippingAddress,
        apTransactionId: ap_transactionid || '',
        status: 'pending',
      });
    }

    if (pending.status === 'paid' && pending.order) {
      const order = await Order.findById(pending.order);
      if (order) return res.json({ success: true, order, alreadyPaid: true });
    }

    const status = await verifyAirpayOrder({
      merchant_txn_id: orderid,
      processor_id: ap_transactionid || pending.apTransactionId || '',
    });

    console.log('Airpay verify result:', {
      orderid,
      success: status.success,
      pending: status.pending,
      statusCode: status.statusCode,
      paymentStatus: status.paymentStatus,
      message: status.message,
    });

    if (status.pending) {
      return res.json({
        success: false,
        pending: true,
        statusCode: status.statusCode,
        message: status.message || 'Payment in process',
      });
    }

    if (!status.success) {
      return res.json({
        success: false,
        pending: false,
        statusCode: status.statusCode,
        message: status.message || 'Payment not completed',
        raw: process.env.NODE_ENV === 'production' ? undefined : status.raw,
      });
    }

    const order = await fulfillPendingPayment(pending, {
      apTransactionId: status.apTransactionId || ap_transactionid,
      transactionId: status.transactionId || orderid,
      raw: status.raw,
    });

    return res.json({ success: true, order });
  } catch (err) {
    console.error('Airpay verifyPayment error:', err?.message || err);
    return res.status(500).json({ error: err?.message || 'Verification failed' });
  }
};

/** Airpay V3 IPN callback (server-to-server) — can place order without browser */
export const airpayIpn = async (req, res) => {
  try {
    const fields = normalizeIpnFields({ ...(req.body || {}), ...(req.query || {}) });
    console.log('Airpay IPN received:', {
      keys: Object.keys(fields),
      TRANSACTIONID: fields.TRANSACTIONID,
      APTRANSACTIONID: fields.APTRANSACTIONID,
      TRANSACTIONSTATUS: fields.TRANSACTIONSTATUS,
      TRANSACTIONPAYMENTSTATUS: fields.TRANSACTIONPAYMENTSTATUS,
      AMOUNT: fields.AMOUNT,
      MESSAGE: fields.MESSAGE,
    });

    const orderid = extractOrderIdFromIpn(fields);
    const apTxnId = String(
      fields.APTRANSACTIONID || fields.ap_transactionid || fields.aptransactionid || ''
    ).trim();

    if (fields.ap_SecureHash && !verifyIpnSecureHash(fields)) {
      console.warn('Airpay IPN: invalid secure hash for orderid=', orderid);
      // Still acknowledge — some channels send alternate hash formats
    }

    const isSuccess = isAirpayIpnSuccess(fields);

    if (isSuccess && (orderid || apTxnId)) {
      let pending = null;
      if (orderid) {
        pending = await PendingPayment.findOne({ orderid: String(orderid) });
        if (!pending) {
          pending = await PendingPayment.findOne({
            orderid: {
              $regex: `^${String(orderid).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`,
              $options: 'i',
            },
          });
        }
      }
      if (!pending && apTxnId) {
        pending = await PendingPayment.findOne({ apTransactionId: apTxnId });
        // Airpay logs sometimes truncate leading digits (16928770 vs 2016928770)
        if (!pending) {
          pending = await PendingPayment.findOne({
            apTransactionId: { $regex: `${apTxnId.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$` },
          });
        }
      }

      if (!pending) {
        console.warn(
          'Airpay IPN success but no PendingPayment for orderid=',
          orderid,
          'apTxnId=',
          apTxnId
        );
      } else {
        pending.rawIpn = fields;
        if (apTxnId && !pending.apTransactionId) pending.apTransactionId = apTxnId;
        await pending.save();
        const order = await fulfillPendingPayment(pending, {
          apTransactionId: apTxnId || fields.APTRANSACTIONID || fields.ap_transactionid,
          transactionId: fields.TRANSACTIONID || orderid,
          raw: fields,
        });
        console.log(
          'Airpay IPN fulfilled order:',
          order?._id?.toString(),
          'orderid=',
          pending.orderid
        );
      }
    } else {
      console.log('Airpay IPN non-success:', {
        orderid,
        apTxnId,
        txnStatus: fields.TRANSACTIONSTATUS,
        payStatus: fields.TRANSACTIONPAYMENTSTATUS,
      });
    }

    // Airpay expects a quick 200 acknowledgement
    return res.status(200).json({ status: 200, message: 'Success' });
  } catch (err) {
    console.error('Airpay IPN error:', err?.message || err);
    return res.status(500).json({ status: 500, message: 'Failed' });
  }
};

export const createCODOrder = async (req, res) => {
  try {
    const userId = req.userId;
    if (!userId) {
      console.error('COD Order: No userId found');
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const cart = await Cart.findOne({ user: userId }).populate('items.product');
    if (!cart || !Array.isArray(cart.items) || cart.items.length === 0) {
      console.error('COD Order: Cart is empty for user', userId);
      return res.status(400).json({ error: 'Cart is empty' });
    }

    const items = buildCartItems(cart);
    const { amount } = computePayable(items);

    let shippingAddress = null;
    try {
      shippingAddress = await loadShippingAddress(userId);
    } catch (addrErr) {
      console.error('COD Order: Error fetching address:', addrErr?.message || addrErr);
    }

    if (!shippingAddress) {
      return res.status(400).json({
        error: 'Shipping address is required. Please save your delivery address first.',
      });
    }

    const order = await Order.create({
      user: userId,
      items,
      amount,
      currency: 'INR',
      status: 'pending',
      paymentMethod: 'cod',
      paymentStatus: 'pending',
      shippingAddress,
    });

    cart.items = [];
    await cart.save();

    console.log('COD Order created successfully:', order._id);
    // Send invoice email asynchronously
    sendOrderInvoiceEmail(order._id).catch((err) =>
      console.error('[Invoice Email Error]:', err?.message || err)
    );
    return res.json({ success: true, order });
  } catch (err) {
    console.error('Create COD order error:', err?.message || err);
    console.error('Stack:', err?.stack);
    return res.status(500).json({ error: err?.message || 'Failed to create COD order' });
  }
};
