import { Request, Response } from 'express';
import mongoose, { Schema, Document } from 'mongoose';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { v4 as uuidv4 } from 'uuid';
import { BaseService } from '../../shared/base-service';
import { MessageBus } from '../../shared/message-bus';

// Environment variables (would be loaded from .env in a real application)
const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key';
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '1h';
const REFRESH_TOKEN_EXPIRES_IN = process.env.REFRESH_TOKEN_EXPIRES_IN || '7d';

// User interface
interface IUser extends Document {
  username: string;
  email: string;
  password: string;
  roles: string[];
  isActive: boolean;
  lastLogin?: Date;
  createdAt: Date;
  updatedAt: Date;
  comparePassword(candidatePassword: string): Promise<boolean>;
}

// Refresh token interface
interface IRefreshToken extends Document {
  token: string;
  user: mongoose.Types.ObjectId;
  expiresAt: Date;
  isRevoked: boolean;
  createdAt: Date;
}

/**
 * Auth Service - Handles authentication, authorization, and user management
 */
export class AuthService extends BaseService {
  private messageBus: MessageBus;
  private userModel: mongoose.Model<IUser>;
  private refreshTokenModel: mongoose.Model<IRefreshToken>;

  /**
   * Initialize the Auth Service
   */
  constructor() {
    // Initialize base service with configuration
    super(
      'auth-service',
      parseInt(process.env.PORT || '3001'),
      process.env.MONGO_URI || 'mongodb://localhost:27017/mayura-auth',
      process.env.RABBITMQ_URI || 'amqp://localhost',
      process.env.REDIS_URI || 'redis://localhost:6379'
    );

    // Initialize message bus
    this.messageBus = new MessageBus(
      this.rabbitmqUri,
      this.serviceName,
      this.logger
    );

    // Define user schema
    const userSchema = new Schema<IUser>({
      username: { 
        type: String, 
        required: true, 
        unique: true,
        trim: true,
        minlength: 3,
        maxlength: 30
      },
      email: { 
        type: String, 
        required: true, 
        unique: true,
        trim: true,
        lowercase: true,
        match: [/^\S+@\S+\.\S+$/, 'Please enter a valid email']
      },
      password: { 
        type: String, 
        required: true,
        minlength: 8
      },
      roles: { 
        type: [String], 
        default: ['user'],
        enum: ['user', 'admin', 'manager']
      },
      isActive: { 
        type: Boolean, 
        default: true 
      },
      lastLogin: { 
        type: Date
      }
    }, {
      timestamps: true
    });

    // Pre-save hook to hash password
    userSchema.pre('save', async function(next) {
      // Only hash the password if it's modified or new
      if (!this.isModified('password')) return next();
      
      try {
        const salt = await bcrypt.genSalt(10);
        this.password = await bcrypt.hash(this.password, salt);
        next();
      } catch (error: any) {
        next(error);
      }
    });

    // Method to compare passwords
    userSchema.methods.comparePassword = async function(candidatePassword: string): Promise<boolean> {
      return bcrypt.compare(candidatePassword, this.password);
    };

    // Define refresh token schema
    const refreshTokenSchema = new Schema<IRefreshToken>({
      token: { 
        type: String, 
        required: true, 
        unique: true 
      },
      user: { 
        type: Schema.Types.ObjectId, 
        ref: 'User', 
        required: true 
      },
      expiresAt: { 
        type: Date, 
        required: true 
      },
      isRevoked: { 
        type: Boolean, 
        default: false 
      }
    }, {
      timestamps: true
    });

    // Create models
    this.userModel = mongoose.model<IUser>('User', userSchema);
    this.refreshTokenModel = mongoose.model<IRefreshToken>('RefreshToken', refreshTokenSchema);
  }

