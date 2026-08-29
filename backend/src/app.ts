import express from "express";
import cors from "cors";
import helmet from "helmet";
import cookieParser from "cookie-parser";
import authRoutes from "./routes/auth.routes.js";
import conversationRoutes from "./routes/conversation.routes.js";
import userRoutes from "./routes/user.routes.js";

const app = express();

/*
 * ================================
 * Security middleware
 * ================================
 */

app.disable("x-powered-by");

app.use(
  helmet({
    contentSecurityPolicy: false,
  }),
);

app.use(
  cors({
    origin: process.env.CLIENT_URL,
    credentials: true,
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE"],
    allowedHeaders: ["Content-Type", "X-CSRF-Token"],
  }),
);

/*
 * Limit request body size.
 * This prevents unnecessarily large JSON payloads.
 */

app.use(
  express.json({
    limit: "10kb",
  }),
);

app.use(
  express.urlencoded({
    extended: false,
    limit: "10kb",
  }),
);

app.use(cookieParser());

app.use("/api/auth", authRoutes);
app.use("/api/conversations", conversationRoutes);
app.use("/api/users", userRoutes);

/*
 * ================================
 * Health check
 * ================================
 */

app.get("/api/health", (_req, res) => {
  res.status(200).json({
    success: true,
    message: "SecureChat API is running",
  });
});

export default app;