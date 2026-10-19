/**
 * Recover an Airpay-paid checkout that IPN/verify failed to place.
 *
 * Usage:
 *   node scripts/recover-airpay-order.js VRMS07CU3Z93F915
 *   node scripts/recover-airpay-order.js VRMS07CU3Z93F915 2016928770
 */
import 'dotenv/config';
import mongoose from 'mongoose';
import PendingPayment from '../models/PendingPayment.js';
import Order from '../models/Order.js';
import Cart from '../models/Cart.js';
import { verifyAirpayOrder } from '../services/airpay.service.js';

const orderid = process.argv[2];
const apTxnArg = process.argv[3] || '';

if (!orderid) {
  console.error('Usage: node scripts/recover-airpay-order.js <TRANSACTIONID> [APTRANSACTIONID]');
  process.exit(1);
}

async function fulfill(pending, apTransactionId, raw) {
  if (pending.status === 'paid' && pending.order) {
    const existing = await Order.findById(pending.order);
    if (existing) return existing;
  }

  const existingByAirpay = await Order.findOne({ airpayOrderId: pending.orderid });
  if (existingByAirpay) {
    pending.status = 'paid';
    pending.order = existingByAirpay._id;
    if (apTransactionId) pending.apTransactionId = String(apTransactionId);
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
    transactionId: apTransactionId || pending.apTransactionId || pending.orderid,
    airpayOrderId: pending.orderid,
    airpayTransactionId: apTransactionId || pending.apTransactionId || '',
    shippingAddress: pending.shippingAddress,
  });

  pending.status = 'paid';
  pending.order = order._id;
  if (apTransactionId) pending.apTransactionId = String(apTransactionId);
  if (raw) pending.rawVerify = raw;
  await pending.save();

  try {
    const cart = await Cart.findOne({ user: pending.user });
    if (cart) {
      cart.items = [];
      await cart.save();
    }
  } catch (e) {
    console.warn('Cart clear failed:', e?.message || e);
  }

  return order;
}

async function main() {
  await mongoose.connect(process.env.MONGO_URI || process.env.MONGODB_URI);
  console.log('Looking up PendingPayment for', orderid);

  let pending = await PendingPayment.findOne({ orderid });
  if (!pending) {
    console.error('No PendingPayment found for', orderid);
    console.error('Cannot auto-create order without the checkout snapshot.');
    process.exit(2);
  }

  console.log('Pending:', {
    orderid: pending.orderid,
    amount: pending.amount,
    status: pending.status,
    apTransactionId: pending.apTransactionId,
    user: String(pending.user),
  });

  const status = await verifyAirpayOrder({
    merchant_txn_id: orderid,
    processor_id: apTxnArg || pending.apTransactionId || '',
  });

  console.log('Airpay verify:', {
    success: status.success,
    pending: status.pending,
    statusCode: status.statusCode,
    paymentStatus: status.paymentStatus,
    apTransactionId: status.apTransactionId,
    amount: status.amount,
    message: status.message,
  });

  const force =
    process.argv.includes('--force') ||
    status.success ||
    String(status.statusCode) === '0' ||
    String(status.paymentStatus || '').toLowerCase() === 'success';

  if (!force) {
    console.error('Airpay did not confirm success. Re-run with --force only if money was captured.');
    process.exit(3);
  }

  const order = await fulfill(
    pending,
    status.apTransactionId || apTxnArg || pending.apTransactionId,
    status.raw
  );

  console.log('Order ready:', {
    id: String(order._id),
    orderNumber: order.orderNumber,
    amount: order.amount,
    paymentStatus: order.paymentStatus,
    airpayOrderId: order.airpayOrderId,
  });

  await mongoose.disconnect();
}

main().catch(async (err) => {
  console.error(err);
  try {
    await mongoose.disconnect();
  } catch {
    /* ignore */
  }
  process.exit(1);
});
