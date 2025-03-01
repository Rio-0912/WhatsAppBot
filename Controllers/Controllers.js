const { log } = console;
const axios = require("axios");
const fs = require("fs");
const path = require("path");
const ffmpeg1 = require("fluent-ffmpeg");
const { whispherHandle } = require("./AiController");
const { 
  sendErrorMessage, 
  sendCreditHistory,
  sendDeleteConfirmation,
  sendPurchaseHistory,
  sendSalesHistory,
  sendPaymentConfirmation,
  sendFullPaymentConfirmation,
  sendHisabPartialConfirmation,
  sendHisabFullConfirmation,
  sendSalesConfirmation,
  sendSavedItemsConfirmation
} = require("../MiddleWare/WhatsAppSendBacks");
const { getCreditsByUser, deleteCredit,createCredit } = require("./CreditController");
const { getPurchasesByDateRange, deletePurchase } = require("./BuyController");
const { getSalesByDate, getSalesByDateRange } = require("./SalesController");
const { createHisab, getHisabByUser, updateHisab } = require("./HisabController");
const { Credit, Hisab } = require('../Models/Modals');
const mongoose = require('mongoose');
const logger = require("../utils/logger");
const { getIndianTime, formatIndianTime } = require('../utils/dateHelper');
const moment = require('moment-timezone');


const userState = {};


const audioHandle = async (message, TOK) => {
  const mediaId = message.audio.id;
  logger.checkpoint('Audio message received', { mediaId, from: message.from });

  try {
    // Step 1: Get the media URL
    const mediaResponse = await axios.get(
      `https://graph.facebook.com/v18.0/${mediaId}`,
      {
        headers: { Authorization: `Bearer ${TOK}` },
      }
    );
    logger.checkpoint('Media URL retrieved', { mediaId });

    const audioUrl = mediaResponse.data.url;

    // Step 2: Get audio data as arraybuffer
    const audioResponse = await axios.get(audioUrl, {
      headers: { Authorization: `Bearer ${TOK}` },
      responseType: 'arraybuffer'
    });
    logger.checkpoint('Audio data downloaded', { mediaId });

    // Step 3: Convert to Blob
    const audioBlob = new Blob([audioResponse.data], {
      type: 'audio/ogg; codecs=opus'
    });
    logger.checkpoint('Audio converted to Blob', { mediaId });

    // Step 4: Process with Whisper
    await whispherHandle(audioBlob, message.from);

  } catch (error) {
    logger.error("Error in audioHandle", error);
    throw error;
  }
};

