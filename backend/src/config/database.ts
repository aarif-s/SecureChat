import mongoose from "mongoose";

export async function connectDatabase(): Promise<void> {
  const mongoUri = process.env.MONGODB_URI;

  if (!mongoUri) {
    throw new Error("MONGODB_URI is not configured.");
  }

  await mongoose.connect(mongoUri, {
    serverSelectionTimeoutMS: 10_000,
    maxPoolSize: 10,
    minPoolSize: 2,
  });

  console.log("MongoDB connected successfully.");
}

export async function disconnectDatabase(): Promise<void> {
  await mongoose.disconnect();
  console.log("MongoDB connection closed.");
}