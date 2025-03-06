import { Request, Response } from 'express';
import mongoose, { Schema, Document } from 'mongoose';
import { v4 as uuidv4 } from 'uuid';
import { BaseService } from '../../shared/base-service';
import { MessageBus } from '../../shared/message-bus';

// Order status enum
enum OrderStatus {
  CART = 'CART',
  PENDING = 'PENDING',
  CONFIRMED = 'CONFIRMED',
  PROCESSING = 'PROCESSING',
  FULFILLED = 'FULFILLED',
  DELIVERED = 'DELIVERED',
  CANCELLED = 'CANCELLED',
  REFUNDED = 'REFUNDED'
}

// Order item interface
interface IOrderItem {
  productId: string;
  sku: string;
  name: string;
  quantity: number;
  unitPrice: number;
  discount: number;
  totalPrice: number;
  notes?: string;
  metadata?: Record<string, any>;
}

// Order interface
interface IOrder extends Document {
  orderId: string;
  customerId?: string;
  status: OrderStatus;
  items: IOrderItem[];
  subtotal: number;
  tax: number;
  discount: number;
  total: number;
  paymentStatus: 'UNPAID' | 'PARTIALLY_PAID' | 'PAID' | 'REFUNDED';
  paymentMethod?: string;
  shippingAddress?: {
    street: string;
    city: string;
    state: string;
    zip: string;
    country: string;
  };
  billingAddress?: {
    street: string;
    city: string;
    state: string;
    zip: string;
    country: string;
  };
  notes?: string;
  metadata?: Record<string, any>;
  createdAt: Date;
  updatedAt: Date;
  confirmedAt?: Date;
  fulfilledAt?: Date;
  deliveredAt?: Date;
  cancelledAt?: Date;
  employeeId?: string;
  storeId?: string;
  deliveryId?: string;
  isOfflineOrder: boolean;
  returnPolicy?: string;
  giftMessage?: string;
}

/**
 * Order Service - Handles order creation and management
 */
export class OrderService extends BaseService {
  private messageBus: MessageBus;
  private orderModel: mongoose.Model<IOrder>;
  private readonly taxRate: number = 0.07; // 7% tax rate, would be configurable in production

  /**
   * Initialize the Order Service
   */
  constructor() {
    // Initialize base service with configuration
    super(
      'order-service',
      parseInt(process.env.PORT || '3004'),
      process.env.MONGO_URI || 'mongodb://localhost:27017/mayura-order',
      process.env.RABBITMQ_URI || 'amqp://localhost',
      process.env.REDIS_URI || 'redis://localhost:6379'
    );

    // Initialize message bus
    this.messageBus = new MessageBus(
      this.rabbitmqUri,
      this.serviceName,
      this.logger
    );

    // Define order item schema
    const orderItemSchema = new Schema<IOrderItem>({
      productId: { 
        type: String, 
        required: true 
      },
      sku: { 
        type: String, 
        required: true 
      },
      name: { 
        type: String, 
        required: true 
      },
      quantity: { 
        type: Number, 
        required: true,
        min: 1 
      },
      unitPrice: { 
        type: Number, 
        required: true,
        min: 0 
      },
      discount: { 
        type: Number, 
        required: true,
        default: 0,
        min: 0 
      },
      totalPrice: { 
        type: Number, 
        required: true,
        min: 0 
      },
      notes: { 
        type: String 
      },
      metadata: { 
        type: Schema.Types.Mixed, 
        default: {} 
      }
    });

    // Define order schema
    const orderSchema = new Schema<IOrder>({
      orderId: { 
        type: String, 
        required: true, 
        unique: true 
      },
      customerId: { 
        type: String,
        index: true
      },
      status: { 
        type: String, 
        required: true,
        enum: Object.values(OrderStatus),
        default: OrderStatus.CART 
      },
      items: [orderItemSchema],
      subtotal: { 
        type: Number, 
        required: true,
        default: 0 
      },
      tax: { 
        type: Number, 
        required: true,
        default: 0 
      },
      discount: { 
        type: Number, 
        required: true,
        default: 0 
      },
      total: { 
        type: Number, 
        required: true,
        default: 0 
      },
      paymentStatus: { 
        type: String, 
        required: true,
        enum: ['UNPAID', 'PARTIALLY_PAID', 'PAID', 'REFUNDED'],
        default: 'UNPAID' 
      },
      paymentMethod: { 
        type: String 
      },
      shippingAddress: {
        street: { type: String },
        city: { type: String },
        state: { type: String },
        zip: { type: String },
        country: { type: String, default: 'US' }
      },
      billingAddress: {
        street: { type: String },
        city: { type: String },
        state: { type: String },
        zip: { type: String },
        country: { type: String, default: 'US' }
      },
      notes: { 
        type: String 
      },
      metadata: { 
        type: Schema.Types.Mixed, 
        default: {} 
      },
      confirmedAt: { 
        type: Date 
      },
      fulfilledAt: { 
        type: Date 
      },
      deliveredAt: { 
        type: Date 
      },
      cancelledAt: { 
        type: Date 
      },
      employeeId: { 
        type: String 
      },
      storeId: { 
        type: String 
      },
      deliveryId: { 
        type: String 
      },
      isOfflineOrder: { 
        type: Boolean, 
        required: true,
        default: false 
      },
      returnPolicy: { 
        type: String 
      },
      giftMessage: { 
        type: String 
      }
    }, {
      timestamps: true
    });

    // Pre-save hook to calculate totals
    orderSchema.pre('save', function(next) {
      try {
        // Skip calculations if items are empty (initial cart)
        if (!this.items || this.items.length === 0) {
          this.subtotal = 0;
          this.tax = 0;
          this.total = 0;
          return next();
        }

        // Calculate totals
        this.subtotal = this.items.reduce((sum, item) => sum + item.totalPrice, 0);
        this.tax = parseFloat((this.subtotal * this.taxRate).toFixed(2));
        this.total = parseFloat((this.subtotal + this.tax - this.discount).toFixed(2));
        next();
      } catch (error: any) {
        next(error);
      }
    });

    // Add indexes for common queries
    orderSchema.index({ status: 1, createdAt: -1 });
    orderSchema.index({ customerId: 1, status: 1, createdAt: -1 });
    orderSchema.index({ paymentStatus: 1 });
    orderSchema.index({ storeId: 1, status: 1 });
    orderSchema.index({ isOfflineOrder: 1, status: 1 });

    // Create model
    this.orderModel = mongoose.model<IOrder>('Order', orderSchema);
  }

