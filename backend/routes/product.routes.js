import express from 'express';
import { getProducts, getProductById, getCategories } from '../controllers/product.controller.js';

const router = express.Router();

// GET /api/products/categories - Get distinct categories
router.get('/categories', getCategories);

// GET /api/products - Get all products or filter by category
router.get('/', getProducts);

// GET /api/products/:id - Get a single product by ID
router.get('/:id', getProductById);

export default router;
