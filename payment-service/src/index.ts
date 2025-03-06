import { Request, Response } from 'express';
import mongoose, { Schema, Document } from 'mongoose';
import { v4 as uuidv4 } from 'uuid';
import { BaseService } from '../../shared/base-service';
import { MessageBus } from '../../shared/message-bus';

// Payment status enum
enum PaymentStatus {
  PENDING = 'PENDING',
  PROCESSING = 'PROCESSING',
  COMPLETED = 'COMPLETED',
  FAILED = 'FAILED',
  REFUNDED = 'REFUNDED',
  PARTIALLY_REFUNDED = 'PARTIALLY_REFUNDED'
}

// Payment method enum
enum PaymentMethod {
  CASH = 'CASH',
  CREDIT_CARD = 'CREDIT_CARD',
  DEBIT_CARD = 'DEBIT_CARD',
  MOBILE_PAYMENT = 'MOBILE_PAYMENT',
  GIFT_CARD = 'GIFT_CARD',
  STORE_CREDIT = 'STORE_CREDIT'
}

// Payment transaction interface
interface IPayment extends Document {
  paymentId: string;
  orderId: string;
  amount: number;
  currency: string;
  method: PaymentMethod;
  status: PaymentStatus;
  refundedAmount?: number;
  metadata: Record<string, any>;
  createdAt: Date;
  updatedAt: Date;
  completedAt?: Date;
  refundedAt?: Date;
  isOffline: boolean;
  gatewayTransactionId?: string;
  offlineReference?: string;
  customerEmail?: string;
  notes?: string;
}

// Offline queue item interface
interface IOfflinePaymentQueue extends Document {
  queueId: string;
  paymentId: string;
  payload: Record<string, any>;
  attempts: number;
  lastAttempt?: Date;
  status: 'PENDING' | 'PROCESSING' | 'COMPLETED' | 'FAILED';
  error?: string;
  createdAt: Date;
}

/**
 * Payment Service - Handles payment processing with offline capabilities
 */
export class PaymentService extends BaseService {
  private messageBus: MessageBus;
  private paymentModel: mongoose.Model<IPayment>;
  private offlineQueueModel: mongoose.Model<IOfflinePaymentQueue>;
  private isProcessingQueue: boolean = false;
  private readonly paymentGateways: Map<string, PaymentGateway> = new Map();

  /**
   * Initialize the Payment Service
   */
  constructor() {
    // Initialize base service with configuration
    super(
      'payment-service',
      parseInt(process.env.PORT || '3002'),
      process.env.MONGO_URI || 'mongodb://localhost:27017/mayura-payment',
      process.env.RABBITMQ_URI || 'amqp://localhost',
      process.env.REDIS_URI || 'redis://localhost:6379'
    );

    // Initialize message bus
    this.messageBus = new MessageBus(
      this.rabbitmqUri,
      this.serviceName,
      this.logger
    );

    // Define payment schema
    const paymentSchema = new Schema<IPayment>({
      paymentId: { 
        type: String, 
        required: true, 
        unique: true 
      },
      orderId: { 
        type: String, 
        required: true, 
        index: true 
      },
      amount: { 
        type: Number, 
        required: true,
        min: 0 
      },
      currency: { 
        type: String, 
        required: true,
        default: 'USD',
        minlength: 3,
        maxlength: 3 
      },
      method: { 
        type: String, 
        required: true,
        enum: Object.values(PaymentMethod)
      },
      status: { 
        type: String, 
        required: true,
        enum: Object.values(PaymentStatus),
        default: PaymentStatus.PENDING 
      },
      refundedAmount: { 
        type: Number,
        min: 0 
      },
      metadata: { 
        type: Schema.Types.Mixed, 
        default: {} 
      },
      completedAt: { 
        type: Date 
      },
      refundedAt: { 
        type: Date 
      },
      isOffline: { 
        type: Boolean, 
        required: true,
        default: false 
      },
      gatewayTransactionId: { 
        type: String 
      },
      offlineReference: { 
        type: String 
      },
      customerEmail: { 
        type: String,
        match: [/^\S+@\S+\.\S+$/, 'Please enter a valid email'] 
      },
      notes: { 
        type: String,
        maxlength: 500 
      }
    }, {
      timestamps: true
    });

    // Define offline queue schema
    const offlineQueueSchema = new Schema<IOfflinePaymentQueue>({
      queueId: { 
        type: String, 
        required: true, 
        unique: true 
      },
      paymentId: { 
        type: String, 
        required: true, 
        index: true 
      },
      payload: { 
        type: Schema.Types.Mixed, 
        required: true 
      },
      attempts: { 
        type: Number, 
        required: true,
        default: 0 
      },
      lastAttempt: { 
        type: Date 
      },
      status: { 
        type: String, 
        required: true,
        enum: ['PENDING', 'PROCESSING', 'COMPLETED', 'FAILED'],
        default: 'PENDING' 
      },
      error: { 
        type: String 
      }
    }, {
      timestamps: true
    });

    // Create models
    this.paymentModel = mongoose.model<IPayment>('Payment', paymentSchema);
    this.offlineQueueModel = mongoose.model<IOfflinePaymentQueue>('OfflinePaymentQueue', offlineQueueSchema);

    // Initialize payment gateways
    this.initializePaymentGateways();
  }