  /**
   * Initialize routes for the Order service
   */
  protected async initRoutes(): Promise<void> {
    // Create a new order
    this.app.post('/orders', this.authenticate.bind(this), this.createOrder.bind(this));
    
    // Get order by ID
    this.app.get('/orders/:id', this.authenticate.bind(this), this.getOrder.bind(this));
    
    // Get orders for a customer
    this.app.get('/orders/customer/:customerId', this.authenticate.bind(this), this.getCustomerOrders.bind(this));
    
    // Update an order (add/remove items)
    this.app.put('/orders/:id', this.authenticate.bind(this), this.updateOrder.bind(this));
    
    // Add item to order
    this.app.post('/orders/:id/items', this.authenticate.bind(this), this.addOrderItem.bind(this));
    
    // Update item in order
    this.app.put('/orders/:id/items/:itemId', this.authenticate.bind(this), this.updateOrderItem.bind(this));
    
    // Remove item from order
    this.app.delete('/orders/:id/items/:itemId', this.authenticate.bind(this), this.removeOrderItem.bind(this));
    
    // Confirm order
    this.app.post('/orders/:id/confirm', this.authenticate.bind(this), this.confirmOrder.bind(this));
    
    // Cancel order
    this.app.post('/orders/:id/cancel', this.authenticate.bind(this), this.cancelOrder.bind(this));
    
    // Update order status
    this.app.put('/orders/:id/status', this.authenticate.bind(this), this.updateStatus.bind(this));
    
    // Search orders
    this.app.get('/orders', this.authenticate.bind(this), this.searchOrders.bind(this));
    
    // Get order statistics
    this.app.get('/orders/stats/summary', this.authenticate.bind(this), this.getOrderStats.bind(this));
  }

