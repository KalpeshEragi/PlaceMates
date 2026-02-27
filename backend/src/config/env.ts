import dotenv from "dotenv";

dotenv.config();

export const env = {
    PORT: parseInt(process.env.PORT || "5000", 10),
    NODE_ENV: process.env.NODE_ENV || "development",
    DATABASE_URL: process.env.DATABASE_URL || "",
    JWT_SECRET: process.env.JWT_SECRET || "dev-secret",
    FRONTEND_URL: process.env.FRONTEND_URL || "http://localhost:3000",
} as const;
