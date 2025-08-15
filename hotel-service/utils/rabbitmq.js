const amqp = require('amqplib');

let connection;
let channel;


async function waitForChannel(retries = 10, delay = 3000) {
  for (let i = 0; i < retries; i++) {
    if (channel) return channel;
    console.log('Waiting for RabbitMQ channel...');
    await new Promise((res) => setTimeout(res, delay));
  }
  throw new Error('RabbitMQ channel not available after retries');
}

async function connect() {
  try {
    const amqpUrl = process.env.RABBITMQ_URL || 'amqp://localhost';
    connection = await amqp.connect(amqpUrl);
    channel = await connection.createChannel();
    await channel.assertExchange(process.env.RABBITMQ_EXCHANGE, 'topic', { durable: true });
    console.log('Connected to RabbitMQ');
  } catch (error) {
    console.error('Error connecting to RabbitMQ:', error);
    process.exit(1);
  }
}

async function publishMessage(routingKey, message) {
  if (!channel) await waitForChannel();
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
  if (!channel) await waitForChannel();

  try {
    const assertedQueue = await channel.assertQueue(queue, { durable: true, exclusive: false });
    await channel.bindQueue(assertedQueue.queue, process.env.RABBITMQ_EXCHANGE, routingKey);

    console.log(`Waiting for messages in ${queue} with routing key ${routingKey}`);

    channel.consume(assertedQueue.queue, async (msg) => {
      if (msg) {
        try {
          const message = JSON.parse(msg.content.toString());
          await callback(message);
          channel.ack(msg);
        } catch (error) {
          console.error('Error processing message:', error);
          channel.nack(msg, false, false);
        }
      }
    });
  } catch (error) {
    console.error('Error setting up consumer:', error);
    throw error;
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
