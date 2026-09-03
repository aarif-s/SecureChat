import "dotenv/config";

import { connectDatabase, disconnectDatabase } from "../config/database.js";
import { MessageModel } from "../models/Message.js";
import { encryptMessage } from "../services/message-encryption.service.js";

const isDryRun = process.argv.includes("--dry-run");

async function migrate(): Promise<void> {
  await connectDatabase();

  let scanned = 0;
  let migrated = 0;

  try {
    const eligibleCount = await MessageModel.countDocuments({
      content: { $type: "string" },
      encryption: { $exists: false },
    });

    if (isDryRun) {
      console.log(`Would migrate ${eligibleCount} legacy messages.`);
      return;
    }

    const cursor = MessageModel.find({
      content: { $type: "string" },
      encryption: { $exists: false },
    }).select("_id conversation sender content").cursor();

    for await (const message of cursor) {
      scanned += 1;
      if (typeof message.content !== "string") continue;

      const encrypted = encryptMessage(message.content, {
        conversationId: message.conversation.toString(),
        senderId: message.sender.toString(),
      });

      const result = await MessageModel.updateOne(
        {
          _id: message._id,
          encryption: { $exists: false },
          content: { $type: "string" },
        },
        {
          $set: {
            encryptedContent: encrypted.ciphertext,
            encryption: {
              algorithm: encrypted.algorithm,
              keyVersion: encrypted.keyVersion,
              iv: encrypted.iv,
              authTag: encrypted.authTag,
            },
          },
          $unset: { content: "" },
        },
      );
      if (result.modifiedCount === 1) migrated += 1;
    }
  } finally {
    await disconnectDatabase();
  }

  console.log(`Migrated ${migrated} of ${scanned} legacy messages.`);
}

void migrate().catch(() => {
  console.error("Message encryption migration failed.");
  process.exitCode = 1;
});