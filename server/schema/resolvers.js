const { signToken, checkAuth } = require('../utils/auth');
const { getMovieDetails } = require('../utils/tmdb');
const tmdbAPI = require('../utils/tmdb');
const ErrorHandler = require('../utils/errorHandler');
const bcrypt = require('bcryptjs');
const prisma = require('../utils/prisma');

const IMAGE_BASE_URL = 'https://image.tmdb.org/t/p/w500';

const resolvers = {
  Query: {
    me: async (_, __, { user, prisma }) => {
      if (!user) {
        throw ErrorHandler.unauthorized('Not logged in');
      }
      
      try {
        const userData = await prisma.user.findUnique({
          where: { id: user.id },
          include: {
            ratings: {
              include: { movie: true }
            },
            reviews: {
              include: { movie: true }
            }
          }
        });

        if (!userData) {
          throw ErrorHandler.notFound('User not found');
        }

        return userData;
      } catch (error) {
        throw ErrorHandler.databaseError('Error fetching user data', error);
      }
    },

    user: async (_, { id }, { prisma }) => {
      try {
        const userData = await prisma.user.findUnique({
          where: { id: parseInt(id) },
          include: {
            ratings: {
              include: { movie: true }
            },
            reviews: {
              include: { movie: true }
            }
          }
        });

        if (!userData) {
          throw ErrorHandler.notFound('User not found');
        }

        return userData;
      } catch (error) {
        throw ErrorHandler.databaseError('Error fetching user data', error);
      }
    },

    users: async (_, __, { prisma }) => {
      try {
        return await prisma.user.findMany({
          include: {
            ratings: true,
            reviews: true
          }
        });
      } catch (error) {
        throw ErrorHandler.databaseError('Error fetching users', error);
      }
    },

    movie: async (_, { id }, { prisma }) => {
      try {
        // If the id starts with 'tmdb-', it's from a search result
        if (id.startsWith('tmdb-')) {
          const tmdbId = parseInt(id.replace('tmdb-', ''));
          
          // First, try to find the movie by tmdbId
          let movie = await prisma.movie.findFirst({
            where: { tmdbId },
            include: {
              ratings: {
                include: { user: true }
              },
              reviews: {
                include: { user: true }
              }
            }
          });
    
          // If movie doesn't exist in our database, fetch from TMDB and create it
          if (!movie) {
            const movieDetails = await tmdbAPI.getMovieDetails(tmdbId);
            if (!movieDetails) {
              throw ErrorHandler.notFound('Movie not found on TMDB');
            }
    
            movie = await prisma.movie.create({
              data: {
                title: movieDetails.title || '',
                description: movieDetails.overview || '',
                releaseYear: movieDetails.release_date ? new Date(movieDetails.release_date).getFullYear() : 0,
                imageSrc: movieDetails.poster_path ? `${IMAGE_BASE_URL}${movieDetails.poster_path}` : '/default-movie-poster.jpg',
                averageRating: (movieDetails.vote_average / 2) || 0,
                tmdbId: tmdbId,
                voteCount: movieDetails.vote_count || 0
              }
            });
    
            // Fetch associations after creation
            movie = await prisma.movie.findFirst({
              where: { tmdbId },
              include: {
                ratings: {
                  include: { user: true }
                },
                reviews: {
                  include: { user: true }
                }
              }
            });
          }
    
          return movie;
        }
    
        // Regular database lookup for seeded movies
        const movie = await prisma.movie.findUnique({
          where: { id: parseInt(id) },
          include: {
            ratings: {
              include: { user: true }
            },
            reviews: {
              include: { user: true }
            }
          }
        });
    
        if (!movie) {
          throw ErrorHandler.notFound('Movie not found');
        }
    
        return movie;
      } catch (error) {
        console.error('Movie fetch error:', error);
        throw ErrorHandler.databaseError('Error fetching movie', error);
      }
    },

    movies: async (_, { page = 1, limit = 20 }, { prisma }) => {
      try {
        // Fetch popular movies directly from TMDB
        const popularMovies = await tmdbAPI.getPopularMovies(page);
        
        // Map TMDB movies to match our Movie type
        return popularMovies.map(movie => ({
          id: `tmdb-${movie.tmdbId}`,
          title: movie.title,
          description: movie.description,
          releaseYear: movie.releaseYear,
          imageSrc: movie.imageSrc,
          averageRating: movie.averageRating,
          tmdbId: movie.tmdbId,
          voteCount: movie.voteCount
        }));
      } catch (error) {
        throw ErrorHandler.tmdbError('Error fetching popular movies', error);
      }
    },

    moviesByTitle: async (_, { title }, { prisma }) => {
      if (!title.trim()) {
        throw ErrorHandler.badRequest('Search title cannot be empty');
      }

      try {
        return await prisma.movie.findMany({
          where: {
            title: {
              contains: title,
              mode: 'insensitive'
            }
          },
          include: {
            ratings: true,
            reviews: true
          }
        });
      } catch (error) {
        throw ErrorHandler.databaseError('Error searching movies', error);
      }
    },

    tmdbMovieDetails: async (_, { tmdbId }) => {
      try {
        if (!tmdbId) {
          throw ErrorHandler.badRequest('TMDB ID is required');
        }
        return await getMovieDetails(tmdbId);
      } catch (error) {
        throw ErrorHandler.tmdbError('Error fetching TMDB movie details', error);
      }
    },

    searchMovies: async (_, { query, page = 1 }) => {
      if (!query.trim()) {
        throw ErrorHandler.badRequest('Search query cannot be empty');
      }
    
      try {
        const tmdbResults = await tmdbAPI.searchMovies(query, page);
        
        return {
          movies: tmdbResults.results,
          totalPages: tmdbResults.total_pages,
          totalResults: tmdbResults.total_results
        };
      } catch (error) {
        console.error('Search error:', error);
        throw ErrorHandler.tmdbError('Error searching TMDB movies', error);
      }
    },

    getRecommendations: async (_, { tmdbId, page = 1 }) => {
      try {
        if (!tmdbId) {
          throw ErrorHandler.badRequest('TMDB ID is required');
        }
        return await tmdbAPI.getRecommendations(tmdbId, page);
      } catch (error) {
        throw ErrorHandler.tmdbError('Error fetching movie recommendations', error);
      }
    },

    getPopularMovies: async (_, { page = 1 }) => {
      try {
        return await tmdbAPI.getPopularMovies(page);
      } catch (error) {
        throw ErrorHandler.tmdbError('Error fetching popular movies', error);
      }
    }
  },

  User: {
    ratings: async (parent, { page = 1 }, { prisma }) => {
      const limit = 12; // Number of ratings per page
      const skip = (page - 1) * limit;

      const [ratings, totalCount] = await Promise.all([
        prisma.rating.findMany({
          where: { userId: parent.id },
          skip,
          take: limit,
          include: {
            movie: {
              select: {
                id: true,
                title: true,
                imageSrc: true
              }
            }
          },
          orderBy: { createdAt: 'desc' }
        }),
        prisma.rating.count({
          where: { userId: parent.id }
        })
      ]);

      return {
        items: ratings,
        totalPages: Math.ceil(totalCount / limit),
        currentPage: page
      };
    },

    reviews: async (parent, { page = 1 }, { prisma }) => {
      const limit = 10; // Number of reviews per page
      const skip = (page - 1) * limit;

      const [reviews, totalCount] = await Promise.all([
        prisma.review.findMany({
          where: { userId: parent.id },
          skip,
          take: limit,
          include: {
            movie: {
              select: {
                id: true,
                title: true,
                imageSrc: true
              }
            }
          },
          orderBy: { createdAt: 'desc' }
        }),
        prisma.review.count({
          where: { userId: parent.id }
        })
      ]);

      return {
        items: reviews,
        totalPages: Math.ceil(totalCount / limit),
        currentPage: page
      };
    }
  },

  Mutation: {
    login: async (_, { username, password }, { prisma }) => {
      try {
        const user = await prisma.user.findUnique({ 
          where: { username } 
        });
        
        if (!user) {
          throw ErrorHandler.unauthorized('Invalid credentials');
        }

        const correctPw = await bcrypt.compare(password, user.password);
        if (!correctPw) {
          throw ErrorHandler.unauthorized('Invalid credentials');
        }

        const token = signToken(user);
        return { token, user };
      } catch (error) {
        if (error.extensions?.code) throw error;
        throw ErrorHandler.databaseError('Login error', error);
      }
    },

    addUser: async (_, args, { prisma }) => {
      try {
        if (!args.username || !args.password) {
          throw ErrorHandler.validationError('Username and password are required');
        }

        if (args.password.length < 6) {
          throw ErrorHandler.validationError('Password must be at least 6 characters');
        }

        const existingUser = await prisma.user.findUnique({ 
          where: { username: args.username } 
        });
        
        if (existingUser) {
          throw ErrorHandler.validationError('Username already exists');
        }

        const hashedPassword = await bcrypt.hash(args.password, 10);
        
        const user = await prisma.user.create({
          data: {
            ...args,
            password: hashedPassword
          }
        });
        
        const token = signToken(user);
        return { token, user };
      } catch (error) {
        if (error.extensions?.code) throw error;
        throw ErrorHandler.databaseError('Error creating user', error);
      }
    },

    addMovie: async (_, args, { user, prisma }) => {
      if (!user?.isAdmin) {
        throw ErrorHandler.forbidden('Must be an admin to add movies');
      }

      try {
        const existingMovie = await prisma.movie.findFirst({ 
          where: { title: args.title } 
        });
        
        if (existingMovie) {
          throw ErrorHandler.validationError('Movie already exists');
        }

        return await prisma.movie.create({
          data: args
        });
      } catch (error) {
        if (error.extensions?.code) throw error;
        throw ErrorHandler.databaseError('Error adding movie', error);
      }
    },

    addRating: async (_, { movieId, rating }, { user, prisma }) => {
      if (!user) {
        throw ErrorHandler.unauthorized('Must be logged in to rate movies');
      }

      if (rating < 1 || rating > 10) {
        throw ErrorHandler.validationError('Rating must be between 1 and 10');
      }

      try {
        const movie = await prisma.movie.findUnique({
          where: { id: parseInt(movieId) }
        });
        
        if (!movie) {
          throw ErrorHandler.notFound('Movie not found');
        }

        // Check if rating already exists
        const existingRating = await prisma.rating.findFirst({
          where: {
            userId: user.id,
            movieId: parseInt(movieId)
          }
        });

        let ratingRecord;
        if (existingRating) {
          // Update existing rating
          ratingRecord = await prisma.rating.update({
            where: { id: existingRating.id },
            data: { rating }
          });
        } else {
          // Create new rating
          ratingRecord = await prisma.rating.create({
            data: {
              rating,
              userId: user.id,
              movieId: parseInt(movieId)
            }
          });
        }

        // Calculate new average rating
        const ratings = await prisma.rating.findMany({
          where: { movieId: parseInt(movieId) }
        });
        
        const avgRating = ratings.reduce((sum, r) => sum + r.rating, 0) / ratings.length;
        
        // Update movie with new average and vote count
        await prisma.movie.update({
          where: { id: parseInt(movieId) },
          data: {
            averageRating: avgRating,
            voteCount: ratings.length
          }
        });

        return ratingRecord;
      } catch (error) {
        throw ErrorHandler.databaseError('Error adding rating', error);
      }
    },

    addReview: async (_, { movieId, content }, { user, prisma }) => {
      if (!user) {
        throw ErrorHandler.unauthorized('Must be logged in to review movies');
      }

      if (!content.trim()) {
        throw ErrorHandler.validationError('Review content cannot be empty');
      }

      try {
        const movie = await prisma.movie.findUnique({
          where: { id: parseInt(movieId) }
        });
        
        if (!movie) {
          throw ErrorHandler.notFound('Movie not found');
        }

        return await prisma.review.create({
          data: {
            content,
            userId: user.id,
            movieId: parseInt(movieId)
          }
        });
      } catch (error) {
        throw ErrorHandler.databaseError('Error adding review', error);
      }
    },

    updateReview: async (_, { reviewId, content }, { user, prisma }) => {
      if (!user) {
        throw ErrorHandler.unauthorized('Must be logged in to update reviews');
      }

      if (!content.trim()) {
        throw ErrorHandler.validationError('Review content cannot be empty');
      }

      try {
        const review = await prisma.review.findUnique({
          where: { id: parseInt(reviewId) }
        });
        
        if (!review) {
          throw ErrorHandler.notFound('Review not found');
        }

        if (review.userId !== user.id) {
          throw ErrorHandler.forbidden('Cannot update another user\'s review');
        }

        return await prisma.review.update({
          where: { id: parseInt(reviewId) },
          data: { content }
        });
      } catch (error) {
        if (error.extensions?.code) throw error;
        throw ErrorHandler.databaseError('Error updating review', error);
      }
    },

    deleteReview: async (_, { reviewId }, { user, prisma }) => {
      if (!user) {
        throw ErrorHandler.unauthorized('Must be logged in to delete reviews');
      }

      try {
        const review = await prisma.review.findUnique({
          where: { id: parseInt(reviewId) }
        });
        
        if (!review) {
          throw ErrorHandler.notFound('Review not found');
        }

        if (review.userId !== user.id) {
          throw ErrorHandler.forbidden('Cannot delete another user\'s review');
        }

        await prisma.review.delete({
          where: { id: parseInt(reviewId) }
        });
        
        return true;
      } catch (error) {
        if (error.extensions?.code) throw error;
        throw ErrorHandler.databaseError('Error deleting review', error);
      }
    }
  }
};

module.exports = resolvers;