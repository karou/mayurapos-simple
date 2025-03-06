import { Request, Response } from 'express';
import mongoose, { Schema, Document } from 'mongoose';
import { v4 as uuidv4 } from 'uuid';
import { BaseService } from '../../shared/base-service';
import { MessageBus } from '../../shared/message-bus';
import * as fs from 'fs';
import * as path from 'path';
import * as csv from 'fast-csv';
import axios from 'axios';

// Environment variables
const ORDER_SERVICE_URL = process.env.ORDER_SERVICE_URL || 'http://localhost:3004';
const INVENTORY_SERVICE_URL = process.env.INVENTORY_SERVICE_URL || 'http://localhost:3003';
const PAYMENT_SERVICE_URL = process.env.PAYMENT_SERVICE_URL || 'http://localhost:3002';
const DELIVERY_SERVICE_URL = process.env.DELIVERY_SERVICE_URL || 'http://localhost:3005';

// Report type enum
enum ReportType {
  SALES = 'SALES',
  INVENTORY = 'INVENTORY',
  PAYMENT = 'PAYMENT',
  DELIVERY = 'DELIVERY',
  CUSTOMER = 'CUSTOMER',
  FINANCIAL = 'FINANCIAL',
  CUSTOM = 'CUSTOM'
}

// Report format enum
enum ReportFormat {
  JSON = 'JSON',
  CSV = 'CSV',
  PDF = 'PDF',
  EXCEL = 'EXCEL'
}

// Report time period enum
enum ReportTimePeriod {
  DAILY = 'DAILY',
  WEEKLY = 'WEEKLY',
  MONTHLY = 'MONTHLY',
  QUARTERLY = 'QUARTERLY',
  YEARLY = 'YEARLY',
  CUSTOM = 'CUSTOM'
}

// Report status enum
enum ReportStatus {
  PENDING = 'PENDING',
  GENERATING = 'GENERATING',
  COMPLETED = 'COMPLETED',
  FAILED = 'FAILED',
  EXPIRED = 'EXPIRED'
}

// Report interface
interface IReport extends Document {
  reportId: string;
  name: string;
  description?: string;
  type: ReportType;
  format: ReportFormat;
  status: ReportStatus;
  parameters: {
    startDate?: Date;
    endDate?: Date;
    storeId?: string;
    productId?: string;
    categoryId?: string;
    userId?: string;
    timePeriod?: ReportTimePeriod;
    filters?: Record<string, any>;
    groupBy?: string[];
    metrics?: string[];
    limit?: number;
    sort?: Record<string, 1 | -1>;
  };
  result?: {
    summary?: Record<string, any>;
    data?: any[];
    charts?: any[];
    url?: string;
    filePath?: string;
    fileSize?: number;
    generatedAt?: Date;
    expiresAt?: Date;
  };
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
  isScheduled: boolean;
  schedule?: {
    frequency: 'DAILY' | 'WEEKLY' | 'MONTHLY';
    dayOfWeek?: number;
    dayOfMonth?: number;
    hour: number;
    minute: number;
    recipients?: string[];
    lastRun?: Date;
    nextRun?: Date;
    active: boolean;
  };
  metadata?: Record<string, any>;
}

// Data summary interface
interface IDataSummary extends Document {
  summaryId: string;
  type: 'DAILY' | 'WEEKLY' | 'MONTHLY';
  date: string;
  dataType: 'SALES' | 'INVENTORY' | 'PAYMENT' | 'DELIVERY';
  data: {
    count: number;
    total?: number;
    average?: number;
    metrics: Record<string, any>;
  };
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Reporting Service - Handles analytics and reporting
 */
export class ReportingService extends BaseService {
  private messageBus: MessageBus;
  private reportModel: mongoose.Model<IReport>;
  private dataSummaryModel: mongoose.Model<IDataSummary>;
  private isGeneratingReport: boolean = false;
  private readonly reportsDir: string;

  /**
   * Initialize the Reporting Service
   */
  constructor() {
    // Initialize base service with configuration
    super(
      'reporting-service',
      parseInt(process.env.PORT || '3006'),
      process.env.MONGO_URI || 'mongodb://localhost:27017/mayura-reporting',
      process.env.RABBITMQ_URI || 'amqp://localhost',
      process.env.REDIS_URI || 'redis://localhost:6379'
    );

    // Initialize message bus
    this.messageBus = new MessageBus(
      this.rabbitmqUri,
      this.serviceName,
      this.logger
    );

    // Define reports directory
    this.reportsDir = path.join(process.cwd(), 'reports');
    this.ensureReportsDirectory();

    // Define report schema
    const reportSchema = new Schema<IReport>({
      reportId: { 
        type: String, 
        required: true, 
        unique: true 
      },
      name: { 
        type: String, 
        required: true 
      },
      description: { 
        type: String 
      },
      type: { 
        type: String, 
        required: true,
        enum: Object.values(ReportType) 
      },
      format: { 
        type: String, 
        required: true,
        enum: Object.values(ReportFormat),
        default: ReportFormat.JSON 
      },
      status: { 
        type: String, 
        required: true,
        enum: Object.values(ReportStatus),
        default: ReportStatus.PENDING,
        index: true
      },
      parameters: {
        startDate: { type: Date },
        endDate: { type: Date },
        storeId: { type: String },
        productId: { type: String },
        categoryId: { type: String },
        userId: { type: String },
        timePeriod: { 
          type: String,
          enum: Object.values(ReportTimePeriod)
        },
        filters: { type: Schema.Types.Mixed },
        groupBy: [String],
        metrics: [String],
        limit: { type: Number },
        sort: { type: Schema.Types.Mixed }
      },
      result: {
        summary: { type: Schema.Types.Mixed },
        data: { type: Schema.Types.Mixed },
        charts: { type: Schema.Types.Mixed },
        url: { type: String },
        filePath: { type: String },
        fileSize: { type: Number },
        generatedAt: { type: Date },
        expiresAt: { type: Date }
      },
      createdBy: { 
        type: String, 
        required: true 
      },
      isScheduled: { 
        type: Boolean, 
        required: true,
        default: false 
      },
      schedule: {
        frequency: { 
          type: String,
          enum: ['DAILY', 'WEEKLY', 'MONTHLY'] 
        },
        dayOfWeek: { type: Number },
        dayOfMonth: { type: Number },
        hour: { type: Number },
        minute: { type: Number },
        recipients: [String],
        lastRun: { type: Date },
        nextRun: { type: Date },
        active: { type: Boolean }
      },
      metadata: { type: Schema.Types.Mixed }
    }, {
      timestamps: true
    });

    // Define data summary schema
    const dataSummarySchema = new Schema<IDataSummary>({
      summaryId: { 
        type: String, 
        required: true, 
        unique: true 
      },
      type: { 
        type: String, 
        required: true,
        enum: ['DAILY', 'WEEKLY', 'MONTHLY'],
        index: true
      },
      date: { 
        type: String, 
        required: true,
        index: true
      },
      dataType: { 
        type: String, 
        required: true,
        enum: ['SALES', 'INVENTORY', 'PAYMENT', 'DELIVERY'],
        index: true
      },
      data: {
        count: { type: Number, required: true },
        total: { type: Number },
        average: { type: Number },
        metrics: { type: Schema.Types.Mixed, required: true }
      }
    }, {
      timestamps: true
    });

    // Create a compound index for efficient lookups
    dataSummarySchema.index({ type: 1, date: 1, dataType: 1 }, { unique: true });

    // Create models
    this.reportModel = mongoose.model<IReport>('Report', reportSchema);
    this.dataSummaryModel = mongoose.model<IDataSummary>('DataSummary', dataSummarySchema);
  }

  /**
   * Initialize routes for the Reporting service
   */
  protected async initRoutes(): Promise<void> {
    // Report generation routes
    this.app.post('/reports', this.authenticate.bind(this), this.createReport.bind(this));
    this.app.get('/reports/:id', this.authenticate.bind(this), this.getReport.bind(this));
    this.app.get('/reports', this.authenticate.bind(this), this.getReports.bind(this));
    this.app.delete('/reports/:id', this.authenticate.bind(this), this.deleteReport.bind(this));
    this.app.get('/reports/:id/download', this.authenticate.bind(this), this.downloadReport.bind(this));
    
    // Schedule report routes
    this.app.post('/reports/schedule', this.authenticate.bind(this), this.scheduleReport.bind(this));
    this.app.put('/reports/schedule/:id', this.authenticate.bind(this), this.updateSchedule.bind(this));
    this.app.delete('/reports/schedule/:id', this.authenticate.bind(this), this.deleteSchedule.bind(this));
    
    // Dashboard data routes
    this.app.get('/dashboard/sales', this.authenticate.bind(this), this.getSalesDashboard.bind(this));
    this.app.get('/dashboard/inventory', this.authenticate.bind(this), this.getInventoryDashboard.bind(this));
    this.app.get('/dashboard/payment', this.authenticate.bind(this), this.getPaymentDashboard.bind(this));
    this.app.get('/dashboard/delivery', this.authenticate.bind(this), this.getDeliveryDashboard.bind(this));
    
    // Summary data routes
    this.app.get('/summaries/:type/:dataType', this.authenticate.bind(this), this.getSummaryData.bind(this));
  }

