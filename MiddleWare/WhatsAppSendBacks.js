const axios = require("axios");
const moment = require('moment-timezone');
const logger = require("../utils/logger"); // Assuming logger has error and checkpoint methods
const { formatIndianTime } = require('../utils/dateHelper'); // Assuming this is used elsewhere or intended

// --- Configuration and Constants ---
const FACEBOOK_GRAPH_API_BASE_URL = "https://graph.facebook.com/v22.0";
// Consider generating this dynamically if the ID changes or storing it in env
const WHATSAPP_SENDER_ID = "559603130570722";
const WHATSAPP_API_URL = `${FACEBOOK_GRAPH_API_BASE_URL}/${WHATSAPP_SENDER_ID}/messages`;
const TOK = process.env.TOK; // Store token once

// --- In-Memory Store for Interactive Message Context ---
const messageStore = new Map();
const MESSAGE_STORE_CLEANUP_INTERVAL = 300000; // 5 minutes
const MESSAGE_STORE_EXPIRY = 600000; // 10 minutes

// --- Message Formatting Constants ---
const EMOJI = {
  ITEM: '🏷️',
  AMOUNT: '💰',
  BUY: '💰',
  SELL: '💵',
  UID: '🔑',
  DATE: '📅',
  USER: '👤',
  CONFIRM: '📝',
  SUCCESS: '✅',
  ERROR: '❌',
  HISTORY: '📊',
  DELETE: '🗑️',
  INFO: '💡',
  PAYMENT: '💰',
  SALES_ONLINE: '🌐',
  SALES_OFFLINE: '🏪',
  PROFIT: '📈',
  CLOCK: '⏰',
  REMAINING: '🔄',
  HELP: '🔍'
};

// --- Helper Functions ---

/**
 * Formats a date object into 'DD MMM YY' format in Asia/Kolkata timezone.
 * @param {Date|string|moment} date - The date to format.
 * @returns {string} Formatted date string.
 */
const formatMessageDate = (date) => {
  return moment(date).tz('Asia/Kolkata').format('DD MMM YY');
};

/**
 * Centralized function to send messages via WhatsApp API.
 * @param {string} to - Recipient phone number ID.
 * @param {object} messagePayload - The specific message payload (e.g., { text: { body: "..." } } or { interactive: { ... } }).
 * @returns {Promise<object|null>} API response data or null on error.
 */
const sendWhatsAppMessage = async (to, messagePayload) => {
  if (!TOK) {
    logger.error("WhatsApp API Token (TOK) is not set in environment variables.");
    return null;
  }
  try {
    const response = await axios.post(
      WHATSAPP_API_URL,
      {
        messaging_product: "whatsapp",
        recipient_type: "individual",
        to: to,
        ...messagePayload // Spread the type-specific payload (text, interactive)
      },
      {
        headers: {
          'Authorization': `Bearer ${TOK}`,
          'Content-Type': 'application/json'
        }
      }
    );
    logger.checkpoint('WhatsApp message sent successfully', { to, type: messagePayload.type, messageId: response.data?.messages?.[0]?.id });
    return response.data; // Return the response data
  } catch (error) {
    const errorMessage = error.response?.data?.error?.message || error.message;
    const errorCode = error.response?.data?.error?.code;
    const errorType = error.response?.data?.error?.type;
    logger.error("Error sending WhatsApp message", {
      to,
      type: messagePayload.type,
      statusCode: error.response?.status,
      errorCode,
      errorType,
      errorMessage,
      //  axiosError: error // Optionally log the full axios error
    });
    // Optionally send an error message back to the user here if desired universally
    // await sendErrorMessage(to, `Failed to send message. Error: ${errorMessage}`);
    return null;
  }
};

/**
 * Formats a single purchase item for display.
 * @param {object} item - The purchase item object.
 * @param {boolean} includeDate - Whether to include the date line.
 * @returns {string} Formatted item string.
 */
const formatPurchaseItem = (item, includeDate = false) => {
  let text = `${EMOJI.ITEM} Item: ${item.itemNameAndQuantity}\n` +
    `${EMOJI.BUY} Buy: ₹${item.purchasePrice}\n` +
    `${EMOJI.SELL} Sell: ₹${item.sellingPrice}`;
  if (item.uid) text += `\n${EMOJI.UID} UID: ${item.uid}`;
  if (includeDate && item.date) {
    text = `${EMOJI.DATE} ${formatMessageDate(item.date)}\n` + text;
  }
  return text;
};

