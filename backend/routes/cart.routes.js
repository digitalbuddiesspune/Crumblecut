import { Router } from 'express';
import mongoose from 'mongoose';
import auth from '../middleware/auth.js';
import Cart from '../models/Cart.js';

const router = Router();

/**
 * Consolidates duplicate items in cart (e.g. if an item was added with size and without size,
 * or multiple identical items were created due to race conditions or previous bugs).
 */
function consolidateCartItems(rawItems) {
  if (!Array.isArray(rawItems) || rawItems.length <= 1) return rawItems;

  const grouped = new Map();

  for (const item of rawItems) {
    if (!item || !item.product) continue;
    const productId = (item.product._id || item.product).toString();
    const rawSize = item.size ? String(item.size).trim() : null;

    if (!grouped.has(productId)) {
      grouped.set(productId, []);
    }
    grouped.get(productId).push({
      item,
      size: rawSize,
      quantity: Math.max(1, Number(item.quantity) || 1),
    });
  }

  const consolidated = [];

  for (const [, entries] of grouped.entries()) {
    if (entries.length === 1) {
      const e = entries[0];
      e.item.quantity = e.quantity;
      e.item.size = e.size || undefined;
      consolidated.push(e.item);
      continue;
    }

    const withSize = entries.filter(e => Boolean(e.size));
    const withoutSize = entries.filter(e => !e.size);

    // If there is only one distinct size among entries, merge any no-size entries into it
    const distinctSizes = new Set(withSize.map(e => e.size.toLowerCase()));
    if (distinctSizes.size === 1 && withoutSize.length > 0) {
      const target = withSize[0];
      const extraQty = withoutSize.reduce((sum, e) => sum + e.quantity, 0);
      target.quantity += extraQty;
      target.item.quantity = target.quantity;
      target.item.size = target.size;
      consolidated.push(target.item);
      continue;
    }

    // Merge entries that have matching sizes (case-insensitive)
    const sizeMap = new Map();
    for (const e of entries) {
      const key = e.size ? e.size.toLowerCase() : '__nosize__';
      if (!sizeMap.has(key)) {
        sizeMap.set(key, { ...e });
      } else {
        const existing = sizeMap.get(key);
        existing.quantity += e.quantity;
        if (!existing.size && e.size) existing.size = e.size;
      }
    }

    for (const merged of sizeMap.values()) {
      merged.item.quantity = merged.quantity;
      merged.item.size = merged.size || undefined;
      consolidated.push(merged.item);
    }
  }

  return consolidated;
}

// GET /api/cart -> current user's cart (auto-consolidating duplicates)
router.get('/', auth, async (req, res) => {
  let cart = await Cart.findOne({ user: req.userId }).populate('items.product');
  if (!cart) {
    return res.json({ user: req.userId, items: [] });
  }

  const prevCount = cart.items.length;
  cart.items = consolidateCartItems(cart.items);
  if (cart.items.length !== prevCount) {
    await cart.save();
    cart = await Cart.findOne({ user: req.userId }).populate('items.product');
  }

  res.json(cart);
});

// POST /api/cart/add -> { productId, quantity?, size? }
router.post('/add', auth, async (req, res) => {
  const { productId, quantity = 1, size } = req.body || {};
  if (!productId || !mongoose.isValidObjectId(productId)) {
    return res.status(400).json({ message: 'Invalid productId' });
  }
  const qty = Number(quantity) || 1;
  if (qty < 1) return res.status(400).json({ message: 'Quantity must be >= 1' });

  let cart = await Cart.findOne({ user: req.userId });
  if (!cart) cart = new Cart({ user: req.userId, items: [] });

  cart.items = consolidateCartItems(cart.items);

  const cleanSize = size ? String(size).trim() : null;

  // Matching logic:
  // 1. Exact match on product and size (case-insensitive)
  // 2. If size not provided, and product already in cart, match the existing item
  let idx = cart.items.findIndex(i => {
    const pId = (i.product?._id || i.product).toString();
    if (pId !== productId) return false;
    const iSize = i.size ? String(i.size).trim() : null;
    if (cleanSize) {
      return (iSize || '').toLowerCase() === cleanSize.toLowerCase();
    }
    return true; // Match the existing item if no size was requested
  });

  if (idx > -1) {
    cart.items[idx].quantity += qty;
    if (cleanSize && !cart.items[idx].size) {
      cart.items[idx].size = cleanSize;
    }
  } else {
    cart.items.push({
      product: productId,
      quantity: qty,
      size: cleanSize || undefined,
    });
  }

  await cart.save();
  const populated = await cart.populate('items.product');
  res.json(populated);
});

