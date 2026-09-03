import "dotenv/config";

import { createServer } from "node:http";

import app from "./app.js";
import {
  connectDatabase,
  disconnectDatabase,
} from "./config/database.js";
import { createChatSocketServer } from "./sockets/chat.socket.js";
import { validateMessageEncryptionConfig } from "./services/message-encryption.service.js";

const PORT = Number(process.env.PORT) || 5000;

async function startServer(): Promise<void> {
  try {
    validateMessageEncryptionConfig();
    await connectDatabase();

    const server = createServer(app);
    const io = createChatSocketServer(server);

    server.listen(PORT, () => {
      console.log(`SecureChat API running on port ${PORT}`);
    });

    const shutdown = async (signal: string): Promise<void> => {
      console.log(`${signal} received. Shutting down...`);

      server.close(async () => {
        try {
          await io.close();
          await disconnectDatabase();
          console.log("Shutdown complete.");
          process.exit(0);
        } catch (error) {
          console.error("Error during shutdown.");
          process.exit(1);
        }
      });
    };

    process.on("SIGINT", () => {
      void shutdown("SIGINT");
    });

    process.on("SIGTERM", () => {
      void shutdown("SIGTERM");
    });
  } catch (error) {
    console.error("Unable to start SecureChat API.");
    process.exit(1);
  }
}

void startServer();