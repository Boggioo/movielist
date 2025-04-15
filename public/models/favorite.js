const { Sequelize, DataTypes } = require('sequelize');
const sequelize = new Sequelize('postgres://user:password@localhost:5432/database');

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
