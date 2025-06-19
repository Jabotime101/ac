const session = require("express-session");
const connectRedis = require("connect-redis");
const { createClient } = require("redis");

// Create Redis client and store
const RedisStore = connectRedis(session);
const redisClient = createClient({ url: process.env.REDIS_URL });

// Connect to Redis
await redisClient.connect();

// Session configuration
const sessionConfig = {
  store: new RedisStore({ client: redisClient }),
  secret: process.env.SESSION_SECRET,
  resave: false,
  saveUninitialized: false,
  cookie: { 
    secure: process.env.NODE_ENV === "production", 
    sameSite: "lax", 
    maxAge: 86400000 
  }
};

module.exports = { session, sessionConfig, redisClient }; 