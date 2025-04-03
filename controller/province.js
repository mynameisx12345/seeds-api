import mysql from 'mysql2';
import dotenv, { parse } from 'dotenv';
import moment from 'moment'

dotenv.config();

const pool =  mysql.createPool({
    host: process.env.MYSQL_HOST,
    user: process.env.MYSQL_USER,
    password:process.env.MYSQL_PASSWORD,
    database: process.env.MYSQL_DATABASE
}).promise();

export async function getSeeds(){
    const [result] = await pool.query(`
    SELECT seeds.id, 
        seeds.name,
        seeds.qty_remaining total_remaining,
        seeds.uom,
        seeds.qty_transit,
        seeds_remaining.qty_remaining,
        seeds_remaining.warehouse_type,
        seeds_remaining.municipality_id,
        mun.name municipality_name
    FROM seeds LEFT OUTER JOIN seeds_remaining ON (seeds.id = seeds_remaining.seed_id)
    LEFT OUTER JOIN municipality mun ON (seeds_remaining.municipality_id = mun.id)
    WHERE ISNULL(seeds.is_deleted) OR seeds.is_deleted = false
    `);

    const parseResult = (result) =>{
        let parsed = [];
        result.forEach((res)=>{
            const inParsed = parsed.find(parse=>parse.id === res.id);
            if(inParsed){
                inParsed.qty_remaining.push({
                    warehouse_type: res.warehouse_type,
                    municipality_id: res.municipality_id,
                    qty_remaining: res.qty_remaining,
                    municipality_name: res.municipality_name
                })
            } else {
                parsed.push({
                    id: res.id,
                    name: res.name,
                    total_remaining: res.total_remaining,
                    uom: res.uom,
                    qty_transit: res.qty_transit,
                    qty_remaining: [{
                        warehouse_type: res.warehouse_type,
                        municipality_id: res.municipality_id,
                        qty_remaining: res.qty_remaining,
                        municipality_name: res.municipality_name
                    }]
                })
            }
        });

        return parsed
    }

    return parseResult(result);
}

export async function saveDistributeDtl(body){
    const {id,details} = body;
    const [dltResult] = await pool.query(`
        DELETE FROM province_distribute_dtl
        WHERE hdr_id = ?
    `,[id]);

    const insertDtl = async (dtl)=>{
        const {seedId, qtyRemaining, uom, qtyDistributed, remarks, hdrId, qtyReceived} = dtl;
        const [insertResult] = await pool.query(`
            INSERT INTO province_distribute_dtl (seed_id, qty_remaining, uom, qty_distributed, remarks, hdr_id, qty_received)
            VALUES(?, ?, ?, ?, ?, ?, ?)
        `,[seedId, qtyRemaining, uom, qtyDistributed, remarks, hdrId, qtyReceived]);

        const insertId = insertResult.insertId;

        return {
            ...dtl,
            id: insertId
        }
    }

    const dtlResult = await Promise.all(details.map(dtl=>insertDtl({...dtl, hdrId:id})));

    return dtlResult;
}

async function updateSeedSub(detail){
    const {seedId, 
        qtyRemaining, 
        qtyDistributed, 
        qtyReceived, 
        transactType, 
        warehouseType, 
        qty, 
        municipalityId,
        isAbsolute
    } = detail;
    if(warehouseType === 'province'){ 
        const [result] = await pool.query(`
            SELECT * FROM seeds_remaining
            WHERE warehouse_type = 'province' AND
                seed_id = ?
        `,[seedId])

        if(result.length > 0){
            const {qty_remaining,id} = result[0];

            const newRemaining =  isAbsolute ? qty : (Number(qty_remaining) ?? 0) + qty
            
            const [adjustResult] = await pool.query(`
                UPDATE seeds_remaining
                SET qty_remaining = ?
                WHERE id = ?
            `,[newRemaining, id])
        } else {
            const [adjustResult] = await pool.query(`
                INSERT INTO seeds_remaining (seed_id, warehouse_type, qty_remaining)
                VALUES (?, ?, ?)
            `, [seedId, warehouseType, qty])
        }

        
    } else if (warehouseType === 'municipality'){
        const [result] = await pool.query(`
            SELECT * FROM seeds_remaining
            WHERE warehouse_type= 'municipality' AND
                seed_id = ? AND
                municipality_id = ?
        `, [seedId, municipalityId]);

        if(result.length > 0){
            const {qty_remaining,id} = result[0];

            const newRemaining = isAbsolute ? qty :  (Number(qty_remaining) ?? 0) + qty;
            
            const [adjustResult] = await pool.query(`
                UPDATE seeds_remaining
                SET qty_remaining = ?
                WHERE id = ?
            `,[newRemaining, id])
        } else {
            const [adjustResult] = await pool.query(`
                INSERT INTO seeds_remaining (seed_id, warehouse_type, municipality_id, qty_remaining)
                VALUES (?, ?, ?, ?)
            `, [seedId, warehouseType, municipalityId, qty])
        }

       
    }
}

