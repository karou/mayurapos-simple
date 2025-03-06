import { Request, Response } from 'express';
import mongoose, { Schema, Document } from 'mongoose';
import { v4 as uuidv4 } from 'uuid';
import { BaseService } from '../../shared/base-service';
import { MessageBus } from '../../shared/message-bus';

// Product interface
interface IProduct extends Document {
  productId: string;
  sku: string;
  name: string;
  description: string;
  category: string;
  price: number;
  costPrice: number;
  taxRate: number;
  barcode?: string;
  images: string[];
  attributes: Record<string, any>;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

// Inventory item interface
interface IInventoryItem extends Document {
  inventoryId: string;
  productId: string;
  sku: string;
  storeId: string;
  quantity: number;
  reservedQuantity: number;
  backorderEnabled: boolean;
  backorderLimit: number;
  reorderPoint: number;
  reorderQuantity: number;
  lastRestockedAt?: Date;
  locationInStore?: string;
  notes?: string;
  batchNumber?: string;
  expirationDate?: Date;
  serialNumbers?: string[];
  createdAt: Date;
  updatedAt: Date;
}

// Inventory transaction interface
interface IInventoryTransaction extends Document {
  transactionId: string;
  inventoryId: string;
  productId: string;
  sku: string;
  storeId: string;
  type: 'RESTOCK' | 'SALE' | 'RETURN' | 'ADJUSTMENT' | 'TRANSFER' | 'RESERVE' | 'UNRESERVE';
  quantity: number;
  previousQuantity: number;
  newQuantity: number;
  orderId?: string;
  referenceId?: string;
  reason?: string;
  performedBy?: string;
  notes?: string;
  createdAt: Date;
}

// Supplier interface
interface ISupplier extends Document {
  supplierId: string;
  name: string;
  contactName: string;
  email: string;
  phone: string;
  address: {
    street: string;
    city: string;
    state: string;
    zip: string;
    country: string;
  };
  website?: string;
  paymentTerms?: string;
  leadTime?: number;
  minOrderValue?: number;
  notes?: string;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

// Purchase order interface
interface IPurchaseOrder extends Document {
  purchaseOrderId: string;
  supplierId: string;
  storeId: string;
  status: 'DRAFT' | 'SUBMITTED' | 'CONFIRMED' | 'SHIPPED' | 'RECEIVED' | 'CANCELLED';
  items: {
    productId: string;
    sku: string;
    quantity: number;
    unitPrice: number;
    totalPrice: number;
    receivedQuantity?: number;
    notes?: string;
  }[];
  subtotal: number;
  tax: number;
  shipping: number;
  total: number;
  expectedDeliveryDate?: Date;
  actualDeliveryDate?: Date;
  paymentStatus: 'UNPAID' | 'PARTIALLY_PAID' | 'PAID';
  paymentTerms?: string;
  notes?: string;
  createdAt: Date;
  updatedAt: Date;
  submittedAt?: Date;
  confirmedAt?: Date;
  shippedAt?: Date;
  receivedAt?: Date;
  cancelledAt?: Date;
}

/**
 * Inventory Service - Handles inventory management
 */
export class InventoryService extends BaseService {
  private messageBus: MessageBus;
  private productModel: mongoose.Model<IProduct>;
  private inventoryModel: mongoose.Model<IInventoryItem>;
  private transactionModel: mongoose.Model<IInventoryTransaction>;
  private supplierModel: mongoose.Model<ISupplier>;
  private purchaseOrderModel: mongoose.Model<IPurchaseOrder>;

  /**
   * Initialize the Inventory Service
   */
  constructor() {
    // Initialize base service with configuration
    super(
      'inventory-service',
      parseInt(process.env.PORT || '3003'),
      process.env.MONGO_URI || 'mongodb://localhost:27017/mayura-inventory',
      process.env.RABBITMQ_URI || 'amqp://localhost',
      process.env.REDIS_URI || 'redis://localhost:6379'
    );

    // Initialize message bus
    this.messageBus = new MessageBus(
      this.rabbitmqUri,
      this.serviceName,
      this.logger
    );

    // Define product schema
    const productSchema = new Schema<IProduct>({
      productId: { 
        type: String, 
        required: true, 
        unique: true 
      },
      sku: { 
        type: String, 
        required: true, 
        unique: true 
      },
      name: { 
        type: String, 
        required: true,
        index: 'text'
      },
      description: { 
        type: String, 
        required: true 
      },
      category: { 
        type: String, 
        required: true,
        index: true
      },
      price: { 
        type: Number, 
        required: true,
        min: 0 
      },
      costPrice: { 
        type: Number, 
        required: true,
        min: 0 
      },
      taxRate: { 
        type: Number, 
        required: true,
        default: 0,
        min: 0 
      },
      barcode: { 
        type: String,
        index: true
      },
      images: [String],
      attributes: { 
        type: Schema.Types.Mixed, 
        default: {} 
      },
      isActive: { 
        type: Boolean, 
        required: true,
        default: true,
        index: true
      }
    }, {
      timestamps: true
    });
    
    // Define inventory schema
    const inventorySchema = new Schema<IInventoryItem>({
      inventoryId: { 
        type: String, 
        required: true, 
        unique: true 
      },
      productId: { 
        type: String, 
        required: true,
        index: true
      },
      sku: { 
        type: String, 
        required: true,
        index: true
      },
      storeId: { 
        type: String, 
        required: true,
        index: true
      },
      quantity: { 
        type: Number, 
        required: true,
        default: 0,
        min: 0 
      },
      reservedQuantity: { 
        type: Number, 
        required: true,
        default: 0,
        min: 0 
      },
      backorderEnabled: { 
        type: Boolean, 
        required: true,
        default: false 
      },
      backorderLimit: { 
        type: Number, 
        required: true,
        default: 0,
        min: 0 
      },
      reorderPoint: { 
        type: Number, 
        required: true,
        default: 5,
        min: 0 
      },
      reorderQuantity: { 
        type: Number, 
        required: true,
        default: 10,
        min: 1 
      },
      lastRestockedAt: { 
        type: Date 
      },
      locationInStore: { 
        type: String 
      },
      notes: { 
        type: String 
      },
      batchNumber: { 
        type: String 
      },
      expirationDate: { 
        type: Date 
      },
      serialNumbers: [String]
    }, {
      timestamps: true
    });
    
    // Create a compound index for productId + storeId
    inventorySchema.index({ productId: 1, storeId: 1 }, { unique: true });
    
    // Define transaction schema
    const transactionSchema = new Schema<IInventoryTransaction>({
      transactionId: { 
        type: String, 
        required: true, 
        unique: true 
      },
      inventoryId: { 
        type: String, 
        required: true,
        index: true
      },
      productId: { 
        type: String, 
        required: true,
        index: true
      },
      sku: { 
        type: String, 
        required: true 
      },
      storeId: { 
        type: String, 
        required: true,
        index: true
      },
      type: { 
        type: String, 
        required: true,
        enum: ['RESTOCK', 'SALE', 'RETURN', 'ADJUSTMENT', 'TRANSFER', 'RESERVE', 'UNRESERVE'],
        index: true
      },
      quantity: { 
        type: Number, 
        required: true 
      },
      previousQuantity: { 
        type: Number, 
        required: true 
      },
      newQuantity: { 
        type: Number, 
        required: true 
      },
      orderId: { 
        type: String,
        index: true
      },
      referenceId: { 
        type: String,
        index: true
      },
      reason: { 
        type: String 
      },
      performedBy: { 
        type: String 
      },
      notes: { 
        type: String 
      }
    }, {
      timestamps: true
    });
    
    // Define supplier schema
    const supplierSchema = new Schema<ISupplier>({
      supplierId: { 
        type: String, 
        required: true, 
        unique: true 
      },
      name: { 
        type: String, 
        required: true,
        index: 'text'
      },
      contactName: { 
        type: String, 
        required: true 
      },
      email: { 
        type: String, 
        required: true 
      },
      phone: { 
        type: String, 
        required: true 
      },
      address: {
        street: { type: String, required: true },
        city: { type: String, required: true },
        state: { type: String, required: true },
        zip: { type: String, required: true },
        country: { type: String, required: true, default: 'US' }
      },
      website: { 
        type: String 
      },
      paymentTerms: { 
        type: String 
      },
      leadTime: { 
        type: Number,
        min: 0 
      },
      minOrderValue: { 
        type: Number,
        min: 0 
      },
      notes: { 
        type: String 
      },
      isActive: { 
        type: Boolean, 
        required: true,
        default: true 
      }
    }, {
      timestamps: true
    });
    
    // Define purchase order schema
    const purchaseOrderSchema = new Schema<IPurchaseOrder>({
      purchaseOrderId: { 
        type: String, 
        required: true, 
        unique: true 
      },
      supplierId: { 
        type: String, 
        required: true,
        index: true
      },
      storeId: { 
        type: String, 
        required: true,
        index: true
      },
      status: { 
        type: String, 
        required: true,
        enum: ['DRAFT', 'SUBMITTED', 'CONFIRMED', 'SHIPPED', 'RECEIVED', 'CANCELLED'],
        default: 'DRAFT',
        index: true
      },
      items: [{
        productId: { type: String, required: true },
        sku: { type: String, required: true },
        quantity: { type: Number, required: true, min: 1 },
        unitPrice: { type: Number, required: true, min: 0 },
        totalPrice: { type: Number, required: true, min: 0 },
        receivedQuantity: { type: Number, min: 0 },
        notes: { type: String }
      }],
      subtotal: { 
        type: Number, 
        required: true,
        min: 0 
      },
      tax: { 
        type: Number, 
        required: true,
        default: 0,
        min: 0 
      },
      shipping: { 
        type: Number, 
        required: true,
        default: 0,
        min: 0 
      },
      total: { 
        type: Number, 
        required: true,
        min: 0 
      },
      expectedDeliveryDate: { 
        type: Date 
      },
      actualDeliveryDate: { 
        type: Date 
      },
      paymentStatus: { 
        type: String, 
        required: true,
        enum: ['UNPAID', 'PARTIALLY_PAID', 'PAID'],
        default: 'UNPAID' 
      },
      paymentTerms: { 
        type: String 
      },
      notes: { 
        type: String 
      },
      submittedAt: { 
        type: Date 
      },
      confirmedAt: { 
        type: Date 
      },
      shippedAt: { 
        type: Date 
      },
      receivedAt: { 
        type: Date 
      },
      cancelledAt: { 
        type: Date 
      }
    }, {
      timestamps: true
    });
    
    // Pre-save hook for purchase order
    purchaseOrderSchema.pre('save', function(next) {
      // Calculate totals for purchase order
      if (this.items && this.items.length > 0) {
        this.subtotal = this.items.reduce((sum, item) => sum + item.totalPrice, 0);
        this.total = this.subtotal + this.tax + this.shipping;
      }
      next();
    });

    // Create models
    this.productModel = mongoose.model<IProduct>('Product', productSchema);
    this.inventoryModel = mongoose.model<IInventoryItem>('Inventory', inventorySchema);
    this.transactionModel = mongoose.model<IInventoryTransaction>('InventoryTransaction', transactionSchema);
    this.supplierModel = mongoose.model<ISupplier>('Supplier', supplierSchema);
    this.purchaseOrderModel = mongoose.model<IPurchaseOrder>('PurchaseOrder', purchaseOrderSchema);
  }