/**
 * Formats a single credit item for display.
 * @param {object} item - The credit item object.
 * @param {boolean} includeUsername - Whether to include the username line.
 * @param {boolean} includeDate - Whether to include the date line.
 * @returns {string} Formatted item string.
 */
const formatCreditItem = (item, includeUsername = false, includeDate = false) => {
  let text = (includeUsername ? `${EMOJI.USER} User: ${item.username}\n` : '') +
    `${EMOJI.ITEM} Item: ${item.itemNameAndQuantity}\n` +
    `${EMOJI.AMOUNT} Amount: ₹${item.amount}`;
  if (item.uid) text += `\n${EMOJI.UID} UID: ${item.uid}`;
  if (includeDate && item.date) {
    text = `${EMOJI.DATE} ${formatMessageDate(item.date)}\n` + text;
  }
  return text;
};

/**
 * Generates the standard deletion instruction text.
 * @param {'credit' | 'buy'} type - The type of item to delete.
 * @returns {string} Deletion instruction string.
 */
const generateDeleteInstruction = (type) => {
  return `\n\n${EMOJI.INFO} _To delete any item, send:_\n\`delete ${type} <UID>\``;
};

// --- Message Store Cleanup ---
setInterval(() => {
  const now = Date.now();
  let deletedCount = 0;
  for (const [key, value] of messageStore.entries()) {
    if (now - value.timestamp > MESSAGE_STORE_EXPIRY) {
      messageStore.delete(key);
      deletedCount++;
    }
  }
  if (deletedCount > 0) {
    logger.checkpoint(`Removed ${deletedCount} stale message contexts from store.`);
  }
}, MESSAGE_STORE_CLEANUP_INTERVAL);

// Add this helper function near the top with other helpers
const logMessageContext = (action, messageId, context = null) => {
  logger.checkpoint(`MessageStore ${action}`, {
    messageId,
    hasContext: !!context,
    contextTimestamp: context?.timestamp,
    storeSize: messageStore.size
  });
};

// Add this helper function
const isValidMessageId = (messageId) => {
  return typeof messageId === 'string' &&
    messageId.startsWith('wamid.') &&
    messageId.length > 20; // Adjust based on your typical message ID length
};

// --- Core Message Sending Functions ---

const sendConfirmationMsg = async (to, extractedText, isWholesale = false) => {
  try {
    const items = JSON.parse(extractedText);
    let formattedMessage;
    let formattedItems;

    if (isWholesale) {
      formattedItems = items.map(item => formatPurchaseItem(item, false)).join('\n\n');
      formattedMessage = `${EMOJI.CONFIRM} *Please Confirm These Purchase Items:*\n\n${formattedItems}`;
    } else {
      const username = items[0]?.username || 'Unknown User';
      formattedItems = items.map(item => formatCreditItem(item, false, false)).join('\n\n');
      formattedMessage = `${EMOJI.CONFIRM} *Please Confirm These Credit Items*\n` +
        `${EMOJI.USER} *User: ${username}*\n\n` +
        formattedItems;
    }

    const payload = {
      type: "interactive",
      interactive: {
        type: "button",
        body: { text: formattedMessage },
        action: {
          buttons: [
            { type: "reply", reply: { id: "confirm_text", title: `${EMOJI.SUCCESS} Yes, proceed` } },
            { type: "reply", reply: { id: "cancel_text", title: `${EMOJI.ERROR} No` } }
          ]
        }
      }
    };

    const responseData = await sendWhatsAppMessage(to, payload);

    // Store context if message sent successfully and ID received
    if (responseData?.messages?.[0]?.id) {
      const messageId = responseData.messages[0].id;
      const context = {
        extractedText,
        timestamp: Date.now(),
        isWholesale,
        to
      };
      messageStore.set(messageId, context);
      await persistMessageContext(messageId, context);
      logMessageContext('Stored', messageId, context);
    }

    return responseData;

  } catch (error) {
    // Log parsing errors specifically
    if (error instanceof SyntaxError) {
      logger.error("Error parsing extractedText JSON in sendConfirmationMsg", { error: error.message, extractedText });
    } else {
      logger.error("Error preparing or sending confirmation message", { error: error.message, stack: error.stack });
    }
    // Attempt to send a generic error message back to the user
    await sendErrorMessage(to);
    return null;
  }
};

const getMessageContext = (messageId) => {
  if (!isValidMessageId(messageId)) {
    logger.error("Invalid message ID format", { messageId });
    return null;
  }

  const context = messageStore.get(messageId);
  logMessageContext('Retrieved', messageId, context);
  return context;
};

