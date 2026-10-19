import mongoose from 'mongoose';

const PendingItemSchema = new mongoose.Schema(
  {
    product: { type: mongoose.Schema.Types.ObjectId, ref: 'Product', required: true },
    quantity: { type: Number, required: true, min: 1 },
    price: { type: Number, required: true },
    size: { type: String },
  },
  { _id: false }
);

const ShippingAddressSchema = new mongoose.Schema(
  {
    fullName: String,
    mobileNumber: String,
    pincode: String,
    locality: String,
    address: String,
    city: String,
    state: String,
    landmark: String,
    alternatePhone: String,
    addressType: String,
  },
  { _id: false }
);

const PendingPaymentSchema = new mongoose.Schema(
  {
    orderid: { type: String, required: true, unique: true, index: true },
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    items: { type: [PendingItemSchema], default: [] },
    amount: { type: Number, required: true },
    currency: { type: String, default: 'INR' },
    shippingAddress: { type: ShippingAddressSchema },
    apTransactionId: { type: String },
    status: {
      type: String,
      enum: ['pending', 'paid', 'failed', 'expired'],
      default: 'pending',
      index: true,
    },
    order: { type: mongoose.Schema.Types.ObjectId, ref: 'Order' },
    rawVerify: { type: mongoose.Schema.Types.Mixed },
    rawIpn: { type: mongoose.Schema.Types.Mixed },
  },
  { timestamps: true }
);

export const PendingPayment =
  mongoose.models.PendingPayment || mongoose.model('PendingPayment', PendingPaymentSchema);
export default PendingPayment;
