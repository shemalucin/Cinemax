import mongoose from "mongoose";

/**
 * Connects to MongoDB Atlas using the MONGO_URI environment variable.
 * Returns true if connected, false otherwise. The server MUST await this
 * before initializing the app-state singleton, otherwise reads/writes will
 * silently fall back to the local JSON file.
 */
export const connectDB = async (): Promise<boolean> => {
  const connString = process.env.MONGO_URI;
  if (!connString) {
    console.log("ℹ️  MONGO_URI is not set — using file-backed JSON store. Data will persist locally but not across deployments.");
    return false;
  }
  try {
    await mongoose.connect(connString, {
      serverSelectionTimeoutMS: 15000,
    });
    console.log("🚀 MongoDB Atlas connected successfully.");
    mongoose.connection.on("error", (err) => {
      console.error("[mongo] connection error:", err);
    });
    mongoose.connection.on("disconnected", () => {
      console.warn("[mongo] disconnected");
    });
    return true;
  } catch (error) {
    console.log("ℹ️  MongoDB connection failed — using file-backed JSON store as fallback:", (error as Error).message);
    return false;
  }
};