const sendSavedItemsConfirmation = async (to, savedItems) => {
  if (!savedItems || savedItems.length === 0) {
    logger.error("Attempted to send confirmation for empty savedItems array", { to });
    return sendErrorMessage(to, `${EMOJI.ERROR} No items were provided to confirm.`);
  }

  try {
    const isCredit = savedItems[0]?.amount !== undefined;
    let messageTitle;
    let formattedItems;
    let username = null;

    if (isCredit) {
      username = savedItems[0]?.username || 'Unknown User';
      messageTitle = `${EMOJI.SUCCESS} *Credit Items Successfully Saved*\n${EMOJI.USER} *User: ${username}*\n\n`;
      formattedItems = savedItems.map(item => formatCreditItem(item, false, false)).join('\n\n');
    } else {
      messageTitle = `${EMOJI.SUCCESS} *Purchase Items Successfully Saved*\n\n`;
      formattedItems = savedItems.map(item => formatPurchaseItem(item, false)).join('\n\n');
    }

    const message = messageTitle + formattedItems + generateDeleteInstruction(isCredit ? 'credit' : 'buy');

    const payload = {
      type: "text",
      text: { body: message, preview_url: false }
    };

    return await sendWhatsAppMessage(to, payload);

  } catch (error) {
    logger.error("Error sending saved items confirmation", { error: error.message, stack: error.stack, to });
    // Attempt to send a generic error message back to the user
    await sendErrorMessage(to);
    return null;
  }
};

const sendErrorMessage = async (to, errorMessage = `${EMOJI.ERROR} Sorry, there was an error processing your request. Please try again or contact support.`) => {
  // Avoid infinite loops if sendWhatsAppMessage itself fails repeatedly
  try {
    const payload = {
      type: "text",
      text: { body: errorMessage, preview_url: false }
    };
    // Directly use axios here OR ensure sendWhatsAppMessage has robust error handling to prevent loops
    // Using sendWhatsAppMessage - assuming it won't loop infinitely on failure
    return await sendWhatsAppMessage(to, payload);
  } catch (error) {
    // If even sending the error message fails, just log it.
    logger.error("CRITICAL: Failed to send error message back to user.", { error: error.message, to });
    return null;
  }
};

const sendCreditHistory = async (to, username, credits, latestHisab, totalOutstanding) => {
  try {
    let message = `${EMOJI.HISTORY} *Credit History for ${username}*\n\n`;

    if (latestHisab) {
      // Keep the specific date format for 'Last Payment' as it was different
      const hisabDateStr = new Date(latestHisab.date).toLocaleString('en-IN', {
        day: '2-digit', month: 'short', year: '2-digit'
      });
      message += `${EMOJI.DATE} *Last Payment: ₹${latestHisab.amount}* on ${hisabDateStr}\n\n`;
    } else {
      message += `No payment history found.\n\n`;
    }

    message += `${EMOJI.AMOUNT} *Current Outstanding: ₹${totalOutstanding}*\n\n`;

    if (credits && credits.length > 0) {
      message += `*Recent Transactions:*\n\n`;
      const formattedCredits = credits.map(credit => {
        return `${EMOJI.DATE} ${formatMessageDate(credit.date)}\n` +
          formatCreditItem(credit, false, false); // Set includeDate to false since we're adding it manually
      }).join('\n\n');
      message += formattedCredits;
    } else {
      message += `No outstanding credit items found.\n`;
    }

    message += generateDeleteInstruction('credit');

    const payload = {
      type: "text",
      text: { body: message, preview_url: false }
    };

    return await sendWhatsAppMessage(to, payload);

  } catch (error) {
    logger.error("Error sending credit history", { error: error.message, stack: error.stack, to, username });
    await sendErrorMessage(to, `${EMOJI.ERROR} Error displaying credit history for ${username}.`);
    return null;
  }
};

