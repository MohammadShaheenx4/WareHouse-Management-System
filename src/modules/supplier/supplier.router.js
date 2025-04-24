import { Router } from "express";
import * as controller from './supplier.controller.js';


const router = Router();

router.get('/suppliers', controller.getAllSuppliers);




export default router;