// Importa il modulo axios per effettuare richieste HTTP
const axios = require('axios');

// Configura l'istanza di axios per l'API TMDB
// - Imposta l'URL base per tutte le richieste
// - Configura i parametri di default (API key e lingua italiana)
const tmdbApi = axios.create({
    baseURL: 'https://api.themoviedb.org/3/',
    params: {
        api_key: 'eb1bd9da13ec5672dca46db23dd48f17',
        language: 'it-IT',
    }
});


/**
 * Recupera la lista completa dei generi cinematografici da TMDB
 * @returns {Promise<Array>} Array di oggetti genere con id e nome
 */
const getMovieGenres = async () => {
    const response = await tmdbApi.get('genre/movie/list');
    return response.data.genres;
};

/**
 * Recupera la lista dei film più popolari del momento
 * @returns {Promise<Array>} Array di oggetti film con dettagli base
 */
const getPopularMovies = async () => {
    const response = await tmdbApi.get('movie/popular');
    return response.data.results;
};

/**
 * Recupera i dettagli completi di un film specifico, inclusi i crediti
 * @param {string|number} movieId - ID del film da recuperare
 * @returns {Promise<Object>} Oggetto con dettagli del film e primi 5 membri del cast
 */
const getMovieDetails = async (movieId) => {
    // Esegue in parallelo le richieste per dettagli e crediti
    const [detailsResponse, creditsResponse] = await Promise.all([
        tmdbApi.get(`movie/${movieId}`),
        tmdbApi.get(`movie/${movieId}/credits`)
    ]);

    const details = detailsResponse.data;
    const credits = creditsResponse.data;

    // Combina i dettagli con i primi 5 membri del cast
    return {
        ...details,
        cast: credits.cast.slice(0, 5)
    };
};


/**
 * Ricerca film con filtri avanzati (query, anno, voto, generi)
 * @param {Object} filters - Oggetto contenente i filtri di ricerca
 * @param {string} [filters.query] - Termine di ricerca
 * @param {number} [filters.year] - Anno di uscita
 * @param {number} [filters.vote] - Voto minimo
 * @param {Array|string} [filters.genres] - ID dei generi
 * @returns {Promise<Array>} Array di film filtrati
 */
const searchMovies = async (filters) => {
    const { query, year, vote, genres } = filters;
    
    // Parametri di base per la ricerca
    let params = {
        include_adult: false,    // Esclude contenuti per adulti
        include_video: false,    // Esclude video/trailer
        sort_by: 'popularity.desc', // Ordina per popolarità
        page: 1                  // Prima pagina dei risultati
    };
    
    // Usa discover/movie se non c'è una query di ricerca
    const endpoint = query ? 'search/movie' : 'discover/movie';
    
    // Parametri di base per la ricerca
    if (query) {
        params.query = query;
    }
    
    // Filtro per anno
    if (year && !isNaN(parseInt(year))) {
        params.primary_release_year = parseInt(year);
    }
    
    // Filtro per voto minimo
    if (vote && !isNaN(parseFloat(vote))) {
        params['vote_average.gte'] = parseFloat(vote);
        params['vote_count.gte'] = 50; // Assicura un numero minimo di voti per risultati più affidabili
    }
    
    // Filtro per generi
    if (genres && genres.length > 0) {
        // Assicurati che i generi siano un array di stringhe e rimuovi eventuali valori vuoti
        const genreIds = Array.isArray(genres) ? genres.filter(id => id && id.trim() !== '') : [genres];
        if (genreIds.length > 0) {
            params.with_genres = genreIds.join(',');
        }
    }
    
    try {
        const response = await tmdbApi.get(endpoint, { params });
        let results = response.data.results;
        
        // Filtraggio aggiuntivo lato client per garantire che i risultati rispettino i criteri
        if (vote) {
            const minVote = parseFloat(vote);
            results = results.filter(movie => movie.vote_average >= minVote);
        }

        // Filtraggio aggiuntivo per i generi
        if (genres && genres.length > 0) {
            const genreIds = Array.isArray(genres) ? genres.filter(id => id && id.trim() !== '') : [genres];
            results = results.filter(movie => {
                return genreIds.every(genreId => movie.genre_ids.includes(parseInt(genreId)));
            });
        }
        
        return results;
    } catch (error) {
        console.error('Errore nella ricerca dei film:', error);
        return [];
    }
};

module.exports = { getPopularMovies, getMovieDetails, searchMovies, getMovieGenres };