const sendDeleteConfirmation = async (to, type, deletedItem) => {
  if (!deletedItem) {
    logger.error("Attempted to send delete confirmation for null/undefined item", { to, type });
    return sendErrorMessage(to, `${EMOJI.ERROR} Cannot confirm deletion: Item data missing.`);
  }
  try {
    let message;
    if (type === 'credit') {
      message = `${EMOJI.SUCCESS} *Credit Entry Deleted Successfully*\n\n` +
        `${EMOJI.DATE} ${formatMessageDate(deletedItem.date)}\n` +
        formatCreditItem(deletedItem, true, false);
    } else { // Assuming 'buy' or 'purchase'
      message = `${EMOJI.SUCCESS} *Purchase Entry Deleted Successfully*\n\n` +
        `${EMOJI.DATE} ${formatMessageDate(deletedItem.date)}\n` +
        formatPurchaseItem(deletedItem, false);
    }
    // Overwrite UID line with Deleted UID
    message = message.replace(`${EMOJI.UID} UID: ${deletedItem.uid}`, `${EMOJI.DELETE} Deleted UID: ${deletedItem.uid}`);


    const payload = {
      type: "text",
      text: { body: message, preview_url: false }
    };

    return await sendWhatsAppMessage(to, payload);
  } catch (error) {
    logger.error("Error sending delete confirmation", { error: error.message, stack: error.stack, to, type });
    await sendErrorMessage(to, `${EMOJI.ERROR} Error confirming deletion.`);
    return null;
  }
};

const sendPurchaseHistory = async (to, dateRange, data) => {
  if (!data || !data.purchases) {
    logger.error("Attempted to send purchase history with invalid data", { to, dateRange });
    return sendErrorMessage(to, `${EMOJI.ERROR} Could not retrieve purchase history data for ${dateRange}.`);
  }
  try {
    const { purchases, totalPurchaseAmount = 0, totalSellingAmount = 0 } = data;
    const expectedProfit = totalSellingAmount - totalPurchaseAmount;

    const formattedPurchases = purchases.length > 0
      ? purchases.map(purchase => {
        return `${EMOJI.DATE} ${formatMessageDate(purchase.date)}\n` +
          formatPurchaseItem(purchase, false);
      }).join('\n\n')
      : "No purchases found in this period.";

    const message =
      `${EMOJI.HISTORY} *Purchase History for ${dateRange}*\n\n` +
      `${EMOJI.BUY} *Total Purchase Amount: ₹${totalPurchaseAmount}*\n` +
      `${EMOJI.SELL} *Total Selling Amount: ₹${totalSellingAmount}*\n` +
      `${EMOJI.PROFIT} *Expected Profit: ₹${expectedProfit}*\n\n` +
      `*Transactions:*\n\n${formattedPurchases}` +
      generateDeleteInstruction('buy');

    const payload = {
      type: "text",
      text: { body: message, preview_url: false }
    };

    return await sendWhatsAppMessage(to, payload);
  } catch (error) {
    logger.error("Error sending purchase history", { error: error.message, stack: error.stack, to, dateRange });
    await sendErrorMessage(to, `${EMOJI.ERROR} Error displaying purchase history for ${dateRange}.`);
    return null;
  }
};

const sendSalesConfirmation = async (to, sales) => {
  if (!sales) {
    logger.error("Attempted to send sales confirmation with invalid data", { to });
    return sendErrorMessage(to, `${EMOJI.ERROR} Could not retrieve sales data.`);
  }
  try {
    const totalOnline = sales.reduce((sum, sale) => sum + (sale.onlineSales || 0), 0);
    const totalOffline = sales.reduce((sum, sale) => sum + (sale.offlineSales || 0), 0);
    const grandTotal = totalOnline + totalOffline;

    const message = 
      `${EMOJI.SUCCESS} *Sales Entry Successfully Saved*\n\n` +
      `${EMOJI.DATE} ${formatMessageDate(sales[0].date)}\n` +
      `${EMOJI.SALES_ONLINE} Online Sales: ₹${totalOnline}\n` +
      `${EMOJI.SALES_OFFLINE} Offline Sales: ₹${totalOffline}\n` +
      `${EMOJI.AMOUNT} *Total Sales: ₹${grandTotal}*\n\n` +
      `${EMOJI.INFO} _Use \`get sales DD.MM.YY\` to view sales history_`;

    const payload = {
      type: "text",
      text: { body: message, preview_url: false }
    };

    return await sendWhatsAppMessage(to, payload);
  } catch (error) {
    logger.error("Error sending sales confirmation", { error: error.message, stack: error.stack, to });
    await sendErrorMessage(to, `${EMOJI.ERROR} Error confirming sales entry.`);
    return null;
  }
};