  /**
   * Initialize routes for the Inventory service
   */
  protected async initRoutes(): Promise<void> {
    // Product routes
    this.app.post('/products', this.authenticate.bind(this), this.createProduct.bind(this));
    this.app.get('/products/:id', this.authenticate.bind(this), this.getProduct.bind(this));
    this.app.put('/products/:id', this.authenticate.bind(this), this.updateProduct.bind(this));
    this.app.get('/products', this.authenticate.bind(this), this.searchProducts.bind(this));
    
    // Inventory routes
    this.app.get('/inventory/:id', this.authenticate.bind(this), this.getInventory.bind(this));
    this.app.get('/inventory/product/:productId', this.authenticate.bind(this), this.getProductInventory.bind(this));
    this.app.get('/inventory/store/:storeId', this.authenticate.bind(this), this.getStoreInventory.bind(this));
    this.app.post('/inventory/adjust', this.authenticate.bind(this), this.adjustInventory.bind(this));
    this.app.post('/inventory/transfer', this.authenticate.bind(this), this.transferInventory.bind(this));
    
    // Inventory reservation
    this.app.post('/inventory/reserve', this.authenticate.bind(this), this.reserveInventory.bind(this));
    this.app.post('/inventory/release', this.authenticate.bind(this), this.releaseInventory.bind(this));
    
    // Inventory transactions
    this.app.get('/transactions', this.authenticate.bind(this), this.getTransactions.bind(this));
    this.app.get('/transactions/:id', this.authenticate.bind(this), this.getTransaction.bind(this));
    this.app.get('/transactions/product/:productId', this.authenticate.bind(this), this.getProductTransactions.bind(this));
    
    // Supplier routes
    this.app.post('/suppliers', this.authenticate.bind(this), this.createSupplier.bind(this));
    this.app.get('/suppliers/:id', this.authenticate.bind(this), this.getSupplier.bind(this));
    this.app.put('/suppliers/:id', this.authenticate.bind(this), this.updateSupplier.bind(this));
    this.app.get('/suppliers', this.authenticate.bind(this), this.getSuppliers.bind(this));
    
    // Purchase order routes
    this.app.post('/purchase-orders', this.authenticate.bind(this), this.createPurchaseOrder.bind(this));
    this.app.get('/purchase-orders/:id', this.authenticate.bind(this), this.getPurchaseOrder.bind(this));
    this.app.put('/purchase-orders/:id', this.authenticate.bind(this), this.updatePurchaseOrder.bind(this));
    this.app.post('/purchase-orders/:id/submit', this.authenticate.bind(this), this.submitPurchaseOrder.bind(this));
    this.app.post('/purchase-orders/:id/receive', this.authenticate.bind(this), this.receivePurchaseOrder.bind(this));
    this.app.post('/purchase-orders/:id/cancel', this.authenticate.bind(this), this.cancelPurchaseOrder.bind(this));
    this.app.get('/purchase-orders', this.authenticate.bind(this), this.getPurchaseOrders.bind(this));
    
    // Low stock alert
    this.app.get('/inventory/alerts/low-stock', this.authenticate.bind(this), this.getLowStockAlerts.bind(this));
  }

