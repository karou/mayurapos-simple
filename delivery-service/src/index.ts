import { Request, Response } from 'express';
import mongoose, { Schema, Document } from 'mongoose';
import { v4 as uuidv4 } from 'uuid';
import { BaseService } from '../../shared/base-service';
import { MessageBus } from '../../shared/message-bus';

// Delivery status enum
enum DeliveryStatus {
  PENDING = 'PENDING',
  ASSIGNED = 'ASSIGNED',
  PICKED_UP = 'PICKED_UP',
  IN_TRANSIT = 'IN_TRANSIT',
  DELIVERED = 'DELIVERED',
  FAILED = 'FAILED',
  CANCELLED = 'CANCELLED'
}

// Delivery type enum
enum DeliveryType {
  STANDARD = 'STANDARD',
  EXPRESS = 'EXPRESS',
  SAME_DAY = 'SAME_DAY',
  PICKUP = 'PICKUP'
}

// Delivery interface
interface IDelivery extends Document {
  deliveryId: string;
  orderId: string;
  customerId?: string;
  status: DeliveryStatus;
  type: DeliveryType;
  driverId?: string;
  vehicleId?: string;
  scheduledTime?: Date;
  pickupTime?: Date;
  deliveredTime?: Date;
  estimatedDeliveryTime?: Date;
  actualDeliveryTime?: Date;
  origin: {
    storeId: string;
    address: {
      street: string;
      city: string;
      state: string;
      zip: string;
      country: string;
      latitude?: number;
      longitude?: number;
    };
    contactName?: string;
    contactPhone?: string;
  };
  destination: {
    address: {
      street: string;
      city: string;
      state: string;
      zip: string;
      country: string;
      latitude?: number;
      longitude?: number;
    };
    contactName: string;
    contactPhone: string;
    notes?: string;
  };
  items: {
    productId: string;
    sku: string;
    name: string;
    quantity: number;
  }[];
  route?: {
    distance: number;
    duration: number;
    polyline?: string;
  };
  tracking?: {
    trackingId: string;
    trackingUrl?: string;
    currentLocation?: {
      latitude: number;
      longitude: number;
      updatedAt: Date;
    };
    checkpoints?: {
      status: string;
      location?: string;
      timestamp: Date;
      notes?: string;
    }[];
  };
  proof?: {
    signature?: string;
    photo?: string;
    notes?: string;
  };
  cancellationReason?: string;
  failureReason?: string;
  notes?: string;
  priority: number;
  createdAt: Date;
  updatedAt: Date;
}

// Driver interface
interface IDriver extends Document {
  driverId: string;
  userId?: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  status: 'AVAILABLE' | 'BUSY' | 'OFFLINE';
  vehicleId?: string;
  currentLocation?: {
    latitude: number;
    longitude: number;
    updatedAt: Date;
  };
  totalDeliveries: number;
  rating: number;
  activeDeliveryId?: string;
  isActive: boolean;
  notes?: string;
  createdAt: Date;
  updatedAt: Date;
}

// Vehicle interface
interface IVehicle extends Document {
  vehicleId: string;
  type: 'CAR' | 'MOTORCYCLE' | 'BICYCLE' | 'SCOOTER' | 'VAN' | 'TRUCK';
  make?: string;
  model?: string;
  year?: number;
  licensePlate?: string;
  capacity: number;
  isActive: boolean;
  assignedDriverId?: string;
  notes?: string;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Delivery Service - Handles delivery tracking and management
 */
export class DeliveryService extends BaseService {
  private messageBus: MessageBus;
  private deliveryModel: mongoose.Model<IDelivery>;
  private driverModel: mongoose.Model<IDriver>;
  private vehicleModel: mongoose.Model<IVehicle>;

  /**
   * Initialize the Delivery Service
   */
  constructor() {
    // Initialize base service with configuration
    super(
      'delivery-service',
      parseInt(process.env.PORT || '3005'),
      process.env.MONGO_URI || 'mongodb://localhost:27017/mayura-delivery',
      process.env.RABBITMQ_URI || 'amqp://localhost',
      process.env.REDIS_URI || 'redis://localhost:6379'
    );

    // Initialize message bus
    this.messageBus = new MessageBus(
      this.rabbitmqUri,
      this.serviceName,
      this.logger
    );

    // Define delivery schema
    const deliverySchema = new Schema<IDelivery>({
      deliveryId: { 
        type: String, 
        required: true, 
        unique: true 
      },
      orderId: { 
        type: String, 
        required: true,
        index: true
      },
      customerId: { 
        type: String,
        index: true
      },
      status: { 
        type: String, 
        required: true,
        enum: Object.values(DeliveryStatus),
        default: DeliveryStatus.PENDING,
        index: true
      },
      type: { 
        type: String, 
        required: true,
        enum: Object.values(DeliveryType),
        default: DeliveryType.STANDARD
      },
      driverId: { 
        type: String,
        index: true
      },
      vehicleId: { 
        type: String 
      },
      scheduledTime: { 
        type: Date 
      },
      pickupTime: { 
        type: Date 
      },
      deliveredTime: { 
        type: Date 
      },
      estimatedDeliveryTime: { 
        type: Date 
      },
      actualDeliveryTime: { 
        type: Date 
      },
      origin: {
        storeId: { 
          type: String, 
          required: true 
        },
        address: {
          street: { type: String, required: true },
          city: { type: String, required: true },
          state: { type: String, required: true },
          zip: { type: String, required: true },
          country: { type: String, required: true, default: 'US' },
          latitude: { type: Number },
          longitude: { type: Number }
        },
        contactName: { type: String },
        contactPhone: { type: String }
      },
      destination: {
        address: {
          street: { type: String, required: true },
          city: { type: String, required: true },
          state: { type: String, required: true },
          zip: { type: String, required: true },
          country: { type: String, required: true, default: 'US' },
          latitude: { type: Number },
          longitude: { type: Number }
        },
        contactName: { 
          type: String, 
          required: true 
        },
        contactPhone: { 
          type: String, 
          required: true 
        },
        notes: { type: String }
      },
      items: [{
        productId: { type: String, required: true },
        sku: { type: String, required: true },
        name: { type: String, required: true },
        quantity: { type: Number, required: true, min: 1 }
      }],
      route: {
        distance: { type: Number },
        duration: { type: Number },
        polyline: { type: String }
      },
      tracking: {
        trackingId: { type: String },
        trackingUrl: { type: String },
        currentLocation: {
          latitude: { type: Number },
          longitude: { type: Number },
          updatedAt: { type: Date }
        },
        checkpoints: [{
          status: { type: String, required: true },
          location: { type: String },
          timestamp: { type: Date, required: true },
          notes: { type: String }
        }]
      },
      proof: {
        signature: { type: String },
        photo: { type: String },
        notes: { type: String }
      },
      cancellationReason: { 
        type: String 
      },
      failureReason: { 
        type: String 
      },
      notes: { 
        type: String 
      },
      priority: { 
        type: Number, 
        required: true,
        default: 1,
        min: 1,
        max: 5
      }
    }, {
      timestamps: true
    });

    // Define driver schema
    const driverSchema = new Schema<IDriver>({
      driverId: { 
        type: String, 
        required: true, 
        unique: true 
      },
      userId: { 
        type: String,
        index: true
      },
      firstName: { 
        type: String, 
        required: true 
      },
      lastName: { 
        type: String, 
        required: true 
      },
      email: { 
        type: String, 
        required: true,
        match: [/^\S+@\S+\.\S+$/, 'Please enter a valid email']
      },
      phone: { 
        type: String, 
        required: true 
      },
      status: { 
        type: String, 
        required: true,
        enum: ['AVAILABLE', 'BUSY', 'OFFLINE'],
        default: 'OFFLINE',
        index: true
      },
      vehicleId: { 
        type: String 
      },
      currentLocation: {
        latitude: { type: Number },
        longitude: { type: Number },
        updatedAt: { type: Date }
      },
      totalDeliveries: { 
        type: Number, 
        required: true,
        default: 0,
        min: 0
      },
      rating: { 
        type: Number, 
        required: true,
        default: 5,
        min: 1,
        max: 5
      },
      activeDeliveryId: { 
        type: String 
      },
      isActive: { 
        type: Boolean, 
        required: true,
        default: true,
        index: true
      },
      notes: { 
        type: String 
      }
    }, {
      timestamps: true
    });

    // Define vehicle schema
    const vehicleSchema = new Schema<IVehicle>({
      vehicleId: { 
        type: String, 
        required: true, 
        unique: true 
      },
      type: { 
        type: String, 
        required: true,
        enum: ['CAR', 'MOTORCYCLE', 'BICYCLE', 'SCOOTER', 'VAN', 'TRUCK'],
        index: true
      },
      make: { 
        type: String 
      },
      model: { 
        type: String 
      },
      year: { 
        type: Number 
      },
      licensePlate: { 
        type: String 
      },
      capacity: { 
        type: Number, 
        required: true,
        default: 1,
        min: 1
      },
      isActive: { 
        type: Boolean, 
        required: true,
        default: true
      },
      assignedDriverId: { 
        type: String,
        index: true
      },
      notes: { 
        type: String 
      }
    }, {
      timestamps: true
    });

    // Create models
    this.deliveryModel = mongoose.model<IDelivery>('Delivery', deliverySchema);
    this.driverModel = mongoose.model<IDriver>('Driver', driverSchema);
    this.vehicleModel = mongoose.model<IVehicle>('Vehicle', vehicleSchema);
  }