  /**
   * Initialize routes for the Auth service
   */
  protected async initRoutes(): Promise<void> {
    // User registration
    this.app.post('/register', this.register.bind(this));
    
    // User login
    this.app.post('/login', this.login.bind(this));
    
    // Token refresh
    this.app.post('/refresh-token', this.refreshToken.bind(this));
    
    // User logout
    this.app.post('/logout', this.authenticate.bind(this), this.logout.bind(this));
    
    // Get current user
    this.app.get('/me', this.authenticate.bind(this), this.getCurrentUser.bind(this));
    
    // Update user
    this.app.put('/users/:id', this.authenticate.bind(this), this.authorize(['admin']), this.updateUser.bind(this));
    
    // Get all users (admin only)
    this.app.get('/users', this.authenticate.bind(this), this.authorize(['admin']), this.getAllUsers.bind(this));
  }

  /**
   * Initialize message bus handlers
   */
  private async initMessageHandlers(): Promise<void> {
    await this.messageBus.connect();
    
    // Create exchanges
    await this.messageBus.createExchange('auth', 'topic');
    
    // Create queues
    await this.messageBus.createQueue('auth.user.events', 'auth', 'user.#');
    
    // Listen for user-related events from other services
    await this.messageBus.subscribe('auth.user.events', async (content, msg) => {
      this.logger.info(`Received user event: ${msg.fields.routingKey}`, { content });
      
      // Handle specific events
      switch (msg.fields.routingKey) {
        case 'user.password.reset.request':
          await this.handlePasswordResetRequest(content);
          break;
        // Add other event handlers as needed
      }
    });
  }

  /**
   * Handle password reset requests
   */
  private async handlePasswordResetRequest(content: any): Promise<void> {
    // Implementation for password reset
    // This would generate a token, store it, and send an email
    // For brevity, this is simplified
    this.logger.info(`Password reset requested for user: ${content.email}`);
  }

