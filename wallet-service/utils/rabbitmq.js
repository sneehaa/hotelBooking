const amqp = require('amqplib');

let connection;
let channel;

// This function will connect to RabbitMQ and establish a channel.
// It no longer asserts a *specific* exchange here, as exchanges will be asserted dynamically.
async function connect(retries = 20, delay = 3000) {
    const amqpUrl = process.env.RABBITMQ_URL || 'amqp://localhost';

    for (let i = 0; i < retries; i++) {
        try {
            connection = await amqp.connect(amqpUrl);
            channel = await connection.createChannel();
            // Removed: await channel.assertExchange(process.env.RABBITMQ_EXCHANGE, 'topic', { durable: true });
            // Exchanges will be asserted dynamically in publish/consume methods
            console.log('Connected to RabbitMQ');
            return channel;
        } catch (err) {
            console.log(`RabbitMQ not ready, retrying in ${delay / 1000}s... (${i + 1}/${retries})`);
            await new Promise((res) => setTimeout(res, delay));
        }
    }

    throw new Error('RabbitMQ channel not available after retries');
}

// Publish a message to a specific exchange with a routing key
async function publishMessage(exchangeName, routingKey, message) {
    if (!channel) {
        console.warn('RabbitMQ channel not available, attempting to connect...');
        await connect(); // Ensure connection is established
    }
    try {
        // Assert the exchange dynamically (if it doesn't exist, create it)
        await channel.assertExchange(exchangeName, 'topic', { durable: true });
        
        await channel.publish(
            exchangeName, // Use the specified exchangeName
            routingKey,
            Buffer.from(JSON.stringify(message)),
            { persistent: true }
        );
        console.log(`Message published to exchange '${exchangeName}' with routing key '${routingKey}'`);
    } catch (error) {
        console.error(`Error publishing message to exchange '${exchangeName}' with routing key '${routingKey}':`, error);
        throw error;
    }
}

// Consume messages from a specific queue on a specific exchange with a routing key
async function consumeMessages(exchangeName, queue, routingKey, callback) {
    if (!channel) {
        console.warn('RabbitMQ channel not available, attempting to connect...');
        await connect(); // Ensure connection is established
    }

    try {
        // Assert the exchange dynamically
        await channel.assertExchange(exchangeName, 'topic', { durable: true });

        const assertedQueue = await channel.assertQueue(queue, { durable: true });
        // Bind the queue to the specified exchange with the given routing key
        await channel.bindQueue(assertedQueue.queue, exchangeName, routingKey);

        console.log(`Waiting for messages in queue '${queue}' on exchange '${exchangeName}' with routing key '${routingKey}'`);

        channel.consume(assertedQueue.queue, async (msg) => {
            if (msg) {
                try {
                    const message = JSON.parse(msg.content.toString());
                    console.log(`[RabbitMQ Consumer] Received message from queue '${queue}' (routingKey: '${routingKey}'):`, message);
                    await callback(message);
                    channel.ack(msg);
                } catch (err) {
                    console.error(`[RabbitMQ Consumer] Error processing message from queue '${queue}' (routingKey: '${routingKey}'):`, err);
                    channel.nack(msg, false, false); // Nack the message to indicate processing failure
                }
            }
        });
    } catch (err) {
        console.error(`Error setting up consumer for queue '${queue}' on exchange '${exchangeName}':`, err);
        throw err;
    }
}

async function closeConnection() {
    if (connection) {
        console.log('Closing RabbitMQ connection...');
        await connection.close();
    }
}

module.exports = {
    connect,
    publish: publishMessage,
    consume: consumeMessages,
    closeConnection
};