  /**
   * Initialize routes for the Delivery service
   */
  protected async initRoutes(): Promise<void> {
    // Delivery routes
    this.app.post('/deliveries', this.authenticate.bind(this), this.createDelivery.bind(this));
    this.app.get('/deliveries/:id', this.authenticate.bind(this), this.getDelivery.bind(this));
    this.app.put('/deliveries/:id', this.authenticate.bind(this), this.updateDelivery.bind(this));
    this.app.get('/deliveries', this.authenticate.bind(this), this.getDeliveries.bind(this));
    this.app.get('/deliveries/order/:orderId', this.authenticate.bind(this), this.getDeliveryByOrder.bind(this));
    this.app.post('/deliveries/:id/assign', this.authenticate.bind(this), this.assignDelivery.bind(this));
    this.app.post('/deliveries/:id/start', this.authenticate.bind(this), this.startDelivery.bind(this));
    this.app.post('/deliveries/:id/complete', this.authenticate.bind(this), this.completeDelivery.bind(this));
    this.app.post('/deliveries/:id/cancel', this.authenticate.bind(this), this.cancelDelivery.bind(this));
    this.app.post('/deliveries/:id/track', this.authenticate.bind(this), this.updateTracking.bind(this));
    
    // Driver routes
    this.app.post('/drivers', this.authenticate.bind(this), this.createDriver.bind(this));
    this.app.get('/drivers/:id', this.authenticate.bind(this), this.getDriver.bind(this));
    this.app.put('/drivers/:id', this.authenticate.bind(this), this.updateDriver.bind(this));
    this.app.get('/drivers', this.authenticate.bind(this), this.getDrivers.bind(this));
    this.app.post('/drivers/:id/status', this.authenticate.bind(this), this.updateDriverStatus.bind(this));
    this.app.post('/drivers/:id/location', this.authenticate.bind(this), this.updateDriverLocation.bind(this));
    
    // Vehicle routes
    this.app.post('/vehicles', this.authenticate.bind(this), this.createVehicle.bind(this));
    this.app.get('/vehicles/:id', this.authenticate.bind(this), this.getVehicle.bind(this));
    this.app.put('/vehicles/:id', this.authenticate.bind(this), this.updateVehicle.bind(this));
    this.app.get('/vehicles', this.authenticate.bind(this), this.getVehicles.bind(this));
    this.app.post('/vehicles/:id/assign', this.authenticate.bind(this), this.assignVehicle.bind(this));
  }