  /**
   * Initialize various payment gateways
   */
  private initializePaymentGateways(): void {
    // Add a mock payment gateway for cash payments
    this.paymentGateways.set(PaymentMethod.CASH, new CashPaymentGateway());
    
    // Add credit card payment gateway
    this.paymentGateways.set(PaymentMethod.CREDIT_CARD, new CardPaymentGateway(true));
    
    // Add debit card payment gateway
    this.paymentGateways.set(PaymentMethod.DEBIT_CARD, new CardPaymentGateway(false));
    
    // Other payment gateways would be added here
    // this.paymentGateways.set(PaymentMethod.MOBILE_PAYMENT, new MobilePaymentGateway());
  }

  /**
   * Initialize routes for the Payment service
   */
  protected async initRoutes(): Promise<void> {
    // Process payment
    this.app.post('/payments', this.authenticate.bind(this), this.processPayment.bind(this));
    
    // Get payment by ID
    this.app.get('/payments/:id', this.authenticate.bind(this), this.getPayment.bind(this));
    
    // Get payments by order ID
    this.app.get('/payments/order/:orderId', this.authenticate.bind(this), this.getPaymentsByOrder.bind(this));
    
    // Process refund
    this.app.post('/payments/:id/refund', this.authenticate.bind(this), this.processRefund.bind(this));
    
    // Submit offline payment for processing
    this.app.post('/offline/submit', this.authenticate.bind(this), this.submitOfflinePayment.bind(this));
    
    // Get offline queue status
    this.app.get('/offline/status', this.authenticate.bind(this), this.getOfflineQueueStatus.bind(this));
  }

  /**
   * Initialize message bus handlers
   */
  private async initMessageHandlers(): Promise<void> {
    await this.messageBus.connect();
    
    // Create exchanges
    await this.messageBus.createExchange('payment', 'topic');
    
    // Create queues
    await this.messageBus.createQueue('payment.order.events', 'payment', 'order.#');
    
    // Listen for order-related events
    await this.messageBus.subscribe('payment.order.events', async (content, msg) => {
      this.logger.info(`Received order event: ${msg.fields.routingKey}`, { content });
      
      // Handle specific events
      switch (msg.fields.routingKey) {
        case 'order.created':
          // Order created, might need to pre-authorize payment
          break;
        case 'order.cancelled':
          // Order cancelled, might need to void payment
          await this.handleOrderCancellation(content);
          break;
      }
    });
    
    // Start the offline queue processor
    this.startOfflineQueueProcessor();
  }

