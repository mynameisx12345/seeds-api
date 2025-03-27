import express from 'express';
import {getMunicipalities, login} from '../controller/user.js'
const router = express.Router();

router.post('/login', async(req,res)=>{
    const user = await login(req.body)
    res.status(201).send(user);
});

router.get('/municipalities', async(req,res)=>{
    const municipalities = await getMunicipalities();
    res.status(201).send(municipalities);
})

export default router;