  /**
   * Initialize message bus handlers
   */
  private async initMessageHandlers(): Promise<void> {
    await this.messageBus.connect();
    
    // Create exchanges
    await this.messageBus.createExchange('delivery', 'topic');
    
    // Create queues
    await this.messageBus.createQueue('delivery.order.events', 'order', 'order.#');
    
    // Listen for order events
    await this.messageBus.subscribe('delivery.order.events', async (content, msg) => {
      this.logger.info(`Received order event: ${msg.fields.routingKey}`, { content });
      
      // Handle specific events
      switch (msg.fields.routingKey) {
        case 'order.fulfilled':
          await this.handleOrderFulfilled(content);
          break;
        case 'order.cancelled':
          await this.handleOrderCancelled(content);
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
   * Create a new delivery
   */
  private async createDelivery(req: Request, res: Response): Promise<void> {
    try {
      const { 
        orderId, 
        customerId, 
        type = DeliveryType.STANDARD,
        scheduledTime,
        origin,
        destination,
        items,
        priority = 1,
        notes
      } = req.body;
      
      // Validate required fields
      if (!orderId || !origin || !origin.storeId || !origin.address || !destination || !destination.address) {
        res.status(400).json({ 
          message: 'Order ID, origin with store ID and address, and destination with address are required' 
        });
        return;
      }
      
      if (!destination.contactName || !destination.contactPhone) {
        res.status(400).json({ 
          message: 'Destination contact name and phone are required' 
        });
        return;
      }
      
      // Create delivery
      const deliveryId = uuidv4();
      const tracking = {
        trackingId: `TRK-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
        trackingUrl: `https://mayurapos.com/track/${deliveryId}`,
        checkpoints: [{
          status: 'CREATED',
          timestamp: new Date(),
          notes: 'Delivery created'
        }]
      };
      
      const delivery = new this.deliveryModel({
        deliveryId,
        orderId,
        customerId,
        status: DeliveryStatus.PENDING,
        type,
        scheduledTime,
        origin,
        destination,
        items,
        priority,
        notes,
        tracking
      });
      
      await delivery.save();
      
      // Publish delivery created event
      await this.messageBus.publish('delivery', 'delivery.created', {
        deliveryId,
        orderId,
        storeId: origin.storeId,
        status: delivery.status,
        type: delivery.type,
        trackingId: tracking.trackingId,
        timestamp: new Date().toISOString()
      });
      
      res.status(201).json({
        deliveryId: delivery.deliveryId,
        orderId: delivery.orderId,
        status: delivery.status,
        type: delivery.type,
        trackingId: tracking.trackingId,
        trackingUrl: tracking.trackingUrl,
        createdAt: delivery.createdAt
      });
    } catch (error: any) {
      this.logger.error(`Delivery creation error: ${error}`);
      res.status(500).json({ message: 'Failed to create delivery', error: error.message });
    }
  }

  /**
   * Get delivery by ID
   */
  private async getDelivery(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      
      const delivery = await this.deliveryModel.findOne({
        $or: [
          { deliveryId: id },
          { 'tracking.trackingId': id },
          { _id: mongoose.isValidObjectId(id) ? id : undefined }
        ]
      });
      
      if (!delivery) {
        res.status(404).json({ message: 'Delivery not found' });
        return;
      }
      
      // If delivery has a driver, get driver details
      let driver = null;
      if (delivery.driverId) {
        driver = await this.driverModel.findOne({ driverId: delivery.driverId });
      }
      
      res.status(200).json({
        deliveryId: delivery.deliveryId,
        orderId: delivery.orderId,
        customerId: delivery.customerId,
        status: delivery.status,
        type: delivery.type,
        scheduledTime: delivery.scheduledTime,
        pickupTime: delivery.pickupTime,
        deliveredTime: delivery.deliveredTime,
        estimatedDeliveryTime: delivery.estimatedDeliveryTime,
        actualDeliveryTime: delivery.actualDeliveryTime,
        origin: delivery.origin,
        destination: delivery.destination,
        items: delivery.items,
        driver: driver ? {
          driverId: driver.driverId,
          name: `${driver.firstName} ${driver.lastName}`,
          phone: driver.phone,
          currentLocation: driver.currentLocation
        } : null,
        tracking: delivery.tracking,
        route: delivery.route,
        proof: delivery.proof,
        notes: delivery.notes,
        createdAt: delivery.createdAt,
        updatedAt: delivery.updatedAt
      });
    } catch (error) {
      this.logger.error(`Get delivery error: ${error}`);
      res.status(500).json({ message: 'Failed to get delivery' });
    }
  }

  /**
   * Update a delivery
   */
  private async updateDelivery(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const { 
        scheduledTime,
        estimatedDeliveryTime,
        destination,
        items,
        priority,
        notes
      } = req.body;
      
      const delivery = await this.deliveryModel.findOne({
        $or: [
          { deliveryId: id },
          { _id: mongoose.isValidObjectId(id) ? id : undefined }
        ]
      });
      
      if (!delivery) {
        res.status(404).json({ message: 'Delivery not found' });
        return;
      }
      
      // Only allow updates if in PENDING status
      if (delivery.status !== DeliveryStatus.PENDING) {
        res.status(400).json({ 
          message: `Cannot update delivery in ${delivery.status} status` 
        });
        return;
      }
      
      // Update fields if provided
      if (scheduledTime !== undefined) delivery.scheduledTime = scheduledTime;
      if (estimatedDeliveryTime !== undefined) delivery.estimatedDeliveryTime = estimatedDeliveryTime;
      if (destination !== undefined) {
        // Only update fields that are provided
        if (destination.address) delivery.destination.address = {...delivery.destination.address, ...destination.address};
        if (destination.contactName) delivery.destination.contactName = destination.contactName;
        if (destination.contactPhone) delivery.destination.contactPhone = destination.contactPhone;
        if (destination.notes) delivery.destination.notes = destination.notes;
      }
      if (items !== undefined) delivery.items = items;
      if (priority !== undefined) delivery.priority = priority;
      if (notes !== undefined) delivery.notes = notes;
      
      // Add checkpoint for update
      if (!delivery.tracking) {
        delivery.tracking = {
          trackingId: `TRK-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
          trackingUrl: `https://mayurapos.com/track/${delivery.deliveryId}`,
          checkpoints: []
        };
      }
      
      delivery.tracking.checkpoints.push({
        status: 'UPDATED',
        timestamp: new Date(),
        notes: 'Delivery details updated'
      });
      
      await delivery.save();
      
      // Publish delivery updated event
      await this.messageBus.publish('delivery', 'delivery.updated', {
        deliveryId: delivery.deliveryId,
        orderId: delivery.orderId,
        status: delivery.status,
        timestamp: new Date().toISOString()
      });
      
      res.status(200).json({
        deliveryId: delivery.deliveryId,
        orderId: delivery.orderId,
        status: delivery.status,
        scheduledTime: delivery.scheduledTime,
        estimatedDeliveryTime: delivery.estimatedDeliveryTime,
        tracking: delivery.tracking,
        updatedAt: delivery.updatedAt
      });
    } catch (error) {
      this.logger.error(`Update delivery error: ${error}`);
      res.status(500).json({ message: 'Failed to update delivery' });
    }
  }

  /**
   * Get all deliveries with filtering options
   */
  private async getDeliveries(req: Request, res: Response): Promise<void> {
    try {
      const { 
        status, 
        storeId, 
        driverId, 
        customerId, 
        startDate, 
        endDate, 
        page = 1, 
        limit = 10 
      } = req.query;
      
      // Build query
      const query: any = {};
      
      if (status) query.status = status;
      if (storeId) query['origin.storeId'] = storeId;
      if (driverId) query.driverId = driverId;
      if (customerId) query.customerId = customerId;
      
      // Date range
      if (startDate || endDate) {
        query.createdAt = {};
        if (startDate) query.createdAt.$gte = new Date(startDate as string);
        if (endDate) query.createdAt.$lte = new Date(endDate as string);
      }
      
      // Parse pagination
      const skip = (parseInt(page as string) - 1) * parseInt(limit as string);
      
      // Get deliveries
      const deliveries = await this.deliveryModel
        .find(query)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(parseInt(limit as string));
      
      // Get total count
      const total = await this.deliveryModel.countDocuments(query);
      
      res.status(200).json({
        deliveries: deliveries.map(delivery => ({
          deliveryId: delivery.deliveryId,
          orderId: delivery.orderId,
          status: delivery.status,
          type: delivery.type,
          scheduledTime: delivery.scheduledTime,
          driverId: delivery.driverId,
          storeId: delivery.origin.storeId,
          destinationCity: delivery.destination.address.city,
          trackingId: delivery.tracking?.trackingId,
          createdAt: delivery.createdAt
        })),
        pagination: {
          page: parseInt(page as string),
          limit: parseInt(limit as string),
          total,
          pages: Math.ceil(total / parseInt(limit as string))
        }
      });
    } catch (error) {
      this.logger.error(`Get deliveries error: ${error}`);
      res.status(500).json({ message: 'Failed to get deliveries' });
    }
  }

  /**
   * Get delivery by order ID
   */
  private async getDeliveryByOrder(req: Request, res: Response): Promise<void> {
    try {
      const { orderId } = req.params;
      
      const delivery = await this.deliveryModel.findOne({ orderId });
      
      if (!delivery) {
        res.status(404).json({ message: 'Delivery not found for this order' });
        return;
      }
      
      // If delivery has a driver, get driver details
      let driver = null;
      if (delivery.driverId) {
        driver = await this.driverModel.findOne({ driverId: delivery.driverId });
      }
      
      res.status(200).json({
        deliveryId: delivery.deliveryId,
        orderId: delivery.orderId,
        status: delivery.status,
        type: delivery.type,
        scheduledTime: delivery.scheduledTime,
        pickupTime: delivery.pickupTime,
        deliveredTime: delivery.deliveredTime,
        estimatedDeliveryTime: delivery.estimatedDeliveryTime,
        actualDeliveryTime: delivery.actualDeliveryTime,
        origin: delivery.origin,
        destination: {
          address: delivery.destination.address,
          contactName: delivery.destination.contactName,
          contactPhone: delivery.destination.contactPhone
        },
        driver: driver ? {
          driverId: driver.driverId,
          name: `${driver.firstName} ${driver.lastName}`,
          phone: driver.phone,
          currentLocation: driver.currentLocation
        } : null,
        tracking: delivery.tracking,
        createdAt: delivery.createdAt
      });
    } catch (error) {
      this.logger.error(`Get delivery by order error: ${error}`);
      res.status(500).json({ message: 'Failed to get delivery' });
    }
  }

  /**
   * Assign a delivery to a driver
   */
  private async assignDelivery(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const { driverId, vehicleId, estimatedDeliveryTime } = req.body;
      
      if (!driverId) {
        res.status(400).json({ message: 'Driver ID is required' });
        return;
      }
      
      // Start a session for transaction
      const session = await mongoose.startSession();
      session.startTransaction();
      
      try {
        // Find delivery
        const delivery = await this.deliveryModel.findOne({
          $or: [
            { deliveryId: id },
            { _id: mongoose.isValidObjectId(id) ? id : undefined }
          ]
        }).session(session);
        
        if (!delivery) {
          await session.abortTransaction();
          session.endSession();
          res.status(404).json({ message: 'Delivery not found' });
          return;
        }
        
        // Only allow assignment if in PENDING status
        if (delivery.status !== DeliveryStatus.PENDING) {
          await session.abortTransaction();
          session.endSession();
          res.status(400).json({ 
            message: `Cannot assign delivery in ${delivery.status} status` 
          });
          return;
        }
        
        // Find driver
        const driver = await this.driverModel.findOne({ driverId }).session(session);
        
        if (!driver) {
          await session.abortTransaction();
          session.endSession();
          res.status(404).json({ message: 'Driver not found' });
          return;
        }
        
        // Check if driver is available
        if (driver.status === 'OFFLINE') {
          await session.abortTransaction();
          session.endSession();
          res.status(400).json({ message: 'Driver is offline' });
          return;
        }
        
        if (driver.status === 'BUSY' && driver.activeDeliveryId) {
          await session.abortTransaction();
          session.endSession();
          res.status(400).json({ 
            message: `Driver is busy with delivery ${driver.activeDeliveryId}` 
          });
          return;
        }
        
        // Update delivery with driver info
        delivery.driverId = driverId;
        
        if (vehicleId) {
          // Check if vehicle exists and is assigned to driver
          const vehicle = await this.vehicleModel.findOne({ vehicleId }).session(session);
          
          if (!vehicle) {
            await session.abortTransaction();
            session.endSession();
            res.status(404).json({ message: 'Vehicle not found' });
            return;
          }
          
          if (vehicle.assignedDriverId !== driverId) {
            await session.abortTransaction();
            session.endSession();
            res.status(400).json({ message: 'Vehicle is not assigned to this driver' });
            return;
          }
          
          delivery.vehicleId = vehicleId;
        }
        
        if (estimatedDeliveryTime) {
          delivery.estimatedDeliveryTime = new Date(estimatedDeliveryTime);
        }
        
        // Update status
        delivery.status = DeliveryStatus.ASSIGNED;
        
        // Add checkpoint
        if (!delivery.tracking) {
          delivery.tracking = {
            trackingId: `TRK-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
            trackingUrl: `https://mayurapos.com/track/${delivery.deliveryId}`,
            checkpoints: []
          };
        }
        
        delivery.tracking.checkpoints.push({
          status: 'ASSIGNED',
          timestamp: new Date(),
          notes: `Assigned to driver ${driver.firstName} ${driver.lastName}`
        });
        
        await delivery.save({ session });
        
        // Update driver status
        driver.status = 'BUSY';
        driver.activeDeliveryId = delivery.deliveryId;
        await driver.save({ session });
        
        // Commit transaction
        await session.commitTransaction();
        
        // Publish delivery assigned event
        await this.messageBus.publish('delivery', 'delivery.assigned', {
          deliveryId: delivery.deliveryId,
          orderId: delivery.orderId,
          driverId,
          driverName: `${driver.firstName} ${driver.lastName}`,
          status: delivery.status,
          estimatedDeliveryTime: delivery.estimatedDeliveryTime,
          timestamp: new Date().toISOString()
        });
        
        res.status(200).json({
          deliveryId: delivery.deliveryId,
          status: delivery.status,
          driverId: delivery.driverId,
          driverName: `${driver.firstName} ${driver.lastName}`,
          vehicleId: delivery.vehicleId,
          estimatedDeliveryTime: delivery.estimatedDeliveryTime,
          message: 'Delivery assigned successfully'
        });
      } catch (error) {
        // Abort transaction on error
        await session.abortTransaction();
        throw error;
      } finally {
        // End session
        session.endSession();
      }
    } catch (error) {
      this.logger.error(`Assign delivery error: ${error}`);
      res.status(500).json({ message: 'Failed to assign delivery' });
    }
  }

  /**
   * Start a delivery (driver has picked up the order)
   */
  private async startDelivery(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const { driverId, notes } = req.body;
      
      // Find delivery
      const delivery = await this.deliveryModel.findOne({
        $or: [
          { deliveryId: id },
          { _id: mongoose.isValidObjectId(id) ? id : undefined }
        ]
      });
      
      if (!delivery) {
        res.status(404).json({ message: 'Delivery not found' });
        return;
      }
      
      // Verify correct driver
      if (delivery.driverId !== driverId) {
        res.status(403).json({ message: 'This delivery is assigned to a different driver' });
        return;
      }
      
      // Only allow start if in ASSIGNED status
      if (delivery.status !== DeliveryStatus.ASSIGNED) {
        res.status(400).json({ 
          message: `Cannot start delivery in ${delivery.status} status` 
        });
        return;
      }
      
      // Update delivery status
      delivery.status = DeliveryStatus.PICKED_UP;
      delivery.pickupTime = new Date();
      
      // Add checkpoint
      if (!delivery.tracking) {
        delivery.tracking = {
          trackingId: `TRK-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
          trackingUrl: `https://mayurapos.com/track/${delivery.deliveryId}`,
          checkpoints: []
        };
      }
      
      delivery.tracking.checkpoints.push({
        status: 'PICKED_UP',
        timestamp: new Date(),
        notes: notes || 'Order picked up by driver'
      });
      
      await delivery.save();
      
      // Publish delivery started event
      await this.messageBus.publish('delivery', 'delivery.started', {
        deliveryId: delivery.deliveryId,
        orderId: delivery.orderId,
        driverId: delivery.driverId,
        status: delivery.status,
        pickupTime: delivery.pickupTime,
        timestamp: new Date().toISOString()
      });
      
      res.status(200).json({
        deliveryId: delivery.deliveryId,
        status: delivery.status,
        pickupTime: delivery.pickupTime,
        message: 'Delivery started successfully'
      });
    } catch (error) {
      this.logger.error(`Start delivery error: ${error}`);
      res.status(500).json({ message: 'Failed to start delivery' });
    }
  }

