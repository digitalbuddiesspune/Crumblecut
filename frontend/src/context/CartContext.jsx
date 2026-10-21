import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { api } from '../utils/api';

const CartContext = createContext();

export const CartProvider = ({ children }) => {
  const [cart, setCart] = useState([]);
  const navigate = useNavigate();
  const location = useLocation();

  const hasToken = () => Boolean(localStorage.getItem('auth_token'));

  const mapServerCartToUI = useCallback((data) => {
    const items = data?.items || [];
    return items.map((i) => {
      const p = i.product || {};
      const price = typeof p.price === 'number'
        ? p.price
        : (typeof p.mrp === 'number' ? Math.round(p.mrp - (p.mrp * (p.discountPercent || 0) / 100)) : 0);
      return {
        id: p._id, // used by UI and for remove
        itemId: i._id || `${p._id}_${i.size || 'default'}`,
        cartItemId: i._id,
        name: p.title,
        image: p.images?.image1,
        material: p.product_info?.SareeMaterial,
        work: p.product_info?.IncludedComponents,
        brand: p.product_info?.brand,
        color: p.product_info?.KurtiColor || p.product_info?.SareeColor,
        size: i.size || null,
        price,
        originalPrice: p.mrp,
        quantity: i.quantity || 1,
      };
    });
  }, []);

  const loadCart = useCallback(async () => {
    if (!hasToken()) {
      setCart([]);
      return;
    }
    try {
      const data = await api.getCart();
      setCart(mapServerCartToUI(data));
    } catch (err) {
      console.error('Failed to load cart:', err);
    }
  }, [mapServerCartToUI]);

  const requireAuth = useCallback(() => {
    if (!hasToken()) {
      alert('Please login to access your cart');
      navigate('/signin', { state: { from: location }, replace: true });
      return false;
    }
    return true;
  }, [navigate, location]);

  const addToCart = useCallback(async (productIdOrObj, quantity = 1, size = null) => {
    if (!requireAuth()) return;
    // Accept either productId or a product object
    let productId = productIdOrObj;
    if (typeof productIdOrObj === 'object' && productIdOrObj) {
      productId = productIdOrObj._id || productIdOrObj.id;
    }
    const cleanSize = size ? String(size).trim() : null;
    await api.addToCart({ productId, quantity, size: cleanSize });
    await loadCart();
  }, [requireAuth, loadCart]);

  const removeFromCart = useCallback(async (productId, size = null, itemId = null) => {
    if (!requireAuth()) return;
    setCart((prevCart) =>
      prevCart.filter((item) => {
        if (itemId && ((item.cartItemId && item.cartItemId === itemId) || item.itemId === itemId)) return false;
        if (!itemId && item.id === productId && (!size || (item.size || '').toLowerCase() === String(size).toLowerCase())) return false;
        return true;
      })
    );
    try {
      const data = await api.removeFromCart(productId, size, itemId);
      setCart(mapServerCartToUI(data));
    } catch (err) {
      console.error('Failed to remove from cart:', err);
      await loadCart();
    }
  }, [requireAuth, mapServerCartToUI, loadCart]);

  const updateQuantity = useCallback(async (productId, newQuantity, size = null, itemId = null) => {
    if (!requireAuth()) return;
    if (newQuantity < 1) {
      await removeFromCart(productId, size, itemId);
      return;
    }

    // Immediate optimistic update in UI so quantity responds with zero lag
    setCart((prevCart) =>
      prevCart.map((item) => {
        const isMatch = itemId
          ? (item.cartItemId && item.cartItemId === itemId) || item.itemId === itemId
          : (item.id === productId && (!size || (item.size || '').toLowerCase() === String(size).toLowerCase()));
        return isMatch ? { ...item, quantity: newQuantity } : item;
      })
    );

    try {
      const data = await api.updateCartQuantity({ productId, quantity: newQuantity, size, itemId });
      setCart(mapServerCartToUI(data));
    } catch (err) {
      console.error('Failed to update cart quantity:', err);
      await loadCart();
    }
  }, [requireAuth, removeFromCart, mapServerCartToUI, loadCart]);

  const clearCart = useCallback(async () => {
    if (!requireAuth()) return;
    for (const item of cart) {
      await api.removeFromCart(item.id, item.size, item.cartItemId);
    }
    await loadCart();
  }, [requireAuth, cart, loadCart]);

  const cartTotal = cart.reduce((total, item) => total + ((item.price || 0) * (item.quantity || 1)), 0);
  const cartCount = cart.reduce((total, item) => total + (item.quantity || 1), 0);

  useEffect(() => {
    loadCart();
    const onStorage = (e) => {
      if (!e || e.key === 'auth_token') loadCart();
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, [loadCart]);

  // Also reload on route changes to reflect auth changes in the same tab
  useEffect(() => {
    loadCart();
  }, [location.pathname, loadCart]);

  return (
    <CartContext.Provider value={{
      cart,
      addToCart,
      removeFromCart,
      updateQuantity,
      clearCart,
      cartTotal,
      cartCount,
      loadCart,
    }}>
      {children}
    </CartContext.Provider>
  );
};

export const useCart = () => {
  const context = useContext(CartContext);
  if (!context) {
    throw new Error('useCart must be used within a CartProvider');
  }
  return context;
};
