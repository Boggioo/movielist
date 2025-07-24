// Importa i moduli necessari
const axios = require('axios');
const ss = require('simple-statistics'); // Per calcoli statistici

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
    // Esegue in parallelo le richieste per dettagli, crediti, video, provider e film simili
    const [detailsResponse, creditsResponse, videosResponse, providersResponse, similarResponse] = await Promise.all([
        tmdbApi.get(`movie/${movieId}`),
        tmdbApi.get(`movie/${movieId}/credits`),
        tmdbApi.get(`movie/${movieId}/videos`),
        tmdbApi.get(`movie/${movieId}/watch/providers`),
        tmdbApi.get(`movie/${movieId}/similar`)
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
        
        // Se ancora non trovato, prende il primo video disponibile
        if (!trailer && videos.results.length > 0) {
            trailer = videos.results[0];
        }
    }
    
    // Si estraggono le piattaforme di streaming disponibili in Italia
    let streamingProviders = [];
    if (providers.results && providers.results.IT) {
        const italianProviders = providers.results.IT;
        
        // Si aggiunge provider con tipo di disponibilità
        if (italianProviders.flatrate) {
            streamingProviders = [...streamingProviders, ...italianProviders.flatrate.map(provider => ({
                ...provider,
                availability_type: 'subscription',
                availability_label: 'Abbonamento'
            }))];
        }
        if (italianProviders.rent) {
            italianProviders.rent.forEach(provider => {
                const existingProvider = streamingProviders.find(p => p.provider_id === provider.provider_id);
                if (existingProvider) {
                    existingProvider.availability_type = [...(existingProvider.availability_type || []), 'rent'];
                    existingProvider.availability_label = [...(existingProvider.availability_label || []), 'Noleggio'];
                } else {
                    streamingProviders.push({
                        ...provider,
                        availability_type: ['rent'],
                        availability_label: ['Noleggio']
                    });
                }
            });
        }
        if (italianProviders.buy) {
            italianProviders.buy.forEach(provider => {
                const existingProvider = streamingProviders.find(p => p.provider_id === provider.provider_id);
                if (existingProvider) {
                    existingProvider.availability_type = [...(existingProvider.availability_type || []), 'buy'];
                    existingProvider.availability_label = [...(existingProvider.availability_label || []), 'Acquisto'];
                } else {
                    streamingProviders.push({
                        ...provider,
                        availability_type: ['buy'],
                        availability_label: ['Acquisto']
                    });
                }
            });
        }
    }

    // Combina tutti i dettagli
    // Calcola la similarità tra il film corrente e i film simili
    const similarMovies = similarResponse.data.results.map(movie => {
        // Calcola un punteggio di similarità basato su vari fattori
        const factors = [
            // Generi in comune
            ss.mean(movie.genre_ids.map(id => details.genres.some(g => g.id === id) ? 1 : 0)),
            // Differenza di voto (normalizzata)
            1 - Math.abs(movie.vote_average - details.vote_average) / 10,
            // Differenza temporale (se disponibile)
            movie.release_date && details.release_date ? 
                1 - Math.abs(new Date(movie.release_date).getFullYear() - new Date(details.release_date).getFullYear()) / 100 : 0.5
        ];
        
        // Calcola il punteggio medio di similarità
        const similarityScore = ss.mean(factors);
        
        return {
            ...movie,
            similarity_score: Math.round(similarityScore * 100)
        };
    })
    // Ordina per punteggio di similarità e prendi i primi 6
    .sort((a, b) => b.similarity_score - a.similarity_score)
    .slice(0, 6);

    return {
        ...details,
        cast: credits.cast.slice(0, 8).map(actor => ({
            ...actor,
            profile_path: actor.profile_path
        })),
        director,
        trailer,
        streamingProviders,
        similarMovies
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

/**
 * Recupera i dettagli di un membro del cast (attore o regista)
 * @param {string|number} personId - ID della persona da recuperare
 * @returns {Promise<Object>} Oggetto con dettagli della persona e filmografia
 */
const getCastMemberDetails = async (personId) => {
    try {
        // Esegue in parallelo le richieste per dettagli persona e filmografia
        const [detailsResponse, creditsResponse] = await Promise.all([
            tmdbApi.get(`person/${personId}`),
            tmdbApi.get(`person/${personId}/movie_credits`)
        ]);

        const details = detailsResponse.data;
        const credits = creditsResponse.data;

        // Ordina i film per data di uscita (dal più recente)
        const sortedMovies = [...credits.cast || [], ...credits.crew || []]
            .filter(movie => movie.release_date) // Filtra i film senza data
            .sort((a, b) => new Date(b.release_date) - new Date(a.release_date));

        return {
            ...details,
            movies: sortedMovies.slice(0, 20) // Limita a 20 film più recenti
        };
    } catch (error) {
        console.error(`Errore nel recupero dei dettagli del membro del cast ${personId}:`, error);
        return null;
    }
};

module.exports = { 
    getPopularMovies, 
    getMovieDetails, 
    searchMovies, 
    getMovieGenres,
    getTopRatedMovies,
    getMoviesByGenre,
    getCastMemberDetails
};
