import { Request, Response } from 'express';
import mongoose, { Schema, Document } from 'mongoose';
import { v4 as uuidv4 } from 'uuid';
import nodemailer from 'nodemailer';
import { BaseService } from '../../shared/base-service';
import { MessageBus } from '../../shared/message-bus';

// Environment variables
const SMTP_HOST = process.env.SMTP_HOST || 'smtp.example.com';
const SMTP_PORT = parseInt(process.env.SMTP_PORT || '587');
const SMTP_USER = process.env.SMTP_USER || 'user@example.com';
const SMTP_PASS = process.env.SMTP_PASS || 'password';
const SMS_API_KEY = process.env.SMS_API_KEY || 'your-sms-api-key';
const FROM_EMAIL = process.env.FROM_EMAIL || 'noreply@mayurapos.com';
const FROM_NAME = process.env.FROM_NAME || 'MayuraPOS';

// Notification type enum
enum NotificationType {
  EMAIL = 'EMAIL',
  SMS = 'SMS',
  PUSH = 'PUSH',
  IN_APP = 'IN_APP'
}

// Notification status enum
enum NotificationStatus {
  PENDING = 'PENDING',
  SENT = 'SENT',
  DELIVERED = 'DELIVERED',
  FAILED = 'FAILED',
  CANCELLED = 'CANCELLED'
}

// Notification priority enum
enum NotificationPriority {
  LOW = 'LOW',
  MEDIUM = 'MEDIUM',
  HIGH = 'HIGH'
}

// Notification interface
interface INotification extends Document {
  notificationId: string;
  type: NotificationType;
  status: NotificationStatus;
  priority: NotificationPriority;
  sender: {
    name: string;
    email?: string;
    phone?: string;
  };
  recipient: {
    userId?: string;
    name: string;
    email?: string;
    phone?: string;
    deviceTokens?: string[];
  };
  content: {
    subject?: string;
    body: string;
    html?: string;
    data?: Record<string, any>;
    templateId?: string;
    templateData?: Record<string, any>;
  };
  metadata: {
    orderId?: string;
    deliveryId?: string;
    paymentId?: string;
    referenceId?: string;
    source?: string;
    tags?: string[];
  };
  scheduledFor?: Date;
  sentAt?: Date;
  deliveredAt?: Date;
  failedAt?: Date;
  failureReason?: string;
  retryCount: number;
  maxRetries: number;
  readAt?: Date;
  clickedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

// Template interface
interface ITemplate extends Document {
  templateId: string;
  name: string;
  description?: string;
  type: NotificationType;
  subject?: string;
  body: string;
  html?: string;
  variables: string[];
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

// Subscription interface
interface ISubscription extends Document {
  subscriptionId: string;
  userId: string;
  email?: string;
  phone?: string;
  deviceTokens?: string[];
  preferences: {
    orderUpdates: boolean;
    deliveryUpdates: boolean;
    paymentUpdates: boolean;
    marketing: boolean;
    promotions: boolean;
  };
  channels: {
    email: boolean;
    sms: boolean;
    push: boolean;
    inApp: boolean;
  };
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Notification Service - Handles sending notifications to users
 */
export class NotificationService extends BaseService {
  private messageBus: MessageBus;
  private notificationModel: mongoose.Model<INotification>;
  private templateModel: mongoose.Model<ITemplate>;
  private subscriptionModel: mongoose.Model<ISubscription>;
  private emailTransporter: nodemailer.Transporter;
  private isProcessingQueue: boolean = false;

  /**
   * Initialize the Notification Service
   */
  constructor() {
    // Initialize base service with configuration
    super(
      'notification-service',
      parseInt(process.env.PORT || '3007'),
      process.env.MONGO_URI || 'mongodb://localhost:27017/mayura-notification',
      process.env.RABBITMQ_URI || 'amqp://localhost',
      process.env.REDIS_URI || 'redis://localhost:6379'
    );

    // Initialize message bus
    this.messageBus = new MessageBus(
      this.rabbitmqUri,
      this.serviceName,
      this.logger
    );

    // Initialize email transporter
    this.emailTransporter = nodemailer.createTransport({
      host: SMTP_HOST,
      port: SMTP_PORT,
      secure: SMTP_PORT === 465, // true for 465, false for other ports
      auth: {
        user: SMTP_USER,
        pass: SMTP_PASS
      }
    });

    // Define notification schema
    const notificationSchema = new Schema<INotification>({
      notificationId: { 
        type: String, 
        required: true, 
        unique: true 
      },
      type: { 
        type: String, 
        required: true,
        enum: Object.values(NotificationType) 
      },
      status: { 
        type: String, 
        required: true,
        enum: Object.values(NotificationStatus),
        default: NotificationStatus.PENDING,
        index: true
      },
      priority: { 
        type: String, 
        required: true,
        enum: Object.values(NotificationPriority),
        default: NotificationPriority.MEDIUM
      },
      sender: {
        name: { type: String, required: true },
        email: { type: String },
        phone: { type: String }
      },
      recipient: {
        userId: { 
          type: String,
          index: true
        },
        name: { type: String, required: true },
        email: { type: String },
        phone: { type: String },
        deviceTokens: [String]
      },
      content: {
        subject: { type: String },
        body: { type: String, required: true },
        html: { type: String },
        data: { type: Schema.Types.Mixed },
        templateId: { 
          type: String,
          index: true
        },
        templateData: { type: Schema.Types.Mixed }
      },
      metadata: {
        orderId: { 
          type: String,
          index: true
        },
        deliveryId: { 
          type: String,
          index: true
        },
        paymentId: { 
          type: String,
          index: true
        },
        referenceId: { 
          type: String,
          index: true
        },
        source: { type: String },
        tags: [String]
      },
      scheduledFor: { 
        type: Date,
        index: true
      },
      sentAt: { type: Date },
      deliveredAt: { type: Date },
      failedAt: { type: Date },
      failureReason: { type: String },
      retryCount: { 
        type: Number, 
        required: true,
        default: 0
      },
      maxRetries: { 
        type: Number, 
        required: true,
        default: 3
      },
      readAt: { type: Date },
      clickedAt: { type: Date }
    }, {
      timestamps: true
    });

    // Define template schema
    const templateSchema = new Schema<ITemplate>({
      templateId: { 
        type: String, 
        required: true, 
        unique: true 
      },
      name: { 
        type: String, 
        required: true,
        unique: true 
      },
      description: { type: String },
      type: { 
        type: String, 
        required: true,
        enum: Object.values(NotificationType) 
      },
      subject: { type: String },
      body: { type: String, required: true },
      html: { type: String },
      variables: [String],
      isActive: { 
        type: Boolean, 
        required: true,
        default: true 
      }
    }, {
      timestamps: true
    });

    // Define subscription schema
    const subscriptionSchema = new Schema<ISubscription>({
      subscriptionId: { 
        type: String, 
        required: true, 
        unique: true 
      },
      userId: { 
        type: String, 
        required: true,
        unique: true,
        index: true
      },
      email: { type: String },
      phone: { type: String },
      deviceTokens: [String],
      preferences: {
        orderUpdates: { 
          type: Boolean, 
          required: true,
          default: true 
        },
        deliveryUpdates: { 
          type: Boolean, 
          required: true,
          default: true 
        },
        paymentUpdates: { 
          type: Boolean, 
          required: true,
          default: true 
        },
        marketing: { 
          type: Boolean, 
          required: true,
          default: false 
        },
        promotions: { 
          type: Boolean, 
          required: true,
          default: false 
        }
      },
      channels: {
        email: { 
          type: Boolean, 
          required: true,
          default: true 
        },
        sms: { 
          type: Boolean, 
          required: true,
          default: false 
        },
        push: { 
          type: Boolean, 
          required: true,
          default: false 
        },
        inApp: { 
          type: Boolean, 
          required: true,
          default: true 
        }
      }
    }, {
      timestamps: true
    });

    // Create models
    this.notificationModel = mongoose.model<INotification>('Notification', notificationSchema);
    this.templateModel = mongoose.model<ITemplate>('Template', templateSchema);
    this.subscriptionModel = mongoose.model<ISubscription>('Subscription', subscriptionSchema);
  }