  /**
   * Initialize message bus handlers
   */
  private async initMessageHandlers(): Promise<void> {
    await this.messageBus.connect();
    
    // Create exchanges
    await this.messageBus.createExchange('order', 'topic');
    
    // Create queues
    await this.messageBus.createQueue('order.payment.events', 'payment', 'payment.#');
    await this.messageBus.createQueue('order.inventory.events', 'inventory', 'inventory.#');
    await this.messageBus.createQueue('order.delivery.events', 'delivery', 'delivery.#');
    
    // Listen for payment events
    await this.messageBus.subscribe('order.payment.events', async (content, msg) => {
      this.logger.info(`Received payment event: ${msg.fields.routingKey}`, { content });
      
      // Handle payment events
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
    
    // Listen for inventory events
    await this.messageBus.subscribe('order.inventory.events', async (content, msg) => {
      this.logger.info(`Received inventory event: ${msg.fields.routingKey}`, { content });
      
      // Handle inventory events
      switch (msg.fields.routingKey) {
        case 'inventory.allocated':
          await this.handleInventoryAllocated(content);
          break;
        case 'inventory.allocation.failed':
          await this.handleInventoryAllocationFailed(content);
          break;
      }
    });
    
    // Listen for delivery events
    await this.messageBus.subscribe('order.delivery.events', async (content, msg) => {
      this.logger.info(`Received delivery event: ${msg.fields.routingKey}`, { content });
      
      // Handle delivery events
      switch (msg.fields.routingKey) {
        case 'delivery.assigned':
          await this.handleDeliveryAssigned(content);
          break;
        case 'delivery.completed':
          await this.handleDeliveryCompleted(content);
          break;
      }
    });
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
   * Create a new order
   */
  private async createOrder(req: Request, res: Response): Promise<void> {
    try {
      const { 
        customerId, 
        items = [], 
        storeId, 
        employeeId,
        isOfflineOrder = false,
        metadata = {}
      } = req.body;
      
      // Create a unique order ID
      const orderId = uuidv4();
      
      // Format and validate items
      const formattedItems = items.map((item: any) => ({
        productId: item.productId,
        sku: item.sku,
        name: item.name,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        discount: item.discount || 0,
        totalPrice: (item.quantity * item.unitPrice) - (item.discount || 0)
      }));
      
      // Create order
      const order = new this.orderModel({
        orderId,
        customerId,
        status: OrderStatus.CART,
        items: formattedItems,
        storeId,
        employeeId,
        isOfflineOrder,
        metadata
      });
      
      await order.save();
      
      // If the order is offline, mark it as pending
      if (isOfflineOrder && items.length > 0) {
        order.status = OrderStatus.PENDING;
        await order.save();
        
        // Publish order created event
        await this.messageBus.publish('order', 'order.created.offline', {
          orderId: order.orderId,
          customerId: order.customerId,
          items: order.items,
          total: order.total,
          storeId: order.storeId,
          timestamp: new Date().toISOString()
        });
      }
      
      res.status(201).json({
        orderId: order.orderId,
        status: order.status,
        items: order.items,
        subtotal: order.subtotal,
        tax: order.tax,
        total: order.total,
        createdAt: order.createdAt
      });
    } catch (error: any) {
      this.logger.error(`Order creation error: ${error}`);
      res.status(500).json({ message: 'Failed to create order', error: error.message });
    }
  }

  /**
   * Get order by ID
   */
  private async getOrder(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      
      // Find by orderId or MongoDB ID
      const order = await this.orderModel.findOne({
        $or: [
          { orderId: id },
          { _id: mongoose.isValidObjectId(id) ? id : undefined }
        ]
      });
      
      if (!order) {
        res.status(404).json({ message: 'Order not found' });
        return;
      }
      
      res.status(200).json({
        orderId: order.orderId,
        customerId: order.customerId,
        status: order.status,
        items: order.items,
        subtotal: order.subtotal,
        tax: order.tax,
        discount: order.discount,
        total: order.total,
        paymentStatus: order.paymentStatus,
        paymentMethod: order.paymentMethod,
        shippingAddress: order.shippingAddress,
        billingAddress: order.billingAddress,
        notes: order.notes,
        createdAt: order.createdAt,
        confirmedAt: order.confirmedAt,
        fulfilledAt: order.fulfilledAt,
        deliveredAt: order.deliveredAt,
        cancelledAt: order.cancelledAt,
        isOfflineOrder: order.isOfflineOrder,
        deliveryId: order.deliveryId
      });
    } catch (error) {
      this.logger.error(`Get order error: ${error}`);
      res.status(500).json({ message: 'Failed to get order' });
    }
  }

  /**
   * Get orders for a customer
   */
  private async getCustomerOrders(req: Request, res: Response): Promise<void> {
    try {
      const { customerId } = req.params;
      const { status, limit = 10, page = 1 } = req.query;
      
      const skip = (parseInt(page as string) - 1) * parseInt(limit as string);
      
      // Build query
      const query: any = { customerId };
      
      if (status) {
        query.status = status;
      }
      
      // Get orders
      const orders = await this.orderModel
        .find(query)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(parseInt(limit as string));
      
      // Get total count
      const total = await this.orderModel.countDocuments(query);
      
      res.status(200).json({
        orders: orders.map(order => ({
          orderId: order.orderId,
          status: order.status,
          total: order.total,
          paymentStatus: order.paymentStatus,
          createdAt: order.createdAt,
          itemCount: order.items.length
        })),
        pagination: {
          page: parseInt(page as string),
          limit: parseInt(limit as string),
          total,
          pages: Math.ceil(total / parseInt(limit as string))
        }
      });
    } catch (error) {
      this.logger.error(`Get customer orders error: ${error}`);
      res.status(500).json({ message: 'Failed to get customer orders' });
    }
  }

  /**
   * Update an entire order
   */
  private async updateOrder(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const {
        items,
        shippingAddress,
        billingAddress,
        notes,
        metadata,
        giftMessage,
        returnPolicy
      } = req.body;
      
      // Find order
      const order = await this.orderModel.findOne({
        $or: [
          { orderId: id },
          { _id: mongoose.isValidObjectId(id) ? id : undefined }
        ]
      });
      
      if (!order) {
        res.status(404).json({ message: 'Order not found' });
        return;
      }
      
      // Only allow updates if order is in CART or PENDING status
      if (![OrderStatus.CART, OrderStatus.PENDING].includes(order.status as OrderStatus)) {
        res.status(400).json({ 
          message: `Cannot update order in ${order.status} status` 
        });
        return;
      }
      
      // Update fields if provided
      if (items) {
        // Format items
        order.items = items.map((item: any) => ({
          productId: item.productId,
          sku: item.sku,
          name: item.name,
          quantity: item.quantity,
          unitPrice: item.unitPrice,
          discount: item.discount || 0,
          totalPrice: (item.quantity * item.unitPrice) - (item.discount || 0),
          notes: item.notes,
          metadata: item.metadata
        }));
      }
      
      if (shippingAddress) order.shippingAddress = shippingAddress;
      if (billingAddress) order.billingAddress = billingAddress;
      if (notes) order.notes = notes;
      if (metadata) order.metadata = { ...order.metadata, ...metadata };
      if (giftMessage) order.giftMessage = giftMessage;
      if (returnPolicy) order.returnPolicy = returnPolicy;
      
      await order.save();
      
      // Publish order updated event
      await this.messageBus.publish('order', 'order.updated', {
        orderId: order.orderId,
        items: order.items,
        total: order.total,
        timestamp: new Date().toISOString()
      });
      
      res.status(200).json({
        orderId: order.orderId,
        status: order.status,
        items: order.items,
        subtotal: order.subtotal,
        tax: order.tax,
        discount: order.discount,
        total: order.total,
        shippingAddress: order.shippingAddress,
        billingAddress: order.billingAddress,
        notes: order.notes
      });
    } catch (error) {
      this.logger.error(`Update order error: ${error}`);
      res.status(500).json({ message: 'Failed to update order' });
    }
  }

  /**
   * Add an item to an order
   */
  private async addOrderItem(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const { productId, sku, name, quantity, unitPrice, discount = 0, notes, metadata } = req.body;
      
      // Validate input
      if (!productId || !sku || !name || !quantity || !unitPrice) {
        res.status(400).json({ message: 'Product details are required' });
        return;
      }
      
      // Find order
      const order = await this.orderModel.findOne({
        $or: [
          { orderId: id },
          { _id: mongoose.isValidObjectId(id) ? id : undefined }
        ]
      });
      
      if (!order) {
        res.status(404).json({ message: 'Order not found' });
        return;
      }
      
      // Only allow updates if order is in CART or PENDING status
      if (![OrderStatus.CART, OrderStatus.PENDING].includes(order.status as OrderStatus)) {
        res.status(400).json({ 
          message: `Cannot add items to order in ${order.status} status` 
        });
        return;
      }
      
      // Calculate total price
      const totalPrice = (quantity * unitPrice) - discount;
      
      // Check if item already exists
      const existingItemIndex = order.items.findIndex(item => 
        item.productId === productId && item.sku === sku
      );
      
      if (existingItemIndex >= 0) {
        // Update existing item
        const existingItem = order.items[existingItemIndex];
        existingItem.quantity += quantity;
        existingItem.totalPrice = (existingItem.quantity * existingItem.unitPrice) - existingItem.discount;
        
        if (notes) existingItem.notes = notes;
        if (metadata) existingItem.metadata = { ...existingItem.metadata, ...metadata };
      } else {
        // Add new item
        order.items.push({
          productId,
          sku,
          name,
          quantity,
          unitPrice,
          discount,
          totalPrice,
          notes,
          metadata
        });
      }
      
      await order.save();
      
      // If order is empty cart, update status to PENDING
      if (order.status === OrderStatus.CART && order.items.length > 0) {
        order.status = OrderStatus.PENDING;
        await order.save();
        
        // Publish order created event
        await this.messageBus.publish('order', 'order.created', {
          orderId: order.orderId,
          customerId: order.customerId,
          items: order.items,
          total: order.total,
          storeId: order.storeId,
          timestamp: new Date().toISOString()
        });
      } else {
        // Publish order updated event
        await this.messageBus.publish('order', 'order.updated', {
          orderId: order.orderId,
          items: order.items,
          total: order.total,
          timestamp: new Date().toISOString()
        });
      }
      
      res.status(200).json({
        orderId: order.orderId,
        status: order.status,
        items: order.items,
        subtotal: order.subtotal,
        tax: order.tax,
        discount: order.discount,
        total: order.total
      });
    } catch (error) {
      this.logger.error(`Add order item error: ${error}`);
      res.status(500).json({ message: 'Failed to add item to order' });
    }
  }