  /**
   * Middleware to authenticate requests
   */
  private async authenticate(req: Request, res: Response, next: Function): Promise<void> {
    try {
      const authHeader = req.headers.authorization;
      
      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        res.status(401).json({ message: 'Authentication required' });
        return;
      }
      
      const token = authHeader.split(' ')[1];
      
      try {
        const decoded = jwt.verify(token, JWT_SECRET) as { userId: string, roles: string[] };
        
        // Attach user info to request
        (req as any).user = {
          userId: decoded.userId,
          roles: decoded.roles
        };
        
        next();
      } catch (error) {
        res.status(401).json({ message: 'Invalid or expired token' });
      }
    } catch (error) {
      next(error);
    }
  }

  /**
   * Middleware to authorize based on roles
   */
  private authorize(roles: string[]): (req: Request, res: Response, next: Function) => void {
    return (req: Request, res: Response, next: Function): void => {
      try {
        const userRoles = (req as any).user?.roles || [];
        
        const hasRequiredRole = roles.some(role => userRoles.includes(role));
        
        if (!hasRequiredRole) {
          res.status(403).json({ message: 'Insufficient permissions' });
          return;
        }
        
        next();
      } catch (error) {
        next(error);
      }
    };
  }

  /**
   * Register a new user
   */
  private async register(req: Request, res: Response): Promise<void> {
    try {
      const { username, email, password } = req.body;
      
      // Validate input
      if (!username || !email || !password) {
        res.status(400).json({ message: 'Username, email and password are required' });
        return;
      }
      
      // Check if user already exists
      const existingUser = await this.userModel.findOne({
        $or: [{ username }, { email }]
      });
      
      if (existingUser) {
        res.status(409).json({ message: 'Username or email already exists' });
        return;
      }
      
      // Create user
      const user = new this.userModel({
        username,
        email,
        password
      });
      
      await user.save();
      
      // Publish user created event
      await this.messageBus.publish('auth', 'user.created', {
        userId: user._id,
        username: user.username,
        email: user.email,
        roles: user.roles,
        timestamp: new Date().toISOString()
      });
      
      // Return user (excluding password)
      res.status(201).json({
        userId: user._id,
        username: user.username,
        email: user.email,
        roles: user.roles
      });
    } catch (error) {
      this.logger.error(`Registration error: ${error}`);
      res.status(500).json({ message: 'Failed to register user' });
    }
  }

  /**
   * Login user
   */
  private async login(req: Request, res: Response): Promise<void> {
    try {
      const { username, password } = req.body;
      
      // Validate input
      if (!username || !password) {
        res.status(400).json({ message: 'Username and password are required' });
        return;
      }
      
      // Find user by username or email
      const user = await this.userModel.findOne({
        $or: [
          { username },
          { email: username } // Allow login with email as well
        ]
      });
      
      if (!user || !user.isActive) {
        res.status(401).json({ message: 'Invalid credentials' });
        return;
      }
      
      // Check password
      const isMatch = await user.comparePassword(password);
      
      if (!isMatch) {
        res.status(401).json({ message: 'Invalid credentials' });
        return;
      }
      
      // Update last login time
      user.lastLogin = new Date();
      await user.save();
      
      // Generate tokens
      const accessToken = this.generateAccessToken(user);
      const refreshToken = await this.generateRefreshToken(user._id);
      
      // Publish login event
      await this.messageBus.publish('auth', 'user.login', {
        userId: user._id,
        timestamp: new Date().toISOString()
      });
      
      // Return tokens and user info
      res.status(200).json({
        accessToken,
        refreshToken,
        user: {
          userId: user._id,
          username: user.username,
          email: user.email,
          roles: user.roles
        }
      });
    } catch (error) {
      this.logger.error(`Login error: ${error}`);
      res.status(500).json({ message: 'Failed to login' });
    }
  }

  /**
   * Refresh access token using refresh token
   */
  private async refreshToken(req: Request, res: Response): Promise<void> {
    try {
      const { refreshToken } = req.body;
      
      if (!refreshToken) {
        res.status(400).json({ message: 'Refresh token is required' });
        return;
      }
      
      // Find the refresh token
      const tokenDoc = await this.refreshTokenModel.findOne({
        token: refreshToken,
        isRevoked: false,
        expiresAt: { $gt: new Date() }
      });
      
      if (!tokenDoc) {
        res.status(401).json({ message: 'Invalid or expired refresh token' });
        return;
      }
      
      // Get the user
      const user = await this.userModel.findById(tokenDoc.user);
      
      if (!user || !user.isActive) {
        res.status(401).json({ message: 'User not found or inactive' });
        return;
      }
      
      // Generate new access token
      const accessToken = this.generateAccessToken(user);
      
      // Return new access token
      res.status(200).json({ accessToken });
    } catch (error) {
      this.logger.error(`Refresh token error: ${error}`);
      res.status(500).json({ message: 'Failed to refresh token' });
    }
  }

  /**
   * Logout user
   */
  private async logout(req: Request, res: Response): Promise<void> {
    try {
      const { refreshToken } = req.body;
      const userId = (req as any).user.userId;
      
      if (refreshToken) {
        // Revoke specific refresh token
        await this.refreshTokenModel.updateOne(
          { token: refreshToken },
          { isRevoked: true }
        );
      } else {
        // Revoke all refresh tokens for user
        await this.refreshTokenModel.updateMany(
          { user: userId },
          { isRevoked: true }
        );
      }
      
      // Publish logout event
      await this.messageBus.publish('auth', 'user.logout', {
        userId,
        timestamp: new Date().toISOString()
      });
      
      res.status(200).json({ message: 'Logged out successfully' });
    } catch (error) {
      this.logger.error(`Logout error: ${error}`);
      res.status(500).json({ message: 'Failed to logout' });
    }
  }

  /**
   * Get current user information
   */
  private async getCurrentUser(req: Request, res: Response): Promise<void> {
    try {
      const userId = (req as any).user.userId;
      
      const user = await this.userModel.findById(userId).select('-password');
      
      if (!user) {
        res.status(404).json({ message: 'User not found' });
        return;
      }
      
      res.status(200).json({
        userId: user._id,
        username: user.username,
        email: user.email,
        roles: user.roles,
        lastLogin: user.lastLogin
      });
    } catch (error) {
      this.logger.error(`Get current user error: ${error}`);
      res.status(500).json({ message: 'Failed to get user information' });
    }
  }

  /**
   * Update user information (admin only)
   */
  private async updateUser(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const { username, email, roles, isActive } = req.body;
      
      // Find user
      const user = await this.userModel.findById(id);
      
      if (!user) {
        res.status(404).json({ message: 'User not found' });
        return;
      }
      
      // Update fields if provided
      if (username) user.username = username;
      if (email) user.email = email;
      if (roles) user.roles = roles;
      if (isActive !== undefined) user.isActive = isActive;
      
      await user.save();
      
      // Publish user updated event
      await this.messageBus.publish('auth', 'user.updated', {
        userId: user._id,
        username: user.username,
        email: user.email,
        roles: user.roles,
        isActive: user.isActive,
        timestamp: new Date().toISOString()
      });
      
      res.status(200).json({
        userId: user._id,
        username: user.username,
        email: user.email,
        roles: user.roles,
        isActive: user.isActive
      });
    } catch (error) {
      this.logger.error(`Update user error: ${error}`);
      res.status(500).json({ message: 'Failed to update user' });
    }
  }

  /**
   * Get all users (admin only)
   */
  private async getAllUsers(req: Request, res: Response): Promise<void> {
    try {
      // Get pagination parameters
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 10;
      const skip = (page - 1) * limit;
      
      // Get users with pagination
      const users = await this.userModel
        .find()
        .select('-password')
        .skip(skip)
        .limit(limit)
        .sort({ createdAt: -1 });
      
      // Get total count
      const total = await this.userModel.countDocuments();
      
      res.status(200).json({
        users: users.map(user => ({
          userId: user._id,
          username: user.username,
          email: user.email,
          roles: user.roles,
          isActive: user.isActive,
          lastLogin: user.lastLogin,
          createdAt: user.createdAt
        })),
        pagination: {
          page,
          limit,
          total,
          pages: Math.ceil(total / limit)
        }
      });
    } catch (error) {
      this.logger.error(`Get all users error: ${error}`);
      res.status(500).json({ message: 'Failed to get users' });
    }
  }

  /**
   * Generate JWT access token
   */
  private generateAccessToken(user: IUser): string {
    return jwt.sign(
      {
        userId: user._id,
        username: user.username,
        email: user.email,
        roles: user.roles
      },
      JWT_SECRET,
      { expiresIn: JWT_EXPIRES_IN }
    );
  }

  /**
   * Generate refresh token
   */
  private async generateRefreshToken(userId: mongoose.Types.ObjectId): Promise<string> {
    // Calculate expiration date
    const expiresInMs = this.parseExpiresIn(REFRESH_TOKEN_EXPIRES_IN);
    const expiresAt = new Date(Date.now() + expiresInMs);
    
    // Generate token
    const token = uuidv4();
    
    // Create refresh token document
    const refreshToken = new this.refreshTokenModel({
      token,
      user: userId,
      expiresAt,
      isRevoked: false
    });
    
    await refreshToken.save();
    
    return token;
  }

  /**
   * Parse expires in string to milliseconds
   */
  private parseExpiresIn(expiresIn: string): number {
    const match = expiresIn.match(/^(\d+)([smhdw])$/);
    
    if (!match) {
      return 24 * 60 * 60 * 1000; // Default to 24 hours
    }
    
    const value = parseInt(match[1]);
    const unit = match[2];
    
    switch (unit) {
      case 's': return value * 1000; // seconds
      case 'm': return value * 60 * 1000; // minutes
      case 'h': return value * 60 * 60 * 1000; // hours
      case 'd': return value * 24 * 60 * 60 * 1000; // days
      case 'w': return value * 7 * 24 * 60 * 60 * 1000; // weeks
      default: return 24 * 60 * 60 * 1000; // Default to 24 hours
    }
  }

  /**
   * Override start method to also initialize message handlers
   */
  public async start(): Promise<void> {
    await super.start();
    await this.initMessageHandlers();
  }
}

// Start the service if this file is run directly
if (require.main === module) {
  const authService = new AuthService();
  authService.start().catch(error => {
    console.error('Failed to start Auth Service:', error);
    process.exit(1);
  });
  
  // Handle graceful shutdown
  const shutdown = async () => {
    await authService.shutdown();
    process.exit(0);
  };
  
  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}

export default AuthService;