  /**
   * Complete a delivery
   */
  private async completeDelivery(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const { 
        driverId, 
        proof, 
        notes 
      } = req.body;
      
      // Start a session for transaction
      const session = await mongoose.startSession();
      session.startTransaction();
      
      try {
        // Find delivery
        const delivery = await this.deliveryModel.findOne({
          $or: [
            { deliveryId: id },
            { _id: mongoose.isValidObjectId(id) ? id : undefined }
          ]
        }).session(session);
        
        if (!delivery) {
          await session.abortTransaction();
          session.endSession();
          res.status(404).json({ message: 'Delivery not found' });
          return;
        }
        
        // Verify correct driver
        if (delivery.driverId !== driverId) {
          await session.abortTransaction();
          session.endSession();
          res.status(403).json({ message: 'This delivery is assigned to a different driver' });
          return;
        }
        
        // Only allow completion if in PICKED_UP or IN_TRANSIT status
        if (delivery.status !== DeliveryStatus.PICKED_UP && delivery.status !== DeliveryStatus.IN_TRANSIT) {
          await session.abortTransaction();
          session.endSession();
          res.status(400).json({ 
            message: `Cannot complete delivery in ${delivery.status} status` 
          });
          return;
        }
        
        // Update delivery status
        delivery.status = DeliveryStatus.DELIVERED;
        delivery.actualDeliveryTime = new Date();
        
        // Add proof of delivery if provided
        if (proof) {
          delivery.proof = proof;
        }
        
        // Add completion notes
        if (notes) {
          delivery.notes = (delivery.notes || '') + `\nCompletion: ${notes}`;
        }
        
        // Add checkpoint
        if (!delivery.tracking) {
          delivery.tracking = {
            trackingId: `TRK-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
            trackingUrl: `https://mayurapos.com/track/${delivery.deliveryId}`,
            checkpoints: []
          };
        }
        
        delivery.tracking.checkpoints.push({
          status: 'DELIVERED',
          timestamp: new Date(),
          notes: notes || 'Order delivered successfully'
        });
        
        await delivery.save({ session });
        
        // Update driver status
        const driver = await this.driverModel.findOne({ driverId }).session(session);
        
        if (driver) {
          driver.status = 'AVAILABLE';
          driver.activeDeliveryId = undefined;
          driver.totalDeliveries += 1;
          await driver.save({ session });
        }
        
        // Commit transaction
        await session.commitTransaction();
        
        // Publish delivery completed event
        await this.messageBus.publish('delivery', 'delivery.completed', {
          deliveryId: delivery.deliveryId,
          orderId: delivery.orderId,
          driverId: delivery.driverId,
          status: delivery.status,
          actualDeliveryTime: delivery.actualDeliveryTime,
          timestamp: new Date().toISOString()
        });
        
        res.status(200).json({
          deliveryId: delivery.deliveryId,
          status: delivery.status,
          actualDeliveryTime: delivery.actualDeliveryTime,
          message: 'Delivery completed successfully'
        });
      } catch (error) {
        // Abort transaction on error
        await session.abortTransaction();
        throw error;
      } finally {
        // End session
        session.endSession();
      }
    } catch (error) {
      this.logger.error(`Complete delivery error: ${error}`);
      res.status(500).json({ message: 'Failed to complete delivery' });
    }
  }