  /**
   * Initialize routes for the Notification service
   */
  protected async initRoutes(): Promise<void> {
    // Notification routes
    this.app.post('/notifications', this.authenticate.bind(this), this.createNotification.bind(this));
    this.app.get('/notifications/:id', this.authenticate.bind(this), this.getNotification.bind(this));
    this.app.get('/notifications', this.authenticate.bind(this), this.getNotifications.bind(this));
    this.app.post('/notifications/:id/cancel', this.authenticate.bind(this), this.cancelNotification.bind(this));
    this.app.post('/notifications/:id/read', this.authenticate.bind(this), this.markAsRead.bind(this));
    
    // Template routes
    this.app.post('/templates', this.authenticate.bind(this), this.createTemplate.bind(this));
    this.app.get('/templates/:id', this.authenticate.bind(this), this.getTemplate.bind(this));
    this.app.put('/templates/:id', this.authenticate.bind(this), this.updateTemplate.bind(this));
    this.app.get('/templates', this.authenticate.bind(this), this.getTemplates.bind(this));
    
    // Subscription routes
    this.app.post('/subscriptions', this.authenticate.bind(this), this.createSubscription.bind(this));
    this.app.get('/subscriptions/:userId', this.authenticate.bind(this), this.getSubscription.bind(this));
    this.app.put('/subscriptions/:userId', this.authenticate.bind(this), this.updateSubscription.bind(this));
    this.app.delete('/subscriptions/:userId', this.authenticate.bind(this), this.deleteSubscription.bind(this));
    
    // Bulk notification route
    this.app.post('/notifications/bulk', this.authenticate.bind(this), this.sendBulkNotifications.bind(this));
  }

  /**
   * Initialize message bus handlers
   */
  private async initMessageHandlers(): Promise<void> {
    await this.messageBus.connect();
    
    // Create exchanges
    await this.messageBus.createExchange('notification', 'topic');
    
    // Create queues
    await this.messageBus.createQueue('notification.order.events', 'order', 'order.#');
    await this.messageBus.createQueue('notification.payment.events', 'payment', 'payment.#');
    await this.messageBus.createQueue('notification.delivery.events', 'delivery', 'delivery.#');
    
    // Listen for order events
    await this.messageBus.subscribe('notification.order.events', async (content, msg) => {
      this.logger.info(`Received order event: ${msg.fields.routingKey}`, { content });
      
      // Handle specific events
      switch (msg.fields.routingKey) {
        case 'order.created':
          await this.handleOrderCreated(content);
          break;
        case 'order.confirmed':
          await this.handleOrderConfirmed(content);
          break;
        case 'order.cancelled':
          await this.handleOrderCancelled(content);
          break;
        case 'order.status.fulfilled':
          await this.handleOrderFulfilled(content);
          break;
      }
    });
    
    // Listen for payment events
    await this.messageBus.subscribe('notification.payment.events', async (content, msg) => {
      this.logger.info(`Received payment event: ${msg.fields.routingKey}`, { content });
      
      // Handle specific events
      switch (msg.fields.routingKey) {
        case 'payment.completed':
          await this.handlePaymentCompleted(content);
          break;
        case 'payment.failed':
          await this.handlePaymentFailed(content);
          break;
        case 'payment.refunded':
          await this.handlePaymentRefunded(content);
          break;
      }
    });
    
    // Listen for delivery events
    await this.messageBus.subscribe('notification.delivery.events', async (content, msg) => {
      this.logger.info(`Received delivery event: ${msg.fields.routingKey}`, { content });
      
      // Handle specific events
      switch (msg.fields.routingKey) {
        case 'delivery.assigned':
          await this.handleDeliveryAssigned(content);
          break;
        case 'delivery.started':
          await this.handleDeliveryStarted(content);
          break;
        case 'delivery.completed':
          await this.handleDeliveryCompleted(content);
          break;
      }
    });
    
    // Start the notification processor
    this.startNotificationProcessor();
  }

  /**
   * Basic JWT authentication middleware
   * In a real implementation, this would validate against the Auth service
   */
  private authenticate(req: Request, res: Response, next: Function): void {
    // This is a simplified version that assumes the API Gateway has already
    // performed authentication. In a real implementation, this would
    // validate the JWT token and set user info
    
    // Simulate authenticated user for demo purposes
    (req as any).user = {
      userId: 'user123',
      roles: ['user']
    };
    
    next();
  }

  /**
   * Create a new notification
   */
  private async createNotification(req: Request, res: Response): Promise<void> {
    try {
      const { 
        type, 
        priority = NotificationPriority.MEDIUM,
        recipient, 
        content, 
        metadata = {},
        scheduledFor
      } = req.body;
      
      // Validate required fields
      if (!type || !recipient || !content || !content.body) {
        res.status(400).json({ 
          message: 'Type, recipient, and content with body are required' 
        });
        return;
      }
      
      // Validate recipient has at least one contact method
      if (!recipient.email && !recipient.phone && (!recipient.deviceTokens || recipient.deviceTokens.length === 0)) {
        res.status(400).json({ 
          message: 'Recipient must have at least one contact method (email, phone, or deviceTokens)' 
        });
        return;
      }
      
      // Validate type-specific requirements
      if (type === NotificationType.EMAIL && !recipient.email) {
        res.status(400).json({ message: 'Email notifications require recipient email' });
        return;
      }
      
      if (type === NotificationType.SMS && !recipient.phone) {
        res.status(400).json({ message: 'SMS notifications require recipient phone' });
        return;
      }
      
      if (type === NotificationType.PUSH && (!recipient.deviceTokens || recipient.deviceTokens.length === 0)) {
        res.status(400).json({ message: 'Push notifications require recipient device tokens' });
        return;
      }
      
      // Use template if provided
      let finalContent = { ...content };
      
      if (content.templateId) {
        const template = await this.templateModel.findOne({ templateId: content.templateId });
        
        if (!template) {
          res.status(404).json({ message: 'Template not found' });
          return;
        }
        
        if (!template.isActive) {
          res.status(400).json({ message: 'Template is not active' });
          return;
        }
        
        if (template.type !== type) {
          res.status(400).json({ 
            message: `Template type (${template.type}) does not match notification type (${type})` 
          });
          return;
        }
        
        finalContent = await this.processTemplate(template, content.templateData || {});
      }
      
      // Create notification
      const notificationId = uuidv4();
      const notification = new this.notificationModel({
        notificationId,
        type,
        status: NotificationStatus.PENDING,
        priority,
        sender: {
          name: FROM_NAME,
          email: FROM_EMAIL
        },
        recipient,
        content: finalContent,
        metadata,
        scheduledFor: scheduledFor ? new Date(scheduledFor) : undefined,
        retryCount: 0,
        maxRetries: 3
      });
      
      await notification.save();
      
      // If notification is scheduled for the future, don't process it now
      if (!scheduledFor || new Date(scheduledFor) <= new Date()) {
        // Process notification immediately
        this.processNotification(notification)
          .catch(error => this.logger.error(`Error processing notification: ${error}`));
      }
      
      res.status(201).json({
        notificationId: notification.notificationId,
        type: notification.type,
        status: notification.status,
        scheduledFor: notification.scheduledFor,
        createdAt: notification.createdAt
      });
    } catch (error: any) {
      this.logger.error(`Notification creation error: ${error}`);
      res.status(500).json({ message: 'Failed to create notification', error: error.message });
    }
  }

