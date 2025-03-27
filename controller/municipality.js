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

export async function getFarmers(){
    const [result] = await pool.query(`
        SELECT * FROM farmers
    `);

    return result;
}