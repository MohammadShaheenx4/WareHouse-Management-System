import { Router } from "express";
import * as controller from './auth.controller.js';

const router = Router();

router.post('/register', controller.register);
router.post('/login', controller.login);
router.post('/resetPassword', controller.resetPassword);
router.get('/users', controller.getAllUsers);
router.put('/:userId', controller.updateUser);
router.delete('/:userId', controller.deleteUser);




export default router;