export async function updateSeedMain(detail){
    const {seedId, qtyRemaining, qtyDistributed, qtyReceived, transactType, municipalityId} = detail;

    const [result] = await pool.query(`
        SELECT * FROM seeds
        WHERE id = ?
    `,[seedId]);

    const {
        qty_remaining: seedQtyRemaining,
        qty_transit: seedQtyTransit
    } = result[0];

    if(transactType === 'PDIST'){
        const newRemaining = (seedQtyRemaining ?? 0) - Number(qtyDistributed);
        const newTransit = (Number(seedQtyTransit) ?? 0) + Number(qtyDistributed);

        
        const [pdistResult] = await pool.query(`
            UPDATE seeds
            SET qty_remaining = ? ,
                qty_transit = ?
            WHERE id = ?
        `,[newRemaining, newTransit, seedId])

        updateSeedSub({...detail, warehouseType:'province',qty: (qtyDistributed * -1), municipalityId})

        
        
    } else if (transactType === 'PREC'){
        const newRemaining = (Number(seedQtyRemaining) ?? 0) + qtyReceived;
        const newTransit = (Number(seedQtyTransit) ?? 0) - qtyReceived;
        const [precResult] = await pool.query(`
            UPDATE seeds
            SET qty_remaining = ? ,
                qty_transit = ?
            WHERE id = ?
        `,[newRemaining, newTransit, seedId])

        updateSeedSub({...detail, warehouseType:'municipality',qty: qtyReceived, municipalityId})
    } else if(transactType === 'MDIST'){
        const newRemaining = (Number(seedQtyRemaining) ?? 0) - Number(qtyDistributed);
        const [mdistResult] = await pool.query(`
            UPDATE seeds
            SET qty_remaining = ?
            WHERE id = ?
        `,[newRemaining, seedId])

        updateSeedSub({...detail, warehouseType:'municipality',qty: (qtyDistributed * -1), municipalityId})

    }
}

export async function provinceDistribute(body){
    const {municipalityId, details, status, id} = body;
    const dt_created = moment().format();
    const dt_modified = moment().format();
    const dt_submitted = moment().format();
    const dt_received = moment().format();

    if(!id && status==='N'){ //new
        const [result] = await pool.query(`
            INSERT INTO province_distribute_hdr (municipality_id, dt_created, dt_modified, status)
            VALUES (?, ?, ?, ?)
        `,[municipalityId, dt_created, dt_modified, status])

        const insertId = result.insertId;

        const dtlResult =  await saveDistributeDtl({...body, id: insertId});
  

        return {
            ...body,
            dt_created,
            id: insertId,
            details: dtlResult
        }
    } else if (id && status === 'N'){
        const [result] = await pool.query(`
            UPDATE province_distribute_hdr
            SET dt_modified = ?
            WHERE id = ?
        `,[dt_modified, id])

        const dtlResult =  await saveDistributeDtl({...body, id});

        return {
            ...body,
            dt_modified,
            details: dtlResult
        }
    } else if (id && status === 'S'){
        const [result] = await pool.query(`
            UPDATE province_distribute_hdr
            SET dt_submitted = ?,
                dt_modified = ?,
                status = ?
            WHERE id = ?
        `,[dt_submitted, dt_modified, status, id])

        details.forEach((detail)=>{
            updateSeedMain({...detail, transactType:'PDIST', municipalityId: body.municipalityId});
        })

        const dtlResult =  await saveDistributeDtl({...body, id});

        return {
            ...body,
            dt_modified,
            dt_submitted,
            details: dtlResult
        }
    } else if (id && status === 'R'){
        const [result] = await pool.query(`
            UPDATE province_distribute_hdr
            SET dt_received = ?,
                status = ?
            WHERE id = ?
        `,[dt_received, status,id])

        details.forEach((detail)=>{
            updateSeedMain({...detail, transactType:'PREC', municipalityId: body.municipalityId});
        })

        const dtlResult =  await saveDistributeDtl({...body, id});

        return {
            ...body,
            dt_received,
            details: dtlResult
        }
    }

}

function parseResult(toParse){
    let parsedResult = [];
    toParse.forEach((res)=>{
        const found = parsedResult.find(parsed=>parsed.id === res.id);
        if(found){
            found.details.push({
                seedId: res.seed_id,
                qtyRemaining: res.qty_remaining,
                uom: res.uom,
                qtyDistributed: res.qty_distributed,
                remarks: res.remarks,
                seedName:  res.seed_name,
                qtyReceived: res.qty_received
            })
        } else {
            parsedResult.push({
                id: res.id,
                municipalityId: res.municipality_id,
                municipalityName: res.municipality_name,
                status: res.status,
                statusName: res.status === 'N' ? 'New' : (res.status === 'S' ? 'Submitted' : 'Received') ,
                dtCreated:res.dt_created &&  moment(res.dt_created).format('MMMM DD, YYYY'),
                dtModified: res.dt_modified && moment(res.dt_modified).format('MMMM DD, YYYY'),
                dtSubmitted: res.dt_submitted && moment(res.dt_submitted).format('MMMM DD, YYYY'),
                dtReceived: res.dt_received && moment(res.dt_received).format('MMMM DD, YYYY'),
                details: [{
                    seedId: res.seed_id,
                    qtyRemaining: res.qty_remaining,
                    uom: res.uom,
                    qtyDistributed: res.qty_distributed,
                    remarks: res.remarks,
                    seedName: res.seed_name,
                    qtyReceived: res.qty_received
                }]
            })
        }
    });

    return parsedResult;
}

