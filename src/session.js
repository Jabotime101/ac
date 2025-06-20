const session      = require("express-session");
const { default: RedisStore } = require("connect-redis");  // v7 default export is the class
const { createClient } = require("redis");

// Create Redis client and store
const redisClient = createClient({ 
  url: process.env.REDIS_URL || 'redis://localhost:6379' 
});

// Connect to Redis with error handling
redisClient.connect().catch(console.error);

// Session configuration
const sessionConfig = {
  store: new RedisStore({ client: redisClient }),
  secret: process.env.SESSION_SECRET || 'your-secret-key-change-in-production',
  resave: false,
  saveUninitialized: false,
  cookie: { 
    secure: process.env.NODE_ENV === "production", 
    sameSite: "lax", 
    maxAge: 86400000 
  }
};

// Export function to setup session middleware
module.exports = (app) => { 
  app.use(session(sessionConfig)); 
}; 