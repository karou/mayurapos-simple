import express, { Request, Response, NextFunction } from 'express';
import { createProxyMiddleware, Options } from 'http-proxy-middleware';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import jwt from 'jsonwebtoken';
import winston from 'winston';
import Redis from 'ioredis';
import { v4 as uuidv4 } from 'uuid';

// Environment variables (would be loaded from .env in a real application)
const PORT = parseInt(process.env.PORT || '8000');
const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key';
const NODE_ENV = process.env.NODE_ENV || 'development';
const REDIS_URI = process.env.REDIS_URI || 'redis://localhost:6379';

// Service URLs
const AUTH_SERVICE_URL = process.env.AUTH_SERVICE_URL || 'http://localhost:3001';
const PAYMENT_SERVICE_URL = process.env.PAYMENT_SERVICE_URL || 'http://localhost:3002';
const INVENTORY_SERVICE_URL = process.env.INVENTORY_SERVICE_URL || 'http://localhost:3003';
const ORDER_SERVICE_URL = process.env.ORDER_SERVICE_URL || 'http://localhost:3004';
const DELIVERY_SERVICE_URL = process.env.DELIVERY_SERVICE_URL || 'http://localhost:3005';
const REPORTING_SERVICE_URL = process.env.REPORTING_SERVICE_URL || 'http://localhost:3006';
const NOTIFICATION_SERVICE_URL = process.env.NOTIFICATION_SERVICE_URL || 'http://localhost:3007';

/**
 * API Gateway - Central entry point for all client requests
 */
class ApiGateway {
  private app: express.Express;
  private logger: winston.Logger;
  private redisClient: Redis.Redis;

  /**
   * Initialize the API Gateway
   */
  constructor() {
    this.app = express();
    
    // Initialize logger
    this.logger = winston.createLogger({
      level: NODE_ENV === 'production' ? 'info' : 'debug',
      format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.json()
      ),
      defaultMeta: { service: 'api-gateway' },
      transports: [
        new winston.transports.Console(),
        new winston.transports.File({ 
          filename: 'logs/api-gateway-error.log', 
          level: 'error' 
        }),
        new winston.transports.File({ 
          filename: 'logs/api-gateway-combined.log' 
        })
      ]
    });
    
    // Initialize Redis client
    this.redisClient = new Redis(REDIS_URI);
    this.redisClient.on('error', (error) => {
      this.logger.error(`Redis error: ${error}`);
    });
    
    // Configure Express
    this.configureExpress();
    
