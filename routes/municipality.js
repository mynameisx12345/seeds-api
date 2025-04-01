import express from 'express';
import { getDistributions, getFarmers, municipalityDistribute } from '../controller/municipality.js';
const router = express.Router();


router.get('/farmers', async(req,res)=>{
    const farmers = await getFarmers();
    res.status(201).send(farmers);
});

router.get('/distribute/:id',async(req,res)=>{
    const result = await getDistributions(req.params.id);
    res.status(201).send(result);
});

router.get('/distribute',async(req,res)=>{
    const result = await getDistributions(req.params.id);
    res.status(201).send(result);
});

router.post('/distribute', async(req,res)=>{
    const result = await municipalityDistribute(req.body);
    res.status(201).send(result);
})



export default router;