const sendSalesHistory = async (to, dateRange, sales) => {
  if (!sales) {
    logger.error("Attempted to send sales history with invalid data", { to, dateRange });
    return sendErrorMessage(to, `${EMOJI.ERROR} Could not retrieve sales history data for ${dateRange}.`);
  }
  try {
    const totalOnline = sales.reduce((sum, sale) => sum + (sale.onlineSales || 0), 0);
    const totalOffline = sales.reduce((sum, sale) => sum + (sale.offlineSales || 0), 0);
    const grandTotal = totalOnline + totalOffline;

    const formattedSales = sales.length > 0
      ? sales.map(sale =>
        `${EMOJI.DATE} ${formatMessageDate(sale.date)}\n` +
        `${EMOJI.SALES_ONLINE} Online: ₹${sale.onlineSales || 0}\n` +
        `${EMOJI.SALES_OFFLINE} Offline: ₹${sale.offlineSales || 0}\n` +
        `${EMOJI.AMOUNT} Total: ₹${sale.totalSales || 0}` // Assuming totalSales is pre-calculated
      ).join('\n\n')
      : "No sales data found in this period.";

    const message =
      `${EMOJI.HISTORY} *Sales Summary for ${dateRange}*\n\n` +
      `${EMOJI.SALES_ONLINE} Total Online Sales: ₹${totalOnline}\n` +
      `${EMOJI.SALES_OFFLINE} Total Offline Sales: ₹${totalOffline}\n` +
      `${EMOJI.AMOUNT} *Grand Total: ₹${grandTotal}*\n\n` +
      `*Daily Breakdown:*\n\n` +
      formattedSales;

    const payload = {
      type: "text",
      text: { body: message, preview_url: false }
    };

    return await sendWhatsAppMessage(to, payload);
  } catch (error) {
    logger.error("Error sending sales history", { error: error.message, stack: error.stack, to, dateRange });
    await sendErrorMessage(to, `${EMOJI.ERROR} Error displaying sales history for ${dateRange}.`);
    return null;
  }
};

// Consolidated Payment Confirmation Logic (can be split if needed, but they are similar)
const sendPaymentConfirmationBase = async (to, title, details, footer) => {
  try {
    const message = `${title}\n\n` + details.join('\n') + `\n\n${footer}`;
    const payload = {
      type: "text",
      text: { body: message, preview_url: false }
    };
    return await sendWhatsAppMessage(to, payload);
  } catch (error) {
    logger.error("Error sending payment confirmation", { error: error.message, stack: error.stack, to, title });
    await sendErrorMessage(to, `${EMOJI.ERROR} Error confirming payment.`);
    return null;
  }
}

const sendPaymentConfirmation = async (to, username, paidAmount, remainingAmount, totalAmount, itemsSummary = "N/A") => {
  const title = `${EMOJI.PAYMENT} *Payment Received*`;
  const details = [
    `${EMOJI.USER} User: ${username}`,
    `${EMOJI.SELL} Paid Amount: ₹${paidAmount}`,
    `${EMOJI.HISTORY} Total Bill: ₹${totalAmount}`, // Using History icon for Total Bill
    `${EMOJI.REMAINING} Remaining: ₹${remainingAmount}`
  ];
  const footer = `*Previous Items Cleared:*\n${itemsSummary}\n\n${EMOJI.INFO} _A new credit entry may have been created for the remaining amount._`;
  return sendPaymentConfirmationBase(to, title, details, footer);
};

const sendFullPaymentConfirmation = async (to, username, paidAmount, totalAmount) => {
  const title = `${EMOJI.SUCCESS} *Full Payment Received*`;
  const details = [
    `${EMOJI.USER} User: ${username}`,
    `${EMOJI.SELL} Paid Amount: ₹${paidAmount}`,
    `${EMOJI.HISTORY} Total Bill Cleared: ₹${totalAmount}`
  ];
  const footer = `${EMOJI.INFO} _All credits for this user have been cleared!_`;
  return sendPaymentConfirmationBase(to, title, details, footer);
};

// Consolidated Hisab Confirmation Logic
const sendHisabConfirmationBase = async (to, title, details, footer) => {
  try {
    const message = `${title}\n\n` + details.join('\n') + `\n\n${footer}`;
    const payload = {
      type: "text",
      text: { body: message, preview_url: false }
    };
    return await sendWhatsAppMessage(to, payload);
  } catch (error) {
    logger.error("Error sending hisab confirmation", { error: error.message, stack: error.stack, to, title });
    await sendErrorMessage(to, `${EMOJI.ERROR} Error recording hisab payment.`);
    return null;
  }
}