  /**
   * Update an item in an order
   */
  private async updateOrderItem(req: Request, res: Response): Promise<void> {
    try {
      const { id, itemId } = req.params;
      const { quantity, discount, notes, metadata } = req.body;
      
      // Find order
      const order = await this.orderModel.findOne({
        $or: [
          { orderId: id },
          { _id: mongoose.isValidObjectId(id) ? id : undefined }
        ]
      });
      
      if (!order) {
        res.status(404).json({ message: 'Order not found' });
        return;
      }
      
      // Only allow updates if order is in CART or PENDING status
      if (![OrderStatus.CART, OrderStatus.PENDING].includes(order.status as OrderStatus)) {
        res.status(400).json({ 
          message: `Cannot update items in order with ${order.status} status` 
        });
        return;
      }
      
      // Find the item
      const itemIndex = order.items.findIndex(item => 
        item._id.toString() === itemId || item.productId === itemId
      );
      
      if (itemIndex === -1) {
        res.status(404).json({ message: 'Item not found in order' });
        return;
      }
      
      // Update item
      const item = order.items[itemIndex];
      
      if (quantity !== undefined) {
        if (quantity <= 0) {
          // Remove item if quantity is 0 or negative
          order.items.splice(itemIndex, 1);
        } else {
          item.quantity = quantity;
          item.totalPrice = (quantity * item.unitPrice) - (discount !== undefined ? discount : item.discount);
        }
      }
      
      if (discount !== undefined) {
        item.discount = discount;
        item.totalPrice = (item.quantity * item.unitPrice) - discount;
      }
      
      if (notes !== undefined) item.notes = notes;
      if (metadata !== undefined) item.metadata = { ...item.metadata, ...metadata };
      
      await order.save();
      
      // Check if order is now empty
      if (order.items.length === 0 && order.status !== OrderStatus.CART) {
        order.status = OrderStatus.CART;
        await order.save();
      }
      
      // Publish order updated event
      await this.messageBus.publish('order', 'order.updated', {
        orderId: order.orderId,
        items: order.items,
        total: order.total,
        timestamp: new Date().toISOString()
      });
      
      res.status(200).json({
        orderId: order.orderId,
        status: order.status,
        items: order.items,
        subtotal: order.subtotal,
        tax: order.tax,
        discount: order.discount,
        total: order.total
      });
    } catch (error) {
      this.logger.error(`Update order item error: ${error}`);
      res.status(500).json({ message: 'Failed to update item in order' });
    }
  }

