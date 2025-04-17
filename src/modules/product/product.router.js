import { Router } from "express";
import * as controller from './product.controller.js';

const router = Router();


router.get('/products', controller.getAllProducts);
router.get('/:productId', controller.getProduct);



export default router;