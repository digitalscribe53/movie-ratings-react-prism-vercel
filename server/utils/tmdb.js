const axios = require('axios');
require('dotenv').config();

const TMDB_API_KEY = process.env.TMDB_API_KEY;
const TMDB_BASE_URL = 'https://api.themoviedb.org/3';
const IMAGE_BASE_URL = 'https://image.tmdb.org/t/p/w500';

// Create axios instance for TMDB API
const tmdbAPI = axios.create({
  baseURL: TMDB_BASE_URL,
  params: {
    api_key: TMDB_API_KEY
  }
});

// Format movie data from TMDB
const formatMovieData = (movie) => {
  return {
    tmdbId: movie.id,
    title: movie.title,
    description: movie.overview,
    releaseYear: movie.release_date ? new Date(movie.release_date).getFullYear() : null,
    imageSrc: movie.poster_path ? `${IMAGE_BASE_URL}${movie.poster_path}` : '/default-movie-poster.jpg',
    averageRating: movie.vote_average ? movie.vote_average / 2 : 0, // Convert to 5-star scale
    voteCount: movie.vote_count || 0
  };
};

module.exports = {
  // Get movie details by TMDB ID
  getMovieDetails: async (tmdbId) => {
    try {
      const response = await tmdbAPI.get(`/movie/${tmdbId}`);
      return formatMovieData(response.data);
    } catch (error) {
      console.error('TMDB API error:', error.message);
      return null;
    }
  },
  
  // Search movies by query
  searchMovies: async (query, page = 1) => {
    try {
      const response = await tmdbAPI.get('/search/movie', {
        params: {
          query,
          page,
          include_adult: false
        }
      });
      
      // Format the results to match our schema
      const formattedResults = response.data.results.map(movie => formatMovieData(movie));
      
      return {
        results: formattedResults,
        page: response.data.page,
        total_pages: response.data.total_pages,
        total_results: response.data.total_results
      };
    } catch (error) {
      console.error('TMDB search error:', error.message);
      throw error;
    }
  },

  // Get movie recommendations
  getRecommendations: async (tmdbId, page = 1) => {
    try {
      const response = await tmdbAPI.get(`/movie/${tmdbId}/recommendations`, {
        params: { page }
      });
      
      return response.data.results.map(movie => formatMovieData(movie));
    } catch (error) {
      console.error('TMDB recommendations error:', error.message);
      return [];
    }
  },

  // Get popular movies
  getPopularMovies: async (page = 1) => {
    try {
      const response = await tmdbAPI.get('/movie/popular', {
        params: { page }
      });
      
      return response.data.results.map(movie => formatMovieData(movie));
    } catch (error) {
      console.error('TMDB popular movies error:', error.message);
      return [];
    }
  }
};