  /**
   * Remove an item from an order
   */
  private async removeOrderItem(req: Request, res: Response): Promise<void> {
    try {
      const { id, itemId } = req.params;
      
      // Find order
      const order = await this.orderModel.findOne({
        $or: [
          { orderId: id },
          { _id: mongoose.isValidObjectId(id) ? id : undefined }
        ]
      });
      
      if (!order) {
        res.status(404).json({ message: 'Order not found' });
        return;
      }
      
      // Only allow updates if order is in CART or PENDING status
      if (![OrderStatus.CART, OrderStatus.PENDING].includes(order.status as OrderStatus)) {
        res.status(400).json({ 
          message: `Cannot remove items from order in ${order.status} status` 
        });
        return;
      }
      
      // Find the item
      const itemIndex = order.items.findIndex(item => 
        item._id.toString() === itemId || item.productId === itemId
      );
      
      if (itemIndex === -1) {
        res.status(404).json({ message: 'Item not found in order' });
        return;
      }
      
      // Remove item
      order.items.splice(itemIndex, 1);
      
      // Check if order is now empty
      if (order.items.length === 0 && order.status !== OrderStatus.CART) {
        order.status = OrderStatus.CART;
      }
      
      await order.save();
      
      // Publish order updated event
      await this.messageBus.publish('order', 'order.updated', {
        orderId: order.orderId,
        items: order.items,
        total: order.total,
        timestamp: new Date().toISOString()
      });
      
      res.status(200).json({
        orderId: order.orderId,
        status: order.status,
        items: order.items,
        subtotal: order.subtotal,
        tax: order.tax,
        discount: order.discount,
        total: order.total
      });
    } catch (error) {
      this.logger.error(`Remove order item error: ${error}`);
      res.status(500).json({ message: 'Failed to remove item from order' });
    }
  }

