// routes/index.js
const express = require('express');
const router = express.Router();
const { getPopularMovies, searchMovies, getMovieDetails } = require('./tmdb');

// Homepage con i film popolari
router.get('/', async (req, res) => {
  const movies = await getPopularMovies();
  res.render('index', { movies });
});

// Ricerca di un film
router.get('/search', async (req, res) => {
  const query = req.query.query || '';
  const movies = await searchMovies(query);
  res.render('search', { movies, query });
});

// Dettagli di un film
router.get('/movie/:id', async (req, res) => {
  const movieId = req.params.id;
  const movie = await getMovieDetails(movieId);
  res.render('movieDetails', {
    movie: {
      title: movie.title,
      cast: movie.cast || [],
      genres: movie.genres || []
    }

  });
});

module.exports = router;
