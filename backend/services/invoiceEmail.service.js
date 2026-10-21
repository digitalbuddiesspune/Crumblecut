import { Resend } from 'resend';
import nodemailer from 'nodemailer';
import Order from '../models/Order.js';
import { COMPANY_INFO } from '../config/companyInfo.js';

const formatINR = (val) => `₹${Number(val || 0).toLocaleString('en-IN')}`;

/**
 * Builds clean, responsive email HTML for the invoice.
 */
function buildInvoiceEmailHtml(order, customerName) {
  const invNum = `INV-${String(order._id).slice(-8).toUpperCase()}`;
  const invDate = new Date(order.createdAt || Date.now()).toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });

  const items = (order.items || []).map((it) => {
    const title = it.product?.title || it.title || 'Product';
    const size = it.size ? ` (Size: ${it.size})` : '';
    const qty = it.quantity || 1;
    const price = Number(it.price || 0);
    const lineTotal = price * qty;
    return `
      <tr>
        <td style="padding: 10px 12px; border-bottom: 1px solid #e5e7eb; font-size: 13px; color: #111827;">
          <strong>${title}</strong>${size}
        </td>
        <td style="padding: 10px 12px; border-bottom: 1px solid #e5e7eb; font-size: 13px; color: #374151; text-align: center;">
          ${qty}
        </td>
        <td style="padding: 10px 12px; border-bottom: 1px solid #e5e7eb; font-size: 13px; color: #374151; text-align: right;">
          ${formatINR(price)}
        </td>
        <td style="padding: 10px 12px; border-bottom: 1px solid #e5e7eb; font-size: 13px; color: #111827; text-align: right; font-weight: bold;">
          ${formatINR(lineTotal)}
        </td>
      </tr>
    `;
  }).join('');

  const shippingAddr = order.shippingAddress
    ? [
        order.shippingAddress.fullName,
        order.shippingAddress.address,
        order.shippingAddress.locality,
        order.shippingAddress.city,
        `${order.shippingAddress.state} - ${order.shippingAddress.pincode}`,
        order.shippingAddress.mobileNumber ? `Phone: ${order.shippingAddress.mobileNumber}` : '',
      ]
        .filter(Boolean)
        .join('<br />')
    : 'Standard Delivery';

  const paymentMethod = (
    order.paymentMethod || (order.airpayOrderId ? 'Airpay' : 'COD')
  ).toUpperCase();

  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <title>Invoice #${invNum}</title>
    </head>
    <body style="font-family: Arial, Helvetica, sans-serif; background-color: #f9fafb; margin: 0; padding: 24px;">
      <div style="max-width: 600px; margin: 0 auto; background-color: #ffffff; border: 1px solid #e5e7eb; border-radius: 8px; overflow: hidden; box-shadow: 0 1px 3px rgba(0,0,0,0.05);">
        
        <!-- Header -->
        <div style="padding: 24px; border-bottom: 2px solid #111827;">
          <table style="width: 100%; border-collapse: collapse;">
            <tr>
              <td>
                <h1 style="margin: 0; font-size: 24px; font-weight: bold; color: #111827; letter-spacing: -0.5px;">
                  ${COMPANY_INFO.brandName}
                </h1>
                <p style="margin: 4px 0 0; font-size: 11px; color: #6b7280; line-height: 1.4;">
                  ${COMPANY_INFO.legalName}<br />
                  GSTIN: ${COMPANY_INFO.gstin} | CIN: ${COMPANY_INFO.cin}
                </p>
              </td>
              <td style="text-align: right; vertical-align: top;">
                <span style="font-size: 16px; font-weight: bold; color: #111827; letter-spacing: 0.5px;">TAX INVOICE</span><br />
                <span style="font-size: 12px; color: #6b7280; font-family: monospace;">#${invNum}</span><br />
                <span style="font-size: 11px; color: #6b7280;">Date: ${invDate}</span>
              </td>
            </tr>
          </table>
        </div>

        <!-- Greeting -->
        <div style="padding: 20px 24px; background-color: #f3f4f6; border-bottom: 1px solid #e5e7eb;">
          <p style="margin: 0; font-size: 14px; color: #111827;">
            Hi <strong>${customerName}</strong>, thank you for your order! Here is your official tax invoice details.
          </p>
        </div>

        <!-- Billed To & Payment Summary -->
        <div style="padding: 20px 24px; border-bottom: 1px solid #e5e7eb;">
          <table style="width: 100%; border-collapse: collapse;">
            <tr>
              <td style="width: 50%; vertical-align: top; padding-right: 12px;">
                <h3 style="margin: 0 0 8px; font-size: 12px; text-transform: uppercase; color: #6b7280;">Billed & Shipped To</h3>
                <div style="font-size: 13px; color: #374151; line-height: 1.5;">
                  ${shippingAddr}
                </div>
              </td>
              <td style="width: 50%; vertical-align: top; padding-left: 12px;">
                <h3 style="margin: 0 0 8px; font-size: 12px; text-transform: uppercase; color: #6b7280;">Payment Details</h3>
                <div style="font-size: 13px; color: #374151; line-height: 1.6;">
                  <strong>Payment Mode:</strong> ${paymentMethod}<br />
                  <strong>Payment Status:</strong> ${(order.paymentStatus || order.status || 'PAID').toUpperCase()}<br />
                  <strong>Order ID:</strong> #${String(order._id).slice(-8).toUpperCase()}
                </div>
              </td>
            </tr>
          </table>
        </div>

        <!-- Items Table -->
        <div style="padding: 16px 24px;">
          <table style="width: 100%; border-collapse: collapse; margin-top: 8px;">
            <thead>
              <tr style="background-color: #f9fafb;">
                <th style="padding: 8px 12px; border-bottom: 2px solid #e5e7eb; text-align: left; font-size: 11px; text-transform: uppercase; color: #4b5563;">Item</th>
                <th style="padding: 8px 12px; border-bottom: 2px solid #e5e7eb; text-align: center; font-size: 11px; text-transform: uppercase; color: #4b5563;">Qty</th>
                <th style="padding: 8px 12px; border-bottom: 2px solid #e5e7eb; text-align: right; font-size: 11px; text-transform: uppercase; color: #4b5563;">Price</th>
                <th style="padding: 8px 12px; border-bottom: 2px solid #e5e7eb; text-align: right; font-size: 11px; text-transform: uppercase; color: #4b5563;">Total</th>
              </tr>
            </thead>
            <tbody>
              ${items}
            </tbody>
          </table>
        </div>

        <!-- Totals -->
        <div style="padding: 12px 24px 24px;">
          <table style="width: 100%; border-collapse: collapse;">
            <tr>
              <td style="width: 60%;"></td>
              <td style="width: 40%;">
                <table style="width: 100%; border-collapse: collapse; font-size: 13px;">
                  <tr>
                    <td style="padding: 6px 0; color: #6b7280;">Subtotal:</td>
                    <td style="padding: 6px 0; text-align: right; font-weight: 500; color: #111827;">${formatINR(order.amount)}</td>
                  </tr>
                  <tr>
                    <td style="padding: 6px 0; color: #6b7280;">Shipping:</td>
                    <td style="padding: 6px 0; text-align: right; color: #15803d; font-weight: bold;">FREE</td>
                  </tr>
                  <tr style="border-top: 2px solid #111827;">
                    <td style="padding: 10px 0 0; font-weight: bold; font-size: 15px; color: #111827;">Total:</td>
                    <td style="padding: 10px 0 0; text-align: right; font-weight: bold; font-size: 16px; color: #111827;">${formatINR(order.amount)}</td>
                  </tr>
                </table>
              </td>
            </tr>
          </table>
        </div>

        <!-- Footer -->
        <div style="padding: 20px 24px; background-color: #f9fafb; border-top: 1px solid #e5e7eb; text-align: center; font-size: 11px; color: #6b7280; line-height: 1.5;">
          <p style="margin: 0 0 4px;">
            Thank you for shopping with <strong>${COMPANY_INFO.brandName}</strong>!
          </p>
          <p style="margin: 0;">
            Support: <a href="mailto:${COMPANY_INFO.email}" style="color: #2563eb; text-decoration: none;">${COMPANY_INFO.email}</a> | Phone: ${COMPANY_INFO.phone}
          </p>
        </div>

      </div>
    </body>
    </html>
  `;
}

/**
 * Sends order invoice email with idempotency safeguard.
 * @param {string} orderId
 * @param {object} options
 */
export async function sendOrderInvoiceEmail(orderId, options = {}) {
  try {
    const order = await Order.findById(orderId).populate('items.product').populate('user');
    if (!order) {
      console.log(`[Invoice Email] Order ${orderId} not found`);
      return { skipped: true, reason: 'order_not_found' };
    }

    // Idempotency check: prevent sending multiple times
    if (order.invoiceEmailSentAt) {
      console.log(`[Invoice Email] Invoice email already sent for order ${orderId} at ${order.invoiceEmailSentAt}`);
      return { skipped: true, reason: 'already_sent' };
    }

    const recipientEmail =
      options.email ||
      order.shippingAddress?.email ||
      order.user?.email;

    const customerName =
      options.name ||
      order.shippingAddress?.fullName ||
      order.user?.name ||
      'Customer';

    if (!recipientEmail || !recipientEmail.includes('@') || recipientEmail.endsWith('@crumblecut.customer')) {
      console.log(`[Invoice Email] Skipping: No valid recipient email for order ${orderId} (${recipientEmail || 'none'})`);
      return { skipped: true, reason: 'no_valid_recipient' };
    }

    const html = buildInvoiceEmailHtml(order, customerName);
    const subject = `Your Tax Invoice for Order #${String(order._id).slice(-8).toUpperCase()} - ${COMPANY_INFO.brandName}`;

    // 1. Try Resend if API key is configured
    const resendApiKey = process.env.RESEND_API || process.env.RESEND_API_KEY;
    if (resendApiKey) {
      const resend = new Resend(resendApiKey);
      const fromAddress = process.env.RESEND_FROM || `${COMPANY_INFO.brandName} <onboarding@resend.dev>`;
      await resend.emails.send({
        from: fromAddress,
        to: recipientEmail,
        subject,
        html,
      });

      order.invoiceEmailSentAt = new Date();
      await order.save();
      console.log(`[Invoice Email] Successfully dispatched via Resend to ${recipientEmail}`);
      return { success: true, provider: 'resend' };
    }

    // 2. Try Nodemailer if SMTP credentials are provided
    if (process.env.SMTP_USER && process.env.SMTP_PASS) {
      const transporter = nodemailer.createTransport({
        host: process.env.SMTP_HOST || 'smtp.gmail.com',
        port: Number(process.env.SMTP_PORT) || 587,
        secure: process.env.SMTP_SECURE === 'true',
        auth: {
          user: process.env.SMTP_USER,
          pass: process.env.SMTP_PASS,
        },
      });

      await transporter.sendMail({
        from: `"${COMPANY_INFO.brandName}" <${process.env.SMTP_USER}>`,
        to: recipientEmail,
        subject,
        html,
      });

      order.invoiceEmailSentAt = new Date();
      await order.save();
      console.log(`[Invoice Email] Successfully dispatched via Nodemailer to ${recipientEmail}`);
      return { success: true, provider: 'nodemailer' };
    }

    console.log(`[Invoice Email] Skipped: Neither RESEND_API nor SMTP_USER configured in .env`);
    return { skipped: true, reason: 'email_provider_not_configured' };
  } catch (err) {
    console.error(`[Invoice Email Error for ${orderId}]:`, err?.message || err);
    return { error: err?.message || err };
  }
}

export default { sendOrderInvoiceEmail };
