const jwt = require('jsonwebtoken');
const { GraphQLError } = require('graphql');
require('dotenv').config();

const secret = process.env.JWT_SECRET || 'mysecretsshhhhh';
const expiration = '2h';

module.exports = {
  // Generate JWT token
  signToken: function ({ id, username, isAdmin }) {
    const payload = { id, username, isAdmin };
    return jwt.sign({ data: payload }, secret, { expiresIn: expiration });
  },

  // Verify JWT token and get user data
  checkAuth: function (context) {
    // Get the authorization header
    const authHeader = context.req.headers.authorization;

    // Check if token exists
    if (!authHeader) {
      return null;
    }

    // Format should be "Bearer [token]"
    const token = authHeader.split(' ').pop().trim();
    if (!token) {
      return null;
    }

    try {
      // Verify token
      const { data } = jwt.verify(token, secret);
      return data;
    } catch (err) {
      console.error('Invalid token:', err.message);
      return null;
    }
  },

  // Express middleware for auth
  authMiddleware: function ({ req }) {
    // Get the authorization header
    const authHeader = req.headers.authorization;

    // Check if token exists
    if (!authHeader) {
      return { user: null };
    }

    // Format should be "Bearer [token]"
    const token = authHeader.split(' ').pop().trim();
    if (!token) {
      return { user: null };
    }

    try {
      // Verify token
      const { data } = jwt.verify(token, secret);
      return { user: data };
    } catch (err) {
      console.error('Invalid token:', err.message);
      return { user: null };
    }
  },

  // Authentication error for GraphQL
  AuthenticationError: new GraphQLError('You must be logged in to perform this action.', {
    extensions: {
      code: 'UNAUTHENTICATED',
    },
  }),
};