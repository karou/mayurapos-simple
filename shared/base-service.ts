import express, { Express, Request, Response, NextFunction } from 'express';
import mongoose from 'mongoose';
import winston from 'winston';
import amqp, { Connection, Channel } from 'amqplib';
import Redis from 'ioredis';
import helmet from 'helmet';
import cors from 'cors';
import rateLimit from 'express-rate-limit';
import { TaskLogger } from './task-logger';

/**
 * BaseService - Abstract class for all microservices to extend
 * Provides standardized setup for database, messaging, caching, and API endpoints
 */
export abstract class BaseService {
  protected app: Express;
  protected port: number;
  protected serviceName: string;
  protected mongoUri: string;
  protected rabbitmqUri: string;
  protected redisUri: string;
  protected logger: winston.Logger;
  protected taskLogger: TaskLogger;
  protected mongoConnection: mongoose.Connection | null = null;
  protected rabbitConnection: Connection | null = null;
  protected rabbitChannel: Channel | null = null;
  protected redisClient: Redis | null = null;

  /**
   * Initialize a new microservice
   * @param serviceName - Name of the microservice
   * @param port - Port to run the service on
   * @param mongoUri - MongoDB connection URI
   * @param rabbitmqUri - RabbitMQ connection URI
   * @param redisUri - Redis connection URI
   */
  constructor(
    serviceName: string,
    port: number,
    mongoUri: string,
    rabbitmqUri: string,
    redisUri: string
  ) {
    this.serviceName = serviceName;
    this.port = port;
    this.mongoUri = mongoUri;
    this.rabbitmqUri = rabbitmqUri;
    this.redisUri = redisUri;
    this.app = express();
    this.taskLogger = new TaskLogger();
    
    // Initialize logger
    this.logger = winston.createLogger({
      level: 'info',
      format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.json()
      ),
      defaultMeta: { service: serviceName },
      transports: [
        new winston.transports.Console(),
        new winston.transports.File({ 
          filename: `logs/${serviceName}-error.log`, 
          level: 'error' 
        }),
        new winston.transports.File({ 
          filename: `logs/${serviceName}-combined.log` 
        })
      ]
    });
    
    // Configure express
    this.configureExpress();
  }

  /**
   * Configure Express application with common middleware
   */
  private configureExpress(): void {
    // Security headers
    this.app.use(helmet());
    
    // CORS configuration
    this.app.use(cors());
    
    // JSON body parser
    this.app.use(express.json({ limit: '1mb' }));
    
    // URL-encoded body parser
    this.app.use(express.urlencoded({ extended: true, limit: '1mb' }));
    
    // Basic rate limiting
    this.app.use(rateLimit({
      windowMs: 15 * 60 * 1000, // 15 minutes
      max: 100, // Limit each IP to 100 requests per windowMs
      standardHeaders: true,
      legacyHeaders: false
    }));
    
    // Request logging middleware
    this.app.use((req: Request, res: Response, next: NextFunction) => {
      this.logger.info(`${req.method} ${req.url}`, { 
        ip: req.ip, 
        userAgent: req.get('user-agent') 
      });
      next();
    });
    
    // Service health check endpoint
    this.app.get('/health', (req: Request, res: Response) => {
      res.status(200).json({
        service: this.serviceName,
        status: 'UP',
        timestamp: new Date().toISOString()
      });
    });
  }

  /**
   * Connect to MongoDB
   */
  protected async connectToMongo(): Promise<void> {
    try {
      await mongoose.connect(this.mongoUri);
      this.mongoConnection = mongoose.connection;
      this.logger.info(`Connected to MongoDB: ${this.mongoUri}`);
    } catch (error) {
      this.logger.error(`MongoDB connection error: ${error}`);
      throw error;
    }
  }

  /**
   * Connect to RabbitMQ
   */
  protected async connectToRabbitMQ(): Promise<void> {
    try {
      this.rabbitConnection = await amqp.connect(this.rabbitmqUri);
      this.rabbitChannel = await this.rabbitConnection.createChannel();
      this.logger.info(`Connected to RabbitMQ: ${this.rabbitmqUri}`);
      
      // Handle connection closure
      this.rabbitConnection.on('close', () => {
        this.logger.warn('RabbitMQ connection closed, attempting to reconnect...');
        setTimeout(() => this.connectToRabbitMQ(), 5000);
      });
    } catch (error) {
      this.logger.error(`RabbitMQ connection error: ${error}`);
      throw error;
    }
  }

  /**
   * Connect to Redis
   */
  protected async connectToRedis(): Promise<void> {
    try {
      this.redisClient = new Redis(this.redisUri);
      this.logger.info(`Connected to Redis: ${this.redisUri}`);
      
      this.redisClient.on('error', (error) => {
        this.logger.error(`Redis error: ${error}`);
      });
    } catch (error) {
      this.logger.error(`Redis connection error: ${error}`);
      throw error;
    }
  }

  /**
   * Register error handling middleware
   */
  protected registerErrorHandlers(): void {
    // 404 handler
    this.app.use((req: Request, res: Response) => {
      res.status(404).json({
        error: 'Not Found',
        message: `Cannot ${req.method} ${req.path}`
      });
    });

    // Global error handler
    this.app.use((err: Error, req: Request, res: Response, next: NextFunction) => {
      this.logger.error(`Unhandled error: ${err.stack}`);
      res.status(500).json({
        error: 'Internal Server Error',
        message: process.env.NODE_ENV === 'production' 
          ? 'An unexpected error occurred'
          : err.message
      });
    });
  }

  /**
   * Initialize routes specific to the service
   * Must be implemented by each service
   */
  protected abstract initRoutes(): void;

  /**
   * Initialize the service by connecting to dependencies and starting the server
   */
  public async start(): Promise<void> {
    try {
      // Connect to dependencies
      await this.connectToMongo();
      await this.connectToRabbitMQ();
      await this.connectToRedis();
      
      // Initialize routes
      this.initRoutes();
      
      // Register error handlers (after routes)
      this.registerErrorHandlers();
      
      // Start server
      this.app.listen(this.port, () => {
        this.logger.info(`${this.serviceName} running on port ${this.port}`);
        this.taskLogger.logTask(
          `Start ${this.serviceName}`,
          `Initialized service with MongoDB, RabbitMQ, and Redis connections`
        );
      });
    } catch (error) {
      this.logger.error(`Failed to start ${this.serviceName}: ${error}`);
      process.exit(1);
    }
  }

  /**
   * Gracefully shutdown the service
   */
  public async shutdown(): Promise<void> {
    this.logger.info(`Shutting down ${this.serviceName}`);
    
    // Close MongoDB connection
    if (this.mongoConnection) {
      await mongoose.disconnect();
    }
    
    // Close RabbitMQ connection
    if (this.rabbitConnection) {
      await this.rabbitConnection.close();
    }
    
    // Close Redis connection
    if (this.redisClient) {
      await this.redisClient.quit();
    }
    
    this.logger.info(`${this.serviceName} shutdown complete`);
  }
}

export default BaseService;