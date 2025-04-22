// Importazione delle dipendenze necessarie
const express = require('express');         // Framework web
const passport = require('passport');       // Middleware di autenticazione
const LocalStrategy = require('passport-local').Strategy;  // Strategia di autenticazione locale
const router = express.Router();            // Router Express
const User = require('../models/user');     // Modello utente
const Favorite = require('../models/favorite');  // Modello preferiti
const { getMovieDetails } = require('./tmdb');  // Funzioni API TMDB
const flash = require('connect-flash');     // Messaggi flash per notifiche

// Configurazione della strategia di autenticazione locale
passport.use(new LocalStrategy(async (username, password, done) => {
    try {
        // Cerca l'utente nel database
        const user = await User.findOne({ where: { username } });
        if (!user) return done(null, false);  // Utente non trovato
        // Verifica la password
        const isValid = await user.validPassword(password);
        if (!isValid) return done(null, false);  // Password non valida
        return done(null, user);  // Autenticazione riuscita
    } catch (err) {
        return done(err);  // Errore durante l'autenticazione
    }
}));

// Serializzazione dell'utente per la sessione
passport.serializeUser((user, done) => done(null, user.id));

// Deserializzazione dell'utente dalla sessione
passport.deserializeUser(async (id, done) => {
    try {
        const user = await User.findByPk(id);  // Recupera l'utente dal database
        done(null, user);
    } catch (err) {
        done(err);  // Errore durante il recupero dell'utente
    }
});

router.get('/login', (req, res) => {
    res.render('login');
});

router.get('/register', (req, res) => {
    res.render('register');
});

// Gestione della registrazione di un nuovo utente
router.post('/register', async (req, res) => {
    try {
        // Validazione dei campi richiesti
        if (!req.body.username || !req.body.password) {
            console.error('Username e password sono richiesti');
            req.flash('error', 'Username e password sono richiesti');
            return res.redirect('/register');
        }

        // Verifica se l'utente esiste già
        const existingUser = await User.findOne({ where: { username: req.body.username } });
        if (existingUser) {
            console.error('Username già in uso');
            req.flash('error', 'Username già in uso. Per favore, scegli un altro nome utente.');
            return res.redirect('/register');
        }

        const user = await User.create({
            username: req.body.username,
            password: req.body.password
        });

        console.log('Utente creato con successo:', user.toJSON());

        req.login(user, (err) => {
            if (err) {
                console.error('Errore durante il login dopo la registrazione:', err);
                return res.redirect('/register');
            }
            return res.redirect('/');
        });
    } catch (error) {
        console.error('Errore durante la registrazione:', error);
        res.redirect('/register');
    }
});

// Gestione del login utente
router.post('/login', (req, res, next) => {
    passport.authenticate('local', (err, user, info) => {
        if (err) { return next(err); }  // Errore durante l'autenticazione
        if (!user) {
            // Credenziali non valide
            req.flash('error', 'Credenziali non valide. Riprova.');
            return res.redirect('/login');
        }
        // Login dell'utente
        req.logIn(user, (err) => {
            if (err) { return next(err); }
            return res.redirect('/');  // Reindirizza alla home dopo il login
        });
    })(req, res, next);
});

router.get('/logout', (req, res) => {
    req.logout((err) => {
        if (err) console.error(err);
        res.redirect('/');
    });
});

// Aggiungi film ai preferiti
// Aggiunta di un film ai preferiti
router.post('/favorite/:movieId', async (req, res) => {
    // Verifica che l'utente sia autenticato
    if (!req.user) {
        return res.redirect('/login');
    }
    
    const movieId = req.params.movieId;
    const userId = req.user.id;
    
    // Verifica se il film è già nei preferiti
    const existingFavorite = await Favorite.findOne({
        where: { userId, movieId }
    });
    
    if (!existingFavorite) {
        const movie = await getMovieDetails(movieId);
        await Favorite.create({
            userId,
            movieId,
            title: movie.title,
            posterPath: movie.poster_path,
        });
    }
    
    // Reindirizza alla pagina del film
    res.redirect(`/movie/${movieId}`);
});

// Visualizza i preferiti dell'utente
router.get('/favorites', async (req, res) => {
    if (!req.user) {
        return res.redirect('/login');
    }
    const favorites = await Favorite.findAll({ where: { userId: req.user.id } });
    res.render('favorites', { favorites });
});

// Rimuovi film dai preferiti
router.post('/favorite/remove/:movieId', async (req, res) => {
    if (!req.user) {
        return res.redirect('/login');
    }
    
    const movieId = req.params.movieId;
    const userId = req.user.id;
    
    await Favorite.destroy({
        where: { userId, movieId }
    });
    
    res.redirect('/favorites');
});

module.exports = router;