const handleGetCredit = async (userId, username) => {
  try {
    if (!username) {
      await sendErrorMessage(userId, "❌ Please provide a username. Example: get john");
      return;
    }

    // Check MongoDB connection state
    if (mongoose.connection.readyState !== 1) {
      await sendErrorMessage(userId, "❌ Database connection issue. Please try again.");
      return;
    }

    // Get the latest hisab entry with timeout and retry logic
    let latestHisab = null;
    let retries = 3;

    while (retries > 0) {
      try {
        latestHisab = await Promise.race([
          Hisab.findOne({ username }).sort({ date: -1 }),
          new Promise((_, reject) => 
            setTimeout(() => reject(new Error('Query timeout')), 5000)
          )
        ]);
        break; // If successful, exit the loop
      } catch (error) {
        retries--;
        if (retries === 0) {
          throw error;
        }
        await new Promise(resolve => setTimeout(resolve, 1000)); // Wait 1 second before retry
      }
    }

    // Get credits with similar retry logic
    let credits = [];
    retries = 3;

    while (retries > 0) {
      try {
        if (latestHisab) {
          credits = await Credit.find({
            username,
            date: { $gt: latestHisab.date }
          }).sort({ date: -1 }).maxTimeMS(5000);
        } else {
          credits = await Credit.find({ username })
            .sort({ date: -1 })
            .maxTimeMS(5000);
        }
        break;
      } catch (error) {
        retries--;
        if (retries === 0) {
          throw error;
        }
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }

    if (credits.length === 0) {
      await sendErrorMessage(
        userId, 
        latestHisab 
          ? `❌ No new credits found for ${username} after last hisab on ${latestHisab.date.toLocaleDateString()}`
          : `❌ No credits found for ${username}`
      );
      return;
    }

    const totalOutstanding = credits.reduce((sum, credit) => sum + credit.amount, 0);

    await sendCreditHistory(
      userId, 
      username, 
      credits,
      latestHisab,
      totalOutstanding
    );

  } catch (error) {
    console.error("Error in handleGetCredit:", error);
    
    // Send more specific error message based on error type
    let errorMessage = "❌ Error retrieving credit history";
    if (error.name === 'MongooseError' && error.message.includes('buffering timed out')) {
      errorMessage = "❌ Database timeout. Please try again.";
    } else if (error.name === 'MongooseError' && error.message.includes('disconnected')) {
      errorMessage = "❌ Database connection lost. Please try again.";
    }
    
    await sendErrorMessage(userId, errorMessage);
  }
};

const handleDeleteCredit = async (userId, uid) => {
  try {
    if (!uid) {
      await sendErrorMessage(userId, "❌ Please provide a UID. Example: delete credit ABC123");
      return;
    }

    const reqMock = { params: { uid } };
    const resMock = {
      status: (code) => ({
        json: async (data) => {
          if (data.success) {
            await sendDeleteConfirmation(userId, 'credit', data.data);
          } else {
            await sendErrorMessage(userId, `❌ No credit entry found with UID: ${uid}`);
          }
          return data;
        }
      })
    };

    await deleteCredit(reqMock, resMock);
  } catch (error) {
    console.error("Error in handleDeleteCredit:", error);
    await sendErrorMessage(userId, "❌ Error deleting credit entry");
  }
};

const handleDeleteBuy = async (userId, uid) => {
  try {
    if (!uid) {
      await sendErrorMessage(userId, "❌ Please provide a UID. Example: delete buy XYZ789");
      return;
    }

    const reqMock = { params: { uid } };
    const resMock = {
      status: (code) => ({
        json: async (data) => {
          if (data.success) {
            await sendDeleteConfirmation(userId, 'purchase', data.data);
          } else {
            await sendErrorMessage(userId, `❌ No purchase entry found with UID: ${uid}`);
          }
          return data;
        }
      })
    };

    await deletePurchase(reqMock, resMock);
  } catch (error) {
    console.error("Error in handleDeleteBuy:", error);
    await sendErrorMessage(userId, "❌ Error deleting purchase entry");
  }
};

const handleGetBuy = async (userId, dateRange) => {
    try {
        if (!dateRange) {
            await sendErrorMessage(userId, "❌ Please provide a date. Example: get buy 27.02.24");
            return;
        }

        const result = await getPurchasesByDateRange(dateRange);
        
        if (result.success) {
            await sendPurchaseHistory(userId, dateRange, result.data);
        } else {
            await sendErrorMessage(userId, result.error);
        }
    } catch (error) {
        console.error("Error in handleGetBuy:", error);
        await sendErrorMessage(userId, "❌ Error retrieving purchase data");
    }
};

// Helper function to parse date strings
function parseDateString(dateStr) {
  try {
    const [day, month, year] = dateStr.split('.');
    // Assuming YY format, convert to YYYY
    const fullYear = year.length === 2 ? '20' + year : year;
    return new Date(`${fullYear}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`);
  } catch (error) {
    return null;
  }
}

const handleGetSales = async (userId, dateRange) => {
  try {
    if (!dateRange) {
      await sendErrorMessage(userId, "❌ Please provide a date or date range. Example: get sales 27.2.25 or get sales 27.2.25-29.2.25");
      return;
    }

    const startDate = moment(parseDateString(dateRange)).tz('Asia/Kolkata');
    const endDate = moment(startDate).tz('Asia/Kolkata');

    const reqMock = { 
      query: { 
        startDate: startDate.toISOString(),
        endDate: endDate.toISOString()
      } 
    };
    const resMock = {
      status: (code) => ({
        json: async (data) => {
          if (data.success && data.data.length > 0) {
            await sendSalesHistory(userId, dateRange, data.data);
          } else {
            await sendErrorMessage(userId, `❌ No sales found for ${dateRange}`);
          }
          return data;
        }
      })
    };

    await getSalesByDateRange(reqMock, resMock);
  } catch (error) {
    console.error("Error in handleGetSales:", error);
    await sendErrorMessage(userId, "❌ Error retrieving sales history");
  }
};

const handleAddSales = async (userId, onlineSales, offlineSales) => {
  try {
    const reqMock = {
      body: {
        onlineSales,
        offlineSales,
        totalSales: onlineSales + offlineSales
      }
    };
    const resMock = {
      status: (code) => ({
        json: async (data) => {
          if (data.success) {
            await sendSalesConfirmation(userId, data.data);
          } else {
            await sendErrorMessage(userId, "❌ Error saving sales data");
          }
          return data;
        }
      })
    };

    await createSales(reqMock, resMock);
  } catch (error) {
    console.error("Error in handleAddSales:", error);
    await sendErrorMessage(userId, "❌ Error adding sales");
  }
};

// Helper function to convert date string to Date object
function convertToDate(dateStr) {
  const [day, month, year] = dateStr.split('.');
  return new Date(`20${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`);
}

const handleHisab = async (userId, username, paidAmount) => {
    try {
        if (!username || !paidAmount) {
            await sendErrorMessage(userId, "❌ Please provide username and amount. Example: hisab john 150");
            return;
        }

        paidAmount = parseFloat(paidAmount);

        // 1. First check for latest hisab entry
        const latestHisab = await Hisab.findOne({ username })
            .sort({ date: -1 });

        // 2. Get credits based on hisab existence
        let credits;
        if (latestHisab) {
            // If hisab exists, get credits after the exact date and time
            credits = await Credit.find({
                username,
                date: { $gt: latestHisab.date } // Get credits after exact hisab date/time
            }).sort({ date: 1 }); // Sort from oldest to newest
            
            console.log(`Found ${credits.length} credits after last hisab dated ${latestHisab.date}`);
        } else {
            // If no hisab exists, get all credits (new user)
            credits = await Credit.find({ username })
                .sort({ date: 1 }); // Sort from oldest to newest
            
            console.log(`No previous hisab found. Found ${credits.length} total credits`);
        }

        // 3. Check if we have any credits to process
        if (credits.length === 0) {
            await sendErrorMessage(
                userId, 
                latestHisab 
                    ? `❌ No new credits found for ${username} after last hisab on ${latestHisab.date.toLocaleDateString()}`
                    : `❌ No credits found for ${username}`
            );
            return;
        }

        // 4. Calculate total outstanding
        const totalCredit = credits.reduce((sum, credit) => sum + credit.amount, 0);
        const remainingAmount = totalCredit - paidAmount;

        try {
            // 5. Create new hisab entry with exact timestamp
            const hisabReqMock = {
                body: {
                    username,
                    amount: paidAmount,
                    date: new Date(), // Current exact timestamp
                    previousBalance: totalCredit // Store total balance for reference
                }
            };

            const hisabResult = await createHisab(hisabReqMock);
            
            if (!hisabResult.success) {
                throw new Error(hisabResult.error);
            }

            // 6. Handle remaining balance if partial payment
            if (remainingAmount > 0) {
                // Add delay to ensure proper ordering
                await new Promise(resolve => setTimeout(resolve, 1000));

                // Create a new credit entry for remaining amount
                const itemsSummary = credits
                    .map(c => c.itemNameAndQuantity)
                    .filter(item => !item.startsWith('Previous Balance')) // Filter out previous balance entries
                    .join(', ');

                const description = itemsSummary 
                    ? `Outstanding Amount (${itemsSummary})`
                    : 'Outstanding Amount';

                const creditReqMock = {
                    body: {
                        data: [{
                            username,
                            itemNameAndQuantity: description,
                            amount: remainingAmount,
                            date: new Date() // Ensure this is after hisab entry
                        }]
                    }
                };
                
                const creditResult = await createCredit(creditReqMock);
                
                if (!creditResult.success) {
                    throw new Error(creditResult.error);
                }

                await sendHisabPartialConfirmation(
                    userId,
                    username,
                    paidAmount,
                    remainingAmount,
                    totalCredit
                );
            } else {
                await sendHisabFullConfirmation(
                    userId,
                    username,
                    paidAmount,
                    totalCredit
                );
            }

        } catch (error) {
            console.error("Error processing hisab:", error);
            await sendErrorMessage(userId, "❌ Error processing payment");
        }

    } catch (error) {
        console.error("Error in handleHisab:", error);
        await sendErrorMessage(userId, "❌ Error processing hisab entry");
    }
};

const handleAddBuy = async (userId, itemName, purchasePrice, sellingPrice) => {
  try {
    const reqMock = {
      body: {
        data: [{
          itemNameAndQuantity: itemName,
          purchasePrice: parseFloat(purchasePrice),
          sellingPrice: parseFloat(sellingPrice)
        }]
      }
    };
    const resMock = {
      status: (code) => ({
        json: async (data) => {
          if (data.success) {
            await sendSavedItemsConfirmation(userId, data.data);
          } else {
            await sendErrorMessage(userId, "❌ Error saving purchase data");
          }
          return data;
        }
      })
    };

    await createBuy(reqMock, resMock);
  } catch (error) {
    console.error("Error in handleAddBuy:", error);
    await sendErrorMessage(userId, "❌ Error adding purchase");
  }
};

const sendHelpMessage = async (userId) => {
    const helpText = `🔍 *Available Commands:*

1. *Wholesale Entry:*
   Type: wholesale item price sellPrice, item2 price2 sellPrice2
   Example: wholesale tea 343 897, oil 325 986

2. *Credit Entry:*
   Type: [number] ka item price, item2 price2
   Example: 518 ka oil 22, potato 44

3. *Get Records:*
   • get buy [date]
   • get buy [startDate-endDate]
   Example: get buy 1.3.25
           get buy 27.2.25-1.3.25

4. *Delete Records:*
   • delete buy [UID]
   • delete credit [UID]
   Example: delete buy ABC123

5. *Voice Commands:*
   Send voice message for wholesale or credit entries

Need more help? Contact support.`;

    await sendMessage(userId, helpText);
};

module.exports = { 
  audioHandle,
  handleGetCredit,
  handleDeleteCredit,
  handleDeleteBuy,
  handleGetBuy,
  handleGetSales,
  handleHisab,
  handleAddSales,
  handleAddBuy,
  sendHelpMessage
};
