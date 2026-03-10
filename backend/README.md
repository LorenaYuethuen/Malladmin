# Mall Admin Backend API

Backend API for the Mall Admin Integration Platform - A comprehensive e-commerce management system.

## Features

- **RESTful API** with Express.js and TypeScript
- **Database** PostgreSQL with connection pooling
- **Caching** Redis for session storage and caching
- **Authentication** JWT-based with refresh tokens
- **Validation** Zod schema validation
- **Security** Helmet, CORS, rate limiting
- **Logging** Winston structured logging
- **Error Handling** Unified error response format
- **Monitoring** Prometheus metrics (planned)
- **Documentation** OpenAPI/Swagger (planned)

## Prerequisites

- Node.js >= 18.x
- PostgreSQL >= 14.x
- Redis >= 7.x
- npm or yarn

## Quick Start

### 1. Install Dependencies

```bash
npm install
```

### 2. Environment Setup

Copy the example environment file and configure:

```bash
cp .env.example .env
```

Edit `.env` with your configuration.

### 3. Database Setup

Start PostgreSQL and Redis using Docker Compose:

```bash
docker-compose up -d
```

Or install them locally and configure the connection in `.env`.

### 4. Run Migrations

```bash
npm run migrate
```

### 5. Seed Database (Optional)

```bash
npm run seed
```

### 6. Start Development Server

```bash
npm run dev
```

The API will be available at `http://localhost:3000`.

## Project Structure

```
backend/
├── src/
│   ├── config/           # Configuration files
│   ├── controllers/      # Route controllers
│   ├── middleware/       # Express middleware
│   ├── models/           # Data models
│   ├── routes/           # API routes
│   ├── services/         # Business logic
│   ├── database/         # Database connection and migrations
│   ├── types/            # TypeScript type definitions
│   ├── utils/            # Utility functions
│   ├── app.ts            # Express app setup
│   └── server.ts         # Server entry point
├── tests/                # Test files
├── uploads/              # File uploads directory
├── logs/                 # Log files
├── .env.example          # Example environment variables
├── package.json          # Dependencies and scripts
├── tsconfig.json         # TypeScript configuration
└── README.md             # This file
```

## Available Scripts

- `npm run dev` - Start development server with hot reload
- `npm run build` - Build for production
- `npm start` - Start production server
- `npm test` - Run tests
- `npm run test:watch` - Run tests in watch mode
- `npm run lint` - Lint code
- `npm run format` - Format code with Prettier
- `npm run migrate` - Run database migrations
- `npm run seed` - Seed database with test data

## API Documentation

### Base URL

```
http://localhost:3000/api/v1
```

### Response Format

All API responses follow this format:

```typescript
{
  "success": boolean,
  "data": T | null,
  "message"?: string,
  "error"?: {
    "code": string,
    "message": string,
    "details"?: any
  },
  "meta": {
    "timestamp": string,
    "requestId": string,
    "version": string
  }
}
```

### Error Codes

| Code | HTTP Status | Description |
|------|-------------|-------------|
| `VALIDATION_ERROR` | 400 | Request validation failed |
| `UNAUTHORIZED` | 401 | Authentication required |
| `FORBIDDEN` | 403 | Insufficient permissions |
| `NOT_FOUND` | 404 | Resource not found |
| `CONFLICT` | 409 | Resource conflict |
| `RATE_LIMIT_EXCEEDED` | 429 | Too many requests |
| `INTERNAL_ERROR` | 500 | Server error |
| `SERVICE_UNAVAILABLE` | 503 | Service unavailable |

### Health Check

```bash
GET /health
```

Response:
```json
{
  "status": "ok",
  "timestamp": "2024-01-15T10:30:00Z",
  "uptime": 12345
}
```

## Environment Variables

See `.env.example` for all available environment variables.

### Required Variables

- `NODE_ENV` - Environment (development, production)
- `PORT` - Server port
- `DB_HOST` - PostgreSQL host
- `DB_PORT` - PostgreSQL port
- `DB_NAME` - Database name
- `DB_USER` - Database user
- `DB_PASSWORD` - Database password
- `REDIS_HOST` - Redis host
- `REDIS_PORT` - Redis port
- `JWT_SECRET` - JWT secret key
- `JWT_REFRESH_SECRET` - JWT refresh secret key

## Development

### Adding a New Endpoint

1. Create a controller in `src/controllers/`
2. Create a route in `src/routes/`
3. Add validation schema if needed
4. Register route in `src/routes/index.ts`
5. Add tests in `tests/`

### Database Migrations

Migrations are located in `src/database/migrations/`.

Create a new migration:

```bash
# Create migration file manually in src/database/migrations/
# Name format: YYYYMMDDHHMMSS_description.sql
```

Run migrations:

```bash
npm run migrate
```

### Testing

```bash
# Run all tests
npm test

# Run tests in watch mode
npm run test:watch

# Run tests with coverage
npm test -- --coverage
```

## Deployment

### Build for Production

```bash
npm run build
```

### Start Production Server

```bash
npm start
```

### Docker Deployment

```bash
# Build image
docker build -t mall-admin-backend .

# Run container
docker run -p 3000:3000 --env-file .env mall-admin-backend
```

## Security

- All passwords are hashed with bcrypt
- JWT tokens for authentication
- CORS configured for allowed origins
- Helmet for security headers
- Rate limiting to prevent abuse
- Input validation with Zod
- SQL injection prevention with parameterized queries

## Monitoring

- Structured logging with Winston
- Request ID tracking
- Error tracking (Sentry integration planned)
- Prometheus metrics (planned)
- Health check endpoint

## Contributing

1. Create a feature branch
2. Make your changes
3. Add tests
4. Run linter and tests
5. Submit a pull request

## License

MIT
