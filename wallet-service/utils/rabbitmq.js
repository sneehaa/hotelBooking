const amqp = require('amqplib');

let connection;
let channel;

async function connect(retries = 20, delay = 3000) {
  const amqpUrl = process.env.RABBITMQ_URL || 'amqp://localhost';

  for (let i = 0; i < retries; i++) {
    try {
      connection = await amqp.connect(amqpUrl);
      channel = await connection.createChannel();
      await channel.assertExchange(process.env.RABBITMQ_EXCHANGE, 'topic', { durable: true });
      console.log('Connected to RabbitMQ');
      return channel;
    } catch (err) {
      console.log(`RabbitMQ not ready, retrying in ${delay / 1000}s... (${i + 1}/${retries})`);
      await new Promise((res) => setTimeout(res, delay));
    }
  }

  throw new Error('RabbitMQ channel not available after retries');
}

async function publishMessage(routingKey, message) {
  if (!channel) await connect();
  try {
    await channel.publish(
      process.env.RABBITMQ_EXCHANGE,
      routingKey,
      Buffer.from(JSON.stringify(message)),
      { persistent: true }
    );
    console.log(`Message published to ${routingKey}`);
  } catch (error) {
    console.error('Error publishing message:', error);
    throw error;
  }
}

async function consumeMessages(queue, routingKey, callback) {
  if (!channel) await connect();

  try {
    const assertedQueue = await channel.assertQueue(queue, { durable: true });
    await channel.bindQueue(assertedQueue.queue, process.env.RABBITMQ_EXCHANGE, routingKey);

    console.log(`Waiting for messages in ${queue} with routing key ${routingKey}`);

    channel.consume(assertedQueue.queue, async (msg) => {
      if (msg) {
        try {
          const message = JSON.parse(msg.content.toString());
          await callback(message);
          channel.ack(msg);
        } catch (err) {
          console.error('Error processing message:', err);
          channel.nack(msg, false, false);
        }
      }
    });
  } catch (err) {
    console.error('Error setting up consumer:', err);
    throw err;
  }
}

async function closeConnection() {
  if (connection) await connection.close();
}

module.exports = {
  connect,
  publish: publishMessage,
  consume: consumeMessages,
  closeConnection
};