    // Configure Routes
    this.configureRoutes();
  }

  /**
   * Configure Express middleware
   */
  private configureExpress(): void {
    // CORS configuration
    this.app.use(cors());
    
    // Security headers
    this.app.use(helmet());
    
    // JSON body parser
    this.app.use(express.json({ limit: '1mb' }));
    
    // URL-encoded body parser
    this.app.use(express.urlencoded({ extended: true, limit: '1mb' }));
    
    // Request logging
    this.app.use((req: Request, res: Response, next: NextFunction) => {
      const requestId = uuidv4();
      res.setHeader('X-Request-ID', requestId);
      
      this.logger.info(`${req.method} ${req.url}`, { 
        requestId,
        ip: req.ip, 
        userAgent: req.get('user-agent') 
      });
      
      const start = Date.now();
      
      res.on('finish', () => {
        const duration = Date.now() - start;
        this.logger.info(`${req.method} ${req.url} ${res.statusCode}`, { 
          requestId,
          duration,
          status: res.statusCode
        });
      });
      
      next();
    });
    
    // Rate limiting
    const apiLimiter = rateLimit({
      windowMs: 15 * 60 * 1000, // 15 minutes
      max: 100, // limit each IP to 100 requests per windowMs
      standardHeaders: true,
      legacyHeaders: false,
      message: 'Too many requests, please try again later.',
      skip: (req) => {
        // Skip rate limiting for certain paths or in development
        return NODE_ENV === 'development' || req.path.startsWith('/health');
      }
    });
    
    this.app.use(apiLimiter);
    
    // Error handling middleware
    this.app.use((err: Error, req: Request, res: Response, next: NextFunction) => {
      this.logger.error(`Unhandled error: ${err.stack}`);
      res.status(500).json({
        error: 'Internal Server Error',
        message: NODE_ENV === 'production' 
          ? 'An unexpected error occurred'
          : err.message
      });
    });
  }

  /**
   * Configure API routes and proxy middleware
   */
  private configureRoutes(): void {
    // Health check endpoint
    this.app.get('/health', (req: Request, res: Response) => {
      res.status(200).json({
        service: 'api-gateway',
        status: 'UP',
        timestamp: new Date().toISOString()
      });
    });
    
    // Authentication endpoints don't require auth
    this.app.use('/auth', this.createProxyMiddleware({
      target: AUTH_SERVICE_URL,
      pathRewrite: { '^/auth': '' },
      changeOrigin: true,
    }));
    
    // Protected routes
    this.app.use('/api/payment', this.authenticate.bind(this), this.createProxyMiddleware({
      target: PAYMENT_SERVICE_URL,
      pathRewrite: { '^/api/payment': '' },
      changeOrigin: true,
    }));
    
    this.app.use('/api/inventory', this.authenticate.bind(this), this.createProxyMiddleware({
      target: INVENTORY_SERVICE_URL,
      pathRewrite: { '^/api/inventory': '' },
      changeOrigin: true,
    }));
    
    this.app.use('/api/orders', this.authenticate.bind(this), this.createProxyMiddleware({
      target: ORDER_SERVICE_URL,
      pathRewrite: { '^/api/orders': '' },
      changeOrigin: true,
    }));
    
    this.app.use('/api/delivery', this.authenticate.bind(this), this.createProxyMiddleware({
      target: DELIVERY_SERVICE_URL,
      pathRewrite: { '^/api/delivery': '' },
      changeOrigin: true,
    }));
    
    this.app.use('/api/reports', this.authenticate.bind(this), this.createProxyMiddleware({
      target: REPORTING_SERVICE_URL,
      pathRewrite: { '^/api/reports': '' },
      changeOrigin: true,
    }));
    
    this.app.use('/api/notifications', this.authenticate.bind(this), this.createProxyMiddleware({
      target: NOTIFICATION_SERVICE_URL,
      pathRewrite: { '^/api/notifications': '' },
      changeOrigin: true,
    }));
    
    // 404 handler
    this.app.use((req: Request, res: Response) => {
      this.logger.warn(`Route not found: ${req.method} ${req.url}`);
      res.status(404).json({
        error: 'Not Found',
        message: `Cannot ${req.method} ${req.url}`
      });
    });
  }

  /**
   * Create proxy middleware with logging and error handling
   */
  private createProxyMiddleware(options: Options): any {
    const proxyMiddleware = createProxyMiddleware({
      ...options,
      logLevel: 'silent', // We'll handle logging ourselves
      onProxyReq: (proxyReq, req, res) => {
        // Add request ID to proxied request
        const requestId = res.getHeader('X-Request-ID') as string;
        proxyReq.setHeader('X-Request-ID', requestId);
        
        // Add user info to proxied request if authenticated
        const user = (req as any).user;
        if (user) {
          proxyReq.setHeader('X-User-ID', user.userId);
          proxyReq.setHeader('X-User-Roles', user.roles.join(','));
        }
        
        // Call original onProxyReq if provided
        if (options.onProxyReq) {
          options.onProxyReq(proxyReq, req, res);
        }
      },
      onProxyRes: (proxyRes, req, res) => {
        // Log proxy response
        this.logger.debug(`Proxy response from ${(options as any).target}${req.url}`, {
          status: proxyRes.statusCode,
          headers: proxyRes.headers
        });
        
        // Call original onProxyRes if provided
        if (options.onProxyRes) {
          options.onProxyRes(proxyRes, req, res);
        }
      },
      onError: (err, req, res) => {
        this.logger.error(`Proxy error for ${req.method} ${req.url}`, { error: err });
        
        // Send error response
        if (!res.headersSent) {
          res.status(500).json({
            error: 'Service Unavailable',
            message: NODE_ENV === 'production' 
              ? 'The requested service is currently unavailable'
              : `Proxy error: ${err.message}`
          });
        }
      }
    });
    
    return proxyMiddleware;
  }

  /**
   * Authentication middleware
   */
  private async authenticate(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      // Check for authorization header
      const authHeader = req.headers.authorization;
      
      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        res.status(401).json({ message: 'Authentication required' });
        return;
      }
      
      const token = authHeader.split(' ')[1];
      
      // Check if token is blacklisted
      const isBlacklisted = await this.checkTokenBlacklist(token);
      if (isBlacklisted) {
        res.status(401).json({ message: 'Token has been revoked' });
        return;
      }
      
      try {
        // Verify token
        const decoded = jwt.verify(token, JWT_SECRET) as { userId: string, roles: string[] };
        
        // Attach user info to request
        (req as any).user = {
          userId: decoded.userId,
          roles: decoded.roles
        };
        
        next();
      } catch (error) {
        // Token verification failed
        res.status(401).json({ message: 'Invalid or expired token' });
      }
    } catch (error) {
      this.logger.error(`Authentication error: ${error}`);
      res.status(500).json({ message: 'Authentication service unavailable' });
    }
  }

  /**
   * Check if a token is blacklisted
   */
  private async checkTokenBlacklist(token: string): Promise<boolean> {
    try {
      // Use Redis to check if token is blacklisted
      const blacklisted = await this.redisClient.get(`blacklist:${token}`);
      return !!blacklisted;
    } catch (error) {
      this.logger.error(`Error checking token blacklist: ${error}`);
      return false; // Default to allowing if Redis is down
    }
  }

  /**
   * Start the API Gateway
   */
  public start(): void {
    this.app.listen(PORT, () => {
      this.logger.info(`API Gateway running on port ${PORT}`);
    });
  }
}

// Create and start the API Gateway
const gateway = new ApiGateway();
gateway.start();

// Handle graceful shutdown
const shutdown = () => {
  process.exit(0);
};

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);