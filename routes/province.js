import express from 'express';
import { getDistributionByM, getDistributions, getInventoryReport, getSeeds, provinceDistribute } from '../controller/province.js';
const router = express.Router();


router.get('/seeds', async(req,res)=>{
    const seeds = await getSeeds();
    res.status(201).send(seeds);
});

router.post('/distribute', async(req,res)=>{
    const result = await provinceDistribute(req.body);
    res.status(201).send(result);
});

router.get('/distribute/:municipality/:status',async(req,res)=>{
    const result = await getDistributionByM(req.params)
    res.status(201).send(result);
});

router.get('/distribute/:id',async(req,res)=>{
    console.log('id1', req.params.id)
    const result = await getDistributions(req.params.id);
    res.status(201).send(result);
});
router.get('/distribute',async(req,res)=>{
    console.log('id1', req.params.id)
    const result = await getDistributions(req.params.id);
    res.status(201).send(result);
});

router.get('/inventory-report/:warehouseType/:municipalityId', async(req,res)=>{
    const result = await getInventoryReport(req.params);
    res.status(201).send(result)
})

export default router;