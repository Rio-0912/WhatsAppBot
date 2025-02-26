const express = require("express");
const mongoose = require("mongoose");
const { log } = console;
const { audioHandle } = require("./Controllers/Controllers");
const { mistralHandle } = require("./Controllers/AiController");
const { getMessageContext, sendSavedItemsConfirmation, sendErrorMessage } = require("./MiddleWare/WhatsAppSendBacks");
const { createBuy } = require("./Controllers/BuyController");
const axios = require("axios");
const { createCredit } = require("./Controllers/CreditController");

const app = express();
app.use(express.json());
require('dotenv').config();
const WEB_VERI_TOK = process.env.WEB_VERI_TOK;
const TOK = process.env.TOK;

// Connect to MongoDB
const mongoURI = process.env.MONGO_URI;
mongoose.connect(mongoURI)
  .then(() => log("MongoDB connected successfully"))
  .catch(err => log("MongoDB connection error:", err));

// log(WEB_VERI_TOK, TOK)
app.get("/", (req, res) => {
  res.send("whatsasdfp");
});

app.get("/webhook", async (req, res) => {
  const mode = req.query["hub.mode"];
  const challenge = req.query["hub.challenge"];
  const token = req.query["hub.verify_token"];
  if (mode && token == WEB_VERI_TOK) {
    res.status(200).send(challenge);
  } else {
    res.sendStatus(403);
  }
});

app.post("/webhook", async (req, res) => {
  try {
    const message = req.body.entry?.[0]?.changes?.[0]?.value?.messages?.[0];
    log("Received message:", message);

    if (message?.type === "audio") {
      await audioHandle(message, TOK);
    }

    if (message?.type === "text") {
      log("Text message received:", message.text.body);
      await mistralHandle(message.text.body, message.from);
    }

    // Enhanced interactive message handling
    if (message?.type === "interactive" && message?.interactive?.type === "button_reply") {
      const buttonReply = message.interactive.button_reply;
      const originalMessageId = message.context?.id;
      const userId = message.from;

      const messageContext = originalMessageId ? getMessageContext(originalMessageId) : null;

      if (messageContext) {
        log("Retrieved message context:", messageContext);

        if (buttonReply.id === "confirm_text") {
          log("User confirmed text:", messageContext.extractedText);
          try {
            const rawData = JSON.parse(messageContext.extractedText);
            
            if (messageContext.isWholesale) {
              // Handle Buy data
              const buyData = {
                data: rawData
              };

              const reqMock = { body: buyData };
              const resMock = {
                status: (code) => ({ 
                  json: (data) => {
                    log("DB Response:", data);
                    return data;
                  }
                })
              };

              const result = await createBuy(reqMock, resMock);
              
              if (result && result.success) {
                await sendSavedItemsConfirmation(userId, result.data);
              } else {
                throw new Error(result?.error || 'Failed to save buy data');
              }
            } else {
              // Handle Credit data
              const creditData = {
                data: rawData
              };

              const reqMock = { body: creditData };
              const resMock = {
                status: (code) => ({ 
                  json: (data) => {
                    log("DB Response:", data);
                    return data;
                  }
                })
              };

              const result = await createCredit(reqMock, resMock);
              
              if (result && result.success) {
                await sendSavedItemsConfirmation(userId, result.data);
              } else {
                throw new Error(result?.error || 'Failed to save credit data');
              }
            }

          } catch (error) {
            console.error("Error processing confirmed text:", error);
            await sendErrorMessage(userId, `Error: ${error.message}`);
          }
        }
        else if (buttonReply.id === "edit_text") {
          log("User requested edit for:", messageContext.extractedText);
          // Handle edit request
          // You might want to send a message asking for the corrected text
          // await sendMessage(userId, "Please send the corrected text.");
        }
      } else {
        log("No context found for message:", originalMessageId);
      }
    }

    res.status(200).send("Webhook processed");
  } catch (error) {
    console.error("Error in webhook processing:", error);
    res.status(500).send("Internal Server Error");
  }
});

app.listen(3000, () => {
  console.log("Server running on port 3000...");
});
