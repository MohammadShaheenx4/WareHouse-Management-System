import cors from 'cors'
import { connectDB } from '../DB/Connection.js';
import authRouter from './modules/auth/auth.router.js'

const initApp = async (app, express) => {

    app.use(express.json());
    app.use(cors());
    connectDB();
    app.get('/', (req, res) => {
        return res.status(200).json({ message: "welcome......" });
    });

    app.use("/auth", authRouter);




    app.use((req, res, next) => {
        return res.status(404).json({ message: "Page not found" });
    });


}
export default initApp;
