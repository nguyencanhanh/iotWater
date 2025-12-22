import { createClient } from "redis";

export let clientRedis = null;

async function connectRedis(url = process.env.REDIS_URL) {
    if (clientRedis) return clientRedis; // tránh tạo lại client

    clientRedis = createClient({ url });

    clientRedis.on("error", (err) => {
        clientRedis.error("Redis error:", err);
    });

    try {
        await clientRedis.connect();
        console.log("Connected to Redis!");
        return clientRedis;
    } catch (err) {
        console.error("Redis connection failed:", err);
        throw err;
    }
}

export default connectRedis;
