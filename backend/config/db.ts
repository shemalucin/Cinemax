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

  // IMPORTANT: never let a bad/placeholder MONGO_URI take the whole process
  // down. A single mis-set environment variable on the hosting dashboard
  // (e.g. Render) used to crash the entire backend on every boot — including
  // the admin panel's API — because this threw out of start() in server.ts
  // and hit process.exit(1). Catch it here instead and fall back to the
  // file-backed JSON store, exactly like the "MONGO_URI not set" case above.
  try {
    await mongoose.connect(mongoUri, { serverSelectionTimeoutMS: 8000 });
    console.log("[db] Connected to MongoDB.");
  } catch (err) {
    console.error(
      "[db] Failed to connect to MongoDB — check that MONGO_URI is a valid connection string. " +
        "Continuing with the file-backed store so the site/admin panel stay online.",
      err,
    );
  }
}