  /**
   * Handle order cancellation
   */
  private async handleOrderCancellation(content: any): Promise<void> {
    const { orderId } = content;
    
    try {
      // Find payments for this order
      const payments = await this.paymentModel.find({
        orderId,
        status: { $in: [PaymentStatus.COMPLETED, PaymentStatus.PROCESSING] }
      });
      
      // Process refunds if needed
      for (const payment of payments) {
        if (payment.status === PaymentStatus.COMPLETED) {
          await this.refundPayment(payment._id.toString(), payment.amount, 'Order cancelled');
        } else if (payment.status === PaymentStatus.PROCESSING) {
          // Void the payment
          payment.status = PaymentStatus.FAILED;
          payment.notes = (payment.notes || '') + ' Order cancelled while processing.';
          await payment.save();
        }
      }
    } catch (error) {
      this.logger.error(`Error handling order cancellation: ${error}`);
    }
  }

  /**
   * Start the offline queue processor
   */
  private startOfflineQueueProcessor(): void {
    // Process queue initially
    this.processOfflineQueue();
    
    // Set up interval to process queue periodically
    setInterval(() => this.processOfflineQueue(), 60000); // Process every minute
  }

  /**
   * Process the offline payment queue
   */
  private async processOfflineQueue(): Promise<void> {
    // Prevent concurrent processing
    if (this.isProcessingQueue) return;
    
    this.isProcessingQueue = true;
    
    try {
      // Get pending items
      const pendingItems = await this.offlineQueueModel.find({
        status: 'PENDING',
        attempts: { $lt: 5 } // Max 5 attempts
      }).sort({ createdAt: 1 }).limit(10);
      
      if (pendingItems.length === 0) {
        this.logger.debug('No pending offline payments to process');
        this.isProcessingQueue = false;
        return;
      }
      
      this.logger.info(`Processing ${pendingItems.length} offline payments`);
      
      // Process each item
      for (const item of pendingItems) {
        try {
          // Mark as processing
          item.status = 'PROCESSING';
          item.attempts += 1;
          item.lastAttempt = new Date();
          await item.save();
          
          // Get the payment
          const payment = await this.paymentModel.findOne({ paymentId: item.paymentId });
          
          if (!payment) {
            item.status = 'FAILED';
            item.error = 'Payment not found';
            await item.save();
            continue;
          }
          
          // Get the appropriate gateway
          const gateway = this.paymentGateways.get(payment.method);
          
          if (!gateway) {
            item.status = 'FAILED';
            item.error = `Payment gateway not found for method: ${payment.method}`;
            await item.save();
            continue;
          }
          
          // Process the payment online
          const result = await gateway.processPayment({
            amount: payment.amount,
            currency: payment.currency,
            metadata: payment.metadata,
            paymentMethod: payment.method,
            orderId: payment.orderId
          });
          
          // Update payment with result
          payment.status = result.success ? PaymentStatus.COMPLETED : PaymentStatus.FAILED;
          payment.gatewayTransactionId = result.transactionId;
          payment.isOffline = false;
          
          if (result.success) {
            payment.completedAt = new Date();
          } else {
            payment.notes = (payment.notes || '') + ` Failed online: ${result.message}`;
          }
          
          await payment.save();
          
          // Update queue item
          item.status = result.success ? 'COMPLETED' : 'FAILED';
          item.error = result.success ? undefined : result.message;
          await item.save();
          
          // Publish payment event
          await this.messageBus.publish('payment', 'payment.processed', {
            paymentId: payment.paymentId,
            orderId: payment.orderId,
            amount: payment.amount,
            status: payment.status,
            isOffline: false,
            timestamp: new Date().toISOString()
          });
        } catch (error: any) {
          this.logger.error(`Error processing offline payment ${item.paymentId}: ${error}`);
          
          // Update queue item
          item.status = 'FAILED';
          item.error = error.message;
          await item.save();
        }
      }
    } catch (error) {
      this.logger.error(`Error in offline queue processor: ${error}`);
    } finally {
      this.isProcessingQueue = false;
    }
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
   * Process a payment
   */
  private async processPayment(req: Request, res: Response): Promise<void> {
    try {
      const { 
        orderId, 
        amount, 
        currency = 'USD', 
        method, 
        metadata = {},
        customerEmail,
        isOffline = false
      } = req.body;
      
      // Validate input
      if (!orderId || !amount || !method) {
        res.status(400).json({ message: 'Order ID, amount, and payment method are required' });
        return;
      }
      
      if (!Object.values(PaymentMethod).includes(method)) {
        res.status(400).json({ message: `Invalid payment method. Valid methods: ${Object.values(PaymentMethod).join(', ')}` });
        return;
      }
      
      // Create a unique payment ID
      const paymentId = uuidv4();
      
      // Check if we have a gateway for this method
      const gateway = this.paymentGateways.get(method);
      
      if (!gateway) {
        res.status(400).json({ message: `Payment method ${method} is not supported` });
        return;
      }
      
      // Create the payment record
      const payment = new this.paymentModel({
        paymentId,
        orderId,
        amount,
        currency,
        method,
        status: PaymentStatus.PENDING,
        metadata,
        isOffline,
        customerEmail
      });
      
      await payment.save();
      
      // If offline, store in queue for later and mark as completed for now
      if (isOffline) {
        // Create queue item for later processing
        const queueItem = new this.offlineQueueModel({
          queueId: uuidv4(),
          paymentId,
          payload: {
            orderId,
            amount,
            currency,
            method,
            metadata
          },
          status: 'PENDING',
          attempts: 0
        });
        
        await queueItem.save();
        
        // Mark as completed for now (will be processed later)
        payment.status = PaymentStatus.COMPLETED;
        payment.completedAt = new Date();
        payment.offlineReference = `OFFLINE-${Date.now()}`;
        await payment.save();
        
        // Publish offline payment event
        await this.messageBus.publish('payment', 'payment.processed.offline', {
          paymentId,
          orderId,
          amount,
          currency,
          method,
          timestamp: new Date().toISOString()
        });
        
        // Return payment info
        res.status(200).json({
          paymentId,
          status: payment.status,
          isOffline: true,
          offlineReference: payment.offlineReference
        });
        
        return;
      }
      
      // Process payment through gateway
      let result;
      try {
        // Mark as processing
        payment.status = PaymentStatus.PROCESSING;
        await payment.save();
        
        // Process via gateway
        result = await gateway.processPayment({
          amount,
          currency,
          metadata,
          paymentMethod: method,
          orderId
        });
      } catch (error: any) {
        // Handle gateway errors
        payment.status = PaymentStatus.FAILED;
        payment.notes = `Gateway error: ${error.message}`;
        await payment.save();
        
        // Publish payment failed event
        await this.messageBus.publish('payment', 'payment.failed', {
          paymentId,
          orderId,
          amount,
          error: error.message,
          timestamp: new Date().toISOString()
        });
        
        res.status(500).json({
          paymentId,
          status: 'FAILED',
          message: 'Payment gateway error'
        });
        
        return;
      }
      
      // Update payment with result
      payment.status = result.success ? PaymentStatus.COMPLETED : PaymentStatus.FAILED;
      payment.gatewayTransactionId = result.transactionId;
      
      if (result.success) {
        payment.completedAt = new Date();
      } else {
        payment.notes = `Failed: ${result.message}`;
      }
      
      await payment.save();
      
      // Publish payment event
      await this.messageBus.publish('payment', result.success ? 'payment.completed' : 'payment.failed', {
        paymentId,
        orderId,
        amount,
        currency,
        method,
        transactionId: result.transactionId,
        timestamp: new Date().toISOString()
      });
      
      // Return payment result
      res.status(result.success ? 200 : 400).json({
        paymentId,
        status: payment.status,
        message: result.message,
        transactionId: result.transactionId
      });
    } catch (error: any) {
      this.logger.error(`Payment processing error: ${error}`);
      res.status(500).json({ message: 'Failed to process payment', error: error.message });
    }
  }

  /**
   * Get payment by ID
   */
  private async getPayment(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      
      // Find by paymentId or MongoDB ID
      const payment = await this.paymentModel.findOne({
        $or: [
          { paymentId: id },
          { _id: mongoose.isValidObjectId(id) ? id : undefined }
        ]
      });
      
      if (!payment) {
        res.status(404).json({ message: 'Payment not found' });
        return;
      }
      
      res.status(200).json({
        paymentId: payment.paymentId,
        orderId: payment.orderId,
        amount: payment.amount,
        currency: payment.currency,
        method: payment.method,
        status: payment.status,
        refundedAmount: payment.refundedAmount,
        isOffline: payment.isOffline,
        gatewayTransactionId: payment.gatewayTransactionId,
        offlineReference: payment.offlineReference,
        createdAt: payment.createdAt,
        completedAt: payment.completedAt
      });
    } catch (error) {
      this.logger.error(`Get payment error: ${error}`);
      res.status(500).json({ message: 'Failed to get payment' });
    }
  }

