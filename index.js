require('dotenv').config();
const express = require("express");
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const { ConnectionManager } = require('./MiddleWare/ConnectionManager');
const ErrorHandler = require('./MiddleWare/ErrorHandler');
const { log } = console;
const { audioHandle, handleGetCredit, handleDeleteCredit, handleDeleteBuy, handleGetBuy, handleGetSales, handleHisab, handleAddSales, handleAddBuy } = require("./Controllers/Controllers");
const { mistralHandle, textMistralHandle } = require("./Controllers/AiController");
const { 
  getMessageContext, 
  sendSavedItemsConfirmation, 
  sendErrorMessage, 
  sendCreditHistory,
  sendHelpMessage,
  sendConfirmationMsg
} = require("./MiddleWare/WhatsAppSendBacks");
const { createBuy } = require("./Controllers/BuyController");
const axios = require("axios");
const { createCredit, getCreditsByUser } = require("./Controllers/CreditController");

// Verify MongoDB URI is loaded
console.log('MongoDB URI:', process.env.MONGO_URI ? 'Found' : 'Missing');

const app = express();

// Trust proxy - Add this before other middleware
app.set('trust proxy', 1);

// Security middleware
app.use(helmet());
app.use(express.json({ limit: '10mb' }));

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 200, // limit each IP to 100 requests per windowMs
  standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
  legacyHeaders: false, // Disable the `X-RateLimit-*` headers
});
app.use('/webhook', limiter);

// Initialize connections
ConnectionManager.initialize();

// Graceful shutdown
process.on('SIGTERM', async () => {
  await ConnectionManager.cleanup();
  process.exit(0);
});

// log(WEB_VERI_TOK, TOK)
app.get("/", (req, res) => {
  res.send("whatsasdfp");
});

app.get("/webhook", async (req, res) => {
  const mode = req.query["hub.mode"];
  const challenge = req.query["hub.challenge"];
  const token = req.query["hub.verify_token"];
  if (mode && token == process.env.WEB_VERI_TOK) {
    res.status(200).send(challenge);
  } else {
    res.sendStatus(403);
  }
});

// Command handlers object for better organization
const commandHandlers = {
  get: async (userId, command) => {
    const [type, ...params] = command.split(' ');
    
    switch(type) {
      case 'buy':
        const dateRange = params.join(' ');
        await handleGetBuy(userId, dateRange);
        break;
      
      case 'sales':
        const salesDateRange = params.join(' ');
        await handleGetSales(userId, salesDateRange);
        break;
      
      default:
        // Handle get credit case
        const username = command;
        if (!username) {
          await sendErrorMessage(userId, "❌ Please provide a username. Example: get john");
        } else {
          await handleGetCredit(userId, username);
        }
    }
  },

  delete: async (userId, command) => {
    const [type, uid] = command.split(' ');
    
    switch(type) {
      case 'credit':
        await handleDeleteCredit(userId, uid);
        break;
      
      case 'buy':
        await handleDeleteBuy(userId, uid);
        break;
      
      default:
        await sendErrorMessage(userId, "❌ Invalid delete command. Use: delete credit/buy <UID>");
    }
  },

  buy: async (userId, command) => {
    const parts = command.split(' ');
    if (parts.length !== 3) {
      await sendErrorMessage(userId, "❌ Invalid format. Use: buy <item> <purchase_price> <selling_price>");
      return;
    }
    const [itemName, purchasePrice, sellingPrice] = parts;
    await handleAddBuy(userId, itemName, Number(purchasePrice), Number(sellingPrice));
  },

  sales: async (userId, command) => {
    const parts = command.split(' ');
    if (parts.length !== 2) {
      await sendErrorMessage(userId, "❌ Invalid format. Use: sales <online> <offline>");
      return;
    }
    const [onlineSales, offlineSales] = parts.map(Number);
    await handleAddSales(userId, onlineSales, offlineSales);
  },

  hisab: async (userId, command) => {
    const parts = command.split(' ');
    if (parts.length !== 2) {
      await sendErrorMessage(userId, "❌ Invalid format. Use: hisab <username> <amount>");
      return;
    }
    const [username, amount] = parts;
    await handleHisab(userId, username, amount);
  },

  help: async (userId) => {
    await sendHelpMessage(userId);
  },

  wholesale: async (userId, command) => {
    try {
      const jsonArray = await textMistralHandle(command, true);
      await sendConfirmationMsg(userId, jsonArray, true);
    } catch (error) {
      console.error("Error processing wholesale text:", error);
      await sendErrorMessage(userId, "❌ Error processing wholesale data");
    }
  },

  credit: async (userId, command) => {
    try {
      const jsonArray = await textMistralHandle(command, false);
      await sendConfirmationMsg(userId, jsonArray, false);
    } catch (error) {
      console.error("Error processing credit text:", error);
      await sendErrorMessage(userId, "❌ Error processing credit data");
    }
  },
};

// Update the webhook POST handler
app.post("/webhook", async (req, res) => {
  try {
    const message = req.body.entry?.[0]?.changes?.[0]?.value?.messages?.[0];
    // log("Received message:", message);

    if (message?.type === "audio") {
      await audioHandle(message, process.env.TOK);
    }

    if (message?.type === "text") {
      const messageText = message.text.body.trim();
      const userId = message.from;

      // First check for specific commands (get, delete)
      if (messageText.toLowerCase().startsWith('get') || messageText.toLowerCase().startsWith('delete')) {
        const [command, ...args] = messageText.toLowerCase().split(' ');
        if (commandHandlers[command]) {
          await commandHandlers[command](userId, args.join(' '));
        }
      }
      // Then check for wholesale entries
      else if (messageText.toLowerCase().startsWith('wholesale')) {
        await commandHandlers.wholesale(userId, messageText);
      }
      // Everything else goes to credit processing
      else {
        // Let Mistral handle the natural language parsing
        await commandHandlers.credit(userId, messageText);
      }
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

// Start server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
