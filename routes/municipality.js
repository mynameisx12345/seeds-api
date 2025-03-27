import express from 'express';
import { getDistributionByM, getDistributions, getInventoryReport, getSeeds, provinceDistribute } from '../controller/province.js';
import { getFarmers } from '../controller/municipality.js';
const router = express.Router();


router.get('/farmers', async(req,res)=>{
    const farmers = await getFarmers();
    res.status(201).send(farmers);
});

export default router;