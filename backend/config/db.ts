import mongoose from "mongoose";

let didAttemptConnection = false;

export async function connectDB(): Promise<void> {
  if (mongoose.connection.readyState === 1) {
    return;
  }

  const mongoUri = process.env.MONGO_URI || process.env.MONGODB_URI;
  if (!mongoUri) {
    if (!didAttemptConnection) {
      console.warn("[db] MONGO_URI not configured; continuing with the file-backed store.");
      didAttemptConnection = true;
    }
    return;
  }

  if (didAttemptConnection && mongoose.connection.readyState === 2) {
    return;
  }

  didAttemptConnection = true;
  await mongoose.connect(mongoUri);
  console.log("[db] Connected to MongoDB.");
}