const sendHisabPartialConfirmation = async (to, username, paidAmount, remainingAmount, totalAmount) => {
  const title = `${EMOJI.PAYMENT} *Partial Payment Recorded (Hisab)*`;
  const details = [
    `${EMOJI.USER} User: ${username}`,
    `${EMOJI.SELL} Paid Amount: ₹${paidAmount}`,
    `${EMOJI.HISTORY} Previous Total: ₹${totalAmount}`,
    `${EMOJI.REMAINING} Remaining Balance: ₹${remainingAmount}`
  ];
  const footer = `${EMOJI.INFO} _The remaining balance may have been added as a new credit entry._\n` +
    `${EMOJI.INFO} _Any new purchases will add to this balance._`;
  return sendHisabConfirmationBase(to, title, details, footer);
};

const sendHisabFullConfirmation = async (to, username, paidAmount, totalAmount) => {
  const title = `${EMOJI.SUCCESS} *Full Payment Recorded (Hisab)*`;
  const details = [
    `${EMOJI.USER} User: ${username}`,
    `${EMOJI.SELL} Paid Amount: ₹${paidAmount}`,
    `${EMOJI.HISTORY} Total Cleared: ₹${totalAmount}`
  ];
  const footer = `${EMOJI.INFO} _All previous credits for this user have been cleared._\n` +
    `${EMOJI.INFO} _New purchases will start a fresh credit record._`;
  return sendHisabConfirmationBase(to, title, details, footer);
};


const sendHelpMessage = async (to) => {
  try {
    // Using template literals for easier multi-line string formatting
    const message = `
${EMOJI.HELP} *Available Commands*

${EMOJI.CONFIRM} *Credit Commands:*
\`get <username>\` - View credit history
\`delete credit <UID>\` - Delete a credit entry
\`hisab <username> <amount>\` - Record payment received

${EMOJI.ITEM} *Purchase Commands:*
\`get buy <DD.MM.YY>\` - View purchases (single date)
\`get buy <DD.MM.YY-DD.MM.YY>\` - View purchases (date range)
\`buy <item_name_qty> <purchase_price> <selling_price>\` - Add purchase
\`delete buy <UID>\` - Delete a purchase entry

${EMOJI.HISTORY} *Sales Commands:*
\`get sales <DD.MM.YY>\` - View sales (single date)
\`get sales <DD.MM.YY-DD.MM.YY>\` - View sales (date range)
\`sales <online_amount> <offline_amount>\` - Add daily sales

${EMOJI.INFO} *Examples:*
\`get john\`
\`hisab john 500\`
\`get buy 04.04.25\`
\`get buy 01.04.25-04.04.25\`
\`buy Potato 10kg 750 950\`
\`sales 780 1100\`
\`get sales 04.04.25\`
\`delete credit ABC123\`
        `.trim(); // Use trim to remove leading/trailing whitespace

    const payload = {
      type: "text",
      text: { body: message, preview_url: false }
    };

    return await sendWhatsAppMessage(to, payload);
  } catch (error) {
    logger.error("Error sending help message", { error: error.message, stack: error.stack, to });
    // Don't send another error message for help failure, just log it.
    return null;
  }
};

// Add these functions to handle persistence
const persistMessageContext = async (messageId, context) => {
  try {
    // You could store this in a file or database
    // For now, we'll just keep it in memory but log it
    logger.checkpoint("Message context persisted", {
      messageId,
      context,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.error("Failed to persist message context", {
      messageId,
      error: error.message
    });
  }
};

// Add this function to handle missing context gracefully
const handleMissingContext = async (to, messageId) => {
  logger.error("No context found for message", {
    messageId,
    storeSize: messageStore.size,
    availableKeys: Array.from(messageStore.keys())
  });

  await sendErrorMessage(
    to,
    `${EMOJI.ERROR} Sorry, the response took too long. Please try your request again.`
  );
};

// --- Exports ---
module.exports = {
  // Core Senders
  sendConfirmationMsg,
  sendSavedItemsConfirmation,
  sendErrorMessage,
  sendCreditHistory,
  sendDeleteConfirmation,
  sendPurchaseHistory,
  sendSalesHistory,
  sendSalesConfirmation,
  sendPaymentConfirmation,
  sendFullPaymentConfirmation,
  sendHisabPartialConfirmation,
  sendHisabFullConfirmation,
  sendHelpMessage,

  // Context Getter
  getMessageContext,

  // Helpers (optional export if needed elsewhere)
  // formatMessageDate,
  // formatPurchaseItem,
  // formatCreditItem,
  // generateDeleteInstruction
};