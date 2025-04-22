import cors from 'cors'
import { connectDB } from '../DB/Connection.js';
import authRouter from './modules/auth/auth.router.js'
import categoryRouter from './modules/category/category.router.js'
import productRouter from './modules/product/product.router.js'
import supplierOrderRoutes from './modules/supplierOrder/supplierOrder.router.js';

import 'dotenv/config'

const initApp = async (app, express) => {

    app.use(express.json());
    app.use(cors());
    connectDB();
    app.get('/', (req, res) => {
        return res.status(200).json({ message: "welcome......" });
    });

    app.use("/auth", authRouter);
    app.use("/category", categoryRouter);
    app.use("/product", productRouter);
    app.use('/supplierOrders', supplierOrderRoutes);





    app.use((req, res, next) => {
        return res.status(404).json({ message: "Page not found" });
    });


}
export default initApp;
