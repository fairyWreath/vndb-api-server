require("dotenv").config();

const config = {
  env: process.env.NODE_ENV || "development",
  port: process.env.PORT || 3000,
  jwtSecret: process.env.JWT_SECRET || "YOUR_secret_key",
  database: {
    user: process.env.DATABASE_USER || "postgres",
    host: process.env.DATABASE_HOST || "localhost",
    database: process.env.DATABASE_DB || "vn_database",
    password: process.env.DATABASE_USER_PW || "yourpw",
    port: process.env.DATABASE_PORT || 5432,
  },
};

export default config;
