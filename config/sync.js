const sequelize = require('./database');
const User = require('../models/user');
const Favorite = require('../models/favorite');

// Definisci le relazioni tra i modelli
User.hasMany(Favorite, { foreignKey: 'userId' });
Favorite.belongsTo(User, { foreignKey: 'userId' });

async function syncDatabase() {
    try {
        // Testa la connessione al database
        await sequelize.authenticate();
        console.log('Connessione al database stabilita con successo.');

        // Sincronizza i modelli con il database
        await sequelize.sync({ alter: true });
        console.log('Modelli sincronizzati con il database.');
    } catch (error) {
        console.error('Errore durante la sincronizzazione del database:', error);
    }
}

module.exports = syncDatabase;