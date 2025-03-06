import amqp, { Channel, Connection, ConsumeMessage } from 'amqplib';
import winston from 'winston';

// Message handler type
type MessageHandler = (content: any, msg: ConsumeMessage) => Promise<void>;

/**
 * MessageBus - Provides standardized message handling for microservices
 * Implements reliable patterns for working with RabbitMQ
 */
export class MessageBus {
  private connection: Connection | null = null;
  private channel: Channel | null = null;
  private readonly logger: winston.Logger;
  private readonly uri: string;
  private reconnectAttempts: number = 0;
  private readonly maxReconnectAttempts: number = 10;
  private readonly initialReconnectDelay: number = 1000;
  private readonly serviceId: string;
  private readonly handlers: Map<string, MessageHandler> = new Map();
  private readonly exchanges: Set<string> = new Set();
  private readonly queues: Set<string> = new Set();

  /**
   * Initialize the message bus
   * @param uri - RabbitMQ connection URI
   * @param serviceId - Unique identifier for the service
   * @param logger - Logger instance
   */
  constructor(uri: string, serviceId: string, logger: winston.Logger) {
    this.uri = uri;
    this.serviceId = serviceId;
    this.logger = logger;
  }

  /**
   * Connect to RabbitMQ with exponential backoff
   */
  public async connect(): Promise<void> {
    try {
      this.connection = await amqp.connect(this.uri);
      this.channel = await this.connection.createChannel();
      this.reconnectAttempts = 0;
      this.logger.info('Connected to RabbitMQ');

      // Setup connection error and close handlers
      this.connection.on('error', (err) => {
        this.logger.error(`RabbitMQ connection error: ${err.message}`);
        this.attemptReconnect();
      });

      this.connection.on('close', () => {
        this.logger.warn('RabbitMQ connection closed');
        this.attemptReconnect();
      });

      // Re-register handlers after reconnection
      await this.restoreTopology();
    } catch (error) {
      this.logger.error(`Failed to connect to RabbitMQ: ${error}`);
      this.attemptReconnect();
    }
  }

  /**
   * Attempt to reconnect with exponential backoff
   */
  private attemptReconnect(): void {
    if (this.connection && this.connection.connection) {
      return; // Already connected or connecting
    }
    
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      this.logger.error('Max reconnection attempts reached. Giving up.');
      return;
    }

    this.reconnectAttempts++;
    const delay = this.initialReconnectDelay * Math.pow(2, this.reconnectAttempts - 1);
    this.logger.info(`Attempting to reconnect in ${delay}ms (attempt ${this.reconnectAttempts})`);

    setTimeout(() => this.connect(), delay);
  }

  /**
   * Create a durable exchange
   * @param exchange - Exchange name
   * @param type - Exchange type (e.g., 'direct', 'topic', 'fanout')
   */
  public async createExchange(exchange: string, type: string): Promise<void> {
    if (!this.channel) {
      throw new Error('Channel not established');
    }
    
    await this.channel.assertExchange(exchange, type, { durable: true });
    this.exchanges.add(`${exchange}:${type}`);
    this.logger.debug(`Exchange created: ${exchange} (${type})`);
  }

  /**
   * Create a durable queue and bind it to an exchange
   * @param queue - Queue name
   * @param exchange - Exchange name
   * @param routingKey - Routing key for binding
   */
  public async createQueue(queue: string, exchange: string, routingKey: string): Promise<void> {
    if (!this.channel) {
      throw new Error('Channel not established');
    }
    
    await this.channel.assertQueue(queue, { durable: true });
    await this.channel.bindQueue(queue, exchange, routingKey);
    this.queues.add(`${queue}:${exchange}:${routingKey}`);
    this.logger.debug(`Queue created and bound: ${queue} -> ${exchange} (${routingKey})`);
  }

  /**
   * Publish a message to an exchange
   * @param exchange - Exchange name
   * @param routingKey - Routing key
   * @param message - Message content (will be serialized to JSON)
   * @param options - Additional options
   */
  public async publish(
    exchange: string, 
    routingKey: string, 
    message: any, 
    options: { 
      persistent?: boolean, 
      messageId?: string, 
      correlationId?: string,
      timestamp?: number
    } = {}
  ): Promise<boolean> {
    if (!this.channel) {
      throw new Error('Channel not established');
    }
    
    try {
      const content = Buffer.from(JSON.stringify(message));
      
      // Set default properties
      const publishOptions = {
        persistent: options.persistent ?? true,
        messageId: options.messageId ?? this.generateId(),
        correlationId: options.correlationId,
        timestamp: options.timestamp ?? Math.floor(Date.now() / 1000),
        appId: this.serviceId
      };
      
      const result = this.channel.publish(exchange, routingKey, content, publishOptions);
      
      if (!result) {
        this.logger.warn('Channel write buffer is full. Consider implementing flow control.');
      }
      
      return result;
    } catch (error) {
      this.logger.error(`Failed to publish message: ${error}`);
      return false;
    }
  }

  /**
   * Subscribe to a queue and process messages
   * @param queue - Queue name
   * @param handler - Message handler function
   */
  public async subscribe(queue: string, handler: MessageHandler): Promise<void> {
    if (!this.channel) {
      throw new Error('Channel not established');
    }
    
    // Store the handler for reconnection
    this.handlers.set(queue, handler);
    
    await this.channel.consume(queue, async (msg) => {
      if (!msg) return;
      
      try {
        const content = JSON.parse(msg.content.toString());
        await handler(content, msg);
        this.channel?.ack(msg);
      } catch (error) {
        this.logger.error(`Error processing message: ${error}`);
        // Negative acknowledgment - requeue only if not already redelivered
        // This prevents indefinite requeuing of poison messages
        const requeue = !msg.fields.redelivered;
        this.channel?.nack(msg, false, requeue);
        
        if (!requeue) {
          this.logger.warn(`Message rejected and not requeued. Consider implementing a dead letter exchange.`);
        }
      }
    });
    
    this.logger.info(`Subscribed to queue: ${queue}`);
  }

  /**
   * Restore exchange, queue and consumer topology after reconnection
   */
  private async restoreTopology(): Promise<void> {
    if (!this.channel) return;
    
    // Re-create exchanges
    for (const exchangeInfo of this.exchanges) {
      const [exchange, type] = exchangeInfo.split(':');
      await this.channel.assertExchange(exchange, type, { durable: true });
    }
    
    // Re-create queues and bindings
    for (const queueInfo of this.queues) {
      const [queue, exchange, routingKey] = queueInfo.split(':');
      await this.channel.assertQueue(queue, { durable: true });
      await this.channel.bindQueue(queue, exchange, routingKey);
    }
    
    // Re-establish consumers
    for (const [queue, handler] of this.handlers.entries()) {
      await this.subscribe(queue, handler);
    }
    
    this.logger.info('Message topology restored after reconnection');
  }

  /**
   * Generate a unique message ID
   */
  private generateId(): string {
    return `${Date.now()}-${Math.random().toString(36).substring(2, 15)}`;
  }

  /**
   * Close the connection
   */
  public async close(): Promise<void> {
    if (this.channel) {
      await this.channel.close();
    }
    
    if (this.connection) {
      await this.connection.close();
    }
    
    this.logger.info('RabbitMQ connection closed');
  }
}

export default MessageBus;