  /**
   * Initialize message bus handlers
   */
  private async initMessageHandlers(): Promise<void> {
    await this.messageBus.connect();
    
    // Create exchanges
    await this.messageBus.createExchange('reporting', 'topic');
    
    // Create queues
    await this.messageBus.createQueue('reporting.order.events', 'order', 'order.#');
    await this.messageBus.createQueue('reporting.payment.events', 'payment', 'payment.#');
    await this.messageBus.createQueue('reporting.inventory.events', 'inventory', 'inventory.#');
    await this.messageBus.createQueue('reporting.delivery.events', 'delivery', 'delivery.#');
    
    // Listen for order events
    await this.messageBus.subscribe('reporting.order.events', async (content, msg) => {
      this.logger.info(`Received order event: ${msg.fields.routingKey}`, { content });
      
      // Store relevant data for reporting
      // We don't need to handle every event, just the ones that matter for reporting
      if (
        msg.fields.routingKey === 'order.confirmed' ||
        msg.fields.routingKey === 'order.fulfilled' ||
        msg.fields.routingKey === 'order.delivered' ||
        msg.fields.routingKey === 'order.cancelled'
      ) {
        await this.recordOrderEvent(msg.fields.routingKey, content);
      }
    });
    
    // Listen for payment events
    await this.messageBus.subscribe('reporting.payment.events', async (content, msg) => {
      this.logger.info(`Received payment event: ${msg.fields.routingKey}`, { content });
      
      // Store relevant data for reporting
      if (
        msg.fields.routingKey === 'payment.completed' ||
        msg.fields.routingKey === 'payment.refunded'
      ) {
        await this.recordPaymentEvent(msg.fields.routingKey, content);
      }
    });
    
    // Listen for inventory events
    await this.messageBus.subscribe('reporting.inventory.events', async (content, msg) => {
      this.logger.info(`Received inventory event: ${msg.fields.routingKey}`, { content });
      
      // Store relevant data for reporting
      if (
        msg.fields.routingKey === 'inventory.updated' ||
        msg.fields.routingKey === 'product.created' ||
        msg.fields.routingKey === 'purchase-order.received'
      ) {
        await this.recordInventoryEvent(msg.fields.routingKey, content);
      }
    });
    
    // Listen for delivery events
    await this.messageBus.subscribe('reporting.delivery.events', async (content, msg) => {
      this.logger.info(`Received delivery event: ${msg.fields.routingKey}`, { content });
      
      // Store relevant data for reporting
      if (
        msg.fields.routingKey === 'delivery.completed' ||
        msg.fields.routingKey === 'delivery.failed' ||
        msg.fields.routingKey === 'delivery.cancelled'
      ) {
        await this.recordDeliveryEvent(msg.fields.routingKey, content);
      }
    });
    
    // Start the scheduled report processor
    this.startScheduledReportProcessor();
    
    // Start the daily summary generator
    this.startDailySummaryGenerator();
  }

  /**
   * Ensure reports directory exists
   */
  private ensureReportsDirectory(): void {
    if (!fs.existsSync(this.reportsDir)) {
      fs.mkdirSync(this.reportsDir, { recursive: true });
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
   * Create a new report
   */
  private async createReport(req: Request, res: Response): Promise<void> {
    try {
      const { 
        name, 
        description, 
        type, 
        format = ReportFormat.JSON, 
        parameters = {} 
      } = req.body;
      
      // Validate required fields
      if (!name || !type) {
        res.status(400).json({ message: 'Name and type are required' });
        return;
      }
      
      // Create report
      const reportId = uuidv4();
      const report = new this.reportModel({
        reportId,
        name,
        description,
        type,
        format,
        status: ReportStatus.PENDING,
        parameters,
        createdBy: (req as any).user.userId,
        isScheduled: false
      });
      
      await report.save();
      
      // Generate report asynchronously
      this.generateReport(report)
        .catch(error => this.logger.error(`Error generating report: ${error}`));
      
      res.status(201).json({
        reportId: report.reportId,
        name: report.name,
        type: report.type,
        format: report.format,
        status: report.status,
        message: 'Report generation started'
      });
    } catch (error: any) {
      this.logger.error(`Report creation error: ${error}`);
      res.status(500).json({ message: 'Failed to create report', error: error.message });
    }
  }

  /**
   * Get report by ID
   */
  private async getReport(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      
      const report = await this.reportModel.findOne({
        $or: [
          { reportId: id },
          { _id: mongoose.isValidObjectId(id) ? id : undefined }
        ]
      });
      
      if (!report) {
        res.status(404).json({ message: 'Report not found' });
        return;
      }
      
      // If report is pending or generating, return basic info
      if (report.status === ReportStatus.PENDING || report.status === ReportStatus.GENERATING) {
        res.status(200).json({
          reportId: report.reportId,
          name: report.name,
          description: report.description,
          type: report.type,
          format: report.format,
          status: report.status,
          parameters: report.parameters,
          createdBy: report.createdBy,
          createdAt: report.createdAt
        });
        return;
      }
      
      // Return full report info
      res.status(200).json({
        reportId: report.reportId,
        name: report.name,
        description: report.description,
        type: report.type,
        format: report.format,
        status: report.status,
        parameters: report.parameters,
        result: {
          summary: report.result?.summary,
          charts: report.result?.charts,
          generatedAt: report.result?.generatedAt,
          expiresAt: report.result?.expiresAt,
          // Only include data for JSON format to prevent large response
          data: report.format === ReportFormat.JSON ? report.result?.data : undefined,
          url: report.result?.url,
          fileSize: report.result?.fileSize
        },
        createdBy: report.createdBy,
        createdAt: report.createdAt,
        updatedAt: report.updatedAt,
        isScheduled: report.isScheduled,
        schedule: report.schedule
      });
    } catch (error) {
      this.logger.error(`Get report error: ${error}`);
      res.status(500).json({ message: 'Failed to get report' });
    }
  }

  /**
   * Get reports with filtering
   */
  private async getReports(req: Request, res: Response): Promise<void> {
    try {
      const { 
        type, 
        status, 
        createdBy, 
        isScheduled, 
        startDate, 
        endDate, 
        page = 1, 
        limit = 10 
      } = req.query;
      
      // Build query
      const query: any = {};
      
      if (type) query.type = type;
      if (status) query.status = status;
      if (createdBy) query.createdBy = createdBy;
      if (isScheduled !== undefined) query.isScheduled = isScheduled === 'true';
      
      // Date range
      if (startDate || endDate) {
        query.createdAt = {};
        if (startDate) query.createdAt.$gte = new Date(startDate as string);
        if (endDate) query.createdAt.$lte = new Date(endDate as string);
      }
      
      // Parse pagination
      const skip = (parseInt(page as string) - 1) * parseInt(limit as string);
      
      // Get reports
      const reports = await this.reportModel
        .find(query)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(parseInt(limit as string));
      
      // Get total count
      const total = await this.reportModel.countDocuments(query);
      
      res.status(200).json({
        reports: reports.map(report => ({
          reportId: report.reportId,
          name: report.name,
          type: report.type,
          format: report.format,
          status: report.status,
          createdBy: report.createdBy,
          createdAt: report.createdAt,
          isScheduled: report.isScheduled,
          generatedAt: report.result?.generatedAt
        })),
        pagination: {
          page: parseInt(page as string),
          limit: parseInt(limit as string),
          total,
          pages: Math.ceil(total / parseInt(limit as string))
        }
      });
    } catch (error) {
      this.logger.error(`Get reports error: ${error}`);
      res.status(500).json({ message: 'Failed to get reports' });
    }
  }

  /**
   * Delete a report
   */
  private async deleteReport(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      
      const report = await this.reportModel.findOne({
        $or: [
          { reportId: id },
          { _id: mongoose.isValidObjectId(id) ? id : undefined }
        ]
      });
      
      if (!report) {
        res.status(404).json({ message: 'Report not found' });
        return;
      }
      
      // Delete file if it exists
      if (report.result?.filePath && fs.existsSync(report.result.filePath)) {
        fs.unlinkSync(report.result.filePath);
      }
      
      // Delete report
      await report.deleteOne();
      
      res.status(200).json({
        reportId: report.reportId,
        message: 'Report deleted successfully'
      });
    } catch (error) {
      this.logger.error(`Delete report error: ${error}`);
      res.status(500).json({ message: 'Failed to delete report' });
    }
  }

  /**
   * Download a report
   */
  private async downloadReport(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      
      const report = await this.reportModel.findOne({
        $or: [
          { reportId: id },
          { _id: mongoose.isValidObjectId(id) ? id : undefined }
        ]
      });
      
      if (!report) {
        res.status(404).json({ message: 'Report not found' });
        return;
      }
      
      if (report.status !== ReportStatus.COMPLETED) {
        res.status(400).json({ message: `Report is not ready (status: ${report.status})` });
        return;
      }
      
      if (!report.result?.filePath || !fs.existsSync(report.result.filePath)) {
        res.status(404).json({ message: 'Report file not found' });
        return;
      }
      
      // Send file
      const fileName = path.basename(report.result.filePath);
      
      let contentType = 'application/octet-stream';
      switch (report.format) {
        case ReportFormat.CSV:
          contentType = 'text/csv';
          break;
        case ReportFormat.JSON:
          contentType = 'application/json';
          break;
        case ReportFormat.PDF:
          contentType = 'application/pdf';
          break;
        case ReportFormat.EXCEL:
          contentType = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
          break;
      }
      
      res.setHeader('Content-Type', contentType);
      res.setHeader('Content-Disposition', `attachment; filename=${fileName}`);
      
      const fileStream = fs.createReadStream(report.result.filePath);
      fileStream.pipe(res);
    } catch (error) {
      this.logger.error(`Download report error: ${error}`);
      res.status(500).json({ message: 'Failed to download report' });
    }
  }

  /**
   * Schedule a report
   */
  private async scheduleReport(req: Request, res: Response): Promise<void> {
    try {
      const { 
        name, 
        description, 
        type, 
        format = ReportFormat.JSON, 
        parameters = {}, 
        schedule 
      } = req.body;
      
      // Validate required fields
      if (!name || !type || !schedule) {
        res.status(400).json({ message: 'Name, type, and schedule are required' });
        return;
      }
      
      // Validate schedule
      if (!schedule.frequency || schedule.hour === undefined || schedule.minute === undefined) {
        res.status(400).json({ message: 'Schedule frequency, hour, and minute are required' });
        return;
      }
      
      // Validate frequency-specific fields
      if (schedule.frequency === 'WEEKLY' && schedule.dayOfWeek === undefined) {
        res.status(400).json({ message: 'Day of week is required for weekly schedule' });
        return;
      }
      
      if (schedule.frequency === 'MONTHLY' && schedule.dayOfMonth === undefined) {
        res.status(400).json({ message: 'Day of month is required for monthly schedule' });
        return;
      }
      
      // Calculate next run time
      const nextRun = this.calculateNextRunTime(schedule);
      
      // Create report
      const reportId = uuidv4();
      const report = new this.reportModel({
        reportId,
        name,
        description,
        type,
        format,
        status: ReportStatus.PENDING,
        parameters,
        createdBy: (req as any).user.userId,
        isScheduled: true,
        schedule: {
          ...schedule,
          lastRun: undefined,
          nextRun,
          active: true
        }
      });
      
      await report.save();
      
      res.status(201).json({
        reportId: report.reportId,
        name: report.name,
        type: report.type,
        format: report.format,
        isScheduled: true,
        schedule: {
          frequency: report.schedule?.frequency,
          dayOfWeek: report.schedule?.dayOfWeek,
          dayOfMonth: report.schedule?.dayOfMonth,
          hour: report.schedule?.hour,
          minute: report.schedule?.minute,
          nextRun: report.schedule?.nextRun,
          active: report.schedule?.active
        },
        message: 'Report scheduled successfully'
      });
    } catch (error: any) {
      this.logger.error(`Schedule report error: ${error}`);
      res.status(500).json({ message: 'Failed to schedule report', error: error.message });
    }
  }

