const amqp = require('amqplib');

let connection;
let channel;
let reconnectTimer;
let isConnecting = false;

const INITIAL_RETRY_DELAY = 1000;
const MAX_RETRIES = 10;

async function wait(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function connect() {
  if (channel) return channel;
  if (isConnecting) {
    await wait(500);
    return connect();
  }

  isConnecting = true;
  const amqpUrl = process.env.RABBITMQ_URL || 'amqp://guest:guest@rabbitmq:5672';

  try {
    connection = await amqp.connect(amqpUrl, {
  clientProperties: { connection_name: 'email-service' }
});


    connection.on('close', () => scheduleReconnect());
    connection.on('error', (err) => console.error('RabbitMQ connection error:', err.message));

    channel = await connection.createConfirmChannel();
    console.log('RabbitMQ connected');
    isConnecting = false;
    return channel;

  } catch (err) {
    isConnecting = false;
    console.error('RabbitMQ connection failed:', err.message);
    throw err;
  }
}


function scheduleReconnect(retries = 0) {
  if (reconnectTimer) clearTimeout(reconnectTimer);

  const delay = Math.min(
    INITIAL_RETRY_DELAY * Math.pow(2, retries),
    30000
  );

  reconnectTimer = setTimeout(async () => {
    try {
      await connect();
    } catch {
      if (retries < MAX_RETRIES) {
        scheduleReconnect(retries + 1);
      } else {
        console.error('Max retries reached. Could not reconnect to RabbitMQ.');
      }
    }
  }, delay);
}

async function publish(exchange, routingKey, message, options = {}) {
  try {
    if (!channel) await connect();
    await channel.assertExchange(exchange, 'topic', { durable: true });

    const payload = Buffer.from(JSON.stringify(message));
    return channel.publish(exchange, routingKey, payload, {
      persistent: true,
      ...options
    });
  } catch (err) {
    console.error('Publish failed:', err.message);
    throw err;
  }
}

async function consume(exchange, queue, routingKey, callback) {
  try {
    if (!channel) await connect();

    await channel.assertExchange(exchange, 'topic', { durable: true });
    const { queue: boundQueue } = await channel.assertQueue(queue, {
      durable: true,
      deadLetterExchange: 'dead_letters'
    });

    await channel.bindQueue(boundQueue, exchange, routingKey);

    console.log(`Listening on ${exchange} (${routingKey})`);

    channel.consume(boundQueue, async (msg) => {
      if (!msg) return;

      try {
        const content = JSON.parse(msg.content.toString());
        await callback(content);
        channel.ack(msg);
      } catch (err) {
        console.error('Message processing failed:', err.message);
        channel.nack(msg, false, false);
      }
    });

  } catch (err) {
    console.error('Consume setup failed:', err.message);
    throw err;
  }
}

async function close() {
  if (reconnectTimer) clearTimeout(reconnectTimer);
  if (channel) await channel.close().catch(() => {});
  if (connection) await connection.close().catch(() => {});
  console.log('RabbitMQ connection closed');
}

process.on('SIGTERM', close);
process.on('SIGINT', close);

module.exports = { connect, publish, consume, close };