  /**
   * Get notification by ID
   */
  private async getNotification(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      
      const notification = await this.notificationModel.findOne({
        $or: [
          { notificationId: id },
          { _id: mongoose.isValidObjectId(id) ? id : undefined }
        ]
      });
      
      if (!notification) {
        res.status(404).json({ message: 'Notification not found' });
        return;
      }
      
      res.status(200).json({
        notificationId: notification.notificationId,
        type: notification.type,
        status: notification.status,
        priority: notification.priority,
        sender: notification.sender,
        recipient: {
          userId: notification.recipient.userId,
          name: notification.recipient.name
        },
        content: {
          subject: notification.content.subject,
          body: notification.content.body,
          templateId: notification.content.templateId
        },
        metadata: notification.metadata,
        scheduledFor: notification.scheduledFor,
        sentAt: notification.sentAt,
        deliveredAt: notification.deliveredAt,
        failedAt: notification.failedAt,
        failureReason: notification.failureReason,
        readAt: notification.readAt,
        clickedAt: notification.clickedAt,
        createdAt: notification.createdAt,
        updatedAt: notification.updatedAt
      });
    } catch (error) {
      this.logger.error(`Get notification error: ${error}`);
      res.status(500).json({ message: 'Failed to get notification' });
    }
  }

  /**
   * Get notifications with filtering
   */
  private async getNotifications(req: Request, res: Response): Promise<void> {
    try {
      const { 
        userId, 
        status, 
        type, 
        orderId, 
        deliveryId,
        startDate, 
        endDate, 
        page = 1, 
        limit = 10 
      } = req.query;
      
      // Build query
      const query: any = {};
      
      if (userId) query['recipient.userId'] = userId;
      if (status) query.status = status;
      if (type) query.type = type;
      if (orderId) query['metadata.orderId'] = orderId;
      if (deliveryId) query['metadata.deliveryId'] = deliveryId;
      
      // Date range
      if (startDate || endDate) {
        query.createdAt = {};
        if (startDate) query.createdAt.$gte = new Date(startDate as string);
        if (endDate) query.createdAt.$lte = new Date(endDate as string);
      }
      
      // Parse pagination
      const skip = (parseInt(page as string) - 1) * parseInt(limit as string);
      
      // Get notifications
      const notifications = await this.notificationModel
        .find(query)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(parseInt(limit as string));
      
      // Get total count
      const total = await this.notificationModel.countDocuments(query);
      
      res.status(200).json({
        notifications: notifications.map(notification => ({
          notificationId: notification.notificationId,
          type: notification.type,
          status: notification.status,
          priority: notification.priority,
          recipient: {
            userId: notification.recipient.userId,
            name: notification.recipient.name
          },
          content: {
            subject: notification.content.subject,
            body: notification.content.body
          },
          metadata: notification.metadata,
          scheduledFor: notification.scheduledFor,
          sentAt: notification.sentAt,
          readAt: notification.readAt,
          createdAt: notification.createdAt
        })),
        pagination: {
          page: parseInt(page as string),
          limit: parseInt(limit as string),
          total,
          pages: Math.ceil(total / parseInt(limit as string))
        }
      });
    } catch (error) {
      this.logger.error(`Get notifications error: ${error}`);
      res.status(500).json({ message: 'Failed to get notifications' });
    }
  }

  /**
   * Cancel a pending notification
   */
  private async cancelNotification(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      
      const notification = await this.notificationModel.findOne({
        $or: [
          { notificationId: id },
          { _id: mongoose.isValidObjectId(id) ? id : undefined }
        ]
      });
      
      if (!notification) {
        res.status(404).json({ message: 'Notification not found' });
        return;
      }
      
      // Only allow cancellation if notification is still pending
      if (notification.status !== NotificationStatus.PENDING) {
        res.status(400).json({ 
          message: `Cannot cancel notification in ${notification.status} status` 
        });
        return;
      }
      
      // Update status
      notification.status = NotificationStatus.CANCELLED;
      await notification.save();
      
      res.status(200).json({
        notificationId: notification.notificationId,
        status: notification.status,
        message: 'Notification cancelled successfully'
      });
    } catch (error) {
      this.logger.error(`Cancel notification error: ${error}`);
      res.status(500).json({ message: 'Failed to cancel notification' });
    }
  }

  /**
   * Mark a notification as read
   */
  private async markAsRead(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      
      const notification = await this.notificationModel.findOne({
        $or: [
          { notificationId: id },
          { _id: mongoose.isValidObjectId(id) ? id : undefined }
        ]
      });
      
      if (!notification) {
        res.status(404).json({ message: 'Notification not found' });
        return;
      }
      
      // Only update if not already read
      if (!notification.readAt) {
        notification.readAt = new Date();
        await notification.save();
      }
      
      res.status(200).json({
        notificationId: notification.notificationId,
        readAt: notification.readAt,
        message: 'Notification marked as read'
      });
    } catch (error) {
      this.logger.error(`Mark notification as read error: ${error}`);
      res.status(500).json({ message: 'Failed to mark notification as read' });
    }
  }

  /**
   * Create a new notification template
   */
  private async createTemplate(req: Request, res: Response): Promise<void> {
    try {
      const { 
        name, 
        description, 
        type, 
        subject, 
        body, 
        html, 
        variables = [] 
      } = req.body;
      
      // Validate required fields
      if (!name || !type || !body) {
        res.status(400).json({ message: 'Name, type, and body are required' });
        return;
      }
      
      // Check if template with name already exists
      const existingTemplate = await this.templateModel.findOne({ name });
      
      if (existingTemplate) {
        res.status(409).json({ message: `Template with name ${name} already exists` });
        return;
      }
      
      // Validate type-specific requirements
      if (type === NotificationType.EMAIL && !subject) {
        res.status(400).json({ message: 'Email templates require a subject' });
        return;
      }
      
      // Create template
      const templateId = uuidv4();
      const template = new this.templateModel({
        templateId,
        name,
        description,
        type,
        subject,
        body,
        html,
        variables,
        isActive: true
      });
      
      await template.save();
      
      res.status(201).json({
        templateId: template.templateId,
        name: template.name,
        type: template.type,
        subject: template.subject,
        variables: template.variables,
        isActive: template.isActive,
        createdAt: template.createdAt
      });
    } catch (error: any) {
      this.logger.error(`Template creation error: ${error}`);
      res.status(500).json({ message: 'Failed to create template', error: error.message });
    }
  }