  /**
   * Initialize message bus handlers
   */
  private async initMessageHandlers(): Promise<void> {
    await this.messageBus.connect();
    
    // Create exchanges
    await this.messageBus.createExchange('inventory', 'topic');
    
    // Create queues
    await this.messageBus.createQueue('inventory.order.events', 'order', 'order.#');
    
    // Listen for order events
    await this.messageBus.subscribe('inventory.order.events', async (content, msg) => {
      this.logger.info(`Received order event: ${msg.fields.routingKey}`, { content });
      
      // Handle specific events
      switch (msg.fields.routingKey) {
        case 'order.confirmed':
          await this.handleOrderConfirmed(content);
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
   * Create a new product
   */
  private async createProduct(req: Request, res: Response): Promise<void> {
    try {
      const { 
        sku, 
        name, 
        description, 
        category, 
        price, 
        costPrice, 
        taxRate = 0, 
        barcode, 
        images = [], 
        attributes = {} 
      } = req.body;
      
      // Validate required fields
      if (!sku || !name || !description || !category || price === undefined || costPrice === undefined) {
        res.status(400).json({ message: 'Missing required product fields' });
        return;
      }
      
      // Check if product with SKU already exists
      const existingProduct = await this.productModel.findOne({ sku });
      
      if (existingProduct) {
        res.status(409).json({ message: `Product with SKU ${sku} already exists` });
        return;
      }
      
      // Create product
      const productId = uuidv4();
      const product = new this.productModel({
        productId,
        sku,
        name,
        description,
        category,
        price,
        costPrice,
        taxRate,
        barcode,
        images,
        attributes,
        isActive: true
      });
      
      await product.save();
      
      // Initialize inventory records for each store
      // In a real implementation, this would get a list of stores from a store service
      // For demo purposes, we'll create a single inventory record for a default store
      const defaultStoreId = 'store_default';
      const inventoryId = uuidv4();
      
      const inventory = new this.inventoryModel({
        inventoryId,
        productId,
        sku,
        storeId: defaultStoreId,
        quantity: 0,
        reservedQuantity: 0,
        backorderEnabled: false,
        backorderLimit: 0,
        reorderPoint: 5,
        reorderQuantity: 10
      });
      
      await inventory.save();
      
      // Publish product created event
      await this.messageBus.publish('inventory', 'product.created', {
        productId,
        sku,
        name,
        price,
        category,
        timestamp: new Date().toISOString()
      });
      
      res.status(201).json({
        productId: product.productId,
        sku: product.sku,
        name: product.name,
        price: product.price,
        category: product.category,
        isActive: product.isActive,
        createdAt: product.createdAt
      });
    } catch (error: any) {
      this.logger.error(`Product creation error: ${error}`);
      res.status(500).json({ message: 'Failed to create product', error: error.message });
    }
  }

  /**
   * Get product by ID
   */
  private async getProduct(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      
      // Find by productId, SKU, or MongoDB ID
      const product = await this.productModel.findOne({
        $or: [
          { productId: id },
          { sku: id },
          { _id: mongoose.isValidObjectId(id) ? id : undefined }
        ]
      });
      
      if (!product) {
        res.status(404).json({ message: 'Product not found' });
        return;
      }
      
      res.status(200).json({
        productId: product.productId,
        sku: product.sku,
        name: product.name,
        description: product.description,
        category: product.category,
        price: product.price,
        costPrice: product.costPrice,
        taxRate: product.taxRate,
        barcode: product.barcode,
        images: product.images,
        attributes: product.attributes,
        isActive: product.isActive,
        createdAt: product.createdAt,
        updatedAt: product.updatedAt
      });
    } catch (error) {
      this.logger.error(`Get product error: ${error}`);
      res.status(500).json({ message: 'Failed to get product' });
    }
  }

  /**
   * Update a product
   */
  private async updateProduct(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const { 
        name, 
        description, 
        category, 
        price, 
        costPrice, 
        taxRate, 
        barcode, 
        images, 
        attributes, 
        isActive 
      } = req.body;
      
      // Find product
      const product = await this.productModel.findOne({
        $or: [
          { productId: id },
          { sku: id },
          { _id: mongoose.isValidObjectId(id) ? id : undefined }
        ]
      });
      
      if (!product) {
        res.status(404).json({ message: 'Product not found' });
        return;
      }
      
      // Update fields if provided
      if (name !== undefined) product.name = name;
      if (description !== undefined) product.description = description;
      if (category !== undefined) product.category = category;
      if (price !== undefined) product.price = price;
      if (costPrice !== undefined) product.costPrice = costPrice;
      if (taxRate !== undefined) product.taxRate = taxRate;
      if (barcode !== undefined) product.barcode = barcode;
      if (images !== undefined) product.images = images;
      if (attributes !== undefined) product.attributes = { ...product.attributes, ...attributes };
      if (isActive !== undefined) product.isActive = isActive;
      
      await product.save();
      
      // Publish product updated event
      await this.messageBus.publish('inventory', 'product.updated', {
        productId: product.productId,
        sku: product.sku,
        name: product.name,
        price: product.price,
        category: product.category,
        isActive: product.isActive,
        timestamp: new Date().toISOString()
      });
      
      res.status(200).json({
        productId: product.productId,
        sku: product.sku,
        name: product.name,
        description: product.description,
        category: product.category,
        price: product.price,
        costPrice: product.costPrice,
        taxRate: product.taxRate,
        barcode: product.barcode,
        images: product.images,
        attributes: product.attributes,
        isActive: product.isActive,
        updatedAt: product.updatedAt
      });
    } catch (error) {
      this.logger.error(`Update product error: ${error}`);
      res.status(500).json({ message: 'Failed to update product' });
    }
  }

  /**
   * Search products
   */
  private async searchProducts(req: Request, res: Response): Promise<void> {
    try {
      const { 
        query, 
        category, 
        minPrice, 
        maxPrice, 
        isActive, 
        page = 1, 
        limit = 10, 
        sortBy = 'name', 
        sortOrder = 'asc' 
      } = req.query;
      
      // Build query
      const searchQuery: any = {};
      
      if (query) {
        searchQuery.$text = { $search: query as string };
      }
      
      if (category) {
        searchQuery.category = category;
      }
      
      if (minPrice !== undefined || maxPrice !== undefined) {
        searchQuery.price = {};
        if (minPrice !== undefined) {
          searchQuery.price.$gte = parseFloat(minPrice as string);
        }
        if (maxPrice !== undefined) {
          searchQuery.price.$lte = parseFloat(maxPrice as string);
        }
      }
      
      if (isActive !== undefined) {
        searchQuery.isActive = isActive === 'true';
      }
      
      // Parse pagination
      const skip = (parseInt(page as string) - 1) * parseInt(limit as string);
      
      // Build sort
      const sort: any = {};
      sort[sortBy as string] = sortOrder === 'asc' ? 1 : -1;
      
      // Get products
      const products = await this.productModel
        .find(searchQuery)
        .sort(sort)
        .skip(skip)
        .limit(parseInt(limit as string));
      
      // Get total count
      const total = await this.productModel.countDocuments(searchQuery);
      
      // Get inventory for found products
      const productIds = products.map(p => p.productId);
      const inventories = await this.inventoryModel.find({
        productId: { $in: productIds }
      });
      
      // Create a map of productId to inventory
      const inventoryMap = inventories.reduce((map, inv) => {
        if (!map[inv.productId]) {
          map[inv.productId] = [];
        }
        map[inv.productId].push({
          storeId: inv.storeId,
          quantity: inv.quantity,
          reservedQuantity: inv.reservedQuantity
        });
        return map;
      }, {} as Record<string, any[]>);
      
      res.status(200).json({
        products: products.map(product => ({
          productId: product.productId,
          sku: product.sku,
          name: product.name,
          category: product.category,
          price: product.price,
          isActive: product.isActive,
          inventory: inventoryMap[product.productId] || []
        })),
        pagination: {
          page: parseInt(page as string),
          limit: parseInt(limit as string),
          total,
          pages: Math.ceil(total / parseInt(limit as string))
        }
      });
    } catch (error) {
      this.logger.error(`Search products error: ${error}`);
      res.status(500).json({ message: 'Failed to search products' });
    }
  }

  /**
   * Get inventory item by ID
   */
  private async getInventory(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      
      const inventory = await this.inventoryModel.findOne({
        $or: [
          { inventoryId: id },
          { _id: mongoose.isValidObjectId(id) ? id : undefined }
        ]
      });
      
      if (!inventory) {
        res.status(404).json({ message: 'Inventory not found' });
        return;
      }
      
      // Get product info
      const product = await this.productModel.findOne({ productId: inventory.productId });
      
      res.status(200).json({
        inventoryId: inventory.inventoryId,
        productId: inventory.productId,
        sku: inventory.sku,
        storeId: inventory.storeId,
        quantity: inventory.quantity,
        reservedQuantity: inventory.reservedQuantity,
        availableQuantity: inventory.quantity - inventory.reservedQuantity,
        backorderEnabled: inventory.backorderEnabled,
        backorderLimit: inventory.backorderLimit,
        reorderPoint: inventory.reorderPoint,
        reorderQuantity: inventory.reorderQuantity,
        lastRestockedAt: inventory.lastRestockedAt,
        locationInStore: inventory.locationInStore,
        product: product ? {
          name: product.name,
          price: product.price,
          category: product.category,
          isActive: product.isActive
        } : null
      });
    } catch (error) {
      this.logger.error(`Get inventory error: ${error}`);
      res.status(500).json({ message: 'Failed to get inventory' });
    }
  }

  /**
   * Get inventory for a product
   */
  private async getProductInventory(req: Request, res: Response): Promise<void> {
    try {
      const { productId } = req.params;
      
      // Get product first to validate it exists
      const product = await this.productModel.findOne({
        $or: [
          { productId },
          { sku: productId }
        ]
      });
      
      if (!product) {
        res.status(404).json({ message: 'Product not found' });
        return;
      }
      
      // Get all inventory items for this product
      const inventories = await this.inventoryModel.find({ 
        productId: product.productId 
      });
      
      // Calculate aggregate totals
      const totalQuantity = inventories.reduce((sum, inv) => sum + inv.quantity, 0);
      const totalReserved = inventories.reduce((sum, inv) => sum + inv.reservedQuantity, 0);
      const totalAvailable = totalQuantity - totalReserved;
      
      res.status(200).json({
        productId: product.productId,
        sku: product.sku,
        name: product.name,
        totalQuantity,
        totalReserved,
        totalAvailable,
        inventoryByStore: inventories.map(inv => ({
          storeId: inv.storeId,
          inventoryId: inv.inventoryId,
          quantity: inv.quantity,
          reservedQuantity: inv.reservedQuantity,
          availableQuantity: inv.quantity - inv.reservedQuantity,
          backorderEnabled: inv.backorderEnabled,
          lastRestockedAt: inv.lastRestockedAt,
          locationInStore: inv.locationInStore
        }))
      });
    } catch (error) {
      this.logger.error(`Get product inventory error: ${error}`);
      res.status(500).json({ message: 'Failed to get product inventory' });
    }
  }

  /**
   * Get inventory for a store
   */
  private async getStoreInventory(req: Request, res: Response): Promise<void> {
    try {
      const { storeId } = req.params;
      const { lowStock, outOfStock, page = 1, limit = 10 } = req.query;
      
      // Build query
      const query: any = { storeId };
      
      if (lowStock === 'true') {
        // Find products where quantity is below reorder point but not zero
        query.$expr = { 
          $and: [
            { $gt: ['$quantity', 0] },
            { $lte: ['$quantity', '$reorderPoint'] }
          ]
        };
      }
      
      if (outOfStock === 'true') {
        // Find products where quantity is zero
        query.quantity = 0;
      }
      
      // Parse pagination
      const skip = (parseInt(page as string) - 1) * parseInt(limit as string);
      
      // Get inventory
      const inventories = await this.inventoryModel
        .find(query)
        .sort({ quantity: 1 })
        .skip(skip)
        .limit(parseInt(limit as string));
      
      // Get total count
      const total = await this.inventoryModel.countDocuments(query);
      
      // Get product details
      const productIds = inventories.map(inv => inv.productId);
      const products = await this.productModel.find({
        productId: { $in: productIds }
      });
      
      // Create a map of productId to product
      const productMap = products.reduce((map, product) => {
        map[product.productId] = product;
        return map;
      }, {} as Record<string, IProduct>);
      
      res.status(200).json({
        storeId,
        inventory: inventories.map(inv => {
          const product = productMap[inv.productId];
          return {
            inventoryId: inv.inventoryId,
            productId: inv.productId,
            sku: inv.sku,
            name: product ? product.name : 'Unknown Product',
            category: product ? product.category : 'Unknown',
            price: product ? product.price : 0,
            quantity: inv.quantity,
            reservedQuantity: inv.reservedQuantity,
            availableQuantity: inv.quantity - inv.reservedQuantity,
            reorderPoint: inv.reorderPoint,
            isLowStock: inv.quantity > 0 && inv.quantity <= inv.reorderPoint,
            isOutOfStock: inv.quantity === 0
          };
        }),
        pagination: {
          page: parseInt(page as string),
          limit: parseInt(limit as string),
          total,
          pages: Math.ceil(total / parseInt(limit as string))
        }
      });
    } catch (error) {
      this.logger.error(`Get store inventory error: ${error}`);
      res.status(500).json({ message: 'Failed to get store inventory' });
    }
  }

  /**
   * Adjust inventory quantity
   */
  private async adjustInventory(req: Request, res: Response): Promise<void> {
    try {
      const { 
        productId, 
        sku, 
        storeId, 
        quantity, 
        reason, 
        notes 
      } = req.body;
      
      // Validate input
      if ((!productId && !sku) || !storeId || quantity === undefined) {
        res.status(400).json({ message: 'Product ID or SKU, store ID, and quantity are required' });
        return;
      }
      
      // Find inventory
      let inventory;
      if (productId) {
        inventory = await this.inventoryModel.findOne({ productId, storeId });
      } else {
        inventory = await this.inventoryModel.findOne({ sku, storeId });
      }
      
      if (!inventory) {
        res.status(404).json({ message: 'Inventory not found' });
        return;
      }
      
      // Record previous quantity for transaction
      const previousQuantity = inventory.quantity;
      
      // Adjust quantity
      const newQuantity = Math.max(0, previousQuantity + quantity);
      inventory.quantity = newQuantity;
      
      // Update lastRestockedAt if adding inventory
      if (quantity > 0) {
        inventory.lastRestockedAt = new Date();
      }
      
      await inventory.save();
      
      // Create transaction record
      const transactionId = uuidv4();
      const transaction = new this.transactionModel({
        transactionId,
        inventoryId: inventory.inventoryId,
        productId: inventory.productId,
        sku: inventory.sku,
        storeId,
        type: quantity > 0 ? 'RESTOCK' : 'ADJUSTMENT',
        quantity,
        previousQuantity,
        newQuantity,
        reason,
        performedBy: (req as any).user.userId,
        notes
      });
      
      await transaction.save();
      
      // Check if we need to publish low stock alert
      if (newQuantity <= inventory.reorderPoint && previousQuantity > inventory.reorderPoint) {
        await this.messageBus.publish('inventory', 'inventory.low-stock', {
          inventoryId: inventory.inventoryId,
          productId: inventory.productId,
          sku: inventory.sku,
          storeId,
          quantity: newQuantity,
          reorderPoint: inventory.reorderPoint,
          reorderQuantity: inventory.reorderQuantity,
          timestamp: new Date().toISOString()
        });
      }
      
      // Publish inventory updated event
      await this.messageBus.publish('inventory', 'inventory.updated', {
        inventoryId: inventory.inventoryId,
        productId: inventory.productId,
        sku: inventory.sku,
        storeId,
        quantity: newQuantity,
        change: quantity,
        timestamp: new Date().toISOString()
      });
      
      res.status(200).json({
        inventoryId: inventory.inventoryId,
        productId: inventory.productId,
        sku: inventory.sku,
        storeId,
        previousQuantity,
        adjustment: quantity,
        newQuantity,
        transaction: {
          transactionId,
          type: quantity > 0 ? 'RESTOCK' : 'ADJUSTMENT'
        }
      });
    } catch (error) {
      this.logger.error(`Adjust inventory error: ${error}`);
      res.status(500).json({ message: 'Failed to adjust inventory' });
    }
  }

  /**
   * Transfer inventory between stores
   */
  private async transferInventory(req: Request, res: Response): Promise<void> {
    try {
      const { 
        productId, 
        sku, 
        fromStoreId, 
        toStoreId, 
        quantity, 
        notes 
      } = req.body;
      
      // Validate input
      if ((!productId && !sku) || !fromStoreId || !toStoreId || !quantity || quantity <= 0) {
        res.status(400).json({ 
          message: 'Product ID or SKU, from store ID, to store ID, and positive quantity are required' 
        });
        return;
      }
      
      if (fromStoreId === toStoreId) {
        res.status(400).json({ message: 'Source and destination stores must be different' });
        return;
      }
      
      // Start a session for transaction
      const session = await mongoose.startSession();
      session.startTransaction();
      
      try {
        // Find source inventory
        let sourceInventory;
        if (productId) {
          sourceInventory = await this.inventoryModel.findOne({ productId, storeId: fromStoreId }).session(session);
        } else {
          sourceInventory = await this.inventoryModel.findOne({ sku, storeId: fromStoreId }).session(session);
        }
        
        if (!sourceInventory) {
          await session.abortTransaction();
          session.endSession();
          res.status(404).json({ message: 'Source inventory not found' });
          return;
        }
        
        // Check if source has enough inventory
        const availableQuantity = sourceInventory.quantity - sourceInventory.reservedQuantity;
        if (availableQuantity < quantity) {
          await session.abortTransaction();
          session.endSession();
          res.status(400).json({ 
            message: `Insufficient inventory. Available: ${availableQuantity}, Requested: ${quantity}` 
          });
          return;
        }
        
        // Find destination inventory
        let destInventory;
        if (productId) {
          destInventory = await this.inventoryModel.findOne({ productId, storeId: toStoreId }).session(session);
        } else {
          destInventory = await this.inventoryModel.findOne({ sku, storeId: toStoreId }).session(session);
        }
        
        // If destination inventory doesn't exist, create it
        if (!destInventory) {
          const inventoryId = uuidv4();
          destInventory = new this.inventoryModel({
            inventoryId,
            productId: sourceInventory.productId,
            sku: sourceInventory.sku,
            storeId: toStoreId,
            quantity: 0,
            reservedQuantity: 0,
            backorderEnabled: sourceInventory.backorderEnabled,
            backorderLimit: sourceInventory.backorderLimit,
            reorderPoint: sourceInventory.reorderPoint,
            reorderQuantity: sourceInventory.reorderQuantity
          });
        }
        
        // Record previous quantities
        const sourcePrevQuantity = sourceInventory.quantity;
        const destPrevQuantity = destInventory.quantity;
        
        // Update quantities
        sourceInventory.quantity -= quantity;
        destInventory.quantity += quantity;
        destInventory.lastRestockedAt = new Date();
        
        await sourceInventory.save({ session });
        await destInventory.save({ session });
        
        // Create transaction records
        const sourceTransactionId = uuidv4();
        const sourceTransaction = new this.transactionModel({
          transactionId: sourceTransactionId,
          inventoryId: sourceInventory.inventoryId,
          productId: sourceInventory.productId,
          sku: sourceInventory.sku,
          storeId: fromStoreId,
          type: 'TRANSFER',
          quantity: -quantity,
          previousQuantity: sourcePrevQuantity,
          newQuantity: sourceInventory.quantity,
          referenceId: toStoreId,
          reason: 'Store transfer',
          performedBy: (req as any).user.userId,
          notes
        });
        
        const destTransactionId = uuidv4();
        const destTransaction = new this.transactionModel({
          transactionId: destTransactionId,
          inventoryId: destInventory.inventoryId,
          productId: destInventory.productId,
          sku: destInventory.sku,
          storeId: toStoreId,
          type: 'TRANSFER',
          quantity: quantity,
          previousQuantity: destPrevQuantity,
          newQuantity: destInventory.quantity,
          referenceId: fromStoreId,
          reason: 'Store transfer',
          performedBy: (req as any).user.userId,
          notes
        });
        
        await sourceTransaction.save({ session });
        await destTransaction.save({ session });
        
        // Commit transaction
        await session.commitTransaction();
        
        // Check if we need to publish low stock alert for source
        if (sourceInventory.quantity <= sourceInventory.reorderPoint && 
            sourcePrevQuantity > sourceInventory.reorderPoint) {
          await this.messageBus.publish('inventory', 'inventory.low-stock', {
            inventoryId: sourceInventory.inventoryId,
            productId: sourceInventory.productId,
            sku: sourceInventory.sku,
            storeId: fromStoreId,
            quantity: sourceInventory.quantity,
            reorderPoint: sourceInventory.reorderPoint,
            reorderQuantity: sourceInventory.reorderQuantity,
            timestamp: new Date().toISOString()
          });
        }
        
        // Publish inventory updated events
        await this.messageBus.publish('inventory', 'inventory.updated', {
          inventoryId: sourceInventory.inventoryId,
          productId: sourceInventory.productId,
          sku: sourceInventory.sku,
          storeId: fromStoreId,
          quantity: sourceInventory.quantity,
          change: -quantity,
          timestamp: new Date().toISOString()
        });
        
        await this.messageBus.publish('inventory', 'inventory.updated', {
          inventoryId: destInventory.inventoryId,
          productId: destInventory.productId,
          sku: destInventory.sku,
          storeId: toStoreId,
          quantity: destInventory.quantity,
          change: quantity,
          timestamp: new Date().toISOString()
        });
        
        // Publish transfer event
        await this.messageBus.publish('inventory', 'inventory.transferred', {
          productId: sourceInventory.productId,
          sku: sourceInventory.sku,
          fromStoreId,
          toStoreId,
          quantity,
          sourceTransaction: sourceTransactionId,
          destTransaction: destTransactionId,
          timestamp: new Date().toISOString()
        });
        
        res.status(200).json({
          productId: sourceInventory.productId,
          sku: sourceInventory.sku,
          fromStore: {
            storeId: fromStoreId,
            previousQuantity: sourcePrevQuantity,
            newQuantity: sourceInventory.quantity
          },
          toStore: {
            storeId: toStoreId,
            previousQuantity: destPrevQuantity,
            newQuantity: destInventory.quantity
          },
          quantity,
          transactions: {
            source: sourceTransactionId,
            destination: destTransactionId
          }
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
      this.logger.error(`Transfer inventory error: ${error}`);
      res.status(500).json({ message: 'Failed to transfer inventory' });
    }
  }

  /**
   * Reserve inventory for an order
   */
  private async reserveInventory(req: Request, res: Response): Promise<void> {
    try {
      const { orderId, items, storeId } = req.body;
      
      // Validate input
      if (!orderId || !items || !items.length || !storeId) {
        res.status(400).json({ message: 'Order ID, items, and store ID are required' });
        return;
      }
      
      // Start a session for transaction
      const session = await mongoose.startSession();
      session.startTransaction();
      
      try {
        const results = [];
        let success = true;
        let errorMessage = '';
        
        // Process each item
        for (const item of items) {
          const { productId, sku, quantity } = item;
          
          if ((!productId && !sku) || !quantity || quantity <= 0) {
            success = false;
            errorMessage = 'Each item must have product ID or SKU, and positive quantity';
            break;
          }
          
          // Find inventory
          let inventory;
          if (productId) {
            inventory = await this.inventoryModel.findOne({ productId, storeId }).session(session);
          } else {
            inventory = await this.inventoryModel.findOne({ sku, storeId }).session(session);
          }
          
          if (!inventory) {
            success = false;
            errorMessage = `Inventory not found for ${productId || sku}`;
            break;
          }
          
          // Check if enough inventory is available
          const availableQuantity = inventory.quantity - inventory.reservedQuantity;
          
          if (availableQuantity < quantity && !inventory.backorderEnabled) {
            success = false;
            errorMessage = `Insufficient inventory for ${inventory.sku}. Available: ${availableQuantity}, Requested: ${quantity}`;
            break;
          }
          
          // Check backorder limit if applicable
          if (availableQuantity < quantity && inventory.backorderEnabled) {
            const backorderNeeded = quantity - availableQuantity;
            if (backorderNeeded > inventory.backorderLimit) {
              success = false;
              errorMessage = `Exceeds backorder limit for ${inventory.sku}. Limit: ${inventory.backorderLimit}, Needed: ${backorderNeeded}`;
              break;
            }
          }
          
          // Record previous quantities
          const previousReserved = inventory.reservedQuantity;
          
          // Update reserved quantity
          inventory.reservedQuantity += quantity;
          await inventory.save({ session });
          
          // Create transaction record
          const transactionId = uuidv4();
          const transaction = new this.transactionModel({
            transactionId,
            inventoryId: inventory.inventoryId,
            productId: inventory.productId,
            sku: inventory.sku,
            storeId,
            type: 'RESERVE',
            quantity,
            previousQuantity: previousReserved,
            newQuantity: inventory.reservedQuantity,
            orderId,
            reason: 'Order reservation',
            performedBy: (req as any).user.userId
          });
          
          await transaction.save({ session });
          
          results.push({
            productId: inventory.productId,
            sku: inventory.sku,
            quantity,
            available: availableQuantity,
            isBackordered: quantity > availableQuantity,
            transaction: transactionId
          });
        }
        
        if (!success) {
          await session.abortTransaction();
          session.endSession();
          res.status(400).json({ message: errorMessage });
          return;
        }
        
        // Commit transaction
        await session.commitTransaction();
        
        // Publish inventory reserved event
        await this.messageBus.publish('inventory', 'inventory.reserved', {
          orderId,
          storeId,
          items: results,
          timestamp: new Date().toISOString()
        });
        
        // Publish inventory allocated event (for order service)
        await this.messageBus.publish('inventory', 'inventory.allocated', {
          orderId,
          storeId,
          items: results,
          timestamp: new Date().toISOString()
        });
        
        res.status(200).json({
          orderId,
          storeId,
          items: results,
          success: true
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
      this.logger.error(`Reserve inventory error: ${error}`);
      res.status(500).json({ message: 'Failed to reserve inventory' });
    }
  }

  /**
   * Release reserved inventory
   */
  private async releaseInventory(req: Request, res: Response): Promise<void> {
    try {
      const { orderId, items, storeId, reason } = req.body;
      
      // Validate input
      if (!orderId || !storeId) {
        res.status(400).json({ message: 'Order ID and store ID are required' });
        return;
      }
      
      // If no items specified, find all reservations for this order
      let itemsToRelease = items;
      if (!itemsToRelease || !itemsToRelease.length) {
        const transactions = await this.transactionModel.find({
          orderId,
          storeId,
          type: 'RESERVE'
        });
        
        itemsToRelease = transactions.map(t => ({
          productId: t.productId,
          sku: t.sku,
          quantity: t.quantity
        }));
      }
      
      if (!itemsToRelease.length) {
        res.status(404).json({ message: 'No reserved inventory found for this order' });
        return;
      }
      
      // Start a session for transaction
      const session = await mongoose.startSession();
      session.startTransaction();
      
      try {
        const results = [];
        
        // Process each item
        for (const item of itemsToRelease) {
          const { productId, sku, quantity } = item;
          
          // Find inventory
          let inventory;
          if (productId) {
            inventory = await this.inventoryModel.findOne({ productId, storeId }).session(session);
          } else {
            inventory = await this.inventoryModel.findOne({ sku, storeId }).session(session);
          }
          
          if (!inventory) {
            continue; // Skip if inventory not found
          }
          
          // Record previous quantities
          const previousReserved = inventory.reservedQuantity;
          
          // Calculate quantity to release (don't go below 0)
          const releaseQuantity = Math.min(previousReserved, quantity || previousReserved);
          
          // Update reserved quantity
          inventory.reservedQuantity = Math.max(0, previousReserved - releaseQuantity);
          await inventory.save({ session });
          
          // Create transaction record
          const transactionId = uuidv4();
          const transaction = new this.transactionModel({
            transactionId,
            inventoryId: inventory.inventoryId,
            productId: inventory.productId,
            sku: inventory.sku,
            storeId,
            type: 'UNRESERVE',
            quantity: -releaseQuantity,
            previousQuantity: previousReserved,
            newQuantity: inventory.reservedQuantity,
            orderId,
            reason: reason || 'Reservation release',
            performedBy: (req as any).user.userId
          });
          
          await transaction.save({ session });
          
          results.push({
            productId: inventory.productId,
            sku: inventory.sku,
            quantityReleased: releaseQuantity,
            transaction: transactionId
          });
        }
        
        // Commit transaction
        await session.commitTransaction();
        
        // Publish inventory released event
        await this.messageBus.publish('inventory', 'inventory.released', {
          orderId,
          storeId,
          items: results,
          reason,
          timestamp: new Date().toISOString()
        });
        
        res.status(200).json({
          orderId,
          storeId,
          items: results,
          success: true
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
      this.logger.error(`Release inventory error: ${error}`);
      res.status(500).json({ message: 'Failed to release inventory' });
    }
  }

  /**
   * Get inventory transactions
   */
  private async getTransactions(req: Request, res: Response): Promise<void> {
    try {
      const { 
        storeId, 
        productId, 
        sku, 
        type, 
        orderId, 
        startDate, 
        endDate, 
        page = 1, 
        limit = 10 
      } = req.query;
      
      // Build query
      const query: any = {};
      
      if (storeId) query.storeId = storeId;
      if (productId) query.productId = productId;
      if (sku) query.sku = sku;
      if (type) query.type = type;
      if (orderId) query.orderId = orderId;
      
      // Date range
      if (startDate || endDate) {
        query.createdAt = {};
        if (startDate) query.createdAt.$gte = new Date(startDate as string);
        if (endDate) query.createdAt.$lte = new Date(endDate as string);
      }
      
      // Parse pagination
      const skip = (parseInt(page as string) - 1) * parseInt(limit as string);
      
      // Get transactions
      const transactions = await this.transactionModel
        .find(query)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(parseInt(limit as string));
      
      // Get total count
      const total = await this.transactionModel.countDocuments(query);
      
      res.status(200).json({
        transactions: transactions.map(t => ({
          transactionId: t.transactionId,
          inventoryId: t.inventoryId,
          productId: t.productId,
          sku: t.sku,
          storeId: t.storeId,
          type: t.type,
          quantity: t.quantity,
          previousQuantity: t.previousQuantity,
          newQuantity: t.newQuantity,
          orderId: t.orderId,
          referenceId: t.referenceId,
          reason: t.reason,
          performedBy: t.performedBy,
          createdAt: t.createdAt
        })),
        pagination: {
          page: parseInt(page as string),
          limit: parseInt(limit as string),
          total,
          pages: Math.ceil(total / parseInt(limit as string))
        }
      });
    } catch (error) {
      this.logger.error(`Get transactions error: ${error}`);
      res.status(500).json({ message: 'Failed to get transactions' });
    }
  }

  /**
   * Get transaction by ID
   */
  private async getTransaction(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      
      const transaction = await this.transactionModel.findOne({
        $or: [
          { transactionId: id },
          { _id: mongoose.isValidObjectId(id) ? id : undefined }
        ]
      });
      
      if (!transaction) {
        res.status(404).json({ message: 'Transaction not found' });
        return;
      }
      
      res.status(200).json({
        transactionId: transaction.transactionId,
        inventoryId: transaction.inventoryId,
        productId: transaction.productId,
        sku: transaction.sku,
        storeId: transaction.storeId,
        type: transaction.type,
        quantity: transaction.quantity,
        previousQuantity: transaction.previousQuantity,
        newQuantity: transaction.newQuantity,
        orderId: transaction.orderId,
        referenceId: transaction.referenceId,
        reason: transaction.reason,
        performedBy: transaction.performedBy,
        notes: transaction.notes,
        createdAt: transaction.createdAt
      });
    } catch (error) {
      this.logger.error(`Get transaction error: ${error}`);
      res.status(500).json({ message: 'Failed to get transaction' });
    }
  }

  /**
   * Get transactions for a product
   */
  private async getProductTransactions(req: Request, res: Response): Promise<void> {
    try {
      const { productId } = req.params;
      const { page = 1, limit = 10 } = req.query;
      
      // Parse pagination
      const skip = (parseInt(page as string) - 1) * parseInt(limit as string);
      
      // Get transactions
      const transactions = await this.transactionModel
        .find({ productId })
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(parseInt(limit as string));
      
      // Get total count
      const total = await this.transactionModel.countDocuments({ productId });
      
      // Get product details
      const product = await this.productModel.findOne({ productId });
      
      res.status(200).json({
        productId,
        productName: product ? product.name : 'Unknown Product',
        transactions: transactions.map(t => ({
          transactionId: t.transactionId,
          storeId: t.storeId,
          type: t.type,
          quantity: t.quantity,
          previousQuantity: t.previousQuantity,
          newQuantity: t.newQuantity,
          orderId: t.orderId,
          reason: t.reason,
          createdAt: t.createdAt
        })),
        pagination: {
          page: parseInt(page as string),
          limit: parseInt(limit as string),
          total,
          pages: Math.ceil(total / parseInt(limit as string))
        }
      });
    } catch (error) {
      this.logger.error(`Get product transactions error: ${error}`);
      res.status(500).json({ message: 'Failed to get product transactions' });
    }
  }

  /**
   * Create a new supplier
   */
  private async createSupplier(req: Request, res: Response): Promise<void> {
    try {
      const { 
        name, 
        contactName, 
        email, 
        phone, 
        address, 
        website, 
        paymentTerms, 
        leadTime, 
        minOrderValue, 
        notes 
      } = req.body;
      
      // Validate required fields
      if (!name || !contactName || !email || !phone || !address) {
        res.status(400).json({ message: 'Name, contact name, email, phone, and address are required' });
        return;
      }
      
      // Create supplier
      const supplierId = uuidv4();
      const supplier = new this.supplierModel({
        supplierId,
        name,
        contactName,
        email,
        phone,
        address,
        website,
        paymentTerms,
        leadTime,
        minOrderValue,
        notes,
        isActive: true
      });
      
      await supplier.save();
      
      res.status(201).json({
        supplierId: supplier.supplierId,
        name: supplier.name,
        contactName: supplier.contactName,
        email: supplier.email,
        phone: supplier.phone,
        address: supplier.address,
        createdAt: supplier.createdAt
      });
    } catch (error: any) {
      this.logger.error(`Supplier creation error: ${error}`);
      res.status(500).json({ message: 'Failed to create supplier', error: error.message });
    }
  }

  /**
   * Get supplier by ID
   */
  private async getSupplier(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      
      const supplier = await this.supplierModel.findOne({
        $or: [
          { supplierId: id },
          { _id: mongoose.isValidObjectId(id) ? id : undefined }
        ]
      });
      
      if (!supplier) {
        res.status(404).json({ message: 'Supplier not found' });
        return;
      }
      
      res.status(200).json({
        supplierId: supplier.supplierId,
        name: supplier.name,
        contactName: supplier.contactName,
        email: supplier.email,
        phone: supplier.phone,
        address: supplier.address,
        website: supplier.website,
        paymentTerms: supplier.paymentTerms,
        leadTime: supplier.leadTime,
        minOrderValue: supplier.minOrderValue,
        notes: supplier.notes,
        isActive: supplier.isActive,
        createdAt: supplier.createdAt,
        updatedAt: supplier.updatedAt
      });
    } catch (error) {
      this.logger.error(`Get supplier error: ${error}`);
      res.status(500).json({ message: 'Failed to get supplier' });
    }
  }

  /**
   * Update a supplier
   */
  private async updateSupplier(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const { 
        name, 
        contactName, 
        email, 
        phone, 
        address, 
        website, 
        paymentTerms, 
        leadTime, 
        minOrderValue, 
        notes, 
        isActive 
      } = req.body;
      
      const supplier = await this.supplierModel.findOne({
        $or: [
          { supplierId: id },
          { _id: mongoose.isValidObjectId(id) ? id : undefined }
        ]
      });
      
      if (!supplier) {
        res.status(404).json({ message: 'Supplier not found' });
        return;
      }
      
      // Update fields if provided
      if (name !== undefined) supplier.name = name;
      if (contactName !== undefined) supplier.contactName = contactName;
      if (email !== undefined) supplier.email = email;
      if (phone !== undefined) supplier.phone = phone;
      if (address !== undefined) supplier.address = address;
      if (website !== undefined) supplier.website = website;
      if (paymentTerms !== undefined) supplier.paymentTerms = paymentTerms;
      if (leadTime !== undefined) supplier.leadTime = leadTime;
      if (minOrderValue !== undefined) supplier.minOrderValue = minOrderValue;
      if (notes !== undefined) supplier.notes = notes;
      if (isActive !== undefined) supplier.isActive = isActive;
      
      await supplier.save();
      
      res.status(200).json({
        supplierId: supplier.supplierId,
        name: supplier.name,
        contactName: supplier.contactName,
        email: supplier.email,
        phone: supplier.phone,
        address: supplier.address,
        website: supplier.website,
        paymentTerms: supplier.paymentTerms,
        leadTime: supplier.leadTime,
        minOrderValue: supplier.minOrderValue,
        isActive: supplier.isActive,
        updatedAt: supplier.updatedAt
      });
    } catch (error) {
      this.logger.error(`Update supplier error: ${error}`);
      res.status(500).json({ message: 'Failed to update supplier' });
    }
  }

  /**
   * Get all suppliers
   */
  private async getSuppliers(req: Request, res: Response): Promise<void> {
    try {
      const { isActive, search, page = 1, limit = 10 } = req.query;
      
      // Build query
      const query: any = {};
      
      if (isActive !== undefined) {
        query.isActive = isActive === 'true';
      }
      
      if (search) {
        query.$text = { $search: search as string };
      }
      
      // Parse pagination
      const skip = (parseInt(page as string) - 1) * parseInt(limit as string);
      
      // Get suppliers
      const suppliers = await this.supplierModel
        .find(query)
        .sort({ name: 1 })
        .skip(skip)
        .limit(parseInt(limit as string));
      
      // Get total count
      const total = await this.supplierModel.countDocuments(query);
      
      res.status(200).json({
        suppliers: suppliers.map(s => ({
          supplierId: s.supplierId,
          name: s.name,
          contactName: s.contactName,
          email: s.email,
          phone: s.phone,
          isActive: s.isActive
        })),
        pagination: {
          page: parseInt(page as string),
          limit: parseInt(limit as string),
          total,
          pages: Math.ceil(total / parseInt(limit as string))
        }
      });
    } catch (error) {
      this.logger.error(`Get suppliers error: ${error}`);
      res.status(500).json({ message: 'Failed to get suppliers' });
    }
  }

  /**
   * Create a new purchase order
   */
  private async createPurchaseOrder(req: Request, res: Response): Promise<void> {
    try {
      const { 
        supplierId, 
        storeId, 
        items, 
        expectedDeliveryDate, 
        paymentTerms, 
        shipping = 0, 
        tax = 0, 
        notes 
      } = req.body;
      
      // Validate required fields
      if (!supplierId || !storeId || !items || !items.length) {
        res.status(400).json({ message: 'Supplier ID, store ID, and items are required' });
        return;
      }
      
      // Validate supplier exists
      const supplier = await this.supplierModel.findOne({ supplierId });
      if (!supplier) {
        res.status(404).json({ message: 'Supplier not found' });
        return;
      }
      
      // Format and validate items
      const formattedItems = [];
      let subtotal = 0;
      
      for (const item of items) {
        const { productId, sku, quantity, unitPrice } = item;
        
        if ((!productId && !sku) || !quantity || quantity <= 0 || !unitPrice || unitPrice < 0) {
          res.status(400).json({ 
            message: 'Each item must have product ID or SKU, positive quantity, and valid unit price' 
          });
          return;
        }
        
        // Find product if only SKU is provided
        let finalProductId = productId;
        let finalSku = sku;
        
        if (!finalProductId && finalSku) {
          const product = await this.productModel.findOne({ sku: finalSku });
          if (product) {
            finalProductId = product.productId;
          }
        } else if (finalProductId && !finalSku) {
          const product = await this.productModel.findOne({ productId: finalProductId });
          if (product) {
            finalSku = product.sku;
          }
        }
        
        if (!finalProductId || !finalSku) {
          res.status(404).json({ message: `Product not found for ${productId || sku}` });
          return;
        }
        
        const totalPrice = quantity * unitPrice;
        subtotal += totalPrice;
        
        formattedItems.push({
          productId: finalProductId,
          sku: finalSku,
          quantity,
          unitPrice,
          totalPrice,
          notes: item.notes
        });
      }
      
      // Calculate total
      const total = subtotal + tax + shipping;
      
      // Create purchase order
      const purchaseOrderId = uuidv4();
      const purchaseOrder = new this.purchaseOrderModel({
        purchaseOrderId,
        supplierId,
        storeId,
        items: formattedItems,
        subtotal,
        tax,
        shipping,
        total,
        expectedDeliveryDate,
        paymentStatus: 'UNPAID',
        paymentTerms: paymentTerms || supplier.paymentTerms,
        notes,
        status: 'DRAFT'
      });
      
      await purchaseOrder.save();
      
      res.status(201).json({
        purchaseOrderId: purchaseOrder.purchaseOrderId,
        supplierId: purchaseOrder.supplierId,
        storeId: purchaseOrder.storeId,
        status: purchaseOrder.status,
        itemCount: purchaseOrder.items.length,
        subtotal: purchaseOrder.subtotal,
        tax: purchaseOrder.tax,
        shipping: purchaseOrder.shipping,
        total: purchaseOrder.total,
        createdAt: purchaseOrder.createdAt
      });
    } catch (error: any) {
      this.logger.error(`Purchase order creation error: ${error}`);
      res.status(500).json({ message: 'Failed to create purchase order', error: error.message });
    }
  }

  /**
   * Get purchase order by ID
   */
  private async getPurchaseOrder(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      
      const purchaseOrder = await this.purchaseOrderModel.findOne({
        $or: [
          { purchaseOrderId: id },
          { _id: mongoose.isValidObjectId(id) ? id : undefined }
        ]
      });
      
      if (!purchaseOrder) {
        res.status(404).json({ message: 'Purchase order not found' });
        return;
      }
      
      // Get supplier info
      const supplier = await this.supplierModel.findOne({ supplierId: purchaseOrder.supplierId });
      
      res.status(200).json({
        purchaseOrderId: purchaseOrder.purchaseOrderId,
        supplierId: purchaseOrder.supplierId,
        supplierName: supplier ? supplier.name : 'Unknown Supplier',
        storeId: purchaseOrder.storeId,
        status: purchaseOrder.status,
        items: purchaseOrder.items,
        subtotal: purchaseOrder.subtotal,
        tax: purchaseOrder.tax,
        shipping: purchaseOrder.shipping,
        total: purchaseOrder.total,
        expectedDeliveryDate: purchaseOrder.expectedDeliveryDate,
        actualDeliveryDate: purchaseOrder.actualDeliveryDate,
        paymentStatus: purchaseOrder.paymentStatus,
        paymentTerms: purchaseOrder.paymentTerms,
        notes: purchaseOrder.notes,
        createdAt: purchaseOrder.createdAt,
        submittedAt: purchaseOrder.submittedAt,
        confirmedAt: purchaseOrder.confirmedAt,
        shippedAt: purchaseOrder.shippedAt,
        receivedAt: purchaseOrder.receivedAt,
        cancelledAt: purchaseOrder.cancelledAt
      });
    } catch (error) {
      this.logger.error(`Get purchase order error: ${error}`);
      res.status(500).json({ message: 'Failed to get purchase order' });
    }
  }

  /**
   * Update a purchase order
   */
  private async updatePurchaseOrder(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const { 
        items, 
        expectedDeliveryDate, 
        paymentTerms, 
        shipping, 
        tax, 
        notes 
      } = req.body;
      
      const purchaseOrder = await this.purchaseOrderModel.findOne({
        $or: [
          { purchaseOrderId: id },
          { _id: mongoose.isValidObjectId(id) ? id : undefined }
        ]
      });
      
      if (!purchaseOrder) {
        res.status(404).json({ message: 'Purchase order not found' });
        return;
      }
      
      // Only allow updates if in DRAFT status
      if (purchaseOrder.status !== 'DRAFT') {
        res.status(400).json({ 
          message: `Cannot update purchase order in ${purchaseOrder.status} status` 
        });
        return;
      }
      
      // Update items if provided
      if (items && items.length > 0) {
        // Format and validate items
        const formattedItems = [];
        let subtotal = 0;
        
        for (const item of items) {
          const { productId, sku, quantity, unitPrice } = item;
          
          if ((!productId && !sku) || !quantity || quantity <= 0 || !unitPrice || unitPrice < 0) {
            res.status(400).json({ 
              message: 'Each item must have product ID or SKU, positive quantity, and valid unit price' 
            });
            return;
          }
          
          // Find product if only SKU is provided
          let finalProductId = productId;
          let finalSku = sku;
          
          if (!finalProductId && finalSku) {
            const product = await this.productModel.findOne({ sku: finalSku });
            if (product) {
              finalProductId = product.productId;
            }
          } else if (finalProductId && !finalSku) {
            const product = await this.productModel.findOne({ productId: finalProductId });
            if (product) {
              finalSku = product.sku;
            }
          }
          
          if (!finalProductId || !finalSku) {
            res.status(404).json({ message: `Product not found for ${productId || sku}` });
            return;
          }
          
          const totalPrice = quantity * unitPrice;
          subtotal += totalPrice;
          
          formattedItems.push({
            productId: finalProductId,
            sku: finalSku,
            quantity,
            unitPrice,
            totalPrice,
            notes: item.notes
          });
        }
        
        purchaseOrder.items = formattedItems;
        purchaseOrder.subtotal = subtotal;
      }
      
      // Update other fields if provided
      if (expectedDeliveryDate !== undefined) purchaseOrder.expectedDeliveryDate = new Date(expectedDeliveryDate);
      if (paymentTerms !== undefined) purchaseOrder.paymentTerms = paymentTerms;
      if (shipping !== undefined) purchaseOrder.shipping = shipping;
      if (tax !== undefined) purchaseOrder.tax = tax;
      if (notes !== undefined) purchaseOrder.notes = notes;
      
      // Recalculate total
      purchaseOrder.total = purchaseOrder.subtotal + purchaseOrder.tax + purchaseOrder.shipping;
      
      await purchaseOrder.save();
      
      res.status(200).json({
        purchaseOrderId: purchaseOrder.purchaseOrderId,
        supplierId: purchaseOrder.supplierId,
        storeId: purchaseOrder.storeId,
        status: purchaseOrder.status,
        itemCount: purchaseOrder.items.length,
        subtotal: purchaseOrder.subtotal,
        tax: purchaseOrder.tax,
        shipping: purchaseOrder.shipping,
        total: purchaseOrder.total,
        updatedAt: purchaseOrder.updatedAt
      });
    } catch (error) {
      this.logger.error(`Update purchase order error: ${error}`);
      res.status(500).json({ message: 'Failed to update purchase order' });
    }
  }

  /**
   * Submit a purchase order
   */
  private async submitPurchaseOrder(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const { notes } = req.body;
      
      const purchaseOrder = await this.purchaseOrderModel.findOne({
        $or: [
          { purchaseOrderId: id },
          { _id: mongoose.isValidObjectId(id) ? id : undefined }
        ]
      });
      
      if (!purchaseOrder) {
        res.status(404).json({ message: 'Purchase order not found' });
        return;
      }
      
      // Only allow submission if in DRAFT status
      if (purchaseOrder.status !== 'DRAFT') {
        res.status(400).json({ 
          message: `Cannot submit purchase order in ${purchaseOrder.status} status` 
        });
        return;
      }
      
      // Update status and add notes
      purchaseOrder.status = 'SUBMITTED';
      purchaseOrder.submittedAt = new Date();
      
      if (notes) {
        purchaseOrder.notes = (purchaseOrder.notes || '') + `\nSubmission: ${notes}`;
      }
      
      await purchaseOrder.save();
      
      // Get supplier info for notification
      const supplier = await this.supplierModel.findOne({ supplierId: purchaseOrder.supplierId });
      
      // Publish purchase order submitted event
      await this.messageBus.publish('inventory', 'purchase-order.submitted', {
        purchaseOrderId: purchaseOrder.purchaseOrderId,
        supplierId: purchaseOrder.supplierId,
        supplierName: supplier ? supplier.name : 'Unknown Supplier',
        storeId: purchaseOrder.storeId,
        itemCount: purchaseOrder.items.length,
        total: purchaseOrder.total,
        expectedDeliveryDate: purchaseOrder.expectedDeliveryDate,
        timestamp: new Date().toISOString()
      });
      
      res.status(200).json({
        purchaseOrderId: purchaseOrder.purchaseOrderId,
        status: purchaseOrder.status,
        submittedAt: purchaseOrder.submittedAt,
        message: 'Purchase order submitted successfully'
      });
    } catch (error) {
      this.logger.error(`Submit purchase order error: ${error}`);
      res.status(500).json({ message: 'Failed to submit purchase order' });
    }
  }

  /**
   * Receive a purchase order
   */
  private async receivePurchaseOrder(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const { 
        items, 
        notes, 
        actualDeliveryDate = new Date() 
      } = req.body;
      
      // Start a session for transaction
      const session = await mongoose.startSession();
      session.startTransaction();
      
      try {
        const purchaseOrder = await this.purchaseOrderModel.findOne({
          $or: [
            { purchaseOrderId: id },
            { _id: mongoose.isValidObjectId(id) ? id : undefined }
          ]
        }).session(session);
        
        if (!purchaseOrder) {
          await session.abortTransaction();
          session.endSession();
          res.status(404).json({ message: 'Purchase order not found' });
          return;
        }
        
        // Only allow receiving if in CONFIRMED or SHIPPED status
        if (purchaseOrder.status !== 'CONFIRMED' && purchaseOrder.status !== 'SHIPPED') {
          await session.abortTransaction();
          session.endSession();
          res.status(400).json({ 
            message: `Cannot receive purchase order in ${purchaseOrder.status} status` 
          });
          return;
        }
        
        // Update received quantities
        if (items && items.length > 0) {
          // Map of item ID/SKU to received quantity
          const receivedQuantities: Record<string, number> = {};
          
          for (const item of items) {
            const { productId, sku, receivedQuantity } = item;
            const key = productId || sku;
            
            if (!key || receivedQuantity === undefined || receivedQuantity < 0) {
              await session.abortTransaction();
              session.endSession();
              res.status(400).json({ 
                message: 'Each item must have product ID or SKU and valid received quantity' 
              });
              return;
            }
            
            receivedQuantities[key] = receivedQuantity;
          }
          
          // Update quantities in purchase order
          for (const poItem of purchaseOrder.items) {
            const key = poItem.productId || poItem.sku;
            if (receivedQuantities[key] !== undefined) {
              poItem.receivedQuantity = receivedQuantities[key];
            }
          }
        } else {
          // If no items specified, assume all items received in full
          for (const poItem of purchaseOrder.items) {
            poItem.receivedQuantity = poItem.quantity;
          }
        }
        
        // Update status and timestamps
        purchaseOrder.status = 'RECEIVED';
        purchaseOrder.actualDeliveryDate = actualDeliveryDate;
        purchaseOrder.receivedAt = new Date();
        
        if (notes) {
          purchaseOrder.notes = (purchaseOrder.notes || '') + `\nReceived: ${notes}`;
        }
        
        await purchaseOrder.save({ session });
        
        // Update inventory for each received item
        const inventoryUpdates = [];
        
        for (const poItem of purchaseOrder.items) {
          if (!poItem.receivedQuantity || poItem.receivedQuantity <= 0) {
            continue; // Skip items with no received quantity
          }
          
          // Find inventory
          let inventory = await this.inventoryModel.findOne({ 
            productId: poItem.productId, 
            storeId: purchaseOrder.storeId 
          }).session(session);
          
          if (!inventory) {
            // Create inventory record if it doesn't exist
            const inventoryId = uuidv4();
            inventory = new this.inventoryModel({
              inventoryId,
              productId: poItem.productId,
              sku: poItem.sku,
              storeId: purchaseOrder.storeId,
              quantity: 0,
              reservedQuantity: 0,
              backorderEnabled: false,
              backorderLimit: 0,
              reorderPoint: 5,
              reorderQuantity: 10
            });
          }
          
          // Record previous quantity
          const previousQuantity = inventory.quantity;
          
          // Update quantity
          inventory.quantity += poItem.receivedQuantity;
          inventory.lastRestockedAt = new Date();
          
          await inventory.save({ session });
          
          // Create transaction record
          const transactionId = uuidv4();
          const transaction = new this.transactionModel({
            transactionId,
            inventoryId: inventory.inventoryId,
            productId: inventory.productId,
            sku: inventory.sku,
            storeId: purchaseOrder.storeId,
            type: 'RESTOCK',
            quantity: poItem.receivedQuantity,
            previousQuantity,
            newQuantity: inventory.quantity,
            referenceId: purchaseOrder.purchaseOrderId,
            reason: 'Purchase order received',
            performedBy: (req as any).user.userId,
            notes: `PO #${purchaseOrder.purchaseOrderId}`
          });
          
          await transaction.save({ session });
          
          inventoryUpdates.push({
            productId: inventory.productId,
            sku: inventory.sku,
            receivedQuantity: poItem.receivedQuantity,
            newQuantity: inventory.quantity,
            transaction: transactionId
          });
        }
        
        // Commit transaction
        await session.commitTransaction();
        
        // Publish purchase order received event
        await this.messageBus.publish('inventory', 'purchase-order.received', {
          purchaseOrderId: purchaseOrder.purchaseOrderId,
          supplierId: purchaseOrder.supplierId,
          storeId: purchaseOrder.storeId,
          receivedAt: purchaseOrder.receivedAt,
          items: inventoryUpdates,
          timestamp: new Date().toISOString()
        });
        
        res.status(200).json({
          purchaseOrderId: purchaseOrder.purchaseOrderId,
          status: purchaseOrder.status,
          receivedAt: purchaseOrder.receivedAt,
          itemsReceived: inventoryUpdates.length,
          inventoryUpdates,
          message: 'Purchase order received successfully'
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
      this.logger.error(`Receive purchase order error: ${error}`);
      res.status(500).json({ message: 'Failed to receive purchase order' });
    }
  }

  /**
   * Cancel a purchase order
   */
  private async cancelPurchaseOrder(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const { reason } = req.body;
      
      const purchaseOrder = await this.purchaseOrderModel.findOne({
        $or: [
          { purchaseOrderId: id },
          { _id: mongoose.isValidObjectId(id) ? id : undefined }
        ]
      });
      
      if (!purchaseOrder) {
        res.status(404).json({ message: 'Purchase order not found' });
        return;
      }
      
      // Only allow cancellation in certain statuses
      const allowedStatuses = ['DRAFT', 'SUBMITTED', 'CONFIRMED'];
      
      if (!allowedStatuses.includes(purchaseOrder.status)) {
        res.status(400).json({ 
          message: `Cannot cancel purchase order in ${purchaseOrder.status} status` 
        });
        return;
      }
      
      // Update status
      purchaseOrder.status = 'CANCELLED';
      purchaseOrder.cancelledAt = new Date();
      purchaseOrder.notes = (purchaseOrder.notes || '') + `\nCancelled: ${reason || 'No reason provided'}`;
      
      await purchaseOrder.save();
      
      // Publish purchase order cancelled event
      await this.messageBus.publish('inventory', 'purchase-order.cancelled', {
        purchaseOrderId: purchaseOrder.purchaseOrderId,
        supplierId: purchaseOrder.supplierId,
        storeId: purchaseOrder.storeId,
        reason,
        timestamp: new Date().toISOString()
      });
      
      res.status(200).json({
        purchaseOrderId: purchaseOrder.purchaseOrderId,
        status: purchaseOrder.status,
        cancelledAt: purchaseOrder.cancelledAt,
        message: 'Purchase order cancelled successfully'
      });
    } catch (error) {
      this.logger.error(`Cancel purchase order error: ${error}`);
      res.status(500).json({ message: 'Failed to cancel purchase order' });
    }
  }

  /**
   * Get purchase orders
   */
  private async getPurchaseOrders(req: Request, res: Response): Promise<void> {
    try {
      const { 
        supplierId, 
        storeId, 
        status, 
        startDate, 
        endDate, 
        page = 1, 
        limit = 10 
      } = req.query;
      
      // Build query
      const query: any = {};
      
      if (supplierId) query.supplierId = supplierId;
      if (storeId) query.storeId = storeId;
      if (status) query.status = status;
      
      // Date range
      if (startDate || endDate) {
        query.createdAt = {};
        if (startDate) query.createdAt.$gte = new Date(startDate as string);
        if (endDate) query.createdAt.$lte = new Date(endDate as string);
      }
      
      // Parse pagination
      const skip = (parseInt(page as string) - 1) * parseInt(limit as string);
      
      // Get purchase orders
      const purchaseOrders = await this.purchaseOrderModel
        .find(query)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(parseInt(limit as string));
      
      // Get total count
      const total = await this.purchaseOrderModel.countDocuments(query);
      
      // Get supplier info for each purchase order
      const supplierIds = [...new Set(purchaseOrders.map(po => po.supplierId))];
      const suppliers = await this.supplierModel.find({ supplierId: { $in: supplierIds } });
      
      // Create supplier ID to name map
      const supplierMap = suppliers.reduce((map, supplier) => {
        map[supplier.supplierId] = supplier.name;
        return map;
      }, {} as Record<string, string>);
      
      res.status(200).json({
        purchaseOrders: purchaseOrders.map(po => ({
          purchaseOrderId: po.purchaseOrderId,
          supplierId: po.supplierId,
          supplierName: supplierMap[po.supplierId] || 'Unknown Supplier',
          storeId: po.storeId,
          status: po.status,
          itemCount: po.items.length,
          total: po.total,
          expectedDeliveryDate: po.expectedDeliveryDate,
          createdAt: po.createdAt
        })),
        pagination: {
          page: parseInt(page as string),
          limit: parseInt(limit as string),
          total,
          pages: Math.ceil(total / parseInt(limit as string))
        }
      });
    } catch (error) {
      this.logger.error(`Get purchase orders error: ${error}`);
      res.status(500).json({ message: 'Failed to get purchase orders' });
    }
  }

  /**
   * Get low stock alerts
   */
  private async getLowStockAlerts(req: Request, res: Response): Promise<void> {
    try {
      const { storeId, page = 1, limit = 10 } = req.query;
      
      // Build query - find items where quantity is at or below reorder point
      const query: any = {
        $expr: { $lte: ['$quantity', '$reorderPoint'] }
      };
      
      if (storeId) {
        query.storeId = storeId;
      }
      
      // Parse pagination
      const skip = (parseInt(page as string) - 1) * parseInt(limit as string);
      
      // Get inventory items
      const inventoryItems = await this.inventoryModel
        .find(query)
        .sort({ quantity: 1 })
        .skip(skip)
        .limit(parseInt(limit as string));
      
      // Get total count
      const total = await this.inventoryModel.countDocuments(query);
      
      // Get product details
      const productIds = inventoryItems.map(item => item.productId);
      const products = await this.productModel.find({
        productId: { $in: productIds }
      });
      
      // Create product ID to product map
      const productMap = products.reduce((map, product) => {
        map[product.productId] = product;
        return map;
      }, {} as Record<string, IProduct>);
      
      res.status(200).json({
        alerts: inventoryItems.map(item => {
          const product = productMap[item.productId];
          const isOutOfStock = item.quantity === 0;
          
          return {
            inventoryId: item.inventoryId,
            productId: item.productId,
            sku: item.sku,
            storeId: item.storeId,
            name: product ? product.name : 'Unknown Product',
            category: product ? product.category : 'Unknown',
            quantity: item.quantity,
            reservedQuantity: item.reservedQuantity,
            availableQuantity: item.quantity - item.reservedQuantity,
            reorderPoint: item.reorderPoint,
            reorderQuantity: item.reorderQuantity,
            isOutOfStock,
            severity: isOutOfStock ? 'HIGH' : 'MEDIUM',
            lastRestockedAt: item.lastRestockedAt
          };
        }),
        pagination: {
          page: parseInt(page as string),
          limit: parseInt(limit as string),
          total,
          pages: Math.ceil(total / parseInt(limit as string))
        }
      });
    } catch (error) {
      this.logger.error(`Get low stock alerts error: ${error}`);
      res.status(500).json({ message: 'Failed to get low stock alerts' });
    }
  }

  /**
   * Handle order confirmed event
   */
  private async handleOrderConfirmed(content: any): Promise<void> {
    try {
      const { orderId, items, storeId } = content;
      
      if (!orderId || !items || !items.length) {
        this.logger.error('Invalid order confirmed event data');
        return;
      }
      
      // Use default store if not specified
      const targetStoreId = storeId || 'store_default';
      
      // Reserve inventory for this order
      const reservePayload = {
        orderId,
        storeId: targetStoreId,
        items: items.map((item: any) => ({
          productId: item.productId,
          sku: item.sku,
          quantity: item.quantity
        }))
      };
      
      try {
        // Call the reserve inventory method
        await this.reserveInventory({
          body: reservePayload,
          user: { userId: 'system' }
        } as any, {
          status: () => ({
            json: (data: any) => {
              if (data.success) {
                this.logger.info(`Successfully reserved inventory for order ${orderId}`);
              } else {
                this.logger.error(`Failed to reserve inventory for order ${orderId}`);
              }
            }
          })
        } as any);
      } catch (error) {
        this.logger.error(`Error reserving inventory for order ${orderId}: ${error}`);
        
        // Publish inventory allocation failed event
        await this.messageBus.publish('inventory', 'inventory.allocation.failed', {
          orderId,
          storeId: targetStoreId,
          reason: `Error reserving inventory: ${error}`,
          timestamp: new Date().toISOString()
        });
      }
    } catch (error) {
      this.logger.error(`Handle order confirmed error: ${error}`);
    }
  }

  /**
   * Handle order cancelled event
   */
  private async handleOrderCancelled(content: any): Promise<void> {
    try {
      const { orderId, storeId } = content;
      
      if (!orderId) {
        this.logger.error('Invalid order cancelled event data');
        return;
      }
      
      // Release any reserved inventory for this order
      const releasePayload = {
        orderId,
        storeId: storeId || 'store_default',
        reason: 'Order cancelled'
      };
      
      try {
        // Call the release inventory method
        await this.releaseInventory({
          body: releasePayload,
          user: { userId: 'system' }
        } as any, {
          status: () => ({
            json: (data: any) => {
              if (data.success) {
                this.logger.info(`Successfully released inventory for cancelled order ${orderId}`);
              } else {
                this.logger.error(`Failed to release inventory for cancelled order ${orderId}`);
              }
            }
          })
        } as any);
      } catch (error) {
        this.logger.error(`Error releasing inventory for cancelled order ${orderId}: ${error}`);
      }
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
  const inventoryService = new InventoryService();
  inventoryService.start().catch(error => {
    console.error('Failed to start Inventory Service:', error);
    process.exit(1);
  });
  
  // Handle graceful shutdown
  const shutdown = async () => {
    await inventoryService.shutdown();
    process.exit(0);
  };
  
  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}

export default InventoryService;