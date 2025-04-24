import cors from 'cors'
import { connectDB } from '../DB/Connection.js';
import authRouter from './modules/auth/auth.router.js'
import categoryRouter from './modules/category/category.router.js'
import productRouter from './modules/product/product.router.js'
import supplierOrderRoutes from './modules/supplierOrder/supplierOrder.router.js';
import supplierRouter from './modules/supplier/supplier.router.js'
import 'dotenv/config'

const initApp = async (app, express) => {
    // Configure CORS properly
    const corsOptions = {
        origin: '*', // Replace with your frontend URL in production
        methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
        allowedHeaders: ['Content-Type', 'Authorization', 'Accept'],
        credentials: true
    };

    app.use(cors(corsOptions));

    // Configure body parsers (just once)
    app.use(express.json({ limit: '50mb' }));
    app.use(express.urlencoded({ extended: true, limit: '50mb' }));

    // Connect to database
    connectDB();

    // Routes
    app.get('/', (req, res) => {
        return res.status(200).json({ message: "welcome......" });
    });

    app.use("/auth", authRouter);
    app.use("/category", categoryRouter);
    app.use("/product", productRouter);
    app.use('/supplierOrders', supplierOrderRoutes);
    app.use('/supplier', supplierRouter);


    // 404 handler
    app.use((req, res, next) => {
        return res.status(404).json({ message: "Page not found" });
    });
}

export default initApp;