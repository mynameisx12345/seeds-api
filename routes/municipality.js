import express from 'express';
import { addFarmer, deleteFarmer,  getDistributionByFarmer, getDistributions, getFarmers, municipalityDistribute } from '../controller/municipality.js';
const router = express.Router();


router.get('/farmers', async(req,res)=>{
    const farmers = await getFarmers();
    res.status(201).send(farmers);
});

router.delete('/farmers/:id', async(req,res)=>{
    const result = await deleteFarmer(req.params.id);
    res.status(201).send(result);
})

router.post('/farmers', async(req,res)=>{
    const result = await addFarmer(req.body);
    res.status(201).send(result);
})

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

router.get('/distribute-by-farmer',async(req,res)=>{
    const result = await getDistributionByFarmer();
    res.status(201).send(result);
})



export default router;