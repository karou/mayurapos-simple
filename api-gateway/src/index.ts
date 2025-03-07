// api-gateway/src/index.ts - Complete rewrite of proxy handling

import express, { Request, Response, NextFunction } from 'express';
import { createProxyMiddleware, Options } from 'http-proxy-middleware';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import jwt from 'jsonwebtoken';
import winston from 'winston';
import Redis from 'ioredis';
import { v4 as uuidv4 } from 'uuid';
import http from 'http';

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
  private server: http.Server | null = null;
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
    const corsOptions = {
      origin: '*',
      methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization', 'X-Request-ID']
    };
    
    this.app.use(cors(corsOptions));
    this.app.options('*', cors(corsOptions));
    
    // Security headers - disable contentSecurityPolicy in development
    this.app.use(helmet({
      contentSecurityPolicy: NODE_ENV === 'production'
    }));
    
    // Logging middleware - must come before body parsers
    this.app.use((req: Request, res: Response, next: NextFunction) => {
      const requestId = uuidv4();
      res.setHeader('X-Request-ID', requestId);
      
      this.logger.info(`Incoming request: ${req.method} ${req.url}`, { 
        requestId,
        ip: req.ip, 
        userAgent: req.get('user-agent'),
        contentType: req.get('content-type'),
        contentLength: req.get('content-length')
      });
      
      const start = Date.now();
      
      res.on('finish', () => {
        const duration = Date.now() - start;
        this.logger.info(`Request completed: ${req.method} ${req.url} ${res.statusCode}`, { 
          requestId,
          duration,
          status: res.statusCode
        });
      });
      
      next();
    });
    
    // Body parsers - only used for non-proxied routes
    // For auth routes and API routes, we'll let the proxy handle the body
    this.app.use('/health', express.json({ limit: '2mb' }));
    this.app.use('/health', express.urlencoded({ extended: true, limit: '2mb' }));
    
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
    this.app.use('/auth', this.createServiceProxy(AUTH_SERVICE_URL, ''));
    
    // Protected routes
    this.app.use('/api/payment', this.authenticate.bind(this), this.createServiceProxy(PAYMENT_SERVICE_URL));
    this.app.use('/api/inventory', this.authenticate.bind(this), this.createServiceProxy(INVENTORY_SERVICE_URL));
    this.app.use('/api/orders', this.authenticate.bind(this), this.createServiceProxy(ORDER_SERVICE_URL));
    this.app.use('/api/delivery', this.authenticate.bind(this), this.createServiceProxy(DELIVERY_SERVICE_URL));
    this.app.use('/api/reports', this.authenticate.bind(this), this.createServiceProxy(REPORTING_SERVICE_URL));
    this.app.use('/api/notifications', this.authenticate.bind(this), this.createServiceProxy(NOTIFICATION_SERVICE_URL));
    
    // 404 handler
    this.app.use((req: Request, res: Response) => {
      this.logger.warn(`Route not found: ${req.method} ${req.url}`);
      res.status(404).json({
        error: 'Not Found',
        message: `Cannot ${req.method} ${req.url}`
      });
    });

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
   * Create a service proxy with proper request handling
   */
  private createServiceProxy(targetUrl: string, pathPrefix = ''): express.RequestHandler {
    const pathRewrite: Record<string, string> = {};
    
    // Determine path rewrite pattern based on the service
    if (targetUrl === AUTH_SERVICE_URL) {
      pathRewrite['^/auth'] = '';
    } else if (pathPrefix) {
      pathRewrite[`^${pathPrefix}`] = '';
    } else {
      // Extract service name from the URL path to create the rewrite pattern
      const match = /\/api\/([^\/]+)/.exec(pathPrefix || '');
      if (match && match[1]) {
        pathRewrite[`^/api/${match[1]}`] = '';
      }
    }
    
    return createProxyMiddleware({
      target: targetUrl,
      pathRewrite,
      changeOrigin: true,
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
        
        // Handle JSON bodies
        if (req.body && Object.keys(req.body).length > 0) {
          if (req.headers['content-type']?.includes('application/json')) {
            const bodyData = JSON.stringify(req.body);
            
            // Update content-length
            proxyReq.setHeader('Content-Length', Buffer.byteLength(bodyData));
            
            // End the original request before writing
            proxyReq.setHeader('Connection', 'keep-alive');
            
            // Write body to request
            proxyReq.write(bodyData);
          }
        }
        
        // Log the outgoing proxy request
        this.logger.debug(`Proxying ${req.method} ${req.url} to ${targetUrl}`, {
          requestId,
          headers: {
            contentType: proxyReq.getHeader('content-type'),
            contentLength: proxyReq.getHeader('content-length'),
          },
          targetUrl
        });
      },
      onProxyRes: (proxyRes, req, res) => {
        // Log proxy response
        const requestId = res.getHeader('X-Request-ID') as string;
        this.logger.debug(`Proxy response from ${targetUrl}${req.url}`, {
          requestId,
          status: proxyRes.statusCode,
          contentType: proxyRes.headers['content-type'],
          contentLength: proxyRes.headers['content-length']
        });
      },
      onError: (err, req, res) => {
        const requestId = res.getHeader('X-Request-ID') as string;
        this.logger.error(`Proxy error for ${req.method} ${req.url}`, { 
          requestId,
          targetUrl,
          error: err.message,
          stack: err.stack
        });
        
        // Send error response
        if (!res.headersSent) {
          res.status(503).json({
            error: 'Service Unavailable',
            message: NODE_ENV === 'production' 
              ? 'The requested service is currently unavailable'
              : `Proxy error: ${err.message}`
          });
        }
      },
      // Important options for reliable proxying
      secure: false, // Allow self-signed certs in development
      timeout: 30000, // 30 second timeout
      proxyTimeout: 30000, // 30 second proxy timeout
      followRedirects: false, // Don't follow redirects
      selfHandleResponse: false, // Let the proxy handle the response
      cookieDomainRewrite: '', // Rewrite cookies to match gateway domain
      ws: false, // Don't proxy websockets
      xfwd: true, // Add x-forwarded headers
      // Don't parse the body; we've already done that
      bodyParser: false
    });
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
    this.server = this.app.listen(PORT, () => {
      this.logger.info(`API Gateway running on port ${PORT}`);
    });
    
    // Add error handling for server
    this.server.on('error', (error) => {
      this.logger.error(`Server error: ${error}`);
    });
  }

  /**
   * Stop the API Gateway
   */
  public async stop(): Promise<void> {
    if (this.server) {
      await new Promise<void>((resolve) => {
        this.server?.close(() => {
          this.logger.info('API Gateway stopped');
          resolve();
        });
      });
    }
    
    if (this.redisClient) {
      await this.redisClient.quit();
    }
  }
}

// Create and start the API Gateway
const gateway = new ApiGateway();
gateway.start();

// Handle graceful shutdown
const shutdown = async () => {
  await gateway.stop();
  process.exit(0);
};

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);

export default ApiGateway;