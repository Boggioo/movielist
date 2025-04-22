/**
 * Modulo delle rotte principali dell'applicazione
 * Gestisce la visualizzazione della home page, la ricerca dei film e i dettagli dei film
 */

// Importazione delle dipendenze
const express = require('express');  // Framework web
const router = express.Router();     // Router Express

// Importazione delle funzioni API TMDB
const { 
  getPopularMovies,  // Recupera film popolari
  searchMovies,      // Ricerca film con filtri
  getMovieDetails,   // Recupera dettagli film
  getMovieGenres     // Recupera lista generi
} = require('./tmdb');

/**
 * Rotta per la homepage
 * Mostra i film più popolari del momento
 */
router.get('/', async (req, res) => {
  const movies = await getPopularMovies();  // Recupera lista film popolari
  res.render('index', { movies });  // Renderizza la vista con i film
});

/**
 * Rotta per la ricerca avanzata dei film
 * Gestisce i filtri di ricerca (query, anno, voto, generi)
 */
router.get('/search', async (req, res) => {
  const query = req.query.query || '';
  const year = req.query.year || '';
  const vote = req.query.vote || '';
  let selectedGenres = req.query.genres || [];
  
  // Assicuriamoci che selectedGenres sia sempre un array
  if (!Array.isArray(selectedGenres)) {
    selectedGenres = [selectedGenres];
  }
  
  // Ottieni la lista dei generi per il form con gestione degli errori
  let genres = [];
  try {
    const genresData = await getMovieGenres();
    // Verifica esplicita che genresData sia definito e sia un array
    genres = Array.isArray(genresData) ? genresData : [];
  } catch (error) {
    console.error('Errore nel recupero dei generi:', error);
    // In caso di errore, inizializza genres come array vuoto
    genres = [];
  }
  
  // Esegui la ricerca con i filtri solo se ci sono parametri
  let movies = [];
  try {
    if (query || year || vote || selectedGenres.length > 0) {
      movies = await searchMovies({ query, year, vote, genres: selectedGenres });
    }
  } catch (error) {
    console.error('Errore nella ricerca dei film:', error);
    // In caso di errore, inizializza movies come array vuoto
    movies = [];
  }
  
  res.render('search', { 
    movies, 
    query, 
    year, 
    vote, 
    genres, 
    selectedGenres 
  });
}); 

/**
 * Rotta per visualizzare i dettagli di un film specifico
 * Recupera e mostra tutte le informazioni disponibili sul film
 */
router.get('/movie/:id', async (req, res) => {
  const movieId = req.params.id;  // ID del film dai parametri URL
  const movie = await getMovieDetails(movieId);  // Recupera dettagli completi
  res.render('movieDetails', { movie });  // Renderizza la vista dettagli
});

module.exports = router;
