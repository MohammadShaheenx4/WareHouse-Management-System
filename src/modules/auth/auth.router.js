import { Router } from "express";
import * as controller from './auth.controller.js';

import fileUpload, { fileValidation } from "../../utils/multer.js";

const router = Router();

router.post('/register', controller.register);
router.post('/login', controller.login);
router.post('/resetPassword', controller.resetPassword);
router.get('/users', controller.getAllUsers);
router.put('/:userId', fileUpload(fileValidation.image).single('profilePicture'), controller.updateUser);
router.delete('/:userId', controller.deleteUser);




export default router;