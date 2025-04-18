const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const Favorite = sequelize.define('Favorite', {
    userId: {
        type: DataTypes.INTEGER,
        allowNull: false,
    },
    movieId: {
        type: DataTypes.INTEGER,
        allowNull: false,
    },
    title: {
        type: DataTypes.STRING,
        allowNull: false,
    },
    posterPath: {
        type: DataTypes.STRING,
        allowNull: true,
    },
});

module.exports = Favorite;
