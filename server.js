import express from 'express';
import cors from 'cors';
import userRouter from './routes/user.js';
import provinceRouter from './routes/province.js';
import municipalityRouter from './routes/municipality.js';

import bodyParser from 'body-parser';

const app = express();

app.use(express.json());
app.use(express.urlencoded({extended:true}))
app.use(bodyParser.json());

app.use(cors());
app.use('/users',userRouter);
app.use('/province',provinceRouter);
app.use('/municipality', municipalityRouter);

app.listen(3000);