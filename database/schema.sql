CREATE DATABASE seed;

CREATE TABLE municipality (
    id INT PRIMARY KEY AUTO_INCREMENT,
    name VARCHAR(100),
    province VARCHAR(100)
);

CREATE TABLE users (
    id INT PRIMARY KEY AUTO_INCREMENT,
    username VARCHAR(100),
    password VARCHAR(100),
    name VARCHAR(200),
    user_type VARCHAR(100),
    municipality_id INT,
    FOREIGN KEY (municipality_id) REFERENCES municipality(id)
);

INSERT INTO municipality (name, province)
VALUES('Municipality of Barbaza', 'Antique');

INSERT INTO municipality (name, province)
VALUES('Municipality of Tibiao', 'Antique');

INSERT INTO municipality (name, province)
VALUES('Municipality of Culasi', 'Antique');

INSERT INTO users (username, password, name, user_type, municipality_id)
VALUES('barbaza','12345','Municipality of Barbaza', 'municipality',1);

INSERT INTO users (username, password, name, user_type, municipality_id)
VALUES('tibiao','12345','Municipality of Tibiao', 'municipality',2);

INSERT INTO users (username, password, name, user_type, municipality_id)
VALUES('culasi','12345','Municipality of Culasi', 'municipality',3);

INSERT INTO users (username, password, name, user_type, municipality_id)
VALUES('tibiao','12345','Municipality of Tibiao', 'municipality',2);


INSERT INTO users (username, password, name, user_type)
VALUES('province','12345','Province', 'province');

CREATE TABLE seeds (
    id INT PRIMARY KEY AUTO_INCREMENT,
    name VARCHAR(100),
    qty_remaining DECIMAL(12,2),
    uom VARCHAR(50),
    qty_transit DECIMAL(12,2)
);

INSERT INTO seeds (name, qty_remaining, uom)
VALUES('Squash', 200, 'sack');

INSERT INTO seeds (name, qty_remaining, uom)
VALUES('Sitaw', 400, 'box');

INSERT INTO seeds (name, qty_remaining, uom)
VALUES('Okra', 890, 'pack');


CREATE TABLE seeds_remaining (
    id INT PRIMARY KEY AUTO_INCREMENT,
    seed_id INT,
    FOREIGN KEY (seed_id) REFERENCES seeds(id),
    warehouse_type VARCHAR(50),
    municipality_id INT,
    FOREIGN KEY (municipality_id) REFERENCES municipality(id),
    qty_remaining DECIMAL(12,2)
);

INSERT INTO seeds_remaining (seed_id, warehouse_type, qty_remaining)
VALUES(1, 'province',200);


INSERT INTO seeds_remaining (seed_id, warehouse_type, qty_remaining)
VALUES(2, 'province',400);

INSERT INTO seeds_remaining (seed_id, warehouse_type, qty_remaining)
VALUES(3, 'province',890);

INSERT INTO seeds_remaining (seed_id, warehouse_type, qty_remaining,municipality_id)
VALUES(2, 'province',890,1);

-- SELECT seeds.id, 
--     seeds.name,
--     seeds.qty_remaining total_remaining,
--     seeds.uom,
--     seeds.qty_transit,
--     seeds_remaining.qty_remaining,
--     seeds_remaining.warehouse_type,
--     seeds_remaining.municipality_id
-- FROM seeds LEFT OUTER JOIN seeds_remaining ON (seeds.id = seeds_remaining.seed_id)

CREATE TABLE province_distribute_hdr (
    id INT PRIMARY KEY AUTO_INCREMENT,
    municipality_id INT,
    FOREIGN KEY (municipality_id) REFERENCES municipality(id),
    dt_created DATETIME,
    dt_modified DATETIME,
    dt_submitted DATETIME,
    status CHAR(1)
);

CREATE TABLE province_distribute_dtl (
    id INT PRIMARY KEY AUTO_INCREMENT,
    seed_id INT,
    FOREIGN KEY (seed_id) REFERENCES seeds(id),
    qty_remaining DECIMAL(12,2),
    uom VARCHAR(50),
    qty_distributed DECIMAL(12,2),
    remarks VARCHAR(200),
    hdr_id INT,
    FOREIGN KEY (hdr_id) REFERENCES province_distribute_hdr(id)
);

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
    dtl.remarks
FROM province_distribute_hdr hdr
LEFT OUTER JOIN province_distribute_dtl dtl ON (hdr.id = dtl.hdr_id);

ALTER TABLE province_distribute_hdr
ADD COLUMN dt_received DATETIME;

ALTER TABLE province_distribute_dtl
ADD COLUMN qty_received DECIMAL(12,2);

SELECT rem.seed_id,
    seeds.name seed_name, 
    rem.municipality_id,
    rem.warehouse_type,
    mun.name municipality_name,
    rem.qty_remaining
FROM seeds_remaining rem
LEFT OUTER JOIN seeds ON seeds.id = rem.seed_id
LEFT OUTER JOIN municipality mun ON mun.id = rem.municipality_id
WHERE rem.warehouse_type = 'municipality' AND
    rem.municipality_id = 1;

CREATE TABLE farmers (
    id INT PRIMARY KEY AUTO_INCREMENT,
    name VARCHAR(100),
    contact VARCHAR(100),
    address VARCHAR(500),
    municipality_id INT,
    FOREIGN KEY (municipality_id) REFERENCES municipality(id),
    dt_created DATETIME
);

INSERT INTO farmers (name, contact, address, municipality_id, dt_created)
VALUES('Juan Dela Cruz','09123456789', 'address 123',1,now());

INSERT INTO farmers (name, contact, address, municipality_id, dt_created)
VALUES('Maria Santiago','09123456789', 'address 456',1,now());

INSERT INTO farmers (name, contact, address, municipality_id, dt_created)
VALUES('Farmer 6','09123456789', 'address 772',3,now());

CREATE TABLE municipality_distribute_hdr (
    id INT PRIMARY KEY AUTO_INCREMENT,
    municipality_id INT,
    FOREIGN KEY (municipality_id) REFERENCES municipality(id),
    dt_created DATETIME,
    dt_modified DATETIME,
    dt_submitted DATETIME,
    status CHAR(1)
);

CREATE TABLE municipality_distribute_dtl (
    id INT PRIMARY KEY AUTO_INCREMENT,
    seed_id INT,
    FOREIGN KEY (seed_id) REFERENCES seeds(id),
    qty_remaining DECIMAL(12,2),
    uom VARCHAR(50),
    qty_distributed DECIMAL(12,2),
    remarks VARCHAR(200),
    hdr_id INT,
    FOREIGN KEY (hdr_id) REFERENCES municipality_distribute_hdr(id),
    farmer_id INT,
    FOREIGN KEY (farmer_id) REFERENCES farmers(id)
);

ALTER TABLE farmers
ADD COLUMN is_deleted BOOLEAN;

ALTER TABLE seeds
ADD COLUMN is_deleted BOOLEAN;

SELECT dtl.seed_id,
    seeds.name,
    dtl.qty_distributed,
    dtl.uom,
    dtl.remarks,
    farmers.name,
    hdr.dt_submitted
FROM municipality_distribute_dtl dtl
LEFT OUTER JOIN municipality_distribute_hdr hdr ON (dtl.hdr_id = hdr.id)
LEFT OUTER JOIN seeds ON (dtl.seed_id = seeds.id)
LEFT OUTER JOIN farmers ON (dtl.farmer_id = farmers.id)