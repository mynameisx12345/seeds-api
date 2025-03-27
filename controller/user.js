import mysql from 'mysql2';
import dotenv, { parse } from 'dotenv';
dotenv.config();

const pool =  mysql.createPool({
    host: process.env.MYSQL_HOST,
    user: process.env.MYSQL_USER,
    password:process.env.MYSQL_PASSWORD,
    database: process.env.MYSQL_DATABASE
}).promise();

export async function login(body){
    const {username, password} = body;
    const [result] = await pool.query(`
        SELECT * FROM users 
        WHERE username = ? AND
        password = ?
    `,[username,password]);

    return result;
}

export async function getMunicipalities(){
    const [result] = await pool.query(`
        SELECT * FROM municipality
    `)

    return result;
}