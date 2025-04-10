const { ApolloServer } = require('@apollo/server');
const { typeDefs } = require('../../server/schema/typeDefs');
const resolvers = require('../../server/schema/resolvers');
const prisma = require('../../server/utils/prisma');
const { checkAuth } = require('../../server/utils/auth');
require('dotenv').config();

// Create Apollo Server instance
const server = new ApolloServer({
  typeDefs,
  resolvers,
  introspection: true
});

// Start the server (only done once)
const startServerPromise = server.start();

// Export the handler function
module.exports = async (req, res) => {
  // Ensure server is started
  await startServerPromise;
  
  // For CORS preflight requests
  if (req.method === 'OPTIONS') {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    return res.status(204).end();
  }
  
  // Handle requests
  if (req.method === 'POST') {
    try {
      // Get user from authentication
      const user = checkAuth({ req });
      
      // Execute query
      const { body } = req;
      const response = await server.executeOperation({
        query: body.query,
        variables: body.variables,
        operationName: body.operationName,
      }, {
        contextValue: {
          user,
          prisma
        },
      });

      // Return response
      return res.status(200).json(response);
    } catch (error) {
      console.error('GraphQL error:', error);
      return res.status(500).json({
        errors: [{ message: 'Internal server error' }]
      });
    }
  } else {
    // Only POST is allowed for GraphQL
    return res.status(405).json({
      errors: [{ message: 'Method not allowed' }]
    });
  }
};