  /**
   * Get template by ID
   */
  private async getTemplate(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      
      const template = await this.templateModel.findOne({
        $or: [
          { templateId: id },
          { name: id },
          { _id: mongoose.isValidObjectId(id) ? id : undefined }
        ]
      });
      
      if (!template) {
        res.status(404).json({ message: 'Template not found' });
        return;
      }
      
      res.status(200).json({
        templateId: template.templateId,
        name: template.name,
        description: template.description,
        type: template.type,
        subject: template.subject,
        body: template.body,
        html: template.html,
        variables: template.variables,
        isActive: template.isActive,
        createdAt: template.createdAt,
        updatedAt: template.updatedAt
      });
    } catch (error) {
      this.logger.error(`Get template error: ${error}`);
      res.status(500).json({ message: 'Failed to get template' });
    }
  }

  /**
   * Update a template
   */
  private async updateTemplate(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const { 
        name, 
        description, 
        subject, 
        body, 
        html, 
        variables, 
        isActive 
      } = req.body;
      
      const template = await this.templateModel.findOne({
        $or: [
          { templateId: id },
          { _id: mongoose.isValidObjectId(id) ? id : undefined }
        ]
      });
      
      if (!template) {
        res.status(404).json({ message: 'Template not found' });
        return;
      }
      
      // Update fields if provided
      if (name !== undefined) template.name = name;
      if (description !== undefined) template.description = description;
      if (subject !== undefined) template.subject = subject;
      if (body !== undefined) template.body = body;
      if (html !== undefined) template.html = html;
      if (variables !== undefined) template.variables = variables;
      if (isActive !== undefined) template.isActive = isActive;
      
      await template.save();
      
      res.status(200).json({
        templateId: template.templateId,
        name: template.name,
        type: template.type,
        subject: template.subject,
        variables: template.variables,
        isActive: template.isActive,
        updatedAt: template.updatedAt
      });
    } catch (error) {
      this.logger.error(`Update template error: ${error}`);
      res.status(500).json({ message: 'Failed to update template' });
    }
  }

  /**
   * Get all templates
   */
  private async getTemplates(req: Request, res: Response): Promise<void> {
    try {
      const { type, isActive, page = 1, limit = 10 } = req.query;
      
      // Build query
      const query: any = {};
      
      if (type) query.type = type;
      if (isActive !== undefined) query.isActive = isActive === 'true';
      
      // Parse pagination
      const skip = (parseInt(page as string) - 1) * parseInt(limit as string);
      
      // Get templates
      const templates = await this.templateModel
        .find(query)
        .sort({ name: 1 })
        .skip(skip)
        .limit(parseInt(limit as string));
      
      // Get total count
      const total = await this.templateModel.countDocuments(query);
      
      res.status(200).json({
        templates: templates.map(template => ({
          templateId: template.templateId,
          name: template.name,
          description: template.description,
          type: template.type,
          subject: template.subject,
          variables: template.variables,
          isActive: template.isActive,
          createdAt: template.createdAt
        })),
        pagination: {
          page: parseInt(page as string),
          limit: parseInt(limit as string),
          total,
          pages: Math.ceil(total / parseInt(limit as string))
        }
      });
    } catch (error) {
      this.logger.error(`Get templates error: ${error}`);
      res.status(500).json({ message: 'Failed to get templates' });
    }
  }

  /**
   * Create a new subscription
   */
  private async createSubscription(req: Request, res: Response): Promise<void> {
    try {
      const { 
        userId, 
        email, 
        phone, 
        deviceTokens, 
        preferences, 
        channels 
      } = req.body;
      
      // Validate required fields
      if (!userId) {
        res.status(400).json({ message: 'User ID is required' });
        return;
      }
      
      // Check if subscription already exists
      const existingSubscription = await this.subscriptionModel.findOne({ userId });
      
      if (existingSubscription) {
        res.status(409).json({ message: `Subscription for user ${userId} already exists` });
        return;
      }
      
      // Create subscription
      const subscriptionId = uuidv4();
      const subscription = new this.subscriptionModel({
        subscriptionId,
        userId,
        email,
        phone,
        deviceTokens,
        preferences: {
          orderUpdates: preferences?.orderUpdates ?? true,
          deliveryUpdates: preferences?.deliveryUpdates ?? true,
          paymentUpdates: preferences?.paymentUpdates ?? true,
          marketing: preferences?.marketing ?? false,
          promotions: preferences?.promotions ?? false
        },
        channels: {
          email: channels?.email ?? true,
          sms: channels?.sms ?? false,
          push: channels?.push ?? false,
          inApp: channels?.inApp ?? true
        }
      });
      
      await subscription.save();
      
      res.status(201).json({
        subscriptionId: subscription.subscriptionId,
        userId: subscription.userId,
        email: subscription.email,
        phone: subscription.phone,
        preferences: subscription.preferences,
        channels: subscription.channels,
        createdAt: subscription.createdAt
      });
    } catch (error: any) {
      this.logger.error(`Subscription creation error: ${error}`);
      res.status(500).json({ message: 'Failed to create subscription', error: error.message });
    }
  }

  /**
   * Get subscription by user ID
   */
  private async getSubscription(req: Request, res: Response): Promise<void> {
    try {
      const { userId } = req.params;
      
      const subscription = await this.subscriptionModel.findOne({ userId });
      
      if (!subscription) {
        res.status(404).json({ message: 'Subscription not found' });
        return;
      }
      
      res.status(200).json({
        subscriptionId: subscription.subscriptionId,
        userId: subscription.userId,
        email: subscription.email,
        phone: subscription.phone,
        deviceTokens: subscription.deviceTokens,
        preferences: subscription.preferences,
        channels: subscription.channels,
        createdAt: subscription.createdAt,
        updatedAt: subscription.updatedAt
      });
    } catch (error) {
      this.logger.error(`Get subscription error: ${error}`);
      res.status(500).json({ message: 'Failed to get subscription' });
    }
  }

  /**
   * Update a subscription
   */
  private async updateSubscription(req: Request, res: Response): Promise<void> {
    try {
      const { userId } = req.params;
      const { 
        email, 
        phone, 
        deviceTokens, 
        preferences, 
        channels 
      } = req.body;
      
      const subscription = await this.subscriptionModel.findOne({ userId });
      
      if (!subscription) {
        res.status(404).json({ message: 'Subscription not found' });
        return;
      }
      
      // Update fields if provided
      if (email !== undefined) subscription.email = email;
      if (phone !== undefined) subscription.phone = phone;
      
      // Update device tokens if provided
      if (deviceTokens !== undefined) {
        if (Array.isArray(deviceTokens)) {
          subscription.deviceTokens = deviceTokens;
        } else {
          subscription.deviceTokens = [];
        }
      }
      
      // Update preferences if provided
      if (preferences) {
        subscription.preferences = {
          ...subscription.preferences,
          ...preferences
        };
      }
      
      // Update channels if provided
      if (channels) {
        subscription.channels = {
          ...subscription.channels,
          ...channels
        };
      }
      
      await subscription.save();
      
      res.status(200).json({
        subscriptionId: subscription.subscriptionId,
        userId: subscription.userId,
        email: subscription.email,
        phone: subscription.phone,
        deviceTokens: subscription.deviceTokens,
        preferences: subscription.preferences,
        channels: subscription.channels,
        updatedAt: subscription.updatedAt
      });
    } catch (error) {
      this.logger.error(`Update subscription error: ${error}`);
      res.status(500).json({ message: 'Failed to update subscription' });
    }
  }

  /**
   * Delete a subscription
   */
  private async deleteSubscription(req: Request, res: Response): Promise<void> {
    try {
      const { userId } = req.params;
      
      const result = await this.subscriptionModel.deleteOne({ userId });
      
      if (result.deletedCount === 0) {
        res.status(404).json({ message: 'Subscription not found' });
        return;
      }
      
      res.status(200).json({
        userId,
        message: 'Subscription deleted successfully'
      });
    } catch (error) {
      this.logger.error(`Delete subscription error: ${error}`);
      res.status(500).json({ message: 'Failed to delete subscription' });
    }
  }

  /**
   * Send bulk notifications
   */
  private async sendBulkNotifications(req: Request, res: Response): Promise<void> {
    try {
      const { 
        type, 
        templateId, 
        templateData, 
        filter = {}, 
        message, 
        metadata = {} 
      } = req.body;
      
      // Validate required fields
      if (!type || (!templateId && !message)) {
        res.status(400).json({ 
          message: 'Type and either templateId or message are required' 
        });
        return;
      }
      
      // Check if template exists
      let template;
      if (templateId) {
        template = await this.templateModel.findOne({ templateId });
        
        if (!template) {
          res.status(404).json({ message: 'Template not found' });
          return;
        }
        
        if (!template.isActive) {
          res.status(400).json({ message: 'Template is not active' });
          return;
        }
        
        if (template.type !== type) {
          res.status(400).json({ 
            message: `Template type (${template.type}) does not match notification type (${type})` 
          });
          return;
        }
      }
      
      // Build subscription filter
      const subscriptionFilter: any = {};
      
      // Add user filter if provided
      if (filter.userIds && Array.isArray(filter.userIds)) {
        subscriptionFilter.userId = { $in: filter.userIds };
      }
      
      // Add preference filters
      if (filter.preferences) {
        Object.entries(filter.preferences).forEach(([key, value]) => {
          if (value !== undefined) {
            subscriptionFilter[`preferences.${key}`] = value;
          }
        });
      }
      
      // Add channel filter for the notification type
      const channelMap: Record<string, string> = {
        [NotificationType.EMAIL]: 'email',
        [NotificationType.SMS]: 'sms',
        [NotificationType.PUSH]: 'push',
        [NotificationType.IN_APP]: 'inApp'
      };
      
      const channelKey = channelMap[type];
      subscriptionFilter[`channels.${channelKey}`] = true;
      
      // Add contact method filter based on type
      if (type === NotificationType.EMAIL) {
        subscriptionFilter.email = { $exists: true, $ne: null };
      } else if (type === NotificationType.SMS) {
        subscriptionFilter.phone = { $exists: true, $ne: null };
      } else if (type === NotificationType.PUSH) {
        subscriptionFilter.deviceTokens = { $exists: true, $ne: [] };
      }
      
      // Get matching subscriptions
      const subscriptions = await this.subscriptionModel.find(subscriptionFilter);
      
      if (subscriptions.length === 0) {
        res.status(200).json({
          message: 'No matching recipients found',
          recipientCount: 0
        });
        return;
      }
      
      // Prepare content
      let content: any;
      if (templateId && template) {
        content = {
          templateId,
          templateData
        };
      } else {
        content = message;
      }
      
      // Create notifications
      const notifications = [];
      const now = new Date();
      
      for (const subscription of subscriptions) {
        const recipient: any = {
          userId: subscription.userId,
          name: subscription.userId // In a real app, we'd get user's name from user service
        };
        
        // Add contact info based on type
        if (type === NotificationType.EMAIL) {
          recipient.email = subscription.email;
        } else if (type === NotificationType.SMS) {
          recipient.phone = subscription.phone;
        } else if (type === NotificationType.PUSH) {
          recipient.deviceTokens = subscription.deviceTokens;
        }
        
        const notificationId = uuidv4();
        const notification = new this.notificationModel({
          notificationId,
          type,
          status: NotificationStatus.PENDING,
          priority: NotificationPriority.MEDIUM,
          sender: {
            name: FROM_NAME,
            email: FROM_EMAIL
          },
          recipient,
          content,
          metadata,
          retryCount: 0,
          maxRetries: 3
        });
        
        notifications.push(notification);
      }
      
      // Save all notifications
      await this.notificationModel.insertMany(notifications);
      
      // Process notifications (batched to avoid overloading the system)
      this.processNotificationQueue()
        .catch(error => this.logger.error(`Error processing notification queue: ${error}`));
      
      res.status(200).json({
        message: 'Bulk notifications queued successfully',
        recipientCount: notifications.length
      });
    } catch (error: any) {
      this.logger.error(`Bulk notification error: ${error}`);
      res.status(500).json({ message: 'Failed to send bulk notifications', error: error.message });
    }
  }

  /**
   * Process a template with data
   */
  private async processTemplate(template: ITemplate, data: Record<string, any>): Promise<any> {
    // Get template content
    let subject = template.subject || '';
    let body = template.body;
    let html = template.html || '';
    
    // Replace variables in content
    for (const [key, value] of Object.entries(data)) {
      const regex = new RegExp(`{{${key}}}`, 'g');
      subject = subject.replace(regex, String(value));
      body = body.replace(regex, String(value));
      html = html.replace(regex, String(value));
    }
    
    return {
      subject,
      body,
      html,
      templateId: template.templateId,
      templateData: data
    };
  }

  /**
   * Start the notification processor
   */
  private startNotificationProcessor(): void {
    // Process queue initially
    this.processNotificationQueue();
    
    // Set up interval to process queue periodically
    setInterval(() => this.processNotificationQueue(), 10000); // Process every 10 seconds
    
    // Set up interval to process scheduled notifications
    setInterval(() => this.processScheduledNotifications(), 60000); // Process every minute
  }

  /**
   * Process scheduled notifications
   */
  private async processScheduledNotifications(): Promise<void> {
    try {
      // Find notifications that are scheduled for now or in the past
      const now = new Date();
      const scheduledNotifications = await this.notificationModel.find({
        status: NotificationStatus.PENDING,
        scheduledFor: { $lte: now }
      }).limit(50);
      
      if (scheduledNotifications.length === 0) {
        return;
      }
      
      this.logger.info(`Processing ${scheduledNotifications.length} scheduled notifications`);
      
      // Process each notification
      for (const notification of scheduledNotifications) {
        this.processNotification(notification)
          .catch(error => this.logger.error(`Error processing scheduled notification: ${error}`));
      }
    } catch (error) {
      this.logger.error(`Error processing scheduled notifications: ${error}`);
    }
  }

  /**
   * Process the notification queue
   */
  private async processNotificationQueue(): Promise<void> {
    // Prevent concurrent processing
    if (this.isProcessingQueue) return;
    
    this.isProcessingQueue = true;
    
    try {
      // Find pending notifications (no scheduled time or scheduled time in the past)
      const now = new Date();
      const pendingNotifications = await this.notificationModel.find({
        status: NotificationStatus.PENDING,
        $or: [
          { scheduledFor: { $exists: false } },
          { scheduledFor: null },
          { scheduledFor: { $lte: now } }
        ]
      }).sort({ priority: -1 }).limit(50);
      
      if (pendingNotifications.length === 0) {
        this.isProcessingQueue = false;
        return;
      }
      
      this.logger.info(`Processing ${pendingNotifications.length} pending notifications`);
      
      // Process notifications in parallel (with concurrency limit)
      const concurrencyLimit = 10;
      const chunks = [];
      
      for (let i = 0; i < pendingNotifications.length; i += concurrencyLimit) {
        chunks.push(pendingNotifications.slice(i, i + concurrencyLimit));
      }
      
      for (const chunk of chunks) {
        await Promise.all(
          chunk.map(notification => 
            this.processNotification(notification)
              .catch(error => this.logger.error(`Error processing notification: ${error}`))
          )
        );
      }
    } catch (error) {
      this.logger.error(`Error processing notification queue: ${error}`);
    } finally {
      this.isProcessingQueue = false;
    }
  }

  /**
   * Process a single notification
   */
  private async processNotification(notification: INotification): Promise<void> {
    try {
      // Process template if needed
      if (notification.content.templateId && notification.content.templateData) {
        const template = await this.templateModel.findOne({ 
          templateId: notification.content.templateId 
        });
        
        if (template) {
          const processedContent = await this.processTemplate(
            template, 
            notification.content.templateData
          );
          
          notification.content.subject = processedContent.subject;
          notification.content.body = processedContent.body;
          notification.content.html = processedContent.html;
        }
      }
      
      // Send notification based on type
      let success = false;
      let error = null;
      
      switch (notification.type) {
        case NotificationType.EMAIL:
          try {
            await this.sendEmail(notification);
            success = true;
          } catch (err: any) {
            error = err;
          }
          break;
          
        case NotificationType.SMS:
          try {
            await this.sendSms(notification);
            success = true;
          } catch (err: any) {
            error = err;
          }
          break;
          
        case NotificationType.PUSH:
          try {
            await this.sendPush(notification);
            success = true;
          } catch (err: any) {
            error = err;
          }
          break;
          
        case NotificationType.IN_APP:
          // In-app notifications are simply stored in the database
          success = true;
          break;
      }
      
      // Update notification status
      if (success) {
        notification.status = NotificationStatus.SENT;
        notification.sentAt = new Date();
      } else {
        notification.retryCount += 1;
        
        if (notification.retryCount >= notification.maxRetries) {
          notification.status = NotificationStatus.FAILED;
          notification.failedAt = new Date();
          notification.failureReason = error?.message || 'Max retry attempts reached';
        }
      }
      
      await notification.save();
      
      // Publish event for notification processed
      await this.messageBus.publish('notification', `notification.${success ? 'sent' : 'failed'}`, {
        notificationId: notification.notificationId,
        type: notification.type,
        recipientId: notification.recipient.userId,
        success,
        error: error?.message,
        timestamp: new Date().toISOString()
      });
    } catch (error: any) {
      this.logger.error(`Error processing notification ${notification.notificationId}: ${error.message}`);
      
      // Update notification status on unhandled error
      notification.retryCount += 1;
      
      if (notification.retryCount >= notification.maxRetries) {
        notification.status = NotificationStatus.FAILED;
        notification.failedAt = new Date();
        notification.failureReason = `Unhandled error: ${error.message}`;
        await notification.save();
      }
    }
  }

  /**
   * Send an email notification
   */
  private async sendEmail(notification: INotification): Promise<void> {
    if (!notification.recipient.email) {
      throw new Error('Recipient email is required');
    }
    
    // Create email options
    const mailOptions = {
      from: `"${notification.sender.name}" <${notification.sender.email || FROM_EMAIL}>`,
      to: notification.recipient.email,
      subject: notification.content.subject || 'Notification',
      text: notification.content.body,
      html: notification.content.html || undefined
    };
    
    // Send email
    await this.emailTransporter.sendMail(mailOptions);
  }

  /**
   * Send an SMS notification
   */
  private async sendSms(notification: INotification): Promise<void> {
    if (!notification.recipient.phone) {
      throw new Error('Recipient phone number is required');
    }
    
    // This is a mock implementation
    // In a real app, this would use an SMS provider API
    this.logger.info(`Sending SMS to ${notification.recipient.phone}: ${notification.content.body}`);
    
    // Simulate API call
    await new Promise(resolve => setTimeout(resolve, 100));
  }

  /**
   * Send a push notification
   */
  private async sendPush(notification: INotification): Promise<void> {
    if (!notification.recipient.deviceTokens || notification.recipient.deviceTokens.length === 0) {
      throw new Error('Recipient device tokens are required');
    }
    
    // This is a mock implementation
    // In a real app, this would use a push notification service like Firebase
    this.logger.info(`Sending push notification to ${notification.recipient.deviceTokens.length} devices: ${notification.content.body}`);
    
    // Simulate API call
    await new Promise(resolve => setTimeout(resolve, 100));
  }

  /**
   * Handle order created event
   */
  private async handleOrderCreated(content: any): Promise<void> {
    try {
      const { orderId, customerId } = content;
      
      if (!orderId || !customerId) {
        this.logger.error('Invalid order created event data');
        return;
      }
      
      // Get user subscription
      const subscription = await this.subscriptionModel.findOne({ userId: customerId });
      
      if (!subscription || !subscription.preferences.orderUpdates) {
        // User doesn't have a subscription or has disabled order updates
        return;
      }
      
      // Get order confirmation template
      const template = await this.templateModel.findOne({ 
        name: 'order_created',
        type: NotificationType.EMAIL,
        isActive: true
      });
      
      if (!template) {
        this.logger.error('Order created template not found');
        return;
      }
      
      // Create notification
      const notificationId = uuidv4();
      const notification = new this.notificationModel({
        notificationId,
        type: NotificationType.EMAIL,
        status: NotificationStatus.PENDING,
        priority: NotificationPriority.HIGH,
        sender: {
          name: FROM_NAME,
          email: FROM_EMAIL
        },
        recipient: {
          userId: customerId,
          name: customerId, // In a real app, we'd get user's name from user service
          email: subscription.email
        },
        content: {
          templateId: template.templateId,
          templateData: {
            orderId,
            customerName: subscription.userId, // Placeholder, would get actual name from user service
            orderTime: new Date().toLocaleString(),
            orderTotal: content.total || 'N/A'
          }
        },
        metadata: {
          orderId,
          source: 'order_service'
        },
        retryCount: 0,
        maxRetries: 3
      });
      
      await notification.save();
      
      // Process notification immediately
      this.processNotification(notification)
        .catch(error => this.logger.error(`Error processing order created notification: ${error}`));
    } catch (error) {
      this.logger.error(`Handle order created error: ${error}`);
    }
  }

  /**
   * Handle order confirmed event
   */
  private async handleOrderConfirmed(content: any): Promise<void> {
    try {
      const { orderId, customerId } = content;
      
      if (!orderId || !customerId) {
        this.logger.error('Invalid order confirmed event data');
        return;
      }
      
      // Get user subscription
      const subscription = await this.subscriptionModel.findOne({ userId: customerId });
      
      if (!subscription || !subscription.preferences.orderUpdates) {
        // User doesn't have a subscription or has disabled order updates
        return;
      }
      
      // Get order confirmation template
      const template = await this.templateModel.findOne({ 
        name: 'order_confirmed',
        type: NotificationType.EMAIL,
        isActive: true
      });
      
      if (!template) {
        this.logger.error('Order confirmation template not found');
        return;
      }
      
      // Create notification
      const notificationId = uuidv4();
      const notification = new this.notificationModel({
        notificationId,
        type: NotificationType.EMAIL,
        status: NotificationStatus.PENDING,
        priority: NotificationPriority.HIGH,
        sender: {
          name: FROM_NAME,
          email: FROM_EMAIL
        },
        recipient: {
          userId: customerId,
          name: customerId, // In a real app, we'd get user's name from user service
          email: subscription.email
        },
        content: {
          templateId: template.templateId,
          templateData: {
            orderId,
            customerName: subscription.userId, // Placeholder, would get actual name from user service
            confirmationTime: new Date().toLocaleString()
          }
        },
        metadata: {
          orderId,
          source: 'order_service'
        },
        retryCount: 0,
        maxRetries: 3
      });
      
      await notification.save();
      
      // Process notification immediately
      this.processNotification(notification)
        .catch(error => this.logger.error(`Error processing order confirmation notification: ${error}`));
    } catch (error) {
      this.logger.error(`Handle order confirmed error: ${error}`);
    }
  }

  /**
   * Handle order cancelled event
   */
  private async handleOrderCancelled(content: any): Promise<void> {
    try {
      const { orderId, customerId, reason } = content;
      
      if (!orderId || !customerId) {
        this.logger.error('Invalid order cancelled event data');
        return;
      }
      
      // Get user subscription
      const subscription = await this.subscriptionModel.findOne({ userId: customerId });
      
      if (!subscription || !subscription.preferences.orderUpdates) {
        // User doesn't have a subscription or has disabled order updates
        return;
      }
      
      // Get order cancellation template
      const template = await this.templateModel.findOne({ 
        name: 'order_cancelled',
        type: NotificationType.EMAIL,
        isActive: true
      });
      
      if (!template) {
        this.logger.error('Order cancellation template not found');
        return;
      }
      
      // Create notification
      const notificationId = uuidv4();
      const notification = new this.notificationModel({
        notificationId,
        type: NotificationType.EMAIL,
        status: NotificationStatus.PENDING,
        priority: NotificationPriority.HIGH,
        sender: {
          name: FROM_NAME,
          email: FROM_EMAIL
        },
        recipient: {
          userId: customerId,
          name: customerId, // In a real app, we'd get user's name from user service
          email: subscription.email
        },
        content: {
          templateId: template.templateId,
          templateData: {
            orderId,
            customerName: subscription.userId, // Placeholder, would get actual name from user service
            cancellationTime: new Date().toLocaleString(),
            reason: reason || 'No reason provided'
          }
        },
        metadata: {
          orderId,
          source: 'order_service'
        },
        retryCount: 0,
        maxRetries: 3
      });
      
      await notification.save();
      
      // Process notification immediately
      this.processNotification(notification)
        .catch(error => this.logger.error(`Error processing order cancellation notification: ${error}`));
    } catch (error) {
      this.logger.error(`Handle order cancelled error: ${error}`);
    }
  }

  /**
   * Handle order fulfilled event
   */
  private async handleOrderFulfilled(content: any): Promise<void> {
    try {
      const { orderId, customerId } = content;
      
      if (!orderId || !customerId) {
        this.logger.error('Invalid order fulfilled event data');
        return;
      }
      
      // Get user subscription
      const subscription = await this.subscriptionModel.findOne({ userId: customerId });
      
      if (!subscription || !subscription.preferences.orderUpdates) {
        // User doesn't have a subscription or has disabled order updates
        return;
      }
      
      // Get order fulfilled template
      const template = await this.templateModel.findOne({ 
        name: 'order_fulfilled',
        type: NotificationType.EMAIL,
        isActive: true
      });
      
      if (!template) {
        this.logger.error('Order fulfilled template not found');
        return;
      }
      
      // Create notification
      const notificationId = uuidv4();
      const notification = new this.notificationModel({
        notificationId,
        type: NotificationType.EMAIL,
        status: NotificationStatus.PENDING,
        priority: NotificationPriority.HIGH,
        sender: {
          name: FROM_NAME,
          email: FROM_EMAIL
        },
        recipient: {
          userId: customerId,
          name: customerId, // In a real app, we'd get user's name from user service
          email: subscription.email
        },
        content: {
          templateId: template.templateId,
          templateData: {
            orderId,
            customerName: subscription.userId, // Placeholder, would get actual name from user service
            fulfilledTime: new Date().toLocaleString()
          }
        },
        metadata: {
          orderId,
          source: 'order_service'
        },
        retryCount: 0,
        maxRetries: 3
      });
      
      await notification.save();
      
      // Process notification immediately
      this.processNotification(notification)
        .catch(error => this.logger.error(`Error processing order fulfilled notification: ${error}`));
    } catch (error) {
      this.logger.error(`Handle order fulfilled error: ${error}`);
    }
  }

  /**
   * Handle payment completed event
   */
  private async handlePaymentCompleted(content: any): Promise<void> {
    try {
      const { orderId, paymentId, amount, customerId } = content;
      
      if (!orderId || !paymentId) {
        this.logger.error('Invalid payment completed event data');
        return;
      }
      
      // Skip if no customer ID is provided
      if (!customerId) {
        return;
      }
      
      // Get user subscription
      const subscription = await this.subscriptionModel.findOne({ userId: customerId });
      
      if (!subscription || !subscription.preferences.paymentUpdates) {
        // User doesn't have a subscription or has disabled payment updates
        return;
      }
      
      // Get payment confirmation template
      const template = await this.templateModel.findOne({ 
        name: 'payment_confirmed',
        type: NotificationType.EMAIL,
        isActive: true
      });
      
      if (!template) {
        this.logger.error('Payment confirmation template not found');
        return;
      }
      
      // Create notification
      const notificationId = uuidv4();
      const notification = new this.notificationModel({
        notificationId,
        type: NotificationType.EMAIL,
        status: NotificationStatus.PENDING,
        priority: NotificationPriority.HIGH,
        sender: {
          name: FROM_NAME,
          email: FROM_EMAIL
        },
        recipient: {
          userId: customerId,
          name: customerId, // In a real app, we'd get user's name from user service
          email: subscription.email
        },
        content: {
          templateId: template.templateId,
          templateData: {
            orderId,
            paymentId,
            customerName: subscription.userId, // Placeholder, would get actual name from user service
            amount: amount || 'N/A',
            paymentTime: new Date().toLocaleString()
          }
        },
        metadata: {
          orderId,
          paymentId,
          source: 'payment_service'
        },
        retryCount: 0,
        maxRetries: 3
      });
      
      await notification.save();
      
      // Process notification immediately
      this.processNotification(notification)
        .catch(error => this.logger.error(`Error processing payment confirmation notification: ${error}`));
    } catch (error) {
      this.logger.error(`Handle payment completed error: ${error}`);
    }
  }

  /**
   * Handle payment failed event
   */
  private async handlePaymentFailed(content: any): Promise<void> {
    try {
      const { orderId, paymentId, error, customerId } = content;
      
      if (!orderId || !paymentId) {
        this.logger.error('Invalid payment failed event data');
        return;
      }
      
      // Skip if no customer ID is provided
      if (!customerId) {
        return;
      }
      
      // Get user subscription
      const subscription = await this.subscriptionModel.findOne({ userId: customerId });
      
      if (!subscription || !subscription.preferences.paymentUpdates) {
        // User doesn't have a subscription or has disabled payment updates
        return;
      }
      
      // Get payment failed template
      const template = await this.templateModel.findOne({ 
        name: 'payment_failed',
        type: NotificationType.EMAIL,
        isActive: true
      });
      
      if (!template) {
        this.logger.error('Payment failed template not found');
        return;
      }
      
      // Create notification
      const notificationId = uuidv4();
      const notification = new this.notificationModel({
        notificationId,
        type: NotificationType.EMAIL,
        status: NotificationStatus.PENDING,
        priority: NotificationPriority.HIGH,
        sender: {
          name: FROM_NAME,
          email: FROM_EMAIL
        },
        recipient: {
          userId: customerId,
          name: customerId, // In a real app, we'd get user's name from user service
          email: subscription.email
        },
        content: {
          templateId: template.templateId,
          templateData: {
            orderId,
            paymentId,
            customerName: subscription.userId, // Placeholder, would get actual name from user service
            errorMessage: error || 'Unknown error',
            failureTime: new Date().toLocaleString()
          }
        },
        metadata: {
          orderId,
          paymentId,
          source: 'payment_service'
        },
        retryCount: 0,
        maxRetries: 3
      });
      
      await notification.save();
      
      // Process notification immediately
      this.processNotification(notification)
        .catch(error => this.logger.error(`Error processing payment failed notification: ${error}`));
    } catch (error) {
      this.logger.error(`Handle payment failed error: ${error}`);
    }
  }

  /**
   * Handle payment refunded event
   */
  private async handlePaymentRefunded(content: any): Promise<void> {
    try {
      const { orderId, paymentId, amount, customerId } = content;
      
      if (!orderId || !paymentId) {
        this.logger.error('Invalid payment refunded event data');
        return;
      }
      
      // Skip if no customer ID is provided
      if (!customerId) {
        return;
      }
      
      // Get user subscription
      const subscription = await this.subscriptionModel.findOne({ userId: customerId });
      
      if (!subscription || !subscription.preferences.paymentUpdates) {
        // User doesn't have a subscription or has disabled payment updates
        return;
      }
      
      // Get payment refund template
      const template = await this.templateModel.findOne({ 
        name: 'payment_refunded',
        type: NotificationType.EMAIL,
        isActive: true
      });
      
      if (!template) {
        this.logger.error('Payment refund template not found');
        return;
      }
      
      // Create notification
      const notificationId = uuidv4();
      const notification = new this.notificationModel({
        notificationId,
        type: NotificationType.EMAIL,
        status: NotificationStatus.PENDING,
        priority: NotificationPriority.HIGH,
        sender: {
          name: FROM_NAME,
          email: FROM_EMAIL
        },
        recipient: {
          userId: customerId,
          name: customerId, // In a real app, we'd get user's name from user service
          email: subscription.email
        },
        content: {
          templateId: template.templateId,
          templateData: {
            orderId,
            paymentId,
            customerName: subscription.userId, // Placeholder, would get actual name from user service
            amount: amount || 'N/A',
            refundTime: new Date().toLocaleString()
          }
        },
        metadata: {
          orderId,
          paymentId,
          source: 'payment_service'
        },
        retryCount: 0,
        maxRetries: 3
      });
      
      await notification.save();
      
      // Process notification immediately
      this.processNotification(notification)
        .catch(error => this.logger.error(`Error processing payment refund notification: ${error}`));
    } catch (error) {
      this.logger.error(`Handle payment refunded error: ${error}`);
    }
  }

  /**
   * Handle delivery assigned event
   */
  private async handleDeliveryAssigned(content: any): Promise<void> {
    try {
      const { deliveryId, orderId, customerId, driverName, estimatedDeliveryTime } = content;
      
      if (!deliveryId || !orderId) {
        this.logger.error('Invalid delivery assigned event data');
        return;
      }
      
      // Skip if no customer ID is provided
      if (!customerId) {
        return;
      }
      
      // Get user subscription
      const subscription = await this.subscriptionModel.findOne({ userId: customerId });
      
      if (!subscription || !subscription.preferences.deliveryUpdates) {
        // User doesn't have a subscription or has disabled delivery updates
        return;
      }
      
      // Get delivery assigned template
      const template = await this.templateModel.findOne({ 
        name: 'delivery_assigned',
        type: NotificationType.EMAIL,
        isActive: true
      });
      
      if (!template) {
        this.logger.error('Delivery assigned template not found');
        return;
      }
      
      // Create notification
      const notificationId = uuidv4();
      const notification = new this.notificationModel({
        notificationId,
        type: NotificationType.EMAIL,
        status: NotificationStatus.PENDING,
        priority: NotificationPriority.HIGH,
        sender: {
          name: FROM_NAME,
          email: FROM_EMAIL
        },
        recipient: {
          userId: customerId,
          name: customerId, // In a real app, we'd get user's name from user service
          email: subscription.email
        },
        content: {
          templateId: template.templateId,
          templateData: {
            orderId,
            deliveryId,
            customerName: subscription.userId, // Placeholder, would get actual name from user service
            driverName: driverName || 'Your delivery driver',
            estimatedDeliveryTime: estimatedDeliveryTime 
              ? new Date(estimatedDeliveryTime).toLocaleString() 
              : 'To be determined',
            assignedTime: new Date().toLocaleString()
          }
        },
        metadata: {
          orderId,
          deliveryId,
          source: 'delivery_service'
        },
        retryCount: 0,
        maxRetries: 3
      });
      
      await notification.save();
      
      // Process notification immediately
      this.processNotification(notification)
        .catch(error => this.logger.error(`Error processing delivery assigned notification: ${error}`));
    } catch (error) {
      this.logger.error(`Handle delivery assigned error: ${error}`);
    }
  }

  /**
   * Handle delivery started event
   */
  private async handleDeliveryStarted(content: any): Promise<void> {
    try {
      const { deliveryId, orderId, customerId, pickupTime } = content;
      
      if (!deliveryId || !orderId) {
        this.logger.error('Invalid delivery started event data');
        return;
      }
      
      // Skip if no customer ID is provided
      if (!customerId) {
        return;
      }
      
      // Get user subscription
      const subscription = await this.subscriptionModel.findOne({ userId: customerId });
      
      if (!subscription || !subscription.preferences.deliveryUpdates) {
        // User doesn't have a subscription or has disabled delivery updates
        return;
      }
      
      // Get delivery started template
      const template = await this.templateModel.findOne({ 
        name: 'delivery_started',
        type: NotificationType.EMAIL,
        isActive: true
      });
      
      if (!template) {
        this.logger.error('Delivery started template not found');
        return;
      }
      
      // Create notification
      const notificationId = uuidv4();
      const notification = new this.notificationModel({
        notificationId,
        type: NotificationType.EMAIL,
        status: NotificationStatus.PENDING,
        priority: NotificationPriority.HIGH,
        sender: {
          name: FROM_NAME,
          email: FROM_EMAIL
        },
        recipient: {
          userId: customerId,
          name: customerId, // In a real app, we'd get user's name from user service
          email: subscription.email
        },
        content: {
          templateId: template.templateId,
          templateData: {
            orderId,
            deliveryId,
            customerName: subscription.userId, // Placeholder, would get actual name from user service
            pickupTime: pickupTime ? new Date(pickupTime).toLocaleString() : new Date().toLocaleString()
          }
        },
        metadata: {
          orderId,
          deliveryId,
          source: 'delivery_service'
        },
        retryCount: 0,
        maxRetries: 3
      });
      
      await notification.save();
      
      // Process notification immediately
      this.processNotification(notification)
        .catch(error => this.logger.error(`Error processing delivery started notification: ${error}`));
    } catch (error) {
      this.logger.error(`Handle delivery started error: ${error}`);
    }
  }

  /**
   * Handle delivery completed event
   */
  private async handleDeliveryCompleted(content: any): Promise<void> {
    try {
      const { deliveryId, orderId, customerId, actualDeliveryTime } = content;
      
      if (!deliveryId || !orderId) {
        this.logger.error('Invalid delivery completed event data');
        return;
      }
      
      // Skip if no customer ID is provided
      if (!customerId) {
        return;
      }
      
      // Get user subscription
      const subscription = await this.subscriptionModel.findOne({ userId: customerId });
      
      if (!subscription || !subscription.preferences.deliveryUpdates) {
        // User doesn't have a subscription or has disabled delivery updates
        return;
      }
      
      // Get delivery completed template
      const template = await this.templateModel.findOne({ 
        name: 'delivery_completed',
        type: NotificationType.EMAIL,
        isActive: true
      });
      
      if (!template) {
        this.logger.error('Delivery completed template not found');
        return;
      }
      
      // Create notification
      const notificationId = uuidv4();
      const notification = new this.notificationModel({
        notificationId,
        type: NotificationType.EMAIL,
        status: NotificationStatus.PENDING,
        priority: NotificationPriority.HIGH,
        sender: {
          name: FROM_NAME,
          email: FROM_EMAIL
        },
        recipient: {
          userId: customerId,
          name: customerId, // In a real app, we'd get user's name from user service
          email: subscription.email
        },
        content: {
          templateId: template.templateId,
          templateData: {
            orderId,
            deliveryId,
            customerName: subscription.userId, // Placeholder, would get actual name from user service
            deliveryTime: actualDeliveryTime 
              ? new Date(actualDeliveryTime).toLocaleString() 
              : new Date().toLocaleString()
          }
        },
        metadata: {
          orderId,
          deliveryId,
          source: 'delivery_service'
        },
        retryCount: 0,
        maxRetries: 3
      });
      
      await notification.save();
      
      // Process notification immediately
      this.processNotification(notification)
        .catch(error => this.logger.error(`Error processing delivery completed notification: ${error}`));
    } catch (error) {
      this.logger.error(`Handle delivery completed error: ${error}`);
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
  const notificationService = new NotificationService();
  notificationService.start().catch(error => {
    console.error('Failed to start Notification Service:', error);
    process.exit(1);
  });
  
  // Handle graceful shutdown
  const shutdown = async () => {
    await notificationService.shutdown();
    process.exit(0);
  };
  
  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}

export default NotificationService;