  /**
   * Get payments by order ID
   */
  private async getPaymentsByOrder(req: Request, res: Response): Promise<void> {
    try {
      const { orderId } = req.params;
      
      const payments = await this.paymentModel.find({ orderId }).sort({ createdAt: -1 });
      
      res.status(200).json({
        orderId,
        payments: payments.map(payment => ({
          paymentId: payment.paymentId,
          amount: payment.amount,
          currency: payment.currency,
          method: payment.method,
          status: payment.status,
          refundedAmount: payment.refundedAmount,
          isOffline: payment.isOffline,
          createdAt: payment.createdAt,
          completedAt: payment.completedAt
        }))
      });
    } catch (error) {
      this.logger.error(`Get payments by order error: ${error}`);
      res.status(500).json({ message: 'Failed to get payments' });
    }
  }

  /**
   * Process a refund
   */
  private async processRefund(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const { amount, reason } = req.body;
      
      if (!amount) {
        res.status(400).json({ message: 'Refund amount is required' });
        return;
      }
      
      const result = await this.refundPayment(id, amount, reason);
      
      if (!result.success) {
        res.status(400).json({ message: result.message });
        return;
      }
      
      res.status(200).json({
        paymentId: result.paymentId,
        refundedAmount: result.refundedAmount,
        status: result.status,
        message: result.message
      });
    } catch (error: any) {
      this.logger.error(`Refund processing error: ${error}`);
      res.status(500).json({ message: 'Failed to process refund', error: error.message });
    }
  }

  /**
   * Submit an offline payment for processing
   */
  private async submitOfflinePayment(req: Request, res: Response): Promise<void> {
    try {
      const { paymentId } = req.body;
      
      if (!paymentId) {
        res.status(400).json({ message: 'Payment ID is required' });
        return;
      }
      
      // Find the payment
      const payment = await this.paymentModel.findOne({ paymentId });
      
      if (!payment) {
        res.status(404).json({ message: 'Payment not found' });
        return;
      }
      
      if (!payment.isOffline) {
        res.status(400).json({ message: 'Payment is not an offline payment' });
        return;
      }
      
      // Check if already in queue
      const existingQueueItem = await this.offlineQueueModel.findOne({ paymentId });
      
      if (existingQueueItem && existingQueueItem.status === 'COMPLETED') {
        res.status(400).json({ message: 'Offline payment has already been processed' });
        return;
      }
      
      if (existingQueueItem && existingQueueItem.status === 'PROCESSING') {
        res.status(400).json({ message: 'Offline payment is currently being processed' });
        return;
      }
      
      // If failed before, reset it
      if (existingQueueItem && existingQueueItem.status === 'FAILED') {
        existingQueueItem.status = 'PENDING';
        existingQueueItem.attempts = 0;
        existingQueueItem.error = undefined;
        await existingQueueItem.save();
        
        res.status(200).json({
          paymentId,
          message: 'Offline payment resubmitted for processing'
        });
        return;
      }
      
      // Create new queue item if none exists
      if (!existingQueueItem) {
        const queueItem = new this.offlineQueueModel({
          queueId: uuidv4(),
          paymentId,
          payload: {
            orderId: payment.orderId,
            amount: payment.amount,
            currency: payment.currency,
            method: payment.method,
            metadata: payment.metadata
          },
          status: 'PENDING',
          attempts: 0
        });
        
        await queueItem.save();
      }
      
      res.status(200).json({
        paymentId,
        message: 'Offline payment submitted for processing'
      });
    } catch (error) {
      this.logger.error(`Submit offline payment error: ${error}`);
      res.status(500).json({ message: 'Failed to submit offline payment' });
    }
  }

  /**
   * Get offline queue status
   */
  private async getOfflineQueueStatus(req: Request, res: Response): Promise<void> {
    try {
      // Get counts for different statuses
      const pending = await this.offlineQueueModel.countDocuments({ status: 'PENDING' });
      const processing = await this.offlineQueueModel.countDocuments({ status: 'PROCESSING' });
      const completed = await this.offlineQueueModel.countDocuments({ status: 'COMPLETED' });
      const failed = await this.offlineQueueModel.countDocuments({ status: 'FAILED' });
      
      res.status(200).json({
        queueStatus: {
          pending,
          processing,
          completed,
          failed,
          total: pending + processing + completed + failed
        },
        isProcessing: this.isProcessingQueue
      });
    } catch (error) {
      this.logger.error(`Get offline queue status error: ${error}`);
      res.status(500).json({ message: 'Failed to get offline queue status' });
    }
  }

  /**
   * Refund a payment
   */
  private async refundPayment(
    paymentId: string, 
    amount: number, 
    reason?: string
  ): Promise<{
    success: boolean;
    message: string;
    paymentId?: string;
    refundedAmount?: number;
    status?: string;
  }> {
    try {
      // Find the payment
      const payment = await this.paymentModel.findOne({
        $or: [
          { paymentId },
          { _id: mongoose.isValidObjectId(paymentId) ? paymentId : undefined }
        ]
      });
      
      if (!payment) {
        return { success: false, message: 'Payment not found' };
      }
      
      if (payment.status !== PaymentStatus.COMPLETED) {
        return { success: false, message: `Cannot refund payment with status: ${payment.status}` };
      }
      
      // Validate refund amount
      if (amount <= 0) {
        return { success: false, message: 'Refund amount must be greater than 0' };
      }
      
      const totalRefunded = (payment.refundedAmount || 0);
      const availableToRefund = payment.amount - totalRefunded;
      
      if (amount > availableToRefund) {
        return { 
          success: false, 
          message: `Cannot refund more than available amount. Available: ${availableToRefund}, Requested: ${amount}` 
        };
      }
      
      // Get the gateway
      const gateway = this.paymentGateways.get(payment.method);
      
      if (!gateway) {
        return { success: false, message: `Payment method ${payment.method} does not support refunds` };
      }
      
      // Process refund through gateway
      let result;
      try {
        result = await gateway.processRefund({
          transactionId: payment.gatewayTransactionId,
          amount,
          currency: payment.currency,
          reason
        });
      } catch (error: any) {
        return { success: false, message: `Refund gateway error: ${error.message}` };
      }
      
      if (!result.success) {
        return { success: false, message: `Refund failed: ${result.message}` };
      }
      
      // Update payment with refund
      const newTotalRefunded = totalRefunded + amount;
      payment.refundedAmount = newTotalRefunded;
      
      // Update status based on refund amount
      if (newTotalRefunded >= payment.amount) {
        payment.status = PaymentStatus.REFUNDED;
      } else {
        payment.status = PaymentStatus.PARTIALLY_REFUNDED;
      }
      
      payment.refundedAt = new Date();
      payment.notes = (payment.notes || '') + ` Refunded ${amount} on ${new Date().toISOString()}. Reason: ${reason || 'Not specified'}`;
      
      await payment.save();
      
      // Publish refund event
      await this.messageBus.publish('payment', 'payment.refunded', {
        paymentId: payment.paymentId,
        orderId: payment.orderId,
        amount,
        totalRefunded: newTotalRefunded,
        status: payment.status,
        reason,
        timestamp: new Date().toISOString()
      });
      
      return {
        success: true,
        message: 'Refund processed successfully',
        paymentId: payment.paymentId,
        refundedAmount: newTotalRefunded,
        status: payment.status
      };
    } catch (error: any) {
      this.logger.error(`Refund error: ${error}`);
      return { success: false, message: `Internal error processing refund: ${error.message}` };
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

// Interface for payment gateway results
interface PaymentResult {
  success: boolean;
  transactionId?: string;
  message: string;
}

// Interface for refund results
interface RefundResult {
  success: boolean;
  transactionId?: string;
  message: string;
}

// Interface for payment request
interface PaymentRequest {
  amount: number;
  currency: string;
  metadata: Record<string, any>;
  paymentMethod: string;
  orderId: string;
}

// Interface for refund request
interface RefundRequest {
  transactionId?: string;
  amount: number;
  currency: string;
  reason?: string;
}

// Abstract payment gateway
abstract class PaymentGateway {
  abstract processPayment(request: PaymentRequest): Promise<PaymentResult>;
  abstract processRefund(request: RefundRequest): Promise<RefundResult>;
}

// Cash payment gateway implementation
class CashPaymentGateway extends PaymentGateway {
  async processPayment(request: PaymentRequest): Promise<PaymentResult> {
    // Cash payments are always successful (manual process)
    return {
      success: true,
      transactionId: `CASH-${Date.now()}`,
      message: 'Cash payment recorded'
    };
  }
  
  async processRefund(request: RefundRequest): Promise<RefundResult> {
    // Cash refunds are always successful (manual process)
    return {
      success: true,
      transactionId: `CASH-REFUND-${Date.now()}`,
      message: 'Cash refund recorded'
    };
  }
}

// Card payment gateway implementation
class CardPaymentGateway extends PaymentGateway {
  private readonly isCredit: boolean;
  
  constructor(isCredit: boolean) {
    super();
    this.isCredit = isCredit;
  }
  
  async processPayment(request: PaymentRequest): Promise<PaymentResult> {
    // Simulate payment processing delay
    await new Promise(resolve => setTimeout(resolve, 500));
    
    // In a real implementation, this would call an external payment processor
    // For this demo, simulate success with a random transaction ID
    const txId = `CARD-${this.isCredit ? 'CREDIT' : 'DEBIT'}-${Date.now()}-${Math.random().toString(36).substring(2, 10)}`;
    
    return {
      success: true,
      transactionId: txId,
      message: `${this.isCredit ? 'Credit' : 'Debit'} card payment processed successfully`
    };
  }
  
  async processRefund(request: RefundRequest): Promise<RefundResult> {
    // Simulate refund processing delay
    await new Promise(resolve => setTimeout(resolve, 500));
    
    // In a real implementation, this would call an external payment processor
    // For this demo, simulate success
    return {
      success: true,
      transactionId: `REFUND-${this.isCredit ? 'CREDIT' : 'DEBIT'}-${Date.now()}`,
      message: `${this.isCredit ? 'Credit' : 'Debit'} card refund processed successfully`
    };
  }
}

// Start the service if this file is run directly
if (require.main === module) {
  const paymentService = new PaymentService();
  paymentService.start().catch(error => {
    console.error('Failed to start Payment Service:', error);
    process.exit(1);
  });
  
  // Handle graceful shutdown
  const shutdown = async () => {
    await paymentService.shutdown();
    process.exit(0);
  };
  
  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}

export default PaymentService;