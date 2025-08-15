const amqp = require('amqplib');

let connection;
let channel;

async function connect(retries = 20, delay = 3000) {
    const amqpUrl = process.env.RABBITMQ_URL || 'amqp://localhost';

    for (let i = 0; i < retries; i++) {
        try {
            connection = await amqp.connect(amqpUrl);
            channel = await connection.createChannel();
            console.log('Connected to RabbitMQ');
            return channel;
        } catch (err) {
            console.log(`RabbitMQ not ready, retrying in ${delay / 1000}s... (${i + 1}/${retries})`);
            await new Promise((res) => setTimeout(res, delay));
        }
    }

    throw new Error('RabbitMQ channel not available after retries');
}

async function publish(exchangeName, routingKey, message) {
    if (!channel) await connect();
    try {
        await channel.assertExchange(exchangeName, 'topic', { durable: true });
        await channel.publish(exchangeName, routingKey, Buffer.from(JSON.stringify(message)), { persistent: true });
        console.log(`Message published to '${exchangeName}' with routing key '${routingKey}'`);
    } catch (error) {
        console.error(`Failed to publish message to '${exchangeName}' (routingKey: '${routingKey}')`, error);
        throw error;
    }
}

async function consume(exchangeName, queue, routingKey, callback) {
    if (!channel) await connect();
    try {
        await channel.assertExchange(exchangeName, 'topic', { durable: true });
        const assertedQueue = await channel.assertQueue(queue, { durable: true });
        await channel.bindQueue(assertedQueue.queue, exchangeName, routingKey);

        console.log(`Listening on queue '${queue}' (exchange: '${exchangeName}', routingKey: '${routingKey}')`);

        channel.consume(assertedQueue.queue, async (msg) => {
            if (!msg) return;
            try {
                const message = JSON.parse(msg.content.toString());
                console.log(`Message received on queue '${queue}':`, message);
                await callback(message);
                channel.ack(msg);
            } catch (err) {
                console.error(`Error processing message from queue '${queue}':`, err);
                channel.nack(msg, false, false);
            }
        });
    } catch (err) {
        console.error(`Failed to set up consumer for queue '${queue}'`, err);
        throw err;
    }
}

async function closeConnection() {
    if (connection) {
        console.log('Closing RabbitMQ connection...');
        await connection.close();
    }
}

module.exports = { connect, publish, consume, closeConnection };