  /**
   * Confirm an order
   */
  private async confirmOrder(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const { 
        paymentMethod,
        shippingAddress,
        billingAddress,
        notes
      } = req.body;
      
      // Find order
      const order = await this.orderModel.findOne({
        $or: [
          { orderId: id },
          { _id: mongoose.isValidObjectId(id) ? id : undefined }
        ]
      });
      
      if (!order) {
        res.status(404).json({ message: 'Order not found' });
        return;
      }
      
      // Only allow confirmation if order is in PENDING status
      if (order.status !== OrderStatus.PENDING) {
        res.status(400).json({ 
          message: `Cannot confirm order in ${order.status} status` 
        });
        return;
      }
      
      // Validate order has items
      if (order.items.length === 0) {
        res.status(400).json({ message: 'Cannot confirm an empty order' });
        return;
      }
      
      // Update order details
      if (paymentMethod) order.paymentMethod = paymentMethod;
      if (shippingAddress) order.shippingAddress = shippingAddress;
      if (billingAddress) order.billingAddress = billingAddress;
      if (notes) order.notes = notes;
      
      // Update status
      order.status = OrderStatus.CONFIRMED;
      order.confirmedAt = new Date();
      
      await order.save();
      
      // Publish order confirmed event
      await this.messageBus.publish('order', 'order.confirmed', {
        orderId: order.orderId,
        customerId: order.customerId,
        items: order.items.map(item => ({
          productId: item.productId,
          sku: item.sku,
          quantity: item.quantity
        })),
        total: order.total,
        paymentMethod: order.paymentMethod,
        timestamp: new Date().toISOString()
      });
      
      res.status(200).json({
        orderId: order.orderId,
        status: order.status,
        paymentMethod: order.paymentMethod,
        subtotal: order.subtotal,
        tax: order.tax,
        discount: order.discount,
        total: order.total,
        confirmedAt: order.confirmedAt
      });
    } catch (error) {
      this.logger.error(`Confirm order error: ${error}`);
      res.status(500).json({ message: 'Failed to confirm order' });
    }
  }

  /**
   * Cancel an order
   */
  private async cancelOrder(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const { reason } = req.body;
      
      // Find order
      const order = await this.orderModel.findOne({
        $or: [
          { orderId: id },
          { _id: mongoose.isValidObjectId(id) ? id : undefined }
        ]
      });
      
      if (!order) {
        res.status(404).json({ message: 'Order not found' });
        return;
      }
      
      // Only allow cancellation in certain statuses
      const allowedStatuses = [
        OrderStatus.PENDING, 
        OrderStatus.CONFIRMED, 
        OrderStatus.PROCESSING
      ];
      
      if (!allowedStatuses.includes(order.status as OrderStatus)) {
        res.status(400).json({ 
          message: `Cannot cancel order in ${order.status} status` 
        });
        return;
      }
      
      // Update status
      order.status = OrderStatus.CANCELLED;
      order.cancelledAt = new Date();
      order.notes = (order.notes || '') + `\nCancelled: ${reason || 'No reason provided'}`;
      
      await order.save();
      
      // Publish order cancelled event
      await this.messageBus.publish('order', 'order.cancelled', {
        orderId: order.orderId,
        customerId: order.customerId,
        items: order.items.map(item => ({
          productId: item.productId,
          sku: item.sku,
          quantity: item.quantity
        })),
        total: order.total,
        reason,
        timestamp: new Date().toISOString()
      });
      
      res.status(200).json({
        orderId: order.orderId,
        status: order.status,
        cancelledAt: order.cancelledAt,
        message: 'Order cancelled successfully'
      });
    } catch (error) {
      this.logger.error(`Cancel order error: ${error}`);
      res.status(500).json({ message: 'Failed to cancel order' });
    }
  }

  /**
   * Update order status
   */
  private async updateStatus(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const { status, notes } = req.body;
      
      // Validate status
      if (!Object.values(OrderStatus).includes(status)) {
        res.status(400).json({ 
          message: `Invalid status. Valid statuses: ${Object.values(OrderStatus).join(', ')}` 
        });
        return;
      }
      
      // Find order
      const order = await this.orderModel.findOne({
        $or: [
          { orderId: id },
          { _id: mongoose.isValidObjectId(id) ? id : undefined }
        ]
      });
      
      if (!order) {
        res.status(404).json({ message: 'Order not found' });
        return;
      }
      
      // Check for valid state transitions
      const isValidTransition = this.isValidStatusTransition(order.status as OrderStatus, status);
      
      if (!isValidTransition) {
        res.status(400).json({ 
          message: `Invalid status transition from ${order.status} to ${status}` 
        });
        return;
      }
      
      // Update status
      const oldStatus = order.status;
      order.status = status;
      
      // Add notes if provided
      if (notes) {
        order.notes = (order.notes || '') + `\nStatus updated from ${oldStatus} to ${status}: ${notes}`;
      }
      
      // Update timestamp based on status
      switch (status) {
        case OrderStatus.CONFIRMED:
          order.confirmedAt = new Date();
          break;
        case OrderStatus.FULFILLED:
          order.fulfilledAt = new Date();
          break;
        case OrderStatus.DELIVERED:
          order.deliveredAt = new Date();
          break;
        case OrderStatus.CANCELLED:
          order.cancelledAt = new Date();
          break;
      }
      
      await order.save();
      
      // Publish status update event
      await this.messageBus.publish('order', `order.status.${status.toLowerCase()}`, {
        orderId: order.orderId,
        oldStatus,
        newStatus: status,
        timestamp: new Date().toISOString()
      });
      
      res.status(200).json({
        orderId: order.orderId,
        status: order.status,
        message: `Order status updated to ${status}`
      });
    } catch (error) {
      this.logger.error(`Update order status error: ${error}`);
      res.status(500).json({ message: 'Failed to update order status' });
    }
  }

  /**
   * Check if a status transition is valid
   */
  private isValidStatusTransition(currentStatus: OrderStatus, newStatus: string): boolean {
    // Define valid state transitions
    const validTransitions: Record<OrderStatus, OrderStatus[]> = {
      [OrderStatus.CART]: [OrderStatus.PENDING, OrderStatus.CANCELLED],
      [OrderStatus.PENDING]: [OrderStatus.CONFIRMED, OrderStatus.CANCELLED],
      [OrderStatus.CONFIRMED]: [OrderStatus.PROCESSING, OrderStatus.CANCELLED],
      [OrderStatus.PROCESSING]: [OrderStatus.FULFILLED, OrderStatus.CANCELLED],
      [OrderStatus.FULFILLED]: [OrderStatus.DELIVERED, OrderStatus.CANCELLED],
      [OrderStatus.DELIVERED]: [OrderStatus.REFUNDED],
      [OrderStatus.CANCELLED]: [OrderStatus.REFUNDED],
      [OrderStatus.REFUNDED]: []
    };
    
    return validTransitions[currentStatus].includes(newStatus as OrderStatus);
  }

  /**
   * Search orders
   */
  private async searchOrders(req: Request, res: Response): Promise<void> {
    try {
      const {
        status,
        customerId,
        startDate,
        endDate,
        minTotal,
        maxTotal,
        paymentStatus,
        isOfflineOrder,
        storeId,
        page = 1,
        limit = 10,
        sortBy = 'createdAt',
        sortOrder = 'desc'
      } = req.query;
      
      // Build query
      const query: any = {};
      
      if (status) query.status = status;
      if (customerId) query.customerId = customerId;
      if (paymentStatus) query.paymentStatus = paymentStatus;
      if (isOfflineOrder !== undefined) query.isOfflineOrder = isOfflineOrder === 'true';
      if (storeId) query.storeId = storeId;
      
      // Date range
      if (startDate || endDate) {
        query.createdAt = {};
        if (startDate) query.createdAt.$gte = new Date(startDate as string);
        if (endDate) query.createdAt.$lte = new Date(endDate as string);
      }
      
      // Total range
      if (minTotal || maxTotal) {
        query.total = {};
        if (minTotal) query.total.$gte = parseFloat(minTotal as string);
        if (maxTotal) query.total.$lte = parseFloat(maxTotal as string);
      }
      
      // Parse pagination
      const skip = (parseInt(page as string) - 1) * parseInt(limit as string);
      
      // Build sort
      const sort: any = {};
      sort[sortBy as string] = sortOrder === 'asc' ? 1 : -1;
      
      // Get orders
      const orders = await this.orderModel
        .find(query)
        .sort(sort)
        .skip(skip)
        .limit(parseInt(limit as string));
      
      // Get total count
      const total = await this.orderModel.countDocuments(query);
      
      res.status(200).json({
        orders: orders.map(order => ({
          orderId: order.orderId,
          customerId: order.customerId,
          status: order.status,
          total: order.total,
          paymentStatus: order.paymentStatus,
          createdAt: order.createdAt,
          itemCount: order.items.length,
          isOfflineOrder: order.isOfflineOrder
        })),
        pagination: {
          page: parseInt(page as string),
          limit: parseInt(limit as string),
          total,
          pages: Math.ceil(total / parseInt(limit as string))
        }
      });
    } catch (error) {
      this.logger.error(`Search orders error: ${error}`);
      res.status(500).json({ message: 'Failed to search orders' });
    }
  }

  /**
   * Get order statistics
   */
  private async getOrderStats(req: Request, res: Response): Promise<void> {
    try {
      const { startDate, endDate, storeId } = req.query;
      
      // Build date range
      const dateRange: any = {};
      if (startDate) dateRange.$gte = new Date(startDate as string);
      if (endDate) dateRange.$lte = new Date(endDate as string);
      
      // Build query
      const query: any = {};
      if (Object.keys(dateRange).length > 0) {
        query.createdAt = dateRange;
      }
      if (storeId) {
        query.storeId = storeId;
      }
      
      // Count orders by status
      const ordersByStatus = await this.orderModel.aggregate([
        { $match: query },
        { $group: {
          _id: '$status',
          count: { $sum: 1 },
          total: { $sum: '$total' }
        }},
        { $sort: { count: -1 } }
      ]);
      
      // Calculate revenue
      const revenue = await this.orderModel.aggregate([
        { 
          $match: { 
            ...query, 
            status: { $in: [OrderStatus.FULFILLED, OrderStatus.DELIVERED] } 
          } 
        },
        { 
          $group: {
            _id: null,
            totalRevenue: { $sum: '$total' },
            orderCount: { $sum: 1 },
            averageOrderValue: { $avg: '$total' }
          } 
        }
      ]);
      
      // Calculate daily sales for the period
      const dailySales = await this.orderModel.aggregate([
        { 
          $match: { 
            ...query, 
            status: { $in: [OrderStatus.FULFILLED, OrderStatus.DELIVERED] } 
          } 
        },
        {
          $group: {
            _id: { 
              $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } 
            },
            sales: { $sum: '$total' },
            orders: { $sum: 1 }
          }
        },
        { $sort: { _id: 1 } }
      ]);
      
      // Top products
      const topProducts = await this.orderModel.aggregate([
        { 
          $match: { 
            ...query, 
            status: { $nin: [OrderStatus.CANCELLED, OrderStatus.CART] } 
          } 
        },
        { $unwind: '$items' },
        { 
          $group: {
            _id: { 
              productId: '$items.productId',
              name: '$items.name',
              sku: '$items.sku'
            },
            totalQuantity: { $sum: '$items.quantity' },
            totalRevenue: { $sum: '$items.totalPrice' },
            orderCount: { $sum: 1 }
          } 
        },
        { $sort: { totalQuantity: -1 } },
        { $limit: 10 }
      ]);
      
      res.status(200).json({
        orderCount: {
          total: await this.orderModel.countDocuments(query),
          byStatus: ordersByStatus.reduce((acc: any, curr: any) => {
            acc[curr._id] = { count: curr.count, total: curr.total };
            return acc;
          }, {})
        },
        revenue: revenue.length > 0 ? {
          total: revenue[0].totalRevenue,
          orderCount: revenue[0].orderCount,
          averageOrderValue: revenue[0].averageOrderValue
        } : {
          total: 0,
          orderCount: 0,
          averageOrderValue: 0
        },
        dailySales: dailySales.map((day: any) => ({
          date: day._id,
          sales: day.sales,
          orders: day.orders
        })),
        topProducts: topProducts.map((product: any) => ({
          productId: product._id.productId,
          name: product._id.name,
          sku: product._id.sku,
          totalQuantity: product.totalQuantity,
          totalRevenue: product.totalRevenue,
          orderCount: product.orderCount
        }))
      });
    } catch (error) {
      this.logger.error(`Get order stats error: ${error}`);
      res.status(500).json({ message: 'Failed to get order statistics' });
    }
  }

  /**
   * Handle payment completed event
   */
  private async handlePaymentCompleted(content: any): Promise<void> {
    try {
      const { orderId } = content;
      
      // Find order
      const order = await this.orderModel.findOne({ orderId });
      
      if (!order) {
        this.logger.error(`Payment completed for non-existent order: ${orderId}`);
        return;
      }
      
      // Update payment status
      order.paymentStatus = 'PAID';
      order.paymentMethod = content.method || order.paymentMethod;
      await order.save();
      
      this.logger.info(`Payment completed for order: ${orderId}`);
    } catch (error) {
      this.logger.error(`Error handling payment completed: ${error}`);
    }
  }

  /**
   * Handle payment failed event
   */
  private async handlePaymentFailed(content: any): Promise<void> {
    try {
      const { orderId, error } = content;
      
      // Find order
      const order = await this.orderModel.findOne({ orderId });
      
      if (!order) {
        this.logger.error(`Payment failed for non-existent order: ${orderId}`);
        return;
      }
      
      // Add note about payment failure
      order.notes = (order.notes || '') + `\nPayment failed: ${error}`;
      await order.save();
      
      this.logger.info(`Payment failed for order: ${orderId}`);
    } catch (error) {
      this.logger.error(`Error handling payment failed: ${error}`);
    }
  }

  /**
   * Handle payment refunded event
   */
  private async handlePaymentRefunded(content: any): Promise<void> {
    try {
      const { orderId, totalRefunded, amount } = content;
      
      // Find order
      const order = await this.orderModel.findOne({ orderId });
      
      if (!order) {
        this.logger.error(`Payment refunded for non-existent order: ${orderId}`);
        return;
      }
      
      // Update payment status and status
      if (totalRefunded >= order.total) {
        order.paymentStatus = 'REFUNDED';
        if (order.status !== OrderStatus.CANCELLED) {
          order.status = OrderStatus.REFUNDED;
        }
      } else {
        order.paymentStatus = 'PARTIALLY_PAID';
      }
      
      // Add note about refund
      order.notes = (order.notes || '') + `\nRefunded ${amount} on ${new Date().toISOString()}`;
      await order.save();
      
      this.logger.info(`Payment refunded for order: ${orderId}`);
    } catch (error) {
      this.logger.error(`Error handling payment refunded: ${error}`);
    }
  }

  /**
   * Handle inventory allocated event
   */
  private async handleInventoryAllocated(content: any): Promise<void> {
    try {
      const { orderId } = content;
      
      // Find order
      const order = await this.orderModel.findOne({ orderId });
      
      if (!order) {
        this.logger.error(`Inventory allocated for non-existent order: ${orderId}`);
        return;
      }
      
      // If order is in CONFIRMED status, move to PROCESSING
      if (order.status === OrderStatus.CONFIRMED) {
        order.status = OrderStatus.PROCESSING;
        await order.save();
        
        // Publish status update event
        await this.messageBus.publish('order', 'order.status.processing', {
          orderId: order.orderId,
          oldStatus: OrderStatus.CONFIRMED,
          newStatus: OrderStatus.PROCESSING,
          timestamp: new Date().toISOString()
        });
      }
      
      this.logger.info(`Inventory allocated for order: ${orderId}`);
    } catch (error) {
      this.logger.error(`Error handling inventory allocated: ${error}`);
    }
  }

  /**
   * Handle inventory allocation failed event
   */
  private async handleInventoryAllocationFailed(content: any): Promise<void> {
    try {
      const { orderId, reason } = content;
      
      // Find order
      const order = await this.orderModel.findOne({ orderId });
      
      if (!order) {
        this.logger.error(`Inventory allocation failed for non-existent order: ${orderId}`);
        return;
      }
      
      // Add note about inventory failure
      order.notes = (order.notes || '') + `\nInventory allocation failed: ${reason}`;
      await order.save();
      
      this.logger.info(`Inventory allocation failed for order: ${orderId}`);
    } catch (error) {
      this.logger.error(`Error handling inventory allocation failed: ${error}`);
    }
  }

  /**
   * Handle delivery assigned event
   */
  private async handleDeliveryAssigned(content: any): Promise<void> {
    try {
      const { orderId, deliveryId } = content;
      
      // Find order
      const order = await this.orderModel.findOne({ orderId });
      
      if (!order) {
        this.logger.error(`Delivery assigned for non-existent order: ${orderId}`);
        return;
      }
      
      // Update delivery ID
      order.deliveryId = deliveryId;
      await order.save();
      
      this.logger.info(`Delivery assigned for order: ${orderId}`);
    } catch (error) {
      this.logger.error(`Error handling delivery assigned: ${error}`);
    }
  }

  /**
   * Handle delivery completed event
   */
  private async handleDeliveryCompleted(content: any): Promise<void> {
    try {
      const { orderId } = content;
      
      // Find order
      const order = await this.orderModel.findOne({ orderId });
      
      if (!order) {
        this.logger.error(`Delivery completed for non-existent order: ${orderId}`);
        return;
      }
      
      // Update status to DELIVERED
      if (order.status === OrderStatus.FULFILLED) {
        order.status = OrderStatus.DELIVERED;
        order.deliveredAt = new Date();
        await order.save();
        
        // Publish status update event
        await this.messageBus.publish('order', 'order.status.delivered', {
          orderId: order.orderId,
          oldStatus: OrderStatus.FULFILLED,
          newStatus: OrderStatus.DELIVERED,
          timestamp: new Date().toISOString()
        });
      }
      
      this.logger.info(`Delivery completed for order: ${orderId}`);
    } catch (error) {
      this.logger.error(`Error handling delivery completed: ${error}`);
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
  const orderService = new OrderService();
  orderService.start().catch(error => {
    console.error('Failed to start Order Service:', error);
    process.exit(1);
  });
  
  // Handle graceful shutdown
  const shutdown = async () => {
    await orderService.shutdown();
    process.exit(0);
  };
  
  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}

export default OrderService;