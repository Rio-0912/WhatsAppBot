const axios = require("axios");
const logger = require("../utils/logger");

// Create a message store with auto-cleanup
const messageStore = new Map();

// Cleanup old messages every 10 minutes
setInterval(() => {
  const now = Date.now();
  for (const [key, value] of messageStore.entries()) {
    if (now - value.timestamp > 600000) { // 10 minutes
      messageStore.delete(key);
      logger.checkpoint(`Removed stale message: ${key}`);
    }
  }
}, 300000); // Run every 5 minutes

const sendConfirmationMsg = async (to, extractedText, isWholesale = false) => {
  const TOK = process.env.TOK;
  
  try {
    const items = JSON.parse(extractedText);
    let formattedMessage;
    
    if (isWholesale) {
      // Wholesale/Buy items format remains the same
      const formattedItems = items.map(item => 
        `🏷️ Item: ${item.itemNameAndQuantity}\n` +
        `💰 Buy: ₹${item.purchasePrice}\n` +
        `💵 Sell: ₹${item.sellingPrice}`
      ).join('\n\n');

      formattedMessage = 
        `📝 *Please Confirm These Purchase Items:*\n\n` +
        formattedItems;
    } else {
      // Credit items - show username once at top
      const username = items[0].username;
      const formattedItems = items.map(item => 
        `🏷️ Item: ${item.itemNameAndQuantity}\n` +
        `💰 Amount: ₹${item.amount}`
      ).join('\n\n');

      formattedMessage = 
        `📝 *Please Confirm These Credit Items*\n` +
        `👤 *User: ${username}*\n\n` +
        formattedItems;
    }

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
                  id: "cancel_text",
                  title: "❌ No"
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

    if (response.data.messages && response.data.messages[0]) {
      const messageId = response.data.messages[0].id;
      messageStore.set(messageId, {
        extractedText,
        timestamp: Date.now(),
        isWholesale,
        to
      });
      logger.checkpoint('Interactive message sent', { messageId, to });
    }

    return response.data;
   
  } catch (error) {
    logger.error("Error sending confirmation message", error);
    return null;
  }
};

const getMessageContext = (messageId) => {
  return messageStore.get(messageId);
};

