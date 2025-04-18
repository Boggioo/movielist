const express = require('express');
const passport = require('passport');
const LocalStrategy = require('passport-local').Strategy;
const router = express.Router();
const User = require('../models/user');
const Favorite = require('../models/favorite');

passport.use(new LocalStrategy(async (username, password, done) => {
    try {
        const user = await User.findOne({ where: { username } });
        if (!user) return done(null, false);
        const isValid = await user.validPassword(password);
        if (!isValid) return done(null, false);
        return done(null, user);
    } catch (err) {
        return done(err);
    }
}));

passport.serializeUser((user, done) => done(null, user.id));
passport.deserializeUser(async (id, done) => {
    try {
        const user = await User.findByPk(id);
        done(null, user);
    } catch (err) {
        done(err);
    }
});

router.get('/login', (req, res) => {
    res.render('login');
});

router.get('/register', (req, res) => {
    res.render('register');
});

router.post('/register', async (req, res) => {
    try {
        if (!req.body.username || !req.body.password) {
            console.error('Username e password sono richiesti');
            return res.redirect('/register');
        }

        // Verifica se l'utente esiste già
        const existingUser = await User.findOne({ where: { username: req.body.username } });
        if (existingUser) {
            console.error('Username già in uso');
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

router.post('/login', passport.authenticate('local', {
    successRedirect: '/',
    failureRedirect: '/login'
}));

router.get('/logout', (req, res) => {
    req.logout((err) => {
        if (err) console.error(err);
        res.redirect('/');
    });
});

// Aggiungi film ai preferiti
router.post('/favorite/:movieId', async (req, res) => {
    const movieId = req.params.movieId;
    const userId = req.user.id;
    const movie = await getMovieDetails(movieId); // Usa la funzione di TMDB
    await Favorite.create({
        userId,
        movieId,
        title: movie.title,
        posterPath: movie.poster_path,
    });
    res.redirect('/');
});

// Visualizza i preferiti dell'utente
router.get('/favorites', async (req, res) => {
    const favorites = await Favorite.findAll({ where: { userId: req.user.id } });
    res.render('favorites', { favorites });
});

module.exports = router;
