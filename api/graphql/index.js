const { ApolloServer } = require('@apollo/server');
const { startServerAndCreateHandler } = require('@as-integrations/vercel');
const { typeDefs, resolvers } = require('../../server/schema');
const prisma = require('../../server/utils/prisma');
const jwt = require('jsonwebtoken');
require('dotenv').config();

// Authentication function
const getUser = (token) => {
  if (token) {
    try {
      return jwt.verify(token, process.env.JWT_SECRET);
    } catch (error) {
      return null;
    }
  }
  return null;
};

// Create the Apollo Server
const server = new ApolloServer({
  typeDefs,
  resolvers,
  introspection: true, // Enable introspection in all environments
  cache: 'bounded',
});

// Create and export the handler
module.exports = startServerAndCreateHandler(server, {
  context: async ({ req }) => {
    // Get the token from the request headers
    const token = req.headers.authorization?.split(' ')[1] || '';
    
    // Add user to the context if token is valid
    const user = getUser(token);
    
    // Return the context object
    return {
      user,
      prisma,
    };
  },
});