const distributionSql = `
    SELECT hdr.id,
    hdr.municipality_id,
    hdr.dt_created,
    hdr.dt_modified,
    hdr.dt_submitted,
    hdr.dt_received,
    hdr.status,
    dtl.id dtl_id,
    dtl.seed_id,
    dtl.qty_remaining,
    dtl.uom,
    dtl.qty_distributed,
    dtl.qty_received,
    dtl.remarks,
    municipality.name municipality_name,
    seeds.name seed_name
    FROM province_distribute_hdr hdr
    LEFT OUTER JOIN province_distribute_dtl dtl ON (hdr.id = dtl.hdr_id)
    LEFT OUTER JOIN municipality ON (hdr.municipality_id = municipality.id)
    LEFT OUTER JOIN seeds ON (dtl.seed_id = seeds.id)
`

export async function getDistributions(id){
    let finalResult = null;

    if(id){
        const [result] = await pool.query(`
            ${distributionSql}
            WHERE hdr.id = ?
            ORDER BY  hdr.id DESC
        `, [id])


        finalResult = result;
    } else {
        const [result] = await pool.query(`
            ${distributionSql}
            WHERE status != 'X'
            ORDER BY  hdr.id DESC
        `)

        finalResult = result;
    };

    //console.log('res', finalResult)

    let parsedResult = parseResult(finalResult);

  

    return parsedResult;
}

export async function getDistributionByM(param){
    const {municipality, status} = param
    
    const mainSql = `
       ${distributionSql}
        WHERE hdr.municipality_id = ? AND
            hdr.status = ?
    `;

    const [result] = await pool.query(`
            ${mainSql}
        `,[municipality, status]);

    const parsedResult = parseResult(result);

    return parsedResult;
}

export async function getInventoryReport(body){
    const {municipalityId, warehouseType} =body;
    let finalResult = [];
    if(warehouseType ==='municipality'){
        const [result] = await pool.query(`
            SELECT rem.seed_id,
                seeds.name seed_name, 
                rem.municipality_id,
                rem.warehouse_type,
                mun.name municipality_name,
                rem.qty_remaining,
                seeds.uom
            FROM seeds_remaining rem
            LEFT OUTER JOIN seeds ON seeds.id = rem.seed_id
            LEFT OUTER JOIN municipality mun ON mun.id = rem.municipality_id
            WHERE rem.warehouse_type = ? AND
                rem.municipality_id = ?;
        `,[warehouseType, municipalityId])

        finalResult = result;
    } else {
        const [result] = await pool.query(`
                SELECT rem.seed_id,
                seeds.name seed_name, 
                rem.municipality_id,
                rem.warehouse_type,
                mun.name municipality_name,
                rem.qty_remaining,
                seeds.uom
            FROM seeds_remaining rem
            LEFT OUTER JOIN seeds ON seeds.id = rem.seed_id
            LEFT OUTER JOIN municipality mun ON mun.id = rem.municipality_id
            WHERE rem.warehouse_type = ?
        `,[warehouseType]);

        finalResult = result;
    }

    return finalResult
}

export async function addSeed(body){
    const {seedName, qtyRemaining, uom, qtySpecific,id } = body;
    let seedId = id;
    if(id){
        const [seedResult] = await pool.query(`
            UPDATE seeds
            SET name = ?,
                qty_remaining = ?,
                uom = ?
            WHERE id = ?
        `,[seedName,qtyRemaining,uom, id])

        seedId = id;

    } else {
        const [seedResult] = await pool.query(`
            INSERT INTO seeds (name, qty_remaining, uom)
            VALUES(?,?,?)
        `,[seedName, qtyRemaining, uom])

        seedId = seedResult.insertId;
    }
    


    qtySpecific.forEach((qty)=>{
        updateSeedSub({
            seedId: seedId, 
            warehouseType: qty.warehouseType, 
            qty: qty.qtyRemaining,
            municipalityId: qty.municipalityId,
            isAbsolute: true
        })
    })

    return {
        ...body,
        id: seedId
    }
}

export async function deleteSeeds(id){
    const [result] = await pool.query(`
        UPDATE seeds
        SET is_deleted = true
        WHERE id = ?
    `,[id])

    return {
        id,
        isDeleted: true
    }
}