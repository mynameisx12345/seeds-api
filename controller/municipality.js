import mysql from 'mysql2';
import dotenv, { parse } from 'dotenv';
import moment from 'moment'
import { updateSeedMain } from './province.js';

dotenv.config();

const pool =  mysql.createPool({
    host: process.env.MYSQL_HOST,
    user: process.env.MYSQL_USER,
    password:process.env.MYSQL_PASSWORD,
    database: process.env.MYSQL_DATABASE
}).promise();

export async function getFarmers(){
    const [result] = await pool.query(`
        SELECT * FROM farmers
    `);

    return result;
}

export async function saveDistributeDtl(body){
    const {id,details} = body;
    const [dltResult] = await pool.query(`
        DELETE FROM municipality_distribute_dtl
        WHERE hdr_id = ?
    `,[id]);

    const insertDtl = async (dtl)=>{
        const {seedId, qtyRemaining, uom, qtyDistributed, remarks, hdrId, qtyReceived, farmerId} = dtl;
        const [insertResult] = await pool.query(`
            INSERT INTO municipality_distribute_dtl (seed_id, qty_remaining, uom, qty_distributed, remarks, hdr_id, farmer_id)
            VALUES(?, ?, ?, ?, ?, ?, ?)
        `,[seedId, qtyRemaining, uom, qtyDistributed, remarks, hdrId,farmerId]);

        const insertId = insertResult.insertId;

        return {
            ...dtl,
            id: insertId
        }
    }

    const dtlResult = await Promise.all(details.map(dtl=>insertDtl({...dtl, hdrId:id})));

    return dtlResult;
}

export async function municipalityDistribute(body){
    const {municipalityId, details, status, id} = body;
    const dt_created = moment().format();
    const dt_modified = moment().format();
    const dt_submitted = moment().format();

    if(!id && status==='N'){
        const [result] = await pool.query(`
            INSERT INTO municipality_distribute_hdr (municipality_id, dt_created, dt_modified, status)
            VALUES (?, ?, ?, ?)
        `,[municipalityId, dt_created, dt_modified, status]);

        const insertId = result.insertId;

        const dtlResult =  await saveDistributeDtl({...body, id: insertId});
  

        return {
            ...body,
            dt_created,
            id: insertId,
            details: dtlResult
        }
    } else if(id && status === 'N'){
        const [result] = await pool.query(`
            UPDATE municipality_distribute_hdr
            SET dt_modified = ?
            WHERE id = ?
        `,[dt_modified, id]);

        const dtlResult =  await saveDistributeDtl({...body, id});

        return {
            ...body,
            dt_modified,
            details: dtlResult
        }
    } else if (id && status === 'S'){
        const [result] = await pool.query(`
            UPDATE municipality_distribute_hdr
            SET dt_submitted = ?,
                dt_modified = ?,
                status = ?
            WHERE id = ?
        `,[dt_submitted, dt_modified, status, id])

        const dtlResult =  await saveDistributeDtl({...body, id});

        details.forEach((detail)=>{
            updateSeedMain({...detail, transactType:'MDIST', municipalityId: body.municipalityId});
        })

        return {
            ...body,
            dt_modified,
            dt_submitted,
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
                farmerId: res.farmer_id,
                farmerName: res.farmer_name
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
                details: [{
                    seedId: res.seed_id,
                    qtyRemaining: res.qty_remaining,
                    uom: res.uom,
                    qtyDistributed: res.qty_distributed,
                    remarks: res.remarks,
                    seedName: res.seed_name,
                    farmerId: res.farmer_id,
                    farmerName: res.farmer_name
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
    hdr.status,
    dtl.id dtl_id,
    dtl.seed_id,
    dtl.qty_remaining,
    dtl.uom,
    dtl.qty_distributed,
    dtl.remarks,
    municipality.name municipality_name,
    seeds.name seed_name,
    dtl.farmer_id,
    farmers.name farmer_name
    FROM municipality_distribute_hdr hdr
    LEFT OUTER JOIN municipality_distribute_dtl dtl ON (hdr.id = dtl.hdr_id)
    LEFT OUTER JOIN municipality ON (hdr.municipality_id = municipality.id)
    LEFT OUTER JOIN seeds ON (dtl.seed_id = seeds.id)
    LEFT OUTER JOIN farmers ON (dtl.farmer_id = farmers.id)
    `


export async function getDistributions(id){
    let finalResult = null;
    if(id){
        const [result] = await pool.query(`
            ${distributionSql}
            WHERE hdr.id = ?
            ORDER BY  hdr.id DESC
        `,[id])

        finalResult = result;
    } else {
        const [result] = await pool.query(`
            ${distributionSql}
            WHERE status != 'X'
            ORDER BY  hdr.id DESC
        `)

        finalResult = result;
    };

    let parsedResult = parseResult(finalResult);

    return parsedResult;
}