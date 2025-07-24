/**
 * Modulo delle rotte principali dell'applicazione
 * Gestisce la visualizzazione della home page, la ricerca dei film e i dettagli dei film
 */

// Importazione delle dipendenze
const express = require('express');
const router = express.Router();     // Router Express

// Importazione delle funzioni API TMDB
const { 
  getPopularMovies,  // Recupera film popolari
  searchMovies,      // Ricerca film con filtri
  getMovieDetails,   // Recupera dettagli film
  getMovieGenres,    // Recupera lista generi
  getTopRatedMovies, // Recupera film con voto più alto
  getMoviesByGenre,  // Recupera film per genere
  getCastMemberDetails // Recupera dettagli membro del cast
} = require('./tmdb');

// Importazione dei modelli
const Review = require('../models/review');
const User = require('../models/user');

/**
 * Rotta per la homepage
 * Mostra diverse categorie di film: popolari, con voto più alto e per generi
 */
router.get('/', async (req, res) => {
  // Inizializza le variabili con array vuoti come valori predefiniti
  let popularMovies = [];
  let topRatedMovies = [];
  let genres = [];
  
  try {
    // Recupera in parallelo le diverse categorie di film
    const results = await Promise.allSettled([
      getPopularMovies(),
      getTopRatedMovies(30),
      getMovieGenres()
    ]);
    
    // Assegna i risultati solo se la promise è stata risolta con successo
    if (results[0].status === 'fulfilled') popularMovies = results[0].value;
    if (results[1].status === 'fulfilled') topRatedMovies = results[1].value;
    if (results[2].status === 'fulfilled') genres = results[2].value;
    
    // Seleziona 6 generi popolari
    const popularGenreIds = [28, 35, 18, 27, 10749, 878]; // ID per Azione, Commedia, Drammatico, Horror, Romance, Fantascienza
    
    // Recupera film per ciascun genere selezionato con gestione errori
    const genrePromises = popularGenreIds.map(async (genreId) => {
      try {
        const genreName = genres.find(g => g.id === genreId)?.name || 'Genere';
        const moviesForGenre = await getMoviesByGenre(genreId, 20);
        return {
          id: genreId,
          name: genreName,
          movies: moviesForGenre || []
        };
      } catch (error) {
        console.error(`Errore nel recupero dei film per il genere ${genreId}:`, error);
        return {
          id: genreId,
          name: 'Genere',
          movies: []
        };
      }
    });
    
    const moviesByGenre = await Promise.allSettled(genrePromises)
      .then(results => results
        .filter(result => result.status === 'fulfilled')
        .map(result => result.value));
    
    // Renderizza la vista con tutte le categorie di film
    res.render('index', { 
      popularMovies, 
      topRatedMovies, 
      moviesByGenre,
      allGenres: genres
    });
  } catch (error) {
    console.error('Errore nel recupero dei film per la homepage:', error);
    // In caso di errore, renderizza la pagina con array vuoti
    res.render('index', { 
      popularMovies: [], 
      topRatedMovies: [], 
      moviesByGenre: popularGenreIds.map(genreId => ({
        id: genreId,
        name: 'Genere',
        movies: []
      })),
      allGenres: []
    });
  }
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
  
  // Assicura che selectedGenres sia sempre un array
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
  
  // Verifica se il film è tra i preferiti dell'utente
  let isFavorite = false;
  if (req.user) {
    const Favorite = require('../models/favorite');
    const favorite = await Favorite.findOne({
      where: { userId: req.user.id, movieId }
    });
    isFavorite = !!favorite;
  }

  // Recupera le recensioni per questo film
  const reviews = await Review.findAll({
    where: { movieId },
    include: [{ model: User, attributes: ['username'] }],
    order: [['createdAt', 'DESC']]
  });
  
  res.render('movieDetails', { movie, isFavorite, reviews });  // Renderizza la vista dettagli
});

// Rotta per aggiungere o aggiornare una recensione
router.post('/movie/:id/review', async (req, res) => {
  if (!req.user) {
    return res.redirect('/login');
  }

  const movieId = req.params.id;
  const { rating, comment } = req.body;

  try {
    // Cerca una recensione esistente
    const existingReview = await Review.findOne({
      where: {
        userId: req.user.id,
        movieId: movieId
      }
    });

    if (existingReview) {
      // Aggiorna la recensione esistente
      await existingReview.update({
        rating: parseInt(rating),
        comment,
        updatedAt: new Date()
      });
    } else {
      // Crea una nuova recensione
      await Review.create({
        userId: req.user.id,
        movieId,
        rating: parseInt(rating),
        comment
      });
    }

    res.redirect(`/movie/${movieId}`);
  } catch (error) {
    console.error('Errore nel salvataggio della recensione:', error);
    res.redirect(`/movie/${movieId}`);
  }
});

/**
 * Rotta per visualizzare i dettagli di un membro del cast
 * Mostra biografia, filmografia e altre informazioni
 */
router.get('/person/:id', async (req, res) => {
  const personId = req.params.id;
  const person = await getCastMemberDetails(personId);
  res.render('castMember', { person });
});

// Rotta per eliminare una recensione
router.post('/movie/:id/review/delete', async (req, res) => {
  if (!req.user) {
    return res.redirect('/login');
  }

  const movieId = req.params.id;

  try {
    await Review.destroy({
      where: {
        userId: req.user.id,
        movieId: movieId
      }
    });

    res.redirect('/reviews');
  } catch (error) {
    console.error('Errore durante l\'eliminazione della recensione:', error);
    res.redirect('/reviews');
  }
});

module.exports = router;
