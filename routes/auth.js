// routes/auth.js
const express = require('express');
const passport = require('passport');
const router = express.Router();
const Favorite = require('../models/favorite');

// Registrazione, login, logout e gestione preferiti
router.post('/login', passport.authenticate('local', { successRedirect: '/', failureRedirect: '/login' }));
router.get('/logout', (req, res) => {
    req.logout((err) => res.redirect('/'));
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
