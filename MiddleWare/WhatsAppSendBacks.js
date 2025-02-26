const axios = require("axios");
const { log } = require("console");

// Create a message tracking store (you might want to use Redis or a database in production)
const messageStore = new Map();

const sendConfirmationMsg = async (to, extractedText, isWholesale = false) => {
  const TOK = process.env.TOK;
  
  try {
    const items = JSON.parse(extractedText);
    
    // Format items with emojis and add type indicator
    const formattedItems = items.map(item => {
      if (isWholesale) { // Wholesale/Buy items
        return `🏷️ Item: ${item.itemNameAndQuantity}\n` +
               `💰 Buy: ₹${item.purchasePrice}\n` +
               `💵 Sell: ₹${item.sellingPrice}`;
      } else { // Credit items
        return `👤 User: ${item.username}\n` +
               `🏷️ Item: ${item.itemNameAndQuantity}\n` +
               `💰 Amount: ₹${item.amount}`;
      }
    }).join('\n\n');

    // Add type indicator to the message
    const formattedMessage = 
      `📝 *Please Confirm These ${isWholesale ? 'Purchase' : 'Credit'} Items:*\n\n` +
      formattedItems;

    const response = await axios.post(
      "https://graph.facebook.com/v22.0/559603130570722/messages",
      {
        messaging_product: "whatsapp",
        recipient_type: "individual",
        to: to,
        type: "interactive",
        interactive: {
          type: "button",
          body: {
            text: formattedMessage
          },
          action: {
            buttons: [
              {
                type: "reply",
                reply: {
                  id: "confirm_text",
                  title: "✅ Yes, proceed"
                }
              },
              {
                type: "reply",
                reply: {
                  id: "edit_text",
                  title: "✏️ Edit"
                }
              }
            ]
          }
        }
      },
      {
        headers: {
          Authorization: `Bearer ${TOK}`,
          "Content-Type": "application/json"
        }
      }
    );

    // Store message context with type information
    if (response.data.messages && response.data.messages[0]) {
      const messageId = response.data.messages[0].id;
      messageStore.set(messageId, {
        extractedText,
        timestamp: Date.now(),
        isWholesale, // Store the type
        to
      });
      
      console.log("Stored message context:", {
        messageId,
        extractedText,
        isWholesale
      });
    }

    return response.data;
   
  } catch (error) {
    console.error("Error sending confirmation message:", error);
    return null;
  }
};

const getMessageContext = (messageId) => {
  return messageStore.get(messageId);
};

// Clean up old messages (optional)
const cleanupOldMessages = () => {
  const ONE_HOUR = 3600000;
  const now = Date.now();
  
  for (const [messageId, data] of messageStore.entries()) {
    if (now - data.timestamp > ONE_HOUR) {
      messageStore.delete(messageId);
    }
  }
};

// Run cleanup every hour
setInterval(cleanupOldMessages, 3600000);

const sendSavedItemsConfirmation = async (to, savedItems) => {
  const TOK = process.env.TOK;
  
  try {
    // Determine the type of items based on their properties
    const isCredit = savedItems[0]?.amount !== undefined;
    
    // Format the saved data for WhatsApp message
    const formattedItems = savedItems.map(item => {
      if (isCredit) {
        return `👤 User: ${item.username}\n` +
               `🏷️ Item: ${item.itemNameAndQuantity}\n` +
               `💰 Amount: ₹${item.amount}\n` +
               `🔑 UID: ${item.uid}`;
      } else {
        return `🏷️ Item: ${item.itemNameAndQuantity}\n` +
               `💰 Buy: ₹${item.purchasePrice}\n` +
               `💵 Sell: ₹${item.sellingPrice}\n` +
               `🔑 UID: ${item.uid}`;
      }
    }).join('\n\n');

    // Create confirmation message
    const confirmationMessage = 
      `✅ *${isCredit ? 'Credit' : 'Purchase'} Items Successfully Saved*\n\n` +
      formattedItems +
      "\n\n📝 _To delete any item, send:_\n" +
      `\`delete ${isCredit ? 'credit' : 'buy'} <UID>\``;

    const response = await axios.post(
      "https://graph.facebook.com/v22.0/559603130570722/messages",
      {
        messaging_product: "whatsapp",
        recipient_type: "individual",
        to: to,
        type: "text",
        text: {
          body: confirmationMessage,
          preview_url: false
        }
      },
      {
        headers: {
          Authorization: `Bearer ${TOK}`,
          "Content-Type": "application/json"
        }
      }
    );

    return response.data;
   
  } catch (error) {
    console.error("Error sending saved items confirmation:", error);
    return null;
  }
};

const sendErrorMessage = async (to, errorMessage = "❌ Sorry, there was an error processing your data. Please try again.") => {
  const TOK = process.env.TOK;
  
  try {
    const response = await axios.post(
      "https://graph.facebook.com/v22.0/559603130570722/messages",
      {
        messaging_product: "whatsapp",
        recipient_type: "individual",
        to: to,
        type: "text",
        text: {
          body: errorMessage,
          preview_url: false
        }
      },
      {
        headers: {
          Authorization: `Bearer ${TOK}`,
          "Content-Type": "application/json"
        }
      }
    );

    return response.data;
   
  } catch (error) {
    console.error("Error sending error message:", error);
    return null;
  }
};

module.exports = { 
  sendConfirmationMsg,
  getMessageContext,
  sendSavedItemsConfirmation,
  sendErrorMessage
};
