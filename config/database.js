const { Sequelize } = require('sequelize');

const sequelize = new Sequelize('movielist_db', 'postgres', '*bZH*#om5Viz5awZV&ToK!s', {
    host: 'localhost',
    dialect: 'postgres',
    port: 5432,
    logging: false
});

module.exports = sequelize;