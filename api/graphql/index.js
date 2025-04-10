const { ApolloServer } = require('@apollo/server');
const { startServerAndCreateHandler } = require('@as-integrations/vercel');
const { typeDefs } = require('../../server/schema/typeDefs');
const resolvers = require('../../server/schema/resolvers');
const prisma = require('../../server/utils/prisma');
const { checkAuth } = require('../../server/utils/auth');
require('dotenv').config();

// Create the Apollo Server
const server = new ApolloServer({
  typeDefs,
  resolvers,
  introspection: true, // Enable introspection in all environments
  cache: 'bounded',
  formatError: (error) => {
    console.error('GraphQL error:', error);
    
    // Return custom error format
    return {
      message: error.message,
      locations: error.locations,
      path: error.path,
      extensions: error.extensions,
    };
  },
});

// Create and export the handler
module.exports = startServerAndCreateHandler(server, {
  context: async ({ req }) => {
    // Get user from token
    const user = checkAuth({ req });
    
    // Return the context object
    return {
      user,
      prisma,
    };
  },
});