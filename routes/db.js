const { Pool } = require('pg');

const pool = new Pool({
    user: 'postgres',
    host: 'localhost',
    database: 'movielist_db',
    password: '*bZH*#om5Viz5awZV&ToK!s',
    port: 5432,
});

module.exports = pool;