  /**
   * Update a scheduled report
   */
  private async updateSchedule(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const { schedule } = req.body;
      
      if (!schedule) {
        res.status(400).json({ message: 'Schedule is required' });
        return;
      }
      
      const report = await this.reportModel.findOne({
        $or: [
          { reportId: id },
          { _id: mongoose.isValidObjectId(id) ? id : undefined }
        ]
      });
      
      if (!report) {
        res.status(404).json({ message: 'Report not found' });
        return;
      }
      
      if (!report.isScheduled) {
        res.status(400).json({ message: 'Report is not scheduled' });
        return;
      }
      
      // Update schedule
      const updatedSchedule = { ...report.schedule, ...schedule };
      
      // Recalculate next run time if frequency, hour, or minute changed
      if (
        schedule.frequency !== undefined ||
        schedule.hour !== undefined ||
        schedule.minute !== undefined ||
        schedule.dayOfWeek !== undefined ||
        schedule.dayOfMonth !== undefined
      ) {
        updatedSchedule.nextRun = this.calculateNextRunTime(updatedSchedule);
      }
      
      report.schedule = updatedSchedule;
      await report.save();
      
      res.status(200).json({
        reportId: report.reportId,
        name: report.name,
        isScheduled: true,
        schedule: {
          frequency: report.schedule?.frequency,
          dayOfWeek: report.schedule?.dayOfWeek,
          dayOfMonth: report.schedule?.dayOfMonth,
          hour: report.schedule?.hour,
          minute: report.schedule?.minute,
          nextRun: report.schedule?.nextRun,
          active: report.schedule?.active
        },
        message: 'Schedule updated successfully'
      });
    } catch (error) {
      this.logger.error(`Update schedule error: ${error}`);
      res.status(500).json({ message: 'Failed to update schedule' });
    }
  }

  /**
   * Delete a scheduled report
   */
  private async deleteSchedule(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      
      const report = await this.reportModel.findOne({
        $or: [
          { reportId: id },
          { _id: mongoose.isValidObjectId(id) ? id : undefined }
        ]
      });
      
      if (!report) {
        res.status(404).json({ message: 'Report not found' });
        return;
      }
      
      if (!report.isScheduled) {
        res.status(400).json({ message: 'Report is not scheduled' });
        return;
      }
      
      // Disable scheduling
      report.isScheduled = false;
      report.schedule = undefined;
      await report.save();
      
      res.status(200).json({
        reportId: report.reportId,
        name: report.name,
        message: 'Schedule removed successfully'
      });
    } catch (error) {
      this.logger.error(`Delete schedule error: ${error}`);
      res.status(500).json({ message: 'Failed to delete schedule' });
    }
  }

  /**
   * Get sales dashboard data
   */
  private async getSalesDashboard(req: Request, res: Response): Promise<void> {
    try {
      const { startDate, endDate, storeId } = req.query;
      
      // Get date range
      const start = startDate ? new Date(startDate as string) : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
      const end = endDate ? new Date(endDate as string) : new Date();
      
      // Fetch data from Order Service
      const orderStatsUrl = `${ORDER_SERVICE_URL}/orders/stats/summary?startDate=${start.toISOString()}&endDate=${end.toISOString()}${storeId ? `&storeId=${storeId}` : ''}`;
      const orderStatsResponse = await axios.get(orderStatsUrl);
      const orderStats = orderStatsResponse.data;
      
      // Get daily sales data from summaries
      const dailySummaries = await this.dataSummaryModel.find({
        type: 'DAILY',
        dataType: 'SALES',
        date: {
          $gte: this.getDateString(start, 'DAILY'),
          $lte: this.getDateString(end, 'DAILY')
        }
      }).sort({ date: 1 });
      
      // Prepare dashboard data
      const salesData = dailySummaries.map(summary => ({
        date: summary.date,
        sales: summary.data.total || 0,
        orders: summary.data.count || 0,
        averageOrderValue: summary.data.average || 0
      }));
      
      // Get top products
      const topProductsData = orderStats.topProducts || [];
      
      // Calculate sales growth
      let salesGrowth = 0;
      if (dailySummaries.length >= 2) {
        const currentSales = dailySummaries[dailySummaries.length - 1].data.total || 0;
        const previousSales = dailySummaries[0].data.total || 0;
        
        if (previousSales > 0) {
          salesGrowth = ((currentSales - previousSales) / previousSales) * 100;
        }
      }
      
      // Prepare response
      const dashboardData = {
        summary: {
          totalSales: orderStats.revenue?.total || 0,
          totalOrders: orderStats.revenue?.orderCount || 0,
          averageOrderValue: orderStats.revenue?.averageOrderValue || 0,
          salesGrowth: salesGrowth.toFixed(2)
        },
        salesByDay: salesData,
        topProducts: topProductsData.slice(0, 5),
        ordersByStatus: orderStats.orderCount?.byStatus || {}
      };
      
      res.status(200).json(dashboardData);
    } catch (error) {
      this.logger.error(`Get sales dashboard error: ${error}`);
      res.status(500).json({ message: 'Failed to get sales dashboard data' });
    }
  }

  /**
   * Get inventory dashboard data
   */
  private async getInventoryDashboard(req: Request, res: Response): Promise<void> {
    try {
      const { storeId } = req.query;
      
      // Fetch low stock alerts from Inventory Service
      const lowStockUrl = `${INVENTORY_SERVICE_URL}/inventory/alerts/low-stock${storeId ? `?storeId=${storeId}` : ''}`;
      const lowStockResponse = await axios.get(lowStockUrl);
      const lowStockData = lowStockResponse.data;
      
      // Get inventory summaries
      const inventorySummaries = await this.dataSummaryModel.find({
        type: 'DAILY',
        dataType: 'INVENTORY',
        date: {
          $gte: this.getDateString(new Date(Date.now() - 30 * 24 * 60 * 60 * 1000), 'DAILY')
        }
      }).sort({ date: 1 });
      
      // Calculate inventory metrics
      const outOfStockCount = lowStockData.alerts?.filter((item: any) => item.isOutOfStock).length || 0;
      const lowStockCount = lowStockData.alerts?.filter((item: any) => !item.isOutOfStock && item.quantity <= item.reorderPoint).length || 0;
      
      // Get daily inventory changes
      const inventoryChanges = inventorySummaries.map(summary => ({
        date: summary.date,
        additions: summary.data.metrics.additions || 0,
        reductions: summary.data.metrics.reductions || 0,
        adjustments: summary.data.metrics.adjustments || 0,
        balance: summary.data.metrics.balance || 0
      }));
      
      // Prepare response
      const dashboardData = {
        summary: {
          outOfStockCount,
          lowStockCount,
          totalItems: lowStockData.pagination?.total || 0
        },
        alerts: lowStockData.alerts?.map((item: any) => ({
          productId: item.productId,
          sku: item.sku,
          name: item.name,
          quantity: item.quantity,
          availableQuantity: item.availableQuantity,
          reorderPoint: item.reorderPoint,
          reorderQuantity: item.reorderQuantity,
          isOutOfStock: item.isOutOfStock,
          severity: item.severity
        })) || [],
        inventoryChanges
      };
      
      res.status(200).json(dashboardData);
    } catch (error) {
      this.logger.error(`Get inventory dashboard error: ${error}`);
      res.status(500).json({ message: 'Failed to get inventory dashboard data' });
    }
  }

  /**
   * Get payment dashboard data
   */
  private async getPaymentDashboard(req: Request, res: Response): Promise<void> {
    try {
      const { startDate, endDate } = req.query;
      
      // Get date range
      const start = startDate ? new Date(startDate as string) : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
      const end = endDate ? new Date(endDate as string) : new Date();
      
      // Get payment summaries
      const paymentSummaries = await this.dataSummaryModel.find({
        type: 'DAILY',
        dataType: 'PAYMENT',
        date: {
          $gte: this.getDateString(start, 'DAILY'),
          $lte: this.getDateString(end, 'DAILY')
        }
      }).sort({ date: 1 });
      
      // Calculate payment metrics
      let totalPayments = 0;
      let totalAmount = 0;
      let totalRefunds = 0;
      let refundAmount = 0;
      
      paymentSummaries.forEach(summary => {
        totalPayments += summary.data.count || 0;
        totalAmount += summary.data.total || 0;
        totalRefunds += summary.data.metrics.refundCount || 0;
        refundAmount += summary.data.metrics.refundAmount || 0;
      });
      
      // Get payment data by day
      const paymentsByDay = paymentSummaries.map(summary => ({
        date: summary.date,
        amount: summary.data.total || 0,
        count: summary.data.count || 0,
        refundAmount: summary.data.metrics.refundAmount || 0,
        refundCount: summary.data.metrics.refundCount || 0
      }));
      
      // Get payment methods distribution
      const paymentMethods = this.aggregatePaymentMethods(paymentSummaries);
      
      // Prepare response
      const dashboardData = {
        summary: {
          totalPayments,
          totalAmount,
          totalRefunds,
          refundAmount,
          netAmount: totalAmount - refundAmount
        },
        paymentsByDay,
        paymentMethods
      };
      
      res.status(200).json(dashboardData);
    } catch (error) {
      this.logger.error(`Get payment dashboard error: ${error}`);
      res.status(500).json({ message: 'Failed to get payment dashboard data' });
    }
  }

  /**
   * Get delivery dashboard data
   */
  private async getDeliveryDashboard(req: Request, res: Response): Promise<void> {
    try {
      const { startDate, endDate } = req.query;
      
      // Get date range
      const start = startDate ? new Date(startDate as string) : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
      const end = endDate ? new Date(endDate as string) : new Date();
      
      // Get delivery summaries
      const deliverySummaries = await this.dataSummaryModel.find({
        type: 'DAILY',
        dataType: 'DELIVERY',
        date: {
          $gte: this.getDateString(start, 'DAILY'),
          $lte: this.getDateString(end, 'DAILY')
        }
      }).sort({ date: 1 });
      
      // Calculate delivery metrics
      let totalDeliveries = 0;
      let completedDeliveries = 0;
      let failedDeliveries = 0;
      let cancelledDeliveries = 0;
      let onTimePercentage = 0;
      let latePercentage = 0;
      
      deliverySummaries.forEach(summary => {
        totalDeliveries += summary.data.count || 0;
        completedDeliveries += summary.data.metrics.completed || 0;
        failedDeliveries += summary.data.metrics.failed || 0;
        cancelledDeliveries += summary.data.metrics.cancelled || 0;
        
        const onTime = summary.data.metrics.onTime || 0;
        const late = summary.data.metrics.late || 0;
        const withTiming = onTime + late;
        
        if (withTiming > 0) {
          onTimePercentage += (onTime / withTiming) * 100;
          latePercentage += (late / withTiming) * 100;
        }
      });
      
      // Average the percentages
      if (deliverySummaries.length > 0) {
        onTimePercentage /= deliverySummaries.length;
        latePercentage /= deliverySummaries.length;
      }
      
      // Get delivery data by day
      const deliveriesByDay = deliverySummaries.map(summary => ({
        date: summary.date,
        total: summary.data.count || 0,
        completed: summary.data.metrics.completed || 0,
        failed: summary.data.metrics.failed || 0,
        cancelled: summary.data.metrics.cancelled || 0
      }));
      
      // Prepare response
      const dashboardData = {
        summary: {
          totalDeliveries,
          completedDeliveries,
          failedDeliveries,
          cancelledDeliveries,
          successRate: totalDeliveries > 0 ? ((completedDeliveries / totalDeliveries) * 100).toFixed(2) : 0,
          onTimePercentage: onTimePercentage.toFixed(2),
          latePercentage: latePercentage.toFixed(2)
        },
        deliveriesByDay
      };
      
      res.status(200).json(dashboardData);
    } catch (error) {
      this.logger.error(`Get delivery dashboard error: ${error}`);
      res.status(500).json({ message: 'Failed to get delivery dashboard data' });
    }
  }

  /**
   * Get summary data
   */
  private async getSummaryData(req: Request, res: Response): Promise<void> {
    try {
      const { type, dataType } = req.params;
      const { startDate, endDate } = req.query;
      
      // Validate type
      if (!['DAILY', 'WEEKLY', 'MONTHLY'].includes(type)) {
        res.status(400).json({ message: 'Invalid summary type. Must be DAILY, WEEKLY, or MONTHLY' });
        return;
      }
      
      // Validate data type
      if (!['SALES', 'INVENTORY', 'PAYMENT', 'DELIVERY'].includes(dataType)) {
        res.status(400).json({ 
          message: 'Invalid data type. Must be SALES, INVENTORY, PAYMENT, or DELIVERY' 
        });
        return;
      }
      
      // Get date range
      const start = startDate 
        ? this.getDateString(new Date(startDate as string), type)
        : this.getDateString(new Date(Date.now() - 90 * 24 * 60 * 60 * 1000), type);
      
      const end = endDate 
        ? this.getDateString(new Date(endDate as string), type)
        : this.getDateString(new Date(), type);
      
      // Get summaries
      const summaries = await this.dataSummaryModel.find({
        type,
        dataType,
        date: {
          $gte: start,
          $lte: end
        }
      }).sort({ date: 1 });
      
      res.status(200).json({
        type,
        dataType,
        dateRange: {
          start,
          end
        },
        summaries: summaries.map(summary => ({
          date: summary.date,
          count: summary.data.count,
          total: summary.data.total,
          average: summary.data.average,
          metrics: summary.data.metrics
        }))
      });
    } catch (error) {
      this.logger.error(`Get summary data error: ${error}`);
      res.status(500).json({ message: 'Failed to get summary data' });
    }
  }

  /**
   * Generate a report
   */
  private async generateReport(report: IReport): Promise<void> {
    try {
      // Prevent concurrent generation
      if (this.isGeneratingReport) {
        // Delay execution to prevent overloading
        setTimeout(() => this.generateReport(report), 5000);
        return;
      }
      
      this.isGeneratingReport = true;
      
      // Update status to generating
      report.status = ReportStatus.GENERATING;
      await report.save();
      
      // Generate report based on type
      let reportData;
      switch (report.type) {
        case ReportType.SALES:
          reportData = await this.generateSalesReport(report);
          break;
        case ReportType.INVENTORY:
          reportData = await this.generateInventoryReport(report);
          break;
        case ReportType.PAYMENT:
          reportData = await this.generatePaymentReport(report);
          break;
        case ReportType.DELIVERY:
          reportData = await this.generateDeliveryReport(report);
          break;
        case ReportType.CUSTOMER:
          reportData = await this.generateCustomerReport(report);
          break;
        case ReportType.FINANCIAL:
          reportData = await this.generateFinancialReport(report);
          break;
        case ReportType.CUSTOM:
          reportData = await this.generateCustomReport(report);
          break;
        default:
          throw new Error(`Unsupported report type: ${report.type}`);
      }
      
      // Save report data
      await this.saveReportData(report, reportData);
      
      // Export report to file if not JSON format
      if (report.format !== ReportFormat.JSON) {
        await this.exportReportToFile(report);
      }
      
      // Update report status
      report.status = ReportStatus.COMPLETED;
      report.result = {
        ...report.result,
        generatedAt: new Date(),
        // Set expiration date (30 days)
        expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
      };
      
      await report.save();
      
      // Publish report completed event
      await this.messageBus.publish('reporting', 'report.completed', {
        reportId: report.reportId,
        name: report.name,
        type: report.type,
        format: report.format,
        createdBy: report.createdBy,
        timestamp: new Date().toISOString()
      });
    } catch (error: any) {
      this.logger.error(`Report generation error: ${error}`);
      
      // Update report status to failed
      if (report) {
        report.status = ReportStatus.FAILED;
        report.result = {
          ...report.result,
          generatedAt: new Date(),
          summary: {
            error: error.message
          }
        };
        
        await report.save();
      }
    } finally {
      this.isGeneratingReport = false;
    }
  }

  /**
   * Generate a sales report
   */
  private async generateSalesReport(report: IReport): Promise<any> {
    // Get parameters
    const { 
      startDate, 
      endDate, 
      storeId, 
      productId, 
      categoryId, 
      timePeriod, 
      groupBy = ['date'] 
    } = report.parameters;
    
    // Calculate date range
    let start: Date, end: Date;
    
    if (startDate && endDate) {
      start = new Date(startDate);
      end = new Date(endDate);
    } else if (timePeriod) {
      const range = this.getDateRangeForTimePeriod(timePeriod);
      start = range.start;
      end = range.end;
    } else {
      // Default to last 30 days
      end = new Date();
      start = new Date(end.getTime() - 30 * 24 * 60 * 60 * 1000);
    }
    
    // Fetch data from Order Service
    const url = new URL(`${ORDER_SERVICE_URL}/orders/stats/summary`);
    url.searchParams.append('startDate', start.toISOString());
    url.searchParams.append('endDate', end.toISOString());
    
    if (storeId) url.searchParams.append('storeId', storeId);
    
    const response = await axios.get(url.toString());
    const orderStats = response.data;
    
    // Process daily sales data
    let salesData = orderStats.dailySales || [];
    let topProducts = orderStats.topProducts || [];
    
    // Filter by product or category if specified
    if (productId || categoryId) {
      // This would need to get more detailed data and filter
      // For this example, we'll just note that filtering would happen here
    }
    
    // Group data if needed
    if (groupBy.includes('product') && !groupBy.includes('date')) {
      // Group by product
      salesData = this.groupSalesByProduct(topProducts);
    } else if (groupBy.includes('date') && groupBy.includes('product')) {
      // Group by date and product
      // This would require more detailed data from the order service
    }
    
    // Calculate summary metrics
    const totalSales = salesData.reduce((sum, day) => sum + day.sales, 0);
    const totalOrders = salesData.reduce((sum, day) => sum + day.orders, 0);
    const averageOrderValue = totalOrders > 0 ? totalSales / totalOrders : 0;
    
    // Prepare charts data
    const salesChartData = {
      type: 'line',
      labels: salesData.map((day: any) => day.date),
      datasets: [
        {
          label: 'Sales',
          data: salesData.map((day: any) => day.sales)
        },
        {
          label: 'Orders',
          data: salesData.map((day: any) => day.orders)
        }
      ]
    };
    
    const productChartData = {
      type: 'pie',
      labels: topProducts.slice(0, 5).map((product: any) => product.name),
      datasets: [
        {
          data: topProducts.slice(0, 5).map((product: any) => product.totalRevenue)
        }
      ]
    };
    
    // Prepare result
    return {
      summary: {
        startDate: start,
        endDate: end,
        totalSales,
        totalOrders,
        averageOrderValue
      },
      charts: [
        { id: 'sales_over_time', title: 'Sales Over Time', data: salesChartData },
        { id: 'top_products', title: 'Top Products', data: productChartData }
      ],
      data: {
        salesByDay: salesData,
        topProducts
      }
    };
  }

  /**
   * Generate an inventory report
   */
  private async generateInventoryReport(report: IReport): Promise<any> {
    // Get parameters
    const { 
      storeId, 
      productId, 
      categoryId,
      filters = {} 
    } = report.parameters;
    
    // Build query parameters
    const params = new URLSearchParams();
    if (storeId) params.append('storeId', storeId as string);
    if (filters.lowStock) params.append('lowStock', 'true');
    if (filters.outOfStock) params.append('outOfStock', 'true');
    params.append('limit', '1000'); // Get a large dataset for reporting
    
    // Fetch data from Inventory Service
    const url = `${INVENTORY_SERVICE_URL}/inventory/store/${storeId || 'store_default'}?${params.toString()}`;
    const response = await axios.get(url);
    const inventoryData = response.data;
    
    // Get low stock items
    const lowStockUrl = `${INVENTORY_SERVICE_URL}/inventory/alerts/low-stock${storeId ? `?storeId=${storeId}` : ''}`;
    const lowStockResponse = await axios.get(lowStockUrl);
    const lowStockData = lowStockResponse.data;
    
    // Filter by product or category if specified
    let items = inventoryData.inventory || [];
    
    if (productId) {
      items = items.filter((item: any) => item.productId === productId);
    }
    
    if (categoryId) {
      items = items.filter((item: any) => item.category === categoryId);
    }
    
    // Calculate metrics
    const totalItems = items.length;
    const totalQuantity = items.reduce((sum: number, item: any) => sum + item.quantity, 0);
    const totalValue = items.reduce((sum: number, item: any) => sum + item.quantity * item.price, 0);
    const outOfStockCount = items.filter((item: any) => item.quantity === 0).length;
    const lowStockCount = items.filter((item: any) => item.quantity > 0 && item.quantity <= item.reorderPoint).length;
    
    // Prepare inventory value by category chart
    const valueByCategory = this.groupInventoryByCategory(items);
    
    const categoryChartData = {
      type: 'pie',
      labels: Object.keys(valueByCategory),
      datasets: [
        {
          data: Object.values(valueByCategory)
        }
      ]
    };
    
    // Prepare inventory status chart
    const statusChartData = {
      type: 'bar',
      labels: ['In Stock', 'Low Stock', 'Out of Stock'],
      datasets: [
        {
          data: [
            totalItems - lowStockCount - outOfStockCount,
            lowStockCount,
            outOfStockCount
          ]
        }
      ]
    };
    
    // Prepare result
    return {
      summary: {
        totalItems,
        totalQuantity,
        totalValue,
        outOfStockCount,
        lowStockCount
      },
      charts: [
        { id: 'inventory_by_category', title: 'Inventory Value by Category', data: categoryChartData },
        { id: 'inventory_status', title: 'Inventory Status', data: statusChartData }
      ],
      data: {
        items,
        lowStockItems: lowStockData.alerts || []
      }
    };
  }

  /**
   * Generate a payment report
   */
  private async generatePaymentReport(report: IReport): Promise<any> {
    // Get parameters
    const { 
      startDate, 
      endDate, 
      timePeriod 
    } = report.parameters;
    
    // Calculate date range
    let start: Date, end: Date;
    
    if (startDate && endDate) {
      start = new Date(startDate);
      end = new Date(endDate);
    } else if (timePeriod) {
      const range = this.getDateRangeForTimePeriod(timePeriod);
      start = range.start;
      end = range.end;
    } else {
      // Default to last 30 days
      end = new Date();
      start = new Date(end.getTime() - 30 * 24 * 60 * 60 * 1000);
    }
    
    // Get payment summaries
    const summaries = await this.dataSummaryModel.find({
      type: 'DAILY',
      dataType: 'PAYMENT',
      date: {
        $gte: this.getDateString(start, 'DAILY'),
        $lte: this.getDateString(end, 'DAILY')
      }
    }).sort({ date: 1 });
    
    // Process payment data
    const paymentsByDay = summaries.map(summary => ({
      date: summary.date,
      amount: summary.data.total || 0,
      count: summary.data.count || 0,
      refundAmount: summary.data.metrics.refundAmount || 0,
      refundCount: summary.data.metrics.refundCount || 0,
      byMethod: summary.data.metrics.byMethod || {}
    }));
    
    // Calculate metrics
    let totalPayments = 0;
    let totalAmount = 0;
    let totalRefunds = 0;
    let refundAmount = 0;
    
    paymentsByDay.forEach(day => {
      totalPayments += day.count;
      totalAmount += day.amount;
      totalRefunds += day.refundCount;
      refundAmount += day.refundAmount;
    });
    
    // Calculate payment method distribution
    const paymentMethods = this.aggregatePaymentMethods(summaries);
    
    // Prepare charts
    const amountChartData = {
      type: 'line',
      labels: paymentsByDay.map(day => day.date),
      datasets: [
        {
          label: 'Payments',
          data: paymentsByDay.map(day => day.amount)
        },
        {
          label: 'Refunds',
          data: paymentsByDay.map(day => day.refundAmount)
        }
      ]
    };
    
    const methodChartData = {
      type: 'pie',
      labels: Object.keys(paymentMethods),
      datasets: [
        {
          data: Object.values(paymentMethods).map((method: any) => method.amount)
        }
      ]
    };
    
    // Prepare result
    return {
      summary: {
        startDate: start,
        endDate: end,
        totalPayments,
        totalAmount,
        totalRefunds,
        refundAmount,
        netAmount: totalAmount - refundAmount
      },
      charts: [
        { id: 'payment_amounts', title: 'Payment Amounts Over Time', data: amountChartData },
        { id: 'payment_methods', title: 'Payment Methods', data: methodChartData }
      ],
      data: {
        paymentsByDay,
        paymentMethods
      }
    };
  }

  /**
   * Generate a delivery report
   */
  private async generateDeliveryReport(report: IReport): Promise<any> {
    // Get parameters
    const { 
      startDate, 
      endDate, 
      timePeriod 
    } = report.parameters;
    
    // Calculate date range
    let start: Date, end: Date;
    
    if (startDate && endDate) {
      start = new Date(startDate);
      end = new Date(endDate);
    } else if (timePeriod) {
      const range = this.getDateRangeForTimePeriod(timePeriod);
      start = range.start;
      end = range.end;
    } else {
      // Default to last 30 days
      end = new Date();
      start = new Date(end.getTime() - 30 * 24 * 60 * 60 * 1000);
    }
    
    // Get delivery summaries
    const summaries = await this.dataSummaryModel.find({
      type: 'DAILY',
      dataType: 'DELIVERY',
      date: {
        $gte: this.getDateString(start, 'DAILY'),
        $lte: this.getDateString(end, 'DAILY')
      }
    }).sort({ date: 1 });
    
    // Process delivery data
    const deliveriesByDay = summaries.map(summary => ({
      date: summary.date,
      total: summary.data.count || 0,
      completed: summary.data.metrics.completed || 0,
      failed: summary.data.metrics.failed || 0,
      cancelled: summary.data.metrics.cancelled || 0,
      onTime: summary.data.metrics.onTime || 0,
      late: summary.data.metrics.late || 0
    }));
    
    // Calculate metrics
    let totalDeliveries = 0;
    let completedDeliveries = 0;
    let failedDeliveries = 0;
    let cancelledDeliveries = 0;
    let onTimeDeliveries = 0;
    let lateDeliveries = 0;
    
    deliveriesByDay.forEach(day => {
      totalDeliveries += day.total;
      completedDeliveries += day.completed;
      failedDeliveries += day.failed;
      cancelledDeliveries += day.cancelled;
      onTimeDeliveries += day.onTime;
      lateDeliveries += day.late;
    });
    
    // Prepare charts
    const statusChartData = {
      type: 'line',
      labels: deliveriesByDay.map(day => day.date),
      datasets: [
        {
          label: 'Completed',
          data: deliveriesByDay.map(day => day.completed)
        },
        {
          label: 'Failed',
          data: deliveriesByDay.map(day => day.failed)
        },
        {
          label: 'Cancelled',
          data: deliveriesByDay.map(day => day.cancelled)
        }
      ]
    };
    
    const summaryChartData = {
      type: 'pie',
      labels: ['Completed', 'Failed', 'Cancelled'],
      datasets: [
        {
          data: [completedDeliveries, failedDeliveries, cancelledDeliveries]
        }
      ]
    };
    
    // Prepare result
    return {
      summary: {
        startDate: start,
        endDate: end,
        totalDeliveries,
        completedDeliveries,
        failedDeliveries,
        cancelledDeliveries,
        onTimeDeliveries,
        lateDeliveries,
        successRate: totalDeliveries > 0 ? (completedDeliveries / totalDeliveries) * 100 : 0,
        onTimeRate: (onTimeDeliveries + lateDeliveries) > 0 
          ? (onTimeDeliveries / (onTimeDeliveries + lateDeliveries)) * 100 
          : 0
      },
      charts: [
        { id: 'delivery_status', title: 'Delivery Status Over Time', data: statusChartData },
        { id: 'delivery_summary', title: 'Delivery Summary', data: summaryChartData }
      ],
      data: {
        deliveriesByDay
      }
    };
  }

  /**
   * Generate a customer report
   */
  private async generateCustomerReport(report: IReport): Promise<any> {
    // For this example, we'll generate a simplified customer report
    // In a real implementation, this would fetch data from a Customer Service
    
    // Get parameters
    const { 
      startDate, 
      endDate, 
      timePeriod 
    } = report.parameters;
    
    // Calculate date range
    let start: Date, end: Date;
    
    if (startDate && endDate) {
      start = new Date(startDate);
      end = new Date(endDate);
    } else if (timePeriod) {
      const range = this.getDateRangeForTimePeriod(timePeriod);
      start = range.start;
      end = range.end;
    } else {
      // Default to last 30 days
      end = new Date();
      start = new Date(end.getTime() - 30 * 24 * 60 * 60 * 1000);
    }
    
    // Fetch data from Order Service for customer analysis
    const orderUrl = new URL(`${ORDER_SERVICE_URL}/orders`);
    orderUrl.searchParams.append('startDate', start.toISOString());
    orderUrl.searchParams.append('endDate', end.toISOString());
    orderUrl.searchParams.append('limit', '1000');
    
    const response = await axios.get(orderUrl.toString());
    const orders = response.data.orders || [];
    
    // Group orders by customer
    const customerOrders: Record<string, any[]> = {};
    
    orders.forEach((order: any) => {
      if (!order.customerId) return;
      
      if (!customerOrders[order.customerId]) {
        customerOrders[order.customerId] = [];
      }
      
      customerOrders[order.customerId].push(order);
    });
    
    // Calculate customer metrics
    const customerMetrics = Object.entries(customerOrders).map(([customerId, customerOrders]) => {
      const orderCount = customerOrders.length;
      const totalSpent = customerOrders.reduce((sum, order) => sum + order.total, 0);
      const averageOrderValue = orderCount > 0 ? totalSpent / orderCount : 0;
      
      return {
        customerId,
        orderCount,
        totalSpent,
        averageOrderValue,
        firstOrderDate: customerOrders[0].createdAt
      };
    });
    
    // Sort customers by total spent
    customerMetrics.sort((a, b) => b.totalSpent - a.totalSpent);
    
    // Calculate summary metrics
    const totalCustomers = customerMetrics.length;
    const totalOrders = orders.length;
    const totalRevenue = customerMetrics.reduce((sum, customer) => sum + customer.totalSpent, 0);
    const averageRevenuePerCustomer = totalCustomers > 0 ? totalRevenue / totalCustomers : 0;
    
    // Prepare charts
    const topCustomersChartData = {
      type: 'bar',
      labels: customerMetrics.slice(0, 10).map(customer => customer.customerId),
      datasets: [
        {
          label: 'Total Spent',
          data: customerMetrics.slice(0, 10).map(customer => customer.totalSpent)
        }
      ]
    };
    
    // Prepare result
    return {
      summary: {
        startDate: start,
        endDate: end,
        totalCustomers,
        totalOrders,
        totalRevenue,
        averageRevenuePerCustomer
      },
      charts: [
        { id: 'top_customers', title: 'Top Customers by Spending', data: topCustomersChartData }
      ],
      data: {
        customerMetrics
      }
    };
  }

  /**
   * Generate a financial report
   */
  private async generateFinancialReport(report: IReport): Promise<any> {
    // Get parameters
    const { 
      startDate, 
      endDate, 
      timePeriod 
    } = report.parameters;
    
    // Calculate date range
    let start: Date, end: Date;
    
    if (startDate && endDate) {
      start = new Date(startDate);
      end = new Date(endDate);
    } else if (timePeriod) {
      const range = this.getDateRangeForTimePeriod(timePeriod);
      start = range.start;
      end = range.end;
    } else {
      // Default to last 30 days
      end = new Date();
      start = new Date(end.getTime() - 30 * 24 * 60 * 60 * 1000);
    }
    
    // Get sales summaries
    const salesSummaries = await this.dataSummaryModel.find({
      type: 'DAILY',
      dataType: 'SALES',
      date: {
        $gte: this.getDateString(start, 'DAILY'),
        $lte: this.getDateString(end, 'DAILY')
      }
    }).sort({ date: 1 });
    
    // Get payment summaries
    const paymentSummaries = await this.dataSummaryModel.find({
      type: 'DAILY',
      dataType: 'PAYMENT',
      date: {
        $gte: this.getDateString(start, 'DAILY'),
        $lte: this.getDateString(end, 'DAILY')
      }
    }).sort({ date: 1 });
    
    // Calculate revenue
    const revenue = salesSummaries.reduce((sum, summary) => sum + (summary.data.total || 0), 0);
    
    // Calculate refunds
    const refunds = paymentSummaries.reduce((sum, summary) => 
      sum + (summary.data.metrics.refundAmount || 0), 0);
    
    // Calculate net revenue
    const netRevenue = revenue - refunds;
    
    // Calculate cost of goods sold (estimating 60% of revenue)
    const costOfGoodsSold = revenue * 0.6;
    
    // Calculate gross profit
    const grossProfit = netRevenue - costOfGoodsSold;
    const grossProfitMargin = revenue > 0 ? (grossProfit / revenue) * 100 : 0;
    
    // Prepare financial data by day
    const financialByDay = salesSummaries.map((salesSummary, index) => {
      const paymentSummary = paymentSummaries[index] || { data: { metrics: {} } };
      const dayRevenue = salesSummary.data.total || 0;
      const dayRefunds = paymentSummary.data.metrics.refundAmount || 0;
      const dayNetRevenue = dayRevenue - dayRefunds;
      const dayCogs = dayRevenue * 0.6;
      const dayGrossProfit = dayNetRevenue - dayCogs;
      
      return {
        date: salesSummary.date,
        revenue: dayRevenue,
        refunds: dayRefunds,
        netRevenue: dayNetRevenue,
        cogs: dayCogs,
        grossProfit: dayGrossProfit
      };
    });
    
    // Prepare charts
    const revenueChartData = {
      type: 'line',
      labels: financialByDay.map(day => day.date),
      datasets: [
        {
          label: 'Revenue',
          data: financialByDay.map(day => day.revenue)
        },
        {
          label: 'Net Revenue',
          data: financialByDay.map(day => day.netRevenue)
        },
        {
          label: 'Gross Profit',
          data: financialByDay.map(day => day.grossProfit)
        }
      ]
    };
    
    // Prepare summary chart
    const summaryChartData = {
      type: 'bar',
      labels: ['Revenue', 'Refunds', 'COGS', 'Gross Profit'],
      datasets: [
        {
          data: [revenue, refunds, costOfGoodsSold, grossProfit]
        }
      ]
    };
    
    // Prepare result
    return {
      summary: {
        startDate: start,
        endDate: end,
        revenue,
        refunds,
        netRevenue,
        costOfGoodsSold,
        grossProfit,
        grossProfitMargin: grossProfitMargin.toFixed(2) + '%'
      },
      charts: [
        { id: 'financial_metrics', title: 'Financial Metrics Over Time', data: revenueChartData },
        { id: 'financial_summary', title: 'Financial Summary', data: summaryChartData }
      ],
      data: {
        financialByDay
      }
    };
  }

  /**
   * Generate a custom report
   */
  private async generateCustomReport(report: IReport): Promise<any> {
    // For this example, we'll just combine data from multiple sources
    // In a real implementation, this would be more dynamic based on user configuration
    
    // Get parameters
    const { 
      startDate, 
      endDate, 
      timePeriod,
      metrics = []
    } = report.parameters;
    
    // Calculate date range
    let start: Date, end: Date;
    
    if (startDate && endDate) {
      start = new Date(startDate);
      end = new Date(endDate);
    } else if (timePeriod) {
      const range = this.getDateRangeForTimePeriod(timePeriod);
      start = range.start;
      end = range.end;
    } else {
      // Default to last 30 days
      end = new Date();
      start = new Date(end.getTime() - 30 * 24 * 60 * 60 * 1000);
    }
    
    // Determine which data to include based on metrics
    const includeSales = metrics.includes('sales') || metrics.length === 0;
    const includePayments = metrics.includes('payments') || metrics.length === 0;
    const includeDeliveries = metrics.includes('deliveries') || metrics.length === 0;
    
    // Get data summaries
    const dateRange = {
      $gte: this.getDateString(start, 'DAILY'),
      $lte: this.getDateString(end, 'DAILY')
    };
    
    const dataPromises = [];
    
    if (includeSales) {
      dataPromises.push(
        this.dataSummaryModel.find({
          type: 'DAILY',
          dataType: 'SALES',
          date: dateRange
        }).sort({ date: 1 })
      );
    }
    
    if (includePayments) {
      dataPromises.push(
        this.dataSummaryModel.find({
          type: 'DAILY',
          dataType: 'PAYMENT',
          date: dateRange
        }).sort({ date: 1 })
      );
    }
    
    if (includeDeliveries) {
      dataPromises.push(
        this.dataSummaryModel.find({
          type: 'DAILY',
          dataType: 'DELIVERY',
          date: dateRange
        }).sort({ date: 1 })
      );
    }
    
    const results = await Promise.all(dataPromises);
    
    // Process data
    const salesSummaries = includeSales ? results.shift() || [] : [];
    const paymentSummaries = includePayments ? results.shift() || [] : [];
    const deliverySummaries = includeDeliveries ? results.shift() || [] : [];
    
    // Prepare combined data by day
    const allDates = new Set<string>();
    
    salesSummaries.forEach(summary => allDates.add(summary.date));
    paymentSummaries.forEach(summary => allDates.add(summary.date));
    deliverySummaries.forEach(summary => allDates.add(summary.date));
    
    const dateArray = Array.from(allDates).sort();
    
    const combinedData = dateArray.map(date => {
      const salesSummary = salesSummaries.find(s => s.date === date);
      const paymentSummary = paymentSummaries.find(s => s.date === date);
      const deliverySummary = deliverySummaries.find(s => s.date === date);
      
      return {
        date,
        sales: salesSummary?.data.total || 0,
        orders: salesSummary?.data.count || 0,
        payments: paymentSummary?.data.count || 0,
        paymentAmount: paymentSummary?.data.total || 0,
        refunds: paymentSummary?.data.metrics.refundCount || 0,
        refundAmount: paymentSummary?.data.metrics.refundAmount || 0,
        deliveries: deliverySummary?.data.count || 0,
        completedDeliveries: deliverySummary?.data.metrics.completed || 0,
        failedDeliveries: deliverySummary?.data.metrics.failed || 0
      };
    });
    
    // Calculate summary metrics
    const totalSales = combinedData.reduce((sum, day) => sum + day.sales, 0);
    const totalOrders = combinedData.reduce((sum, day) => sum + day.orders, 0);
    const totalPaymentAmount = combinedData.reduce((sum, day) => sum + day.paymentAmount, 0);
    const totalRefundAmount = combinedData.reduce((sum, day) => sum + day.refundAmount, 0);
    const totalDeliveries = combinedData.reduce((sum, day) => sum + day.deliveries, 0);
    const completedDeliveries = combinedData.reduce((sum, day) => sum + day.completedDeliveries, 0);
    
    // Prepare chart
    const combinedChartData = {
      type: 'line',
      labels: combinedData.map(day => day.date),
      datasets: []
    };
    
    if (includeSales) {
      combinedChartData.datasets.push({
        label: 'Sales',
        data: combinedData.map(day => day.sales)
      });
    }
    
    if (includePayments) {
      combinedChartData.datasets.push({
        label: 'Payments',
        data: combinedData.map(day => day.paymentAmount)
      });
      
      combinedChartData.datasets.push({
        label: 'Refunds',
        data: combinedData.map(day => day.refundAmount)
      });
    }
    
    if (includeDeliveries) {
      combinedChartData.datasets.push({
        label: 'Deliveries',
        data: combinedData.map(day => day.deliveries)
      });
    }
    
    // Prepare result
    return {
      summary: {
        startDate: start,
        endDate: end,
        totalSales,
        totalOrders,
        totalPaymentAmount,
        totalRefundAmount,
        totalDeliveries,
        completedDeliveries,
        deliverySuccessRate: totalDeliveries > 0 
          ? (completedDeliveries / totalDeliveries) * 100 
          : 0
      },
      charts: [
        { id: 'combined_metrics', title: 'Combined Metrics Over Time', data: combinedChartData }
      ],
      data: {
        dailyData: combinedData
      }
    };
  }

  /**
   * Save report data
   */
  private async saveReportData(report: IReport, data: any): Promise<void> {
    report.result = {
      summary: data.summary,
      charts: data.charts,
      data: data.data
    };
    
    await report.save();
  }

  /**
   * Export report to file
   */
  private async exportReportToFile(report: IReport): Promise<void> {
    if (!report.result || !report.result.data) {
      throw new Error('No report data to export');
    }
    
    // Generate filename
    const timestamp = new Date().toISOString().replace(/[:.-]/g, '');
    const sanitizedName = report.name.replace(/[^a-z0-9]/gi, '_').toLowerCase();
    const fileName = `${sanitizedName}_${timestamp}`;
    
    let filePath: string;
    let fileData: any;
    
    switch (report.format) {
      case ReportFormat.CSV:
        filePath = path.join(this.reportsDir, `${fileName}.csv`);
        await this.exportToCsv(report.result.data, filePath);
        break;
        
      case ReportFormat.JSON:
        filePath = path.join(this.reportsDir, `${fileName}.json`);
        fileData = JSON.stringify({
          reportId: report.reportId,
          name: report.name,
          type: report.type,
          parameters: report.parameters,
          summary: report.result.summary,
          data: report.result.data,
          generatedAt: new Date()
        }, null, 2);
        fs.writeFileSync(filePath, fileData);
        break;
        
      case ReportFormat.PDF:
        // In a real implementation, this would generate a PDF
        // For this example, we'll just create a text file
        filePath = path.join(this.reportsDir, `${fileName}.txt`);
        fileData = `Report: ${report.name}\n`;
        fileData += `Type: ${report.type}\n`;
        fileData += `Generated: ${new Date().toISOString()}\n\n`;
        fileData += `Summary:\n${JSON.stringify(report.result.summary, null, 2)}\n\n`;
        fileData += `Data:\n${JSON.stringify(report.result.data, null, 2)}`;
        fs.writeFileSync(filePath, fileData);
        break;
        
      case ReportFormat.EXCEL:
        // In a real implementation, this would generate an Excel file
        // For this example, we'll just create a CSV
        filePath = path.join(this.reportsDir, `${fileName}.csv`);
        await this.exportToCsv(report.result.data, filePath);
        break;
        
      default:
        throw new Error(`Unsupported export format: ${report.format}`);
    }
    
    // Update report with file info
    report.result.filePath = filePath;
    report.result.url = `/reports/download/${report.reportId}`;
    report.result.fileSize = fs.statSync(filePath).size;
  }

  /**
   * Export data to CSV
   */
  private async exportToCsv(data: any, filePath: string): Promise<void> {
    return new Promise((resolve, reject) => {
      try {
        // Determine the structure of the data
        let rows = [];
        
        if (data.salesByDay) {
          rows = data.salesByDay;
        } else if (data.items) {
          rows = data.items;
        } else if (data.paymentsByDay) {
          rows = data.paymentsByDay;
        } else if (data.deliveriesByDay) {
          rows = data.deliveriesByDay;
        } else if (data.customerMetrics) {
          rows = data.customerMetrics;
        } else if (data.financialByDay) {
          rows = data.financialByDay;
        } else if (data.dailyData) {
          rows = data.dailyData;
        } else {
          // Default: Use first data property
          const firstProp = Object.keys(data)[0];
          if (firstProp && Array.isArray(data[firstProp])) {
            rows = data[firstProp];
          } else {
            rows = [data];
          }
        }
        
        // Create write stream
        const writeStream = fs.createWriteStream(filePath);
        const csvStream = csv.format({ headers: true });
        
        csvStream.pipe(writeStream);
        
        // Write rows
        rows.forEach(row => csvStream.write(row));
        
        // End the stream
        csvStream.end();
        
        writeStream.on('finish', () => {
          resolve();
        });
        
        writeStream.on('error', (error) => {
          reject(error);
        });
      } catch (error) {
        reject(error);
      }
    });
  }

  /**
   * Start the scheduled report processor
   */
  private startScheduledReportProcessor(): void {
    // Check for scheduled reports every minute
    setInterval(() => this.processScheduledReports(), 60000);
  }

  /**
   * Process scheduled reports
   */
  private async processScheduledReports(): Promise<void> {
    try {
      const now = new Date();
      
      // Find reports scheduled for now or in the past
      const scheduledReports = await this.reportModel.find({
        isScheduled: true,
        'schedule.active': true,
        'schedule.nextRun': { $lte: now }
      });
      
      if (scheduledReports.length === 0) {
        return;
      }
      
      this.logger.info(`Processing ${scheduledReports.length} scheduled reports`);
      
      // Process each report
      for (const report of scheduledReports) {
        try {
          // Clone the report
          const newReport = new this.reportModel({
            reportId: uuidv4(),
            name: `${report.name} (Scheduled ${now.toISOString().slice(0, 10)})`,
            description: report.description,
            type: report.type,
            format: report.format,
            status: ReportStatus.PENDING,
            parameters: report.parameters,
            createdBy: report.createdBy,
            isScheduled: false
          });
          
          await newReport.save();
          
          // Generate the report
          this.generateReport(newReport)
            .catch(error => this.logger.error(`Error generating scheduled report: ${error}`));
          
          // Update last run and next run times
          report.schedule = {
            ...report.schedule,
            lastRun: now,
            nextRun: this.calculateNextRunTime(report.schedule)
          };
          
          await report.save();
        } catch (error) {
          this.logger.error(`Error processing scheduled report ${report.reportId}: ${error}`);
        }
      }
    } catch (error) {
      this.logger.error(`Error processing scheduled reports: ${error}`);
    }
  }

  /**
   * Calculate next run time for scheduled report
   */
  private calculateNextRunTime(schedule: any): Date {
    const now = new Date();
    let nextRun = new Date(now);
    
    // Set time
    nextRun.setHours(schedule.hour);
    nextRun.setMinutes(schedule.minute);
    nextRun.setSeconds(0);
    nextRun.setMilliseconds(0);
    
    // If the time has already passed today, move to the next day
    if (nextRun <= now) {
      nextRun.setDate(nextRun.getDate() + 1);
    }
    
    // Adjust based on frequency
    switch (schedule.frequency) {
      case 'DAILY':
        // Already handled above
        break;
        
      case 'WEEKLY':
        // Set to the specified day of the week
        const currentDay = nextRun.getDay();
        const daysUntilTarget = (schedule.dayOfWeek - currentDay + 7) % 7;
        
        if (daysUntilTarget > 0 || (daysUntilTarget === 0 && nextRun <= now)) {
          nextRun.setDate(nextRun.getDate() + daysUntilTarget);
        }
        break;
        
      case 'MONTHLY':
        // Set to the specified day of the month
        nextRun.setDate(schedule.dayOfMonth);
        
        // If the day has already passed this month, move to next month
        if (nextRun <= now) {
          nextRun.setMonth(nextRun.getMonth() + 1);
        }
        
        // Handle cases where the day doesn't exist in the month
        const maxDaysInMonth = new Date(nextRun.getFullYear(), nextRun.getMonth() + 1, 0).getDate();
        if (schedule.dayOfMonth > maxDaysInMonth) {
          nextRun.setDate(maxDaysInMonth);
        }
        break;
    }
    
    return nextRun;
  }

  /**
   * Start the daily summary generator
   */
  private startDailySummaryGenerator(): void {
    // Generate summaries daily at midnight
    const now = new Date();
    const midnight = new Date(now);
    midnight.setHours(0, 0, 0, 0);
    midnight.setDate(midnight.getDate() + 1);
    
    const timeUntilMidnight = midnight.getTime() - now.getTime();
    
    // Schedule first run at midnight
    setTimeout(() => {
      // Generate yesterday's summary
      this.generateDailySummaries();
      
      // Then schedule to run daily
      setInterval(() => this.generateDailySummaries(), 24 * 60 * 60 * 1000);
    }, timeUntilMidnight);
  }

  /**
   * Generate daily summaries
   */
  private async generateDailySummaries(): Promise<void> {
    try {
      // Get yesterday's date
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      yesterday.setHours(0, 0, 0, 0);
      
      const dateString = this.getDateString(yesterday, 'DAILY');
      
      // Generate summaries for different data types
      await this.generateSalesSummary(yesterday, 'DAILY', dateString);
      await this.generatePaymentSummary(yesterday, 'DAILY', dateString);
      await this.generateInventorySummary(yesterday, 'DAILY', dateString);
      await this.generateDeliverySummary(yesterday, 'DAILY', dateString);
      
      // Generate weekly summary if it's Sunday
      if (yesterday.getDay() === 0) {
        const weekStart = new Date(yesterday);
        weekStart.setDate(weekStart.getDate() - 6);
        
        const weekDateString = this.getDateString(yesterday, 'WEEKLY');
        
        await this.generateSalesSummary(weekStart, 'WEEKLY', weekDateString, 7);
        await this.generatePaymentSummary(weekStart, 'WEEKLY', weekDateString, 7);
        await this.generateInventorySummary(weekStart, 'WEEKLY', weekDateString, 7);
        await this.generateDeliverySummary(weekStart, 'WEEKLY', weekDateString, 7);
      }
      
      // Generate monthly summary if it's the last day of the month
      const lastDayOfMonth = new Date(yesterday.getFullYear(), yesterday.getMonth() + 1, 0);
      if (yesterday.getDate() === lastDayOfMonth.getDate()) {
        const monthStart = new Date(yesterday.getFullYear(), yesterday.getMonth(), 1);
        const daysInMonth = lastDayOfMonth.getDate();
        
        const monthDateString = this.getDateString(yesterday, 'MONTHLY');
        
        await this.generateSalesSummary(monthStart, 'MONTHLY', monthDateString, daysInMonth);
        await this.generatePaymentSummary(monthStart, 'MONTHLY', monthDateString, daysInMonth);
        await this.generateInventorySummary(monthStart, 'MONTHLY', monthDateString, daysInMonth);
        await this.generateDeliverySummary(monthStart, 'MONTHLY', monthDateString, daysInMonth);
      }
    } catch (error) {
      this.logger.error(`Error generating daily summaries: ${error}`);
    }
  }

  /**
   * Generate sales summary
   */
  private async generateSalesSummary(
    startDate: Date, 
    type: 'DAILY' | 'WEEKLY' | 'MONTHLY',
    dateString: string,
    days: number = 1
  ): Promise<void> {
    try {
      // Calculate date range
      const endDate = new Date(startDate);
      endDate.setDate(endDate.getDate() + days - 1);
      endDate.setHours(23, 59, 59, 999);
      
      // Fetch data from Order Service
      const orderStatsUrl = `${ORDER_SERVICE_URL}/orders/stats/summary?startDate=${startDate.toISOString()}&endDate=${endDate.toISOString()}`;
      const orderStatsResponse = await axios.get(orderStatsUrl);
      const orderStats = orderStatsResponse.data;
      
      // Prepare summary data
      const salesData = {
        count: orderStats.revenue?.orderCount || 0,
        total: orderStats.revenue?.total || 0,
        average: orderStats.revenue?.averageOrderValue || 0,
        metrics: {
          byStatus: orderStats.orderCount?.byStatus || {},
          topProducts: (orderStats.topProducts || []).slice(0, 5)
        }
      };
      
      // Store summary
      await this.upsertSummary('SALES', type, dateString, salesData);
    } catch (error) {
      this.logger.error(`Error generating sales summary: ${error}`);
    }
  }

  /**
   * Generate payment summary (continued)
   */
  private async generatePaymentSummary(
    startDate: Date, 
    type: 'DAILY' | 'WEEKLY' | 'MONTHLY',
    dateString: string,
    days: number = 1
  ): Promise<void> {
    try {
      // Calculate date range
      const endDate = new Date(startDate);
      endDate.setDate(endDate.getDate() + days - 1);
      endDate.setHours(23, 59, 59, 999);
      
      // Fetch data from Payment Service
      // For this example, we'll simulate payment data
      const paymentData = {
        count: Math.floor(Math.random() * 100) + 50,
        total: Math.floor(Math.random() * 10000) + 1000,
        average: 0,
        metrics: {
          refundCount: Math.floor(Math.random() * 10),
          refundAmount: Math.floor(Math.random() * 1000),
          byMethod: {
            CREDIT_CARD: { count: Math.floor(Math.random() * 50) + 25, amount: Math.floor(Math.random() * 5000) + 500 },
            DEBIT_CARD: { count: Math.floor(Math.random() * 30) + 15, amount: Math.floor(Math.random() * 3000) + 300 },
            CASH: { count: Math.floor(Math.random() * 20) + 10, amount: Math.floor(Math.random() * 2000) + 200 }
          }
        }
      };
      
      // Calculate average
      paymentData.average = paymentData.count > 0 ? paymentData.total / paymentData.count : 0;
      
      // Store summary
      await this.upsertSummary('PAYMENT', type, dateString, paymentData);
    } catch (error) {
      this.logger.error(`Error generating payment summary: ${error}`);
    }
  }

  /**
   * Generate inventory summary
   */
  private async generateInventorySummary(
    startDate: Date, 
    type: 'DAILY' | 'WEEKLY' | 'MONTHLY',
    dateString: string,
    days: number = 1
  ): Promise<void> {
    try {
      // Calculate date range
      const endDate = new Date(startDate);
      endDate.setDate(endDate.getDate() + days - 1);
      endDate.setHours(23, 59, 59, 999);
      
      // Fetch data from Inventory Service
      // For this example, we'll simulate inventory data
      const inventoryData = {
        count: Math.floor(Math.random() * 500) + 200,
        total: 0,
        average: 0,
        metrics: {
          additions: Math.floor(Math.random() * 50) + 10,
          reductions: Math.floor(Math.random() * 40) + 5,
          adjustments: Math.floor(Math.random() * 10) + 1,
          balance: 0,
          outOfStock: Math.floor(Math.random() * 20),
          lowStock: Math.floor(Math.random() * 30) + 10
        }
      };
      
      // Calculate balance
      inventoryData.metrics.balance = inventoryData.metrics.additions - inventoryData.metrics.reductions;
      
      // Store summary
      await this.upsertSummary('INVENTORY', type, dateString, inventoryData);
    } catch (error) {
      this.logger.error(`Error generating inventory summary: ${error}`);
    }
  }

  /**
   * Generate delivery summary
   */
  private async generateDeliverySummary(
    startDate: Date, 
    type: 'DAILY' | 'WEEKLY' | 'MONTHLY',
    dateString: string,
    days: number = 1
  ): Promise<void> {
    try {
      // Calculate date range
      const endDate = new Date(startDate);
      endDate.setDate(endDate.getDate() + days - 1);
      endDate.setHours(23, 59, 59, 999);
      
      // Fetch data from Delivery Service
      // For this example, we'll simulate delivery data
      const totalDeliveries = Math.floor(Math.random() * 100) + 20;
      const completed = Math.floor(totalDeliveries * (0.7 + Math.random() * 0.2));
      const failed = Math.floor(totalDeliveries * (0.05 + Math.random() * 0.05));
      const cancelled = totalDeliveries - completed - failed;
      
      const onTime = Math.floor(completed * (0.8 + Math.random() * 0.15));
      const late = completed - onTime;
      
      const deliveryData = {
        count: totalDeliveries,
        total: 0,
        average: 0,
        metrics: {
          completed,
          failed,
          cancelled,
          onTime,
          late
        }
      };
      
      // Store summary
      await this.upsertSummary('DELIVERY', type, dateString, deliveryData);
    } catch (error) {
      this.logger.error(`Error generating delivery summary: ${error}`);
    }
  }

  /**
   * Upsert a summary record
   */
  private async upsertSummary(
    dataType: 'SALES' | 'INVENTORY' | 'PAYMENT' | 'DELIVERY',
    type: 'DAILY' | 'WEEKLY' | 'MONTHLY',
    date: string,
    data: any
  ): Promise<void> {
    try {
      await this.dataSummaryModel.updateOne(
        { type, date, dataType },
        {
          $set: {
            summaryId: uuidv4(),
            type,
            date,
            dataType,
            data
          }
        },
        { upsert: true }
      );
    } catch (error) {
      this.logger.error(`Error upserting summary: ${error}`);
      throw error;
    }
  }

  /**
   * Record order event
   */
  private async recordOrderEvent(eventType: string, content: any): Promise<void> {
    try {
      // In a real implementation, this would store event data for reporting
      // For this example, we'll just log the event
      this.logger.debug(`Recording order event: ${eventType}`, { content });
    } catch (error) {
      this.logger.error(`Error recording order event: ${error}`);
    }
  }

  /**
   * Record payment event
   */
  private async recordPaymentEvent(eventType: string, content: any): Promise<void> {
    try {
      // In a real implementation, this would store event data for reporting
      // For this example, we'll just log the event
      this.logger.debug(`Recording payment event: ${eventType}`, { content });
    } catch (error) {
      this.logger.error(`Error recording payment event: ${error}`);
    }
  }

  /**
   * Record inventory event
   */
  private async recordInventoryEvent(eventType: string, content: any): Promise<void> {
    try {
      // In a real implementation, this would store event data for reporting
      // For this example, we'll just log the event
      this.logger.debug(`Recording inventory event: ${eventType}`, { content });
    } catch (error) {
      this.logger.error(`Error recording inventory event: ${error}`);
    }
  }

  /**
   * Record delivery event
   */
  private async recordDeliveryEvent(eventType: string, content: any): Promise<void> {
    try {
      // In a real implementation, this would store event data for reporting
      // For this example, we'll just log the event
      this.logger.debug(`Recording delivery event: ${eventType}`, { content });
    } catch (error) {
      this.logger.error(`Error recording delivery event: ${error}`);
    }
  }

  /**
   * Get date string for summary
   */
  private getDateString(date: Date, type: 'DAILY' | 'WEEKLY' | 'MONTHLY'): string {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    
    switch (type) {
      case 'DAILY':
        return `${year}-${month}-${day}`;
      case 'WEEKLY':
        const weekStart = new Date(date);
        weekStart.setDate(weekStart.getDate() - weekStart.getDay());
        const weekStartMonth = String(weekStart.getMonth() + 1).padStart(2, '0');
        const weekStartDay = String(weekStart.getDate()).padStart(2, '0');
        return `${year}-W${this.getWeekNumber(date)}`;
      case 'MONTHLY':
        return `${year}-${month}`;
      default:
        return `${year}-${month}-${day}`;
    }
  }

  /**
   * Get week number
   */
  private getWeekNumber(date: Date): number {
    const target = new Date(date.valueOf());
    const dayNr = (date.getDay() + 6) % 7;
    target.setDate(target.getDate() - dayNr + 3);
    const firstThursday = target.valueOf();
    target.setMonth(0, 1);
    if (target.getDay() !== 4) {
      target.setMonth(0, 1 + ((4 - target.getDay()) + 7) % 7);
    }
    return 1 + Math.ceil((firstThursday - target.valueOf()) / 604800000);
  }

  /**
   * Get date range for time period
   */
  private getDateRangeForTimePeriod(timePeriod: string): { start: Date, end: Date } {
    const now = new Date();
    let start: Date, end: Date;
    
    switch (timePeriod) {
      case ReportTimePeriod.DAILY:
        start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        end = new Date(start);
        end.setHours(23, 59, 59, 999);
        break;
        
      case ReportTimePeriod.WEEKLY:
        // Start from last Sunday
        start = new Date(now);
        start.setDate(now.getDate() - now.getDay());
        start.setHours(0, 0, 0, 0);
        end = new Date(now);
        end.setHours(23, 59, 59, 999);
        break;
        
      case ReportTimePeriod.MONTHLY:
        // Start from first day of month
        start = new Date(now.getFullYear(), now.getMonth(), 1);
        end = new Date(now);
        end.setHours(23, 59, 59, 999);
        break;
        
      case ReportTimePeriod.QUARTERLY:
        // Start from first day of quarter
        const quarter = Math.floor(now.getMonth() / 3);
        start = new Date(now.getFullYear(), quarter * 3, 1);
        end = new Date(now);
        end.setHours(23, 59, 59, 999);
        break;
        
      case ReportTimePeriod.YEARLY:
        // Start from first day of year
        start = new Date(now.getFullYear(), 0, 1);
        end = new Date(now);
        end.setHours(23, 59, 59, 999);
        break;
        
      default:
        // Default to last 30 days
        end = new Date(now);
        end.setHours(23, 59, 59, 999);
        start = new Date(end);
        start.setDate(end.getDate() - 30);
        start.setHours(0, 0, 0, 0);
    }
    
    return { start, end };
  }

  /**
   * Group sales by product
   */
  private groupSalesByProduct(products: any[]): any[] {
    return products.map(product => ({
      productId: product.productId,
      name: product.name,
      sales: product.totalRevenue || 0,
      quantity: product.totalQuantity || 0
    }));
  }

  /**
   * Group inventory by category
   */
  private groupInventoryByCategory(items: any[]): Record<string, number> {
    const categories: Record<string, number> = {};
    
    items.forEach(item => {
      const category = item.category || 'Uncategorized';
      const value = (item.quantity || 0) * (item.price || 0);
      
      if (!categories[category]) {
        categories[category] = 0;
      }
      
      categories[category] += value;
    });
    
    return categories;
  }

  /**
   * Aggregate payment methods
   */
  private aggregatePaymentMethods(summaries: any[]): Record<string, any> {
    const methods: Record<string, any> = {};
    
    summaries.forEach(summary => {
      const byMethod = summary.data.metrics.byMethod || {};
      
      Object.entries(byMethod).forEach(([method, data]: [string, any]) => {
        if (!methods[method]) {
          methods[method] = {
            count: 0,
            amount: 0
          };
        }
        
        methods[method].count += data.count || 0;
        methods[method].amount += data.amount || 0;
      });
    });
    
    return methods;
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
  const reportingService = new ReportingService();
  reportingService.start().catch(error => {
    console.error('Failed to start Reporting Service:', error);
    process.exit(1);
  });
  
  // Handle graceful shutdown
  const shutdown = async () => {
    await reportingService.shutdown();
    process.exit(0);
  };
  
  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}

export default ReportingService;