/**
 * Swagger API Documentation Configuration
 * Generates OpenAPI 3.0 spec for the Expense Tracker API
 */

const swaggerJSDoc = require('swagger-jsdoc');
const swaggerUi = require('swagger-ui-express');

// Swagger definition
const swaggerDefinition = {
  openapi: '3.0.0',
  info: {
    title: 'Expense Tracker API',
    version: '1.0.0',
    description: 'A production-ready Expense Tracker API with JWT authentication, multi-tenancy, and RapidAPI integration',
    contact: {
      name: 'API Support',
      email: 'support@expensetracker.com',
      url: 'https://github.com/yourusername/expense-tracker-api'
    },
    license: {
      name: 'MIT',
      url: 'https://opensource.org/licenses/MIT'
    }
  },
  servers: [
    {
      url: 'http://localhost:3000',
      description: 'Development server'
    },
    {
      url: 'https://api.expensetracker.com',
      description: 'Production server'
    }
  ],
  components: {
    securitySchemes: {
      bearerAuth: {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
        description: 'Enter your JWT token in the format: Bearer <token>'
      },
      apiKeyAuth: {
        type: 'apiKey',
        in: 'header',
        name: 'X-RapidAPI-Key',
        description: 'RapidAPI key for programmatic access'
      },
      adminAuth: {
        type: 'apiKey',
        in: 'header',
        name: 'X-Admin-Secret',
        description: 'Admin secret for administrative operations'
      }
    },
    schemas: {
      User: {
        type: 'object',
        properties: {
          _id: { type: 'string', example: '60d21b4667d0d8992e610c85' },
          email: { type: 'string', format: 'email', example: 'user@example.com' },
          name: { type: 'string', example: 'John Doe' },
          role: { type: 'string', enum: ['user', 'admin'], example: 'user' },
          status: { type: 'string', enum: ['active', 'suspended', 'deleted'], example: 'active' },
          isEmailVerified: { type: 'boolean', example: false },
          apiKey: { type: 'string', example: 'exp_a1b2c3d4e5f6g7h8i9j0' },
          createdAt: { type: 'string', format: 'date-time' },
          lastLoginAt: { type: 'string', format: 'date-time' }
        }
      },
      Category: {
        type: 'object',
        properties: {
          _id: { type: 'string' },
          name: { type: 'string', example: 'Food' },
          type: { type: 'string', enum: ['income', 'expense', 'both'], example: 'expense' },
          icon: { type: 'string', example: 'restaurant' },
          color: { type: 'string', example: '#FF5722' },
          user: {
            type: 'object',
            properties: {
              _id: { type: 'string' },
              name: { type: 'string' }
            }
          },
          isDeleted: { type: 'boolean' },
          createdAt: { type: 'string', format: 'date-time' }
        }
      },
      Transaction: {
        type: 'object',
        properties: {
          _id: { type: 'string' },
          type: { type: 'string', enum: ['income', 'expense'], example: 'expense' },
          amount: { type: 'number', example: 45.99, minimum: 0.01 },
          category: {
            type: 'object',
            properties: {
              _id: { type: 'string' },
              name: { type: 'string', example: 'Food' },
              type: { type: 'string' },
              color: { type: 'string' }
            }
          },
          description: { type: 'string', example: 'Lunch at cafe', maxLength: 500 },
          date: { type: 'string', format: 'date-time' },
          user: { type: 'string', example: '60d21b4667d0d8992e610c85' },
          isDeleted: { type: 'boolean' },
          createdAt: { type: 'string', format: 'date-time' },
          updatedAt: { type: 'string', format: 'date-time' }
        }
      },
      AuthResponse: {
        type: 'object',
        properties: {
          success: { type: 'boolean' },
          message: { type: 'string' },
          data: {
            type: 'object',
            properties: {
              user: {
                type: 'object',
                properties: {
                  id: { type: 'string' },
                  email: { type: 'string' },
                  name: { type: 'string' },
                  role: { type: 'string' },
                  apiKey: { type: 'string' },
                  createdAt: { type: 'string', format: 'date-time' }
                }
              },
              token: { type: 'string' }
            }
          }
        }
      },
      ErrorResponse: {
        type: 'object',
        properties: {
          success: { type: 'boolean', example: false },
          error: { type: 'string', example: 'ValidationError' },
          message: { type: 'string', example: 'Invalid input data' },
          details: {
            type: 'object',
            additionalProperties: { type: 'string' }
          }
        }
      },
      Pagination: {
        type: 'object',
        properties: {
          page: { type: 'integer', example: 1 },
          limit: { type: 'integer', example: 20 },
          total: { type: 'integer', example: 100 },
          pages: { type: 'integer', example: 5 }
        }
      }
    },
    responses: {
      Unauthorized: {
        description: 'Unauthorized - Invalid or missing token',
        content: {
          'application/json': {
            schema: { $ref: '#/components/schemas/ErrorResponse' },
            example: {
              success: false,
              error: 'Unauthorized',
              message: 'No token provided. Please authenticate.'
            }
          }
        }
      },
      ValidationError: {
        description: 'Validation Error',
        content: {
          'application/json': {
            schema: { $ref: '#/components/schemas/ErrorResponse' },
            example: {
              success: false,
              error: 'ValidationError',
              message: 'Invalid input data',
              details: {
                amount: 'Amount must be a positive number',
                category: 'Category is required'
              }
            }
          }
        }
      },
      NotFound: {
        description: 'Resource not found',
        content: {
          'application/json': {
            schema: { $ref: '#/components/schemas/ErrorResponse' },
            example: {
              success: false,
              error: 'NotFound',
              message: 'Transaction not found or access denied'
            }
          }
        }
      },
      Forbidden: {
        description: 'Forbidden - Access denied',
        content: {
          'application/json': {
            schema: { $ref: '#/components/schemas/ErrorResponse' },
            example: {
              success: false,
              error: 'Forbidden',
              message: 'Account is suspended'
            }
          }
        }
      },
      RateLimited: {
        description: 'Too many requests',
        content: {
          'application/json': {
            schema: { $ref: '#/components/schemas/ErrorResponse' },
            example: {
              success: false,
              error: 'TooManyRequests',
              message: 'Rate limit exceeded. Please try again later.',
              resetAt: '2024-01-15T10:30:00.000Z'
            }
          }
        }
      }
    },
    parameters: {
      pageParam: {
        name: 'page',
        in: 'query',
        description: 'Page number for pagination',
        required: false,
        schema: { type: 'integer', minimum: 1, default: 1 }
      },
      limitParam: {
        name: 'limit',
        in: 'query',
        description: 'Items per page',
        required: false,
        schema: { type: 'integer', minimum: 1, maximum: 100, default: 20 }
      },
      sortByParam: {
        name: 'sortBy',
        in: 'query',
        description: 'Sort field',
        required: false,
        schema: {
          type: 'string',
          enum: ['date', 'amount', 'createdAt'],
          default: 'date'
        }
      },
      sortOrderParam: {
        name: 'sortOrder',
        in: 'query',
        description: 'Sort order',
        required: false,
        schema: {
          type: 'string',
          enum: ['asc', 'desc'],
          default: 'desc'
        }
      },
      startDateParam: {
        name: 'startDate',
        in: 'query',
        description: 'Filter by start date (ISO 8601)',
        required: false,
        schema: { type: 'string', format: 'date' }
      },
      endDateParam: {
        name: 'endDate',
        in: 'query',
        description: 'Filter by end date (ISO 8601)',
        required: false,
        schema: { type: 'string', format: 'date' }
      }
    }
  },
  tags: [
    {
      name: 'Authentication',
      description: 'User registration, login, and profile management'
    },
    {
      name: 'Transactions',
      description: 'Income and expense management'
    },
    {
      name: 'Categories',
      description: 'Category management (system and custom)'
    },
    {
      name: 'Analytics',
      description: 'Financial analytics and insights'
    },
    {
      name: 'Admin',
      description: 'Admin APIs for API key management (requires X-Admin-Secret)'
    }
  ]
};

// Options for the swagger docs
const options = {
  swaggerDefinition,
  // Path to the API docs
  apis: [
    './src/routes/*.js',
    './src/controllers/*.js',
    './src/models/*.js'
  ]
};

// Initialize swagger-jsdoc
const swaggerSpec = swaggerJSDoc(options);

module.exports = {
  swaggerSpec,
  swaggerUi
};