// PUT /api/cart/quantity -> { productId, quantity, size?, itemId? }
router.put('/quantity', auth, async (req, res) => {
  const { productId, quantity, size, itemId } = req.body || {};
  if (!productId || !mongoose.isValidObjectId(productId)) {
    return res.status(400).json({ message: 'Invalid productId' });
  }
  const targetQty = Number(quantity);

  let cart = await Cart.findOne({ user: req.userId });
  if (!cart) cart = new Cart({ user: req.userId, items: [] });

  cart.items = consolidateCartItems(cart.items);

  const cleanSize = size ? String(size).trim() : null;

  // If quantity <= 0, remove item
  if (targetQty < 1) {
    cart.items = cart.items.filter(i => {
      const pId = (i.product?._id || i.product).toString();
      if (pId !== productId) return true;
      if (itemId && i._id && i._id.toString() === itemId.toString()) return false;
      if (cleanSize) {
        const iSize = i.size ? String(i.size).trim() : null;
        return (iSize || '').toLowerCase() !== cleanSize.toLowerCase();
      }
      return false;
    });
    await cart.save();
    const populated = await cart.populate('items.product');
    return res.json(populated);
  }

  // Find target item:
  // 1. By subdocument itemId if provided
  let idx = -1;
  if (itemId) {
    idx = cart.items.findIndex(i => i._id && i._id.toString() === itemId.toString());
  }

  // 2. By productId and size match
  if (idx === -1 && cleanSize) {
    idx = cart.items.findIndex(i => {
      const pId = (i.product?._id || i.product).toString();
      const iSize = i.size ? String(i.size).trim() : null;
      return pId === productId && (iSize || '').toLowerCase() === cleanSize.toLowerCase();
    });
  }

  // 3. Fallback: by productId
  if (idx === -1) {
    idx = cart.items.findIndex(i => {
      const pId = (i.product?._id || i.product).toString();
      return pId === productId;
    });
  }

  if (idx > -1) {
    cart.items[idx].quantity = targetQty;
    if (cleanSize && !cart.items[idx].size) {
      cart.items[idx].size = cleanSize;
    }
  } else {
    cart.items.push({
      product: productId,
      quantity: targetQty,
      size: cleanSize || undefined,
    });
  }

  await cart.save();
  const populated = await cart.populate('items.product');
  res.json(populated);
});

// DELETE /api/cart/remove/:id -> remove by productId (and optional size / itemId)
router.delete('/remove/:id', auth, async (req, res) => {
  const { id: productId } = req.params;
  const { size, itemId } = req.query;

  if (!productId || !mongoose.isValidObjectId(productId)) {
    return res.status(400).json({ message: 'Invalid productId' });
  }

  const cart = await Cart.findOne({ user: req.userId });
  if (!cart) return res.json({ user: req.userId, items: [] });

  const cleanSize = size ? String(size).trim() : null;

  cart.items = cart.items.filter(i => {
    const pId = (i.product?._id || i.product).toString();
    if (pId !== productId) return true;
    if (itemId && i._id && i._id.toString() === itemId.toString()) return false;
    if (cleanSize) {
      const iSize = i.size ? String(i.size).trim() : null;
      return (iSize || '').toLowerCase() !== cleanSize.toLowerCase();
    }
    return false;
  });

  cart.items = consolidateCartItems(cart.items);
  await cart.save();
  const populated = await cart.populate('items.product');
  res.json(populated);
});

export default router;
