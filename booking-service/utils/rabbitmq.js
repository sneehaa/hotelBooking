// utils/rabbitmq.js
// Unified, per-call exchange; robust connect + consume.

const amqp = require('amqplib');

let connection;
let channel;

async function waitForChannel(retries = 20, delay = 1500) {
  for (let i = 0; i < retries; i++) {
    if (channel) return channel;
    console.log('Waiting for RabbitMQ channel...');
    await new Promise((res) => setTimeout(res, delay));
  }
  throw new Error('RabbitMQ channel not available after retries');
}

async function connect() {
  const amqpUrl = process.env.RABBITMQ_URL || 'amqp://localhost';
  try {
    connection = await amqp.connect(amqpUrl);
    channel = await connection.createChannel();
    console.log('Connected to RabbitMQ');
  } catch (error) {
    console.error('Error connecting to RabbitMQ:', error);
    throw error;
  }
}

async function publish(exchange, routingKey, message) {
  if (!channel) await waitForChannel();
  await channel.assertExchange(exchange, 'topic', { durable: true });
  const payload = Buffer.from(JSON.stringify(message));
  const ok = channel.publish(exchange, routingKey, payload, { persistent: true });
  if (!ok) console.warn(`Backpressure when publishing to ${exchange}:${routingKey}`);
}

async function consume(exchange, queue, routingKey, callback) {
  if (!channel) await waitForChannel();
  await channel.assertExchange(exchange, 'topic', { durable: true });
  const { queue: q } = await channel.assertQueue(queue, { durable: true, exclusive: false });
  await channel.bindQueue(q, exchange, routingKey);
  console.log(`Consuming ${q} on ${exchange} (${routingKey})`);

  channel.consume(q, async (msg) => {
    if (!msg) return;
    try {
      const content = JSON.parse(msg.content.toString());
      await callback(content);
      channel.ack(msg);
    } catch (err) {
      console.error('Error processing message:', err);
      // dead-letter instead of requeue spam
      channel.nack(msg, false, false);
    }
  });
}

async function closeConnection() {
  try {
    if (connection) await connection.close();
  } catch {}
}

module.exports = { connect, publish, consume, closeConnection };
