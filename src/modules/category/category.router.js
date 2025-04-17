import { Router } from "express";
import * as controller from './category.controller.js';

const router = Router();

router.post('/add', controller.add);




export default router;