const sendSavedItemsConfirmation = async (to, savedItems) => {
  const TOK = process.env.TOK;
  
  try {
    // Determine the type of items based on their properties
    const isCredit = savedItems[0]?.amount !== undefined;
    let message;
    
    if (isCredit) {
      // For credit items, show username once at top
      const username = savedItems[0].username;
      message = `✅ *Credit Items Successfully Saved*\n` +
                `👤 *User: ${username}*\n\n`;

      // Format items without repeating username
      const formattedItems = savedItems.map(item =>
        `🏷️ Item: ${item.itemNameAndQuantity}\n` +
        `💰 Amount: ₹${item.amount}\n` +
        `🔑 UID: ${item.uid}`
      ).join('\n\n');

      message += formattedItems;
    } else {
      // For purchase items, keep original format
      const formattedItems = savedItems.map(item =>
        `🏷️ Item: ${item.itemNameAndQuantity}\n` +
        `💰 Buy: ₹${item.purchasePrice}\n` +
        `💵 Sell: ₹${item.sellingPrice}\n` +
        `🔑 UID: ${item.uid}`
      ).join('\n\n');

      message = `✅ *Purchase Items Successfully Saved*\n\n${formattedItems}`;
    }

    message += "\n\n📝 _To delete any item, send:_\n" +
               `\`delete ${isCredit ? 'credit' : 'buy'} <UID>\``;

    const response = await axios.post(
      "https://graph.facebook.com/v22.0/559603130570722/messages",
      {
        messaging_product: "whatsapp",
        recipient_type: "individual",
        to: to,
        type: "text",
        text: {
          body: message,
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

const sendCreditHistory = async (to, username, credits, latestHisab = null, totalOutstanding) => {
  const TOK = process.env.TOK;
  
  try {
    let message = `📊 *Credit History for ${username}*\n\n`;
    
    // Add last payment info if exists
    if (latestHisab) {
      const hisabDate = new Date(latestHisab.date).toLocaleString('en-IN', {
        day: '2-digit',
        month: 'short',
        year: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        hour12: true
      });
      message += `📅 *Last Payment: ₹${latestHisab.amount}* on ${hisabDate}\n\n`;
    }

    message += `💳 *Current Outstanding: ₹${totalOutstanding}*\n\n`;

    if (credits.length > 0) {
      message += `*Recent Transactions:*\n\n`;

      // Format credits
      const formattedCredits = credits.map(credit => {
        const dateObj = new Date(credit.date);
        const formattedDate = dateObj.toLocaleString('en-IN', {
          day: '2-digit',
          month: 'short',
          year: '2-digit',
          hour: '2-digit',
          minute: '2-digit',
          hour12: true
        });

        return `📅 ${formattedDate}\n` +
               `🏷️ ${credit.itemNameAndQuantity}\n` +
               `💰 ₹${credit.amount}\n` +
               `🔑 UID: ${credit.uid}`;
      }).join('\n\n');

      message += formattedCredits;
    }

    message += `\n\n_To delete any item, send:_\n\`delete credit <UID>\``;

    const response = await axios.post(
      "https://graph.facebook.com/v22.0/559603130570722/messages",
      {
        messaging_product: "whatsapp",
        recipient_type: "individual",
        to: to,
        type: "text",
        text: {
          body: message,
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
    console.error("Error sending credit history:", error);
    await sendErrorMessage(to, "❌ Error displaying credit history");
    return null;
  }
};

const sendDeleteConfirmation = async (to, type, deletedItem) => {
  const TOK = process.env.TOK;
  
  try {
    let message;
    if (type === 'credit') {
      message = `✅ *Credit Entry Deleted Successfully*\n\n` +
                `👤 User: ${deletedItem.username}\n` +
                `🏷️ Item: ${deletedItem.itemNameAndQuantity}\n` +
                `💰 Amount: ₹${deletedItem.amount}\n` +
                `🗑️ Deleted UID: ${deletedItem.uid}`;
    } else {
      message = `✅ *Purchase Entry Deleted Successfully*\n\n` +
                `🏷️ Item: ${deletedItem.itemNameAndQuantity}\n` +
                `💰 Buy: ₹${deletedItem.purchasePrice}\n` +
                `💵 Sell: ₹${deletedItem.sellingPrice}\n` +
                `🗑️ Deleted UID: ${deletedItem.uid}`;
    }

    const response = await axios.post(
      "https://graph.facebook.com/v22.0/559603130570722/messages",
      {
        messaging_product: "whatsapp",
        recipient_type: "individual",
        to: to,
        type: "text",
        text: {
          body: message,
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
    console.error("Error sending delete confirmation:", error);
    return null;
  }
};

const sendPurchaseHistory = async (to, dateRange, data) => {
  const TOK = process.env.TOK;
  
  try {
    const { purchases, totalPurchaseAmount, totalSellingAmount } = data;
    
    const formattedPurchases = purchases.map(purchase => 
      `🏷️ ${purchase.itemNameAndQuantity}\n` +
      `⏰ ${new Date(purchase.date).toLocaleString('en-IN', {
        day: '2-digit',
        month: 'short',
        year: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        hour12: true
      })}\n` +
      `💰 Buy: ₹${purchase.purchasePrice}\n` +
      `💵 Sell: ₹${purchase.sellingPrice}\n` +
      `🔑 UID: ${purchase.uid}`
    ).join('\n\n');

    const message = 
      `📊 *Purchase History for ${dateRange}*\n\n` +
      `💰 *Total Purchase Amount: ₹${totalPurchaseAmount}*\n` +
      `💵 *Total Selling Amount: ₹${totalSellingAmount}*\n` +
      `📈 *Expected Profit: ₹${totalSellingAmount - totalPurchaseAmount}*\n\n` +
      `*Transactions:*\n\n${formattedPurchases}\n\n` +
      `_To delete any item, send:_\n` +
      `\`delete buy <UID>\``;

    const response = await axios.post(
      "https://graph.facebook.com/v22.0/559603130570722/messages",
      {
        messaging_product: "whatsapp",
        recipient_type: "individual",
        to: to,
        type: "text",
        text: {
          body: message,
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
    console.error("Error sending purchase history:", error);
    return null;
  }
};

const sendSalesHistory = async (to, dateRange, sales) => {
  const TOK = process.env.TOK;
  
  try {
    const totalOnline = sales.reduce((sum, sale) => sum + sale.onlineSales, 0);
    const totalOffline = sales.reduce((sum, sale) => sum + sale.offlineSales, 0);
    const grandTotal = totalOnline + totalOffline;

    const message = 
      `📊 *Sales Summary for ${dateRange}*\n\n` +
      `🌐 Total Online Sales: ₹${totalOnline}\n` +
      `🏪 Total Offline Sales: ₹${totalOffline}\n` +
      `💰 *Grand Total: ₹${grandTotal}*\n\n` +
      `*Daily Breakdown:*\n\n` +
      sales.map(sale => 
        `📅 ${new Date(sale.date).toLocaleDateString('en-IN')}\n` +
        `🌐 Online: ₹${sale.onlineSales}\n` +
        `🏪 Offline: ₹${sale.offlineSales}\n` +
        `💰 Total: ₹${sale.totalSales}`
      ).join('\n\n');

    const response = await axios.post(
      "https://graph.facebook.com/v22.0/559603130570722/messages",
      {
        messaging_product: "whatsapp",
        recipient_type: "individual",
        to: to,
        type: "text",
        text: {
          body: message,
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
    console.error("Error sending sales history:", error);
    return null;
  }
};

const sendPaymentConfirmation = async (to, username, paidAmount, remainingAmount, totalAmount, itemsSummary) => {
  const TOK = process.env.TOK;
  
  try {
    const message = 
      `💰 *Payment Received*\n\n` +
      `👤 User: ${username}\n` +
      `💵 Paid Amount: ₹${paidAmount}\n` +
      `📊 Total Bill: ₹${totalAmount}\n` +
      `🔄 Remaining: ₹${remainingAmount}\n\n` +
      `*Previous Items:*\n${itemsSummary}\n\n` +
      `_A new credit entry has been created for the remaining amount._`;

    const response = await axios.post(
      "https://graph.facebook.com/v22.0/559603130570722/messages",
      {
        messaging_product: "whatsapp",
        recipient_type: "individual",
        to: to,
        type: "text",
        text: {
          body: message,
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
    console.error("Error sending payment confirmation:", error);
    return null;
  }
};

const sendFullPaymentConfirmation = async (to, username, paidAmount, totalAmount) => {
  const TOK = process.env.TOK;
  
  try {
    const message = 
      `✅ *Full Payment Received*\n\n` +
      `👤 User: ${username}\n` +
      `💵 Paid Amount: ₹${paidAmount}\n` +
      `📊 Total Bill: ₹${totalAmount}\n\n` +
      `_All credits have been cleared!_`;

    const response = await axios.post(
      "https://graph.facebook.com/v22.0/559603130570722/messages",
      {
        messaging_product: "whatsapp",
        recipient_type: "individual",
        to: to,
        type: "text",
        text: {
          body: message,
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
    console.error("Error sending full payment confirmation:", error);
    return null;
  }
};

const sendHisabPartialConfirmation = async (to, username, paidAmount, remainingAmount, totalAmount) => {
  const TOK = process.env.TOK;
  
  try {
    const message = 
      `💰 *Partial Payment Recorded*\n\n` +
      `👤 User: ${username}\n` +
      `💵 Paid Amount: ₹${paidAmount}\n` +
      `📊 Previous Total: ₹${totalAmount}\n` +
      `🔄 Remaining Balance: ₹${remainingAmount}\n\n` +
      `_The remaining balance has been added as a new credit entry._\n` +
      `_Any new purchases will be added to this remaining balance._`;

    const response = await axios.post(
      "https://graph.facebook.com/v22.0/559603130570722/messages",
      {
        messaging_product: "whatsapp",
        recipient_type: "individual",
        to: to,
        type: "text",
        text: {
          body: message,
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
    console.error("Error sending hisab partial confirmation:", error);
    return null;
  }
};

const sendHisabFullConfirmation = async (to, username, paidAmount, totalAmount) => {
  const TOK = process.env.TOK;
  
  try {
    const message = 
      `✅ *Full Payment Recorded*\n\n` +
      `👤 User: ${username}\n` +
      `💵 Paid Amount: ₹${paidAmount}\n` +
      `📊 Total Cleared: ₹${totalAmount}\n\n` +
      `_All previous credits have been cleared._\n` +
      `_New purchases will start a fresh credit record._`;

    const response = await axios.post(
      "https://graph.facebook.com/v22.0/559603130570722/messages",
      {
        messaging_product: "whatsapp",
        recipient_type: "individual",
        to: to,
        type: "text",
        text: {
          body: message,
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
    console.error("Error sending hisab full confirmation:", error);
    return null;
  }
};

const sendHelpMessage = async (to) => {
  const TOK = process.env.TOK;
  
  try {
    const message = 
      `🔍 *Available Commands*\n\n` +
      
      `📝 *Credit Commands:*\n` +
      `\`get <username>\` - View credit history\n` +
      `\`delete credit <UID>\` - Delete a credit entry\n` +
      `\`hisab <username> <amount>\` - Record payment\n\n` +
      
      `🛍️ *Purchase Commands:*\n` +
      `\`get buy <DD.MM.YY>\` - View purchases for single date\n` +
      `\`get buy <DD.MM.YY-DD.MM.YY>\` - View purchases for date range\n` +
      `\`buy <item> <purchase_price> <selling_price>\` - Add new purchase\n` +
      `\`delete buy <UID>\` - Delete a purchase entry\n\n` +
      
      `📊 *Sales Commands:*\n` +
      `\`get sales <DD.MM.YY>\` - View sales for single date\n` +
      `\`get sales <DD.MM.YY-DD.MM.YY>\` - View sales for date range\n` +
      `\`sales <online> <offline>\` - Add new sales entry\n\n` +
      
      `💡 *Examples:*\n` +
      `\`get john\` - View John's credit history\n` +
      `\`hisab john 500\` - Record ₹500 payment from John\n` +
      `\`get buy 27.02.24\` - View purchases for 27th Feb\n` +
      `\`get buy 27.02.24-29.02.24\` - View purchases from 27th to 29th Feb\n` +
      `\`buy potato 750 950\` - Add potato purchase (buy:₹750, sell:₹950)\n` +
      `\`sales 780 1100\` - Add sales (online:₹780, offline:₹1100)\n` +
      `\`get sales 27.02.24\` - View sales for 27th Feb\n` +
      `\`delete credit ABC123\` - Delete credit with UID ABC123`;

    const response = await axios.post(
      "https://graph.facebook.com/v22.0/559603130570722/messages",
      {
        messaging_product: "whatsapp",
        recipient_type: "individual",
        to: to,
        type: "text",
        text: {
          body: message,
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
    console.error("Error sending help message:", error);
    return null;
  }
};

module.exports = { 
  sendConfirmationMsg,
  getMessageContext,
  sendSavedItemsConfirmation,
  sendErrorMessage,
  sendCreditHistory,
  sendDeleteConfirmation,
  sendPurchaseHistory,
  sendSalesHistory,
  sendPaymentConfirmation,
  sendFullPaymentConfirmation,
  sendHisabPartialConfirmation,
  sendHisabFullConfirmation,
  sendHelpMessage
};
