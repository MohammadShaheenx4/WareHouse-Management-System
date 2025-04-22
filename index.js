import express from 'express';
import initApp from './src/app.router.js';
import 'dotenv/config'
import cors from 'cors'


const app = express();
const PORT = process.env.PORT || 3000;
app.use(cors());

initApp(app, express);
app.listen(PORT, () => {

    console.log(`Server is Running .....${PORT}`);

})