  /**
   * Cancel a delivery
   */
  private async cancelDelivery(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const { reason } = req.body;
      
      // Start a session for transaction
      const session = await mongoose.startSession();
      session.startTransaction();
      
      try {
        // Find delivery
        const delivery = await this.deliveryModel.findOne({
          $or: [
            { deliveryId: id },
            { _id: mongoose.isValidObjectId(id) ? id : undefined }
          ]
        }).session(session);
        
        if (!delivery) {
          await session.abortTransaction();
          session.endSession();
          res.status(404).json({ message: 'Delivery not found' });
          return;
        }
        
        // Only allow cancellation in certain statuses
        const validStatuses = [
          DeliveryStatus.PENDING,
          DeliveryStatus.ASSIGNED,
          DeliveryStatus.PICKED_UP,
          DeliveryStatus.IN_TRANSIT
        ];
        
        if (!validStatuses.includes(delivery.status as DeliveryStatus)) {
          await session.abortTransaction();
          session.endSession();
          res.status(400).json({ 
            message: `Cannot cancel delivery in ${delivery.status} status` 
          });
          return;
        }
        
        // Update delivery status
        delivery.status = DeliveryStatus.CANCELLED;
        delivery.cancellationReason = reason || 'No reason provided';
        
        // Add checkpoint
        if (!delivery.tracking) {
          delivery.tracking = {
            trackingId: `TRK-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
            trackingUrl: `https://mayurapos.com/track/${delivery.deliveryId}`,
            checkpoints: []
          };
        }
        
        delivery.tracking.checkpoints.push({
          status: 'CANCELLED',
          timestamp: new Date(),
          notes: `Cancelled: ${delivery.cancellationReason}`
        });
        
        await delivery.save({ session });
        
        // If delivery was assigned to a driver, update driver status
        if (delivery.driverId) {
          const driver = await this.driverModel.findOne({ driverId: delivery.driverId }).session(session);
          
          if (driver && driver.activeDeliveryId === delivery.deliveryId) {
            driver.status = 'AVAILABLE';
            driver.activeDeliveryId = undefined;
            await driver.save({ session });
          }
        }
        
        // Commit transaction
        await session.commitTransaction();
        
        // Publish delivery cancelled event
        await this.messageBus.publish('delivery', 'delivery.cancelled', {
          deliveryId: delivery.deliveryId,
          orderId: delivery.orderId,
          driverId: delivery.driverId,
          status: delivery.status,
          reason: delivery.cancellationReason,
          timestamp: new Date().toISOString()
        });
        
        res.status(200).json({
          deliveryId: delivery.deliveryId,
          status: delivery.status,
          reason: delivery.cancellationReason,
          message: 'Delivery cancelled successfully'
        });
      } catch (error) {
        // Abort transaction on error
        await session.abortTransaction();
        throw error;
      } finally {
        // End session
        session.endSession();
      }
    } catch (error) {
      this.logger.error(`Cancel delivery error: ${error}`);
      res.status(500).json({ message: 'Failed to cancel delivery' });
    }
  }

  /**
   * Update delivery tracking information
   */
  private async updateTracking(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const { 
        driverId, 
        location, 
        status, 
        checkpoint 
      } = req.body;
      
      // Find delivery
      const delivery = await this.deliveryModel.findOne({
        $or: [
          { deliveryId: id },
          { _id: mongoose.isValidObjectId(id) ? id : undefined }
        ]
      });
      
      if (!delivery) {
        res.status(404).json({ message: 'Delivery not found' });
        return;
      }
      
      // Verify correct driver if provided
      if (driverId && delivery.driverId !== driverId) {
        res.status(403).json({ message: 'This delivery is assigned to a different driver' });
        return;
      }
      
      // Only allow tracking updates for active deliveries
      if (delivery.status === DeliveryStatus.CANCELLED || 
          delivery.status === DeliveryStatus.DELIVERED ||
          delivery.status === DeliveryStatus.FAILED) {
        res.status(400).json({ 
          message: `Cannot update tracking for delivery in ${delivery.status} status` 
        });
        return;
      }
      
      // Initialize tracking if not already present
      if (!delivery.tracking) {
        delivery.tracking = {
          trackingId: `TRK-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
          trackingUrl: `https://mayurapos.com/track/${delivery.deliveryId}`,
          checkpoints: []
        };
      }
      
      // Update current location if provided
      if (location) {
        delivery.tracking.currentLocation = {
          latitude: location.latitude,
          longitude: location.longitude,
          updatedAt: new Date()
        };
        
        // Also update driver's location
        if (driverId) {
          await this.driverModel.updateOne(
            { driverId },
            { 
              currentLocation: {
                latitude: location.latitude,
                longitude: location.longitude,
                updatedAt: new Date()
              }
            }
          );
        }
      }
      
      // Update status if provided (transitioning to IN_TRANSIT)
      if (status === 'IN_TRANSIT' && delivery.status === DeliveryStatus.PICKED_UP) {
        delivery.status = DeliveryStatus.IN_TRANSIT;
      }
      
      // Add checkpoint if provided
      if (checkpoint) {
        delivery.tracking.checkpoints.push({
          status: checkpoint.status || 'UPDATE',
          location: checkpoint.location,
          timestamp: new Date(),
          notes: checkpoint.notes || 'Tracking update'
        });
      }
      
      await delivery.save();
      
      // Publish tracking update event
      await this.messageBus.publish('delivery', 'delivery.tracking.updated', {
        deliveryId: delivery.deliveryId,
        orderId: delivery.orderId,
        status: delivery.status,
        location: delivery.tracking.currentLocation,
        timestamp: new Date().toISOString()
      });
      
      res.status(200).json({
        deliveryId: delivery.deliveryId,
        status: delivery.status,
        tracking: {
          currentLocation: delivery.tracking.currentLocation,
          lastCheckpoint: delivery.tracking.checkpoints[delivery.tracking.checkpoints.length - 1]
        },
        message: 'Tracking updated successfully'
      });
    } catch (error) {
      this.logger.error(`Update tracking error: ${error}`);
      res.status(500).json({ message: 'Failed to update tracking' });
    }
  }

  /**
   * Create a new driver
   */
  private async createDriver(req: Request, res: Response): Promise<void> {
    try {
      const { 
        userId, 
        firstName, 
        lastName, 
        email, 
        phone, 
        notes 
      } = req.body;
      
      // Validate required fields
      if (!firstName || !lastName || !email || !phone) {
        res.status(400).json({ message: 'First name, last name, email, and phone are required' });
        return;
      }
      
      // Check if driver with email already exists
      const existingDriver = await this.driverModel.findOne({ email });
      
      if (existingDriver) {
        res.status(409).json({ message: `Driver with email ${email} already exists` });
        return;
      }
      
      // Create driver
      const driverId = uuidv4();
      const driver = new this.driverModel({
        driverId,
        userId,
        firstName,
        lastName,
        email,
        phone,
        status: 'OFFLINE',
        totalDeliveries: 0,
        rating: 5,
        isActive: true,
        notes
      });
      
      await driver.save();
      
      res.status(201).json({
        driverId: driver.driverId,
        name: `${driver.firstName} ${driver.lastName}`,
        email: driver.email,
        phone: driver.phone,
        status: driver.status,
        isActive: driver.isActive,
        createdAt: driver.createdAt
      });
    } catch (error: any) {
      this.logger.error(`Driver creation error: ${error}`);
      res.status(500).json({ message: 'Failed to create driver', error: error.message });
    }
  }

  /**
   * Get driver by ID
   */
  private async getDriver(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      
      const driver = await this.driverModel.findOne({
        $or: [
          { driverId: id },
          { userId: id },
          { _id: mongoose.isValidObjectId(id) ? id : undefined }
        ]
      });
      
      if (!driver) {
        res.status(404).json({ message: 'Driver not found' });
        return;
      }
      
      // Get driver's active delivery if any
      let activeDelivery = null;
      if (driver.activeDeliveryId) {
        activeDelivery = await this.deliveryModel.findOne({ deliveryId: driver.activeDeliveryId });
      }
      
      // Get driver's vehicle if any
      let vehicle = null;
      if (driver.vehicleId) {
        vehicle = await this.vehicleModel.findOne({ vehicleId: driver.vehicleId });
      }
      
      res.status(200).json({
        driverId: driver.driverId,
        userId: driver.userId,
        firstName: driver.firstName,
        lastName: driver.lastName,
        email: driver.email,
        phone: driver.phone,
        status: driver.status,
        currentLocation: driver.currentLocation,
        totalDeliveries: driver.totalDeliveries,
        rating: driver.rating,
        activeDelivery: activeDelivery ? {
          deliveryId: activeDelivery.deliveryId,
          orderId: activeDelivery.orderId,
          status: activeDelivery.status,
          pickupTime: activeDelivery.pickupTime,
          destination: {
            city: activeDelivery.destination.address.city,
            state: activeDelivery.destination.address.state
          }
        } : null,
        vehicle: vehicle ? {
          vehicleId: vehicle.vehicleId,
          type: vehicle.type,
          make: vehicle.make,
          model: vehicle.model,
          licensePlate: vehicle.licensePlate
        } : null,
        isActive: driver.isActive,
        notes: driver.notes,
        createdAt: driver.createdAt,
        updatedAt: driver.updatedAt
      });
    } catch (error) {
      this.logger.error(`Get driver error: ${error}`);
      res.status(500).json({ message: 'Failed to get driver' });
    }
  }

  /**
   * Update a driver
   */
  private async updateDriver(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const { 
        firstName, 
        lastName, 
        email, 
        phone, 
        isActive, 
        notes 
      } = req.body;
      
      const driver = await this.driverModel.findOne({
        $or: [
          { driverId: id },
          { _id: mongoose.isValidObjectId(id) ? id : undefined }
        ]
      });
      
      if (!driver) {
        res.status(404).json({ message: 'Driver not found' });
        return;
      }
      
      // Update fields if provided
      if (firstName !== undefined) driver.firstName = firstName;
      if (lastName !== undefined) driver.lastName = lastName;
      if (email !== undefined) driver.email = email;
      if (phone !== undefined) driver.phone = phone;
      if (isActive !== undefined) driver.isActive = isActive;
      if (notes !== undefined) driver.notes = notes;
      
      await driver.save();
      
      res.status(200).json({
        driverId: driver.driverId,
        firstName: driver.firstName,
        lastName: driver.lastName,
        email: driver.email,
        phone: driver.phone,
        status: driver.status,
        isActive: driver.isActive,
        updatedAt: driver.updatedAt
      });
    } catch (error) {
      this.logger.error(`Update driver error: ${error}`);
      res.status(500).json({ message: 'Failed to update driver' });
    }
  }

  /**
   * Get all drivers with filtering options
   */
  private async getDrivers(req: Request, res: Response): Promise<void> {
    try {
      const { 
        status, 
        isActive, 
        page = 1, 
        limit = 10 
      } = req.query;
      
      // Build query
      const query: any = {};
      
      if (status) query.status = status;
      if (isActive !== undefined) query.isActive = isActive === 'true';
      
      // Parse pagination
      const skip = (parseInt(page as string) - 1) * parseInt(limit as string);
      
      // Get drivers
      const drivers = await this.driverModel
        .find(query)
        .sort({ firstName: 1, lastName: 1 })
        .skip(skip)
        .limit(parseInt(limit as string));
      
      // Get total count
      const total = await this.driverModel.countDocuments(query);
      
      res.status(200).json({
        drivers: drivers.map(driver => ({
          driverId: driver.driverId,
          name: `${driver.firstName} ${driver.lastName}`,
          email: driver.email,
          phone: driver.phone,
          status: driver.status,
          totalDeliveries: driver.totalDeliveries,
          rating: driver.rating,
          isActive: driver.isActive,
          activeDeliveryId: driver.activeDeliveryId
        })),
        pagination: {
          page: parseInt(page as string),
          limit: parseInt(limit as string),
          total,
          pages: Math.ceil(total / parseInt(limit as string))
        }
      });
    } catch (error) {
      this.logger.error(`Get drivers error: ${error}`);
      res.status(500).json({ message: 'Failed to get drivers' });
    }
  }

  /**
   * Update driver status
   */
  private async updateDriverStatus(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const { status } = req.body;
      
      if (!status || !['AVAILABLE', 'BUSY', 'OFFLINE'].includes(status)) {
        res.status(400).json({ 
          message: 'Valid status (AVAILABLE, BUSY, OFFLINE) is required' 
        });
        return;
      }
      
      const driver = await this.driverModel.findOne({
        $or: [
          { driverId: id },
          { _id: mongoose.isValidObjectId(id) ? id : undefined }
        ]
      });
      
      if (!driver) {
        res.status(404).json({ message: 'Driver not found' });
        return;
      }
      
      // If going offline while having an active delivery, reject
      if (status === 'OFFLINE' && driver.activeDeliveryId) {
        res.status(400).json({ 
          message: `Cannot go offline while having active delivery: ${driver.activeDeliveryId}` 
        });
        return;
      }
      
      // Update status
      driver.status = status;
      
      if (status === 'OFFLINE') {
        driver.activeDeliveryId = undefined;
      }
      
      await driver.save();
      
      res.status(200).json({
        driverId: driver.driverId,
        name: `${driver.firstName} ${driver.lastName}`,
        status: driver.status,
        updatedAt: driver.updatedAt,
        message: `Driver status updated to ${status}`
      });
    } catch (error) {
      this.logger.error(`Update driver status error: ${error}`);
      res.status(500).json({ message: 'Failed to update driver status' });
    }
  }

  /**
   * Update driver location
   */
  private async updateDriverLocation(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const { latitude, longitude } = req.body;
      
      if (latitude === undefined || longitude === undefined) {
        res.status(400).json({ message: 'Latitude and longitude are required' });
        return;
      }
      
      const driver = await this.driverModel.findOne({
        $or: [
          { driverId: id },
          { _id: mongoose.isValidObjectId(id) ? id : undefined }
        ]
      });
      
      if (!driver) {
        res.status(404).json({ message: 'Driver not found' });
        return;
      }
      
      // Update location
      driver.currentLocation = {
        latitude,
        longitude,
        updatedAt: new Date()
      };
      
      await driver.save();
      
      // If driver has an active delivery, update its tracking location too
      if (driver.activeDeliveryId) {
        const delivery = await this.deliveryModel.findOne({ 
          deliveryId: driver.activeDeliveryId 
        });
        
        if (delivery) {
          if (!delivery.tracking) {
            delivery.tracking = {
              trackingId: `TRK-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
              trackingUrl: `https://mayurapos.com/track/${delivery.deliveryId}`,
              checkpoints: []
            };
          }
          
          delivery.tracking.currentLocation = {
            latitude,
            longitude,
            updatedAt: new Date()
          };
          
          await delivery.save();
          
          // Publish tracking update event
          await this.messageBus.publish('delivery', 'delivery.tracking.updated', {
            deliveryId: delivery.deliveryId,
            orderId: delivery.orderId,
            status: delivery.status,
            location: delivery.tracking.currentLocation,
            timestamp: new Date().toISOString()
          });
        }
      }
      
      res.status(200).json({
        driverId: driver.driverId,
        name: `${driver.firstName} ${driver.lastName}`,
        currentLocation: driver.currentLocation,
        activeDeliveryId: driver.activeDeliveryId,
        message: 'Driver location updated'
      });
    } catch (error) {
      this.logger.error(`Update driver location error: ${error}`);
      res.status(500).json({ message: 'Failed to update driver location' });
    }
  }

  /**
   * Create a new vehicle
   */
  private async createVehicle(req: Request, res: Response): Promise<void> {
    try {
      const { 
        type, 
        make, 
        model, 
        year, 
        licensePlate, 
        capacity = 1, 
        notes 
      } = req.body;
      
      // Validate required fields
      if (!type) {
        res.status(400).json({ 
          message: 'Vehicle type is required' 
        });
        return;
      }
      
      if (!['CAR', 'MOTORCYCLE', 'BICYCLE', 'SCOOTER', 'VAN', 'TRUCK'].includes(type)) {
        res.status(400).json({ 
          message: 'Invalid vehicle type. Must be one of: CAR, MOTORCYCLE, BICYCLE, SCOOTER, VAN, TRUCK' 
        });
        return;
      }
      
      // Create vehicle
      const vehicleId = uuidv4();
      const vehicle = new this.vehicleModel({
        vehicleId,
        type,
        make,
        model,
        year,
        licensePlate,
        capacity,
        isActive: true,
        notes
      });
      
      await vehicle.save();
      
      res.status(201).json({
        vehicleId: vehicle.vehicleId,
        type: vehicle.type,
        make: vehicle.make,
        model: vehicle.model,
        licensePlate: vehicle.licensePlate,
        capacity: vehicle.capacity,
        isActive: vehicle.isActive,
        createdAt: vehicle.createdAt
      });
    } catch (error: any) {
      this.logger.error(`Vehicle creation error: ${error}`);
      res.status(500).json({ message: 'Failed to create vehicle', error: error.message });
    }
  }

  /**
   * Get vehicle by ID
   */
  private async getVehicle(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      
      const vehicle = await this.vehicleModel.findOne({
        $or: [
          { vehicleId: id },
          { _id: mongoose.isValidObjectId(id) ? id : undefined }
        ]
      });
      
      if (!vehicle) {
        res.status(404).json({ message: 'Vehicle not found' });
        return;
      }
      
      // Get assigned driver if any
      let driver = null;
      if (vehicle.assignedDriverId) {
        driver = await this.driverModel.findOne({ driverId: vehicle.assignedDriverId });
      }
      
      res.status(200).json({
        vehicleId: vehicle.vehicleId,
        type: vehicle.type,
        make: vehicle.make,
        model: vehicle.model,
        year: vehicle.year,
        licensePlate: vehicle.licensePlate,
        capacity: vehicle.capacity,
        assignedDriver: driver ? {
          driverId: driver.driverId,
          name: `${driver.firstName} ${driver.lastName}`,
          status: driver.status
        } : null,
        isActive: vehicle.isActive,
        notes: vehicle.notes,
        createdAt: vehicle.createdAt,
        updatedAt: vehicle.updatedAt
      });
    } catch (error) {
      this.logger.error(`Get vehicle error: ${error}`);
      res.status(500).json({ message: 'Failed to get vehicle' });
    }
  }

  /**
   * Update a vehicle
   */
  private async updateVehicle(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const { 
        make, 
        model, 
        year, 
        licensePlate, 
        capacity, 
        isActive, 
        notes 
      } = req.body;
      
      const vehicle = await this.vehicleModel.findOne({
        $or: [
          { vehicleId: id },
          { _id: mongoose.isValidObjectId(id) ? id : undefined }
        ]
      });
      
      if (!vehicle) {
        res.status(404).json({ message: 'Vehicle not found' });
        return;
      }
      
      // Update fields if provided
      if (make !== undefined) vehicle.make = make;
      if (model !== undefined) vehicle.model = model;
      if (year !== undefined) vehicle.year = year;
      if (licensePlate !== undefined) vehicle.licensePlate = licensePlate;
      if (capacity !== undefined) vehicle.capacity = capacity;
      if (isActive !== undefined) vehicle.isActive = isActive;
      if (notes !== undefined) vehicle.notes = notes;
      
      await vehicle.save();
      
      res.status(200).json({
        vehicleId: vehicle.vehicleId,
        type: vehicle.type,
        make: vehicle.make,
        model: vehicle.model,
        licensePlate: vehicle.licensePlate,
        capacity: vehicle.capacity,
        assignedDriverId: vehicle.assignedDriverId,
        isActive: vehicle.isActive,
        updatedAt: vehicle.updatedAt
      });
    } catch (error) {
      this.logger.error(`Update vehicle error: ${error}`);
      res.status(500).json({ message: 'Failed to update vehicle' });
    }
  }

  /**
   * Get all vehicles with filtering options
   */
  private async getVehicles(req: Request, res: Response): Promise<void> {
    try {
      const { 
        type, 
        isActive, 
        page = 1, 
        limit = 10 
      } = req.query;
      
      // Build query
      const query: any = {};
      
      if (type) query.type = type;
      if (isActive !== undefined) query.isActive = isActive === 'true';
      
      // Parse pagination
      const skip = (parseInt(page as string) - 1) * parseInt(limit as string);
      
      // Get vehicles
      const vehicles = await this.vehicleModel
        .find(query)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(parseInt(limit as string));
      
      // Get total count
      const total = await this.vehicleModel.countDocuments(query);
      
      // Get driver info for each vehicle
      const driverIds = vehicles
        .filter(v => v.assignedDriverId)
        .map(v => v.assignedDriverId as string);
      
      const drivers = await this.driverModel.find({
        driverId: { $in: driverIds }
      });
      
      // Create driver ID to driver map
      const driverMap = drivers.reduce((map, driver) => {
        map[driver.driverId] = driver;
        return map;
      }, {} as Record<string, IDriver>);
      
      res.status(200).json({
        vehicles: vehicles.map(vehicle => ({
          vehicleId: vehicle.vehicleId,
          type: vehicle.type,
          make: vehicle.make,
          model: vehicle.model,
          licensePlate: vehicle.licensePlate,
          capacity: vehicle.capacity,
          driver: vehicle.assignedDriverId ? {
            driverId: vehicle.assignedDriverId,
            name: driverMap[vehicle.assignedDriverId] ? 
              `${driverMap[vehicle.assignedDriverId].firstName} ${driverMap[vehicle.assignedDriverId].lastName}` : 
              'Unknown Driver',
            status: driverMap[vehicle.assignedDriverId]?.status
          } : null,
          isActive: vehicle.isActive
        })),
        pagination: {
          page: parseInt(page as string),
          limit: parseInt(limit as string),
          total,
          pages: Math.ceil(total / parseInt(limit as string))
        }
      });
    } catch (error) {
      this.logger.error(`Get vehicles error: ${error}`);
      res.status(500).json({ message: 'Failed to get vehicles' });
    }
  }

  /**
   * Assign a vehicle to a driver
   */
  private async assignVehicle(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const { driverId } = req.body;
      
      if (!driverId) {
        res.status(400).json({ message: 'Driver ID is required' });
        return;
      }
      
      // Start a session for transaction
      const session = await mongoose.startSession();
      session.startTransaction();
      
      try {
        // Find vehicle
        const vehicle = await this.vehicleModel.findOne({
          $or: [
            { vehicleId: id },
            { _id: mongoose.isValidObjectId(id) ? id : undefined }
          ]
        }).session(session);
        
        if (!vehicle) {
          await session.abortTransaction();
          session.endSession();
          res.status(404).json({ message: 'Vehicle not found' });
          return;
        }
        
        // Check if vehicle is already assigned
        if (vehicle.assignedDriverId && vehicle.assignedDriverId !== driverId) {
          await session.abortTransaction();
          session.endSession();
          res.status(400).json({ 
            message: `Vehicle is already assigned to driver ${vehicle.assignedDriverId}` 
          });
          return;
        }
        
        // Find driver
        const driver = await this.driverModel.findOne({ driverId }).session(session);
        
        if (!driver) {
          await session.abortTransaction();
          session.endSession();
          res.status(404).json({ message: 'Driver not found' });
          return;
        }
        
        // Check if driver is active
        if (!driver.isActive) {
          await session.abortTransaction();
          session.endSession();
          res.status(400).json({ message: 'Driver is not active' });
          return;
        }
        
        // Check if driver already has a vehicle
        if (driver.vehicleId && driver.vehicleId !== id) {
          // Unassign previous vehicle
          await this.vehicleModel.updateOne(
            { vehicleId: driver.vehicleId },
            { assignedDriverId: null }
          ).session(session);
        }
        
        // Update vehicle
        vehicle.assignedDriverId = driverId;
        await vehicle.save({ session });
        
        // Update driver
        driver.vehicleId = vehicle.vehicleId;
        await driver.save({ session });
        
        // Commit transaction
        await session.commitTransaction();
        
        res.status(200).json({
          vehicleId: vehicle.vehicleId,
          type: vehicle.type,
          make: vehicle.make,
          model: vehicle.model,
          licensePlate: vehicle.licensePlate,
          driver: {
            driverId: driver.driverId,
            name: `${driver.firstName} ${driver.lastName}`
          },
          message: 'Vehicle assigned successfully'
        });
      } catch (error) {
        // Abort transaction on error
        await session.abortTransaction();
        throw error;
      } finally {
        // End session
        session.endSession();
      }
    } catch (error) {
      this.logger.error(`Assign vehicle error: ${error}`);
      res.status(500).json({ message: 'Failed to assign vehicle' });
    }
  }

  /**
   * Handle order fulfilled event
   */
  private async handleOrderFulfilled(content: any): Promise<void> {
    try {
      const { orderId, customerId, shippingAddress } = content;
      
      if (!orderId) {
        this.logger.error('Invalid order fulfilled event data');
        return;
      }
      
      // Check if delivery already exists for this order
      const existingDelivery = await this.deliveryModel.findOne({ orderId });
      
      if (existingDelivery) {
        this.logger.info(`Delivery already exists for order ${orderId}`);
        return;
      }
      
      // Get order details from content
      // In a real implementation, we might call the Order Service for more details
      const storeId = content.storeId || 'store_default';
      const orderItems = content.items || [];
      
      // Default origin address (would come from Store Service in reality)
      const defaultOrigin = {
        storeId,
        address: {
          street: '123 Main St',
          city: 'Anytown',
          state: 'CA',
          zip: '12345',
          country: 'US'
        },
        contactName: 'Store Manager',
        contactPhone: '555-123-4567'
      };
      
      // Create delivery if shipping address is available
      if (shippingAddress) {
        try {
          const deliveryId = uuidv4();
          const tracking = {
            trackingId: `TRK-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
            trackingUrl: `https://mayurapos.com/track/${deliveryId}`,
            checkpoints: [{
              status: 'CREATED',
              timestamp: new Date(),
              notes: 'Delivery automatically created from fulfilled order'
            }]
          };
          
          const delivery = new this.deliveryModel({
            deliveryId,
            orderId,
            customerId,
            status: DeliveryStatus.PENDING,
            type: DeliveryType.STANDARD,
            origin: defaultOrigin,
            destination: {
              address: shippingAddress,
              contactName: shippingAddress.contactName || 'Customer',
              contactPhone: shippingAddress.contactPhone || 'N/A'
            },
            items: orderItems.map((item: any) => ({
              productId: item.productId,
              sku: item.sku || 'N/A',
              name: item.name || 'Product',
              quantity: item.quantity || 1
            })),
            priority: 1,
            tracking
          });
          
          await delivery.save();
          
          // Publish delivery created event
          await this.messageBus.publish('delivery', 'delivery.created', {
            deliveryId,
            orderId,
            storeId,
            status: delivery.status,
            type: delivery.type,
            trackingId: tracking.trackingId,
            timestamp: new Date().toISOString()
          });
          
          this.logger.info(`Created delivery ${deliveryId} for fulfilled order ${orderId}`);
        } catch (error) {
          this.logger.error(`Error creating delivery for fulfilled order ${orderId}: ${error}`);
        }
      } else {
        this.logger.info(`No shipping address provided for order ${orderId}, skipping delivery creation`);
      }
    } catch (error) {
      this.logger.error(`Handle order fulfilled error: ${error}`);
    }
  }

  /**
   * Handle order cancelled event
   */
  private async handleOrderCancelled(content: any): Promise<void> {
    try {
      const { orderId, reason } = content;
      
      if (!orderId) {
        this.logger.error('Invalid order cancelled event data');
        return;
      }
      
      // Find delivery for this order
      const delivery = await this.deliveryModel.findOne({ orderId });
      
      if (!delivery) {
        this.logger.info(`No delivery found for cancelled order ${orderId}`);
        return;
      }
      
      // Only cancel delivery if it's in a cancellable state
      const validStatuses = [
        DeliveryStatus.PENDING,
        DeliveryStatus.ASSIGNED
      ];
      
      if (!validStatuses.includes(delivery.status as DeliveryStatus)) {
        this.logger.info(`Cannot cancel delivery for order ${orderId} in status ${delivery.status}`);
        return;
      }
      
      // Update delivery status
      delivery.status = DeliveryStatus.CANCELLED;
      delivery.cancellationReason = reason || 'Order cancelled';
      
      // Add checkpoint
      if (!delivery.tracking) {
        delivery.tracking = {
          trackingId: `TRK-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
          trackingUrl: `https://mayurapos.com/track/${delivery.deliveryId}`,
          checkpoints: []
        };
      }
      
      delivery.tracking.checkpoints.push({
        status: 'CANCELLED',
        timestamp: new Date(),
        notes: `Cancelled due to order cancellation: ${delivery.cancellationReason}`
      });
      
      await delivery.save();
      
      // If delivery was assigned to a driver, update driver status
      if (delivery.driverId) {
        const driver = await this.driverModel.findOne({ driverId: delivery.driverId });
        
        if (driver && driver.activeDeliveryId === delivery.deliveryId) {
          driver.status = 'AVAILABLE';
          driver.activeDeliveryId = undefined;
          await driver.save();
        }
      }
      
      // Publish delivery cancelled event
      await this.messageBus.publish('delivery', 'delivery.cancelled', {
        deliveryId: delivery.deliveryId,
        orderId,
        reason: delivery.cancellationReason,
        timestamp: new Date().toISOString()
      });
      
      this.logger.info(`Cancelled delivery ${delivery.deliveryId} due to order ${orderId} cancellation`);
    } catch (error) {
      this.logger.error(`Handle order cancelled error: ${error}`);
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
  const deliveryService = new DeliveryService();
  deliveryService.start().catch(error => {
    console.error('Failed to start Delivery Service:', error);
    process.exit(1);
  });
  
  // Handle graceful shutdown
  const shutdown = async () => {
    await deliveryService.shutdown();
    process.exit(0);
  };
  
  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}

export default DeliveryService;