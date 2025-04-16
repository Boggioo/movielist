const axios = require('axios');

const tmdbApi = axios.create({
    baseURL: 'https://api.themoviedb.org/3/',
    params: {
        api_key: 'eb1bd9da13ec5672dca46db23dd48f17',
        language: 'it-IT',
    }
});

// Funzione per ottenere i film popolari
const getPopularMovies = async () => {
    const response = await tmdbApi.get('movie/popular');
    return response.data.results;
};

// Funzione per ottenere i dettagli di un film
const getMovieDetails = async (movieId) => {
    const [detailsResponse, creditsResponse] = await Promise.all([
        tmdbApi.get(`movie/${movieId}`),
        tmdbApi.get(`movie/${movieId}/credits`)
    ]);

    const details = detailsResponse.data;
    const credits = creditsResponse.data;

    return {
        ...details,
        cast: credits.cast.slice(0, 5)
    };
};


// Funzione per cercare i film
const searchMovies = async (query) => {
    const response = await tmdbApi.get('search/movie', {
        params: { query }
    });
    return response.data.results;
};

module.exports = { getPopularMovies, getMovieDetails, searchMovies };
