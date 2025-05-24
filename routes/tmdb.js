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
 * Recupera i dettagli completi di un film specifico, inclusi i crediti, trailer e piattaforme di streaming
 * @param {string|number} movieId - ID del film da recuperare
 * @returns {Promise<Object>} Oggetto con dettagli del film, cast, regista, trailer e piattaforme di streaming
 */
const getMovieDetails = async (movieId) => {
    // Esegue in parallelo le richieste per dettagli, crediti, video e provider
    const [detailsResponse, creditsResponse, videosResponse, providersResponse] = await Promise.all([
        tmdbApi.get(`movie/${movieId}`),
        tmdbApi.get(`movie/${movieId}/credits`),
        tmdbApi.get(`movie/${movieId}/videos`),
        tmdbApi.get(`movie/${movieId}/watch/providers`)
    ]);

    const details = detailsResponse.data;
    const credits = creditsResponse.data;
    const videos = videosResponse.data;
    const providers = providersResponse.data;

    // Trova il regista tra i membri della crew
    const director = credits.crew.find(member => member.job === 'Director');
    
    // Trova il trailer tra i video
    let trailer = null;
    if (videos.results && videos.results.length > 0) {
        // Prima cerca un trailer ufficiale in italiano
        trailer = videos.results.find(video => 
            video.type === 'Trailer' && 
            video.official === true && 
            video.site === 'YouTube' &&
            video.iso_639_1 === 'it'
        );
        
        // Se non trovato, cerca un trailer ufficiale in qualsiasi lingua
        if (!trailer) {
            trailer = videos.results.find(video => 
                video.type === 'Trailer' && 
                video.official === true && 
                video.site === 'YouTube'
            );
        }
        
        // Se ancora non trovato, prendi il primo video disponibile
        if (!trailer && videos.results.length > 0) {
            trailer = videos.results[0];
        }
    }
    
    // Estrai le piattaforme di streaming disponibili in Italia
    let streamingProviders = [];
    if (providers.results && providers.results.IT) {
        const italianProviders = providers.results.IT;
        
        // Combina i provider di flatrate (abbonamento), rent (noleggio) e buy (acquisto)
        if (italianProviders.flatrate) {
            streamingProviders = [...streamingProviders, ...italianProviders.flatrate];
        }
        if (italianProviders.rent) {
            // Aggiungi solo provider che non sono già presenti
            italianProviders.rent.forEach(provider => {
                if (!streamingProviders.some(p => p.provider_id === provider.provider_id)) {
                    streamingProviders.push(provider);
                }
            });
        }
        if (italianProviders.buy) {
            // Aggiungi solo provider che non sono già presenti
            italianProviders.buy.forEach(provider => {
                if (!streamingProviders.some(p => p.provider_id === provider.provider_id)) {
                    streamingProviders.push(provider);
                }
            });
        }
    }

    // Combina tutti i dettagli
    return {
        ...details,
        cast: credits.cast.slice(0, 8).map(actor => ({
            ...actor,
            profile_path: actor.profile_path
        })),
        director,
        trailer,
        streamingProviders
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

/**
 * Recupera i film con il voto più alto
 * @param {number} [limit=20] - Numero di film da recuperare
 * @returns {Promise<Array>} Array di oggetti film con dettagli base
 */
const getTopRatedMovies = async (limit = 20) => {
    try {
        const response = await tmdbApi.get('movie/top_rated', {
            params: {
                page: 1,
                'vote_count.gte': 100 // Solo film con almeno 100 voti
            }
        });
        return response.data.results.slice(0, limit);
    } catch (error) {
        console.error('Errore nel recupero dei film con voto più alto:', error);
        return [];
    }
};

/**
 * Recupera i film per un genere specifico
 * @param {number} genreId - ID del genere
 * @param {number} [limit=20] - Numero di film da recuperare
 * @returns {Promise<Array>} Array di oggetti film con dettagli base
 */
const getMoviesByGenre = async (genreId, limit = 20) => {
    try {
        const response = await tmdbApi.get('discover/movie', {
            params: {
                with_genres: genreId,
                sort_by: 'popularity.desc',
                page: 1,
                include_adult: false
            }
        });
        return response.data.results.slice(0, limit);
    } catch (error) {
        console.error(`Errore nel recupero dei film per il genere ${genreId}:`, error);
        return [];
    }
};

module.exports = { 
    getPopularMovies, 
    getMovieDetails, 
    searchMovies, 
    getMovieGenres,
    getTopRatedMovies,
    getMoviesByGenre
};
