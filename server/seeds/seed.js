const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');
const prisma = new PrismaClient();

async function seed() {
  console.log('Starting seed...');

  // Clean up existing data
  await prisma.review.deleteMany({});
  await prisma.rating.deleteMany({});
  await prisma.movie.deleteMany({});
  await prisma.user.deleteMany({});

  try {
    // Create users
    console.log('Creating users...');
    const adminPassword = await bcrypt.hash('admin123', 10);
    const userPassword = await bcrypt.hash('password123', 10);

    const admin = await prisma.user.create({
      data: {
        username: 'admin',
        password: adminPassword,
        isAdmin: true
      }
    });

    const user = await prisma.user.create({
      data: {
        username: 'testuser',
        password: userPassword,
        isAdmin: false
      }
    });

    // Create movies
    console.log('Creating movies...');
    const movies = [
      {
        title: 'The Shawshank Redemption',
        description: 'Two imprisoned men bond over a number of years, finding solace and eventual redemption through acts of common decency.',
        releaseYear: 1994,
        imageSrc: 'https://image.tmdb.org/t/p/w500/q6y0Go1tsGEsmtFryDOJo3dEmqu.jpg',
        averageRating: 4.5,
        tmdbId: 278,
        voteCount: 2
      },
      {
        title: 'The Godfather',
        description: 'The aging patriarch of an organized crime dynasty transfers control of his clandestine empire to his reluctant son.',
        releaseYear: 1972,
        imageSrc: 'https://image.tmdb.org/t/p/w500/3bhkrj58Vtu7enYsRolD1fZdja1.jpg',
        averageRating: 4.7,
        tmdbId: 238,
        voteCount: 2
      },
      {
        title: 'The Dark Knight',
        description: 'When the menace known as The Joker emerges from his mysterious past, he wreaks havoc and chaos on the people of Gotham.',
        releaseYear: 2008,
        imageSrc: 'https://image.tmdb.org/t/p/w500/qJ2tW6WMUDux911r6m7haRef0WH.jpg',
        averageRating: 4.6,
        tmdbId: 155,
        voteCount: 2
      }
    ];

    const createdMovies = await Promise.all(
      movies.map(movie => 
        prisma.movie.create({
          data: movie
        })
      )
    );

    // Create ratings and reviews
    console.log('Creating ratings and reviews...');
    for (const movie of createdMovies) {
      // Admin ratings and reviews
      await prisma.rating.create({
        data: {
          rating: Math.floor(Math.random() * 5) + 6,  // Random rating between 6-10
          userId: admin.id,
          movieId: movie.id
        }
      });

      await prisma.review.create({
        data: {
          content: `Admin review for ${movie.title}. This is a fantastic movie!`,
          userId: admin.id,
          movieId: movie.id
        }
      });

      // Regular user ratings and reviews
      await prisma.rating.create({
        data: {
          rating: Math.floor(Math.random() * 5) + 6,  // Random rating between 6-10
          userId: user.id,
          movieId: movie.id
        }
      });

      await prisma.review.create({
        data: {
          content: `User review for ${movie.title}. I really enjoyed this movie.`,
          userId: user.id,
          movieId: movie.id
        }
      });
    }

    console.log('Seed completed successfully!');
  } catch (error) {
    console.error('Error seeding database:', error);
  } finally {
    await prisma.$disconnect();
  }
}

seed();