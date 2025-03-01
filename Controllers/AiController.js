const { log } = require("console");
const fs = require("fs");
const { extractTypeAndArray } = require('../MiddleWare/HelperAiFunc')
const { sendConfirmationMsg } = require('../MiddleWare/WhatsAppSendBacks')
const logger = require('../utils/logger')
// const audioFile = require('./media/media_file.ogg')

const wholesaleMistralHandle = async (msg) => {
  const { Client } = await import("@gradio/client");
  const client = await Client.connect("Skier8402/mistral-super-fast");

  const systemPrompt = `
    consider this as your system prompt = Just check if there is any word like "wholesale" in the starting of the message or not. If there is then return true else return false. Just return "true" or "false". not even a single word or character else.
    "${msg}"
  `;

  const result = await client.predict("/chat", {
    prompt: systemPrompt,
    temperature: 0.7,
    max_new_tokens: 500,
    top_p: 0.9,
    repetition_penalty: 1.2,
  });

  console.log("AI Response Wholesale:", result.data);

  // Check if the response is an array and access the first element
  const resi = Array.isArray(result.data) ? result.data[0] : result.data; // Get the first element if it's an array
  log(resi);

  // Remove leading/trailing spaces and check for "true"
  const isTrue = resi.trim().toLowerCase().includes("true"); // Check for "true" in any format

  return isTrue ? "true" : "false"; // Return "true" or "false" as a string
};

const mistralHandle = async (msg, flag) => {
  const { Client } = await import("@gradio/client");
  const client = await Client.connect("Skier8402/mistral-super-fast");

  const systemPrompt = `Consider this as your system_prompt = 
    (You are an AI translator designed to convert natural language shopping lists into a structured JSON array format. You live in India. You currency is INR.) 

    Instructions:  
    - The user will give a **spoken or written shopping list** in **English, Hindi, or Urdu**.
    - Your task is to convert it into a JSON array format as follows:
    - "${flag
      ? "I case of wholesale the first word will be wholesale afther that the item name and quantity will be there there is a 50% chance that after the item name there can be quantity defined like 2kg or 2litre/2l or 2pcs/2pc etc. and then purchase price and selling price will be there. and then it will repeat the same for the next item. Also the item name and quantity will should be put in one column of itemNameAndQuantity"
      : "I case of credit the first word will be the username and then the item name and quantity will be there there is a 50% chance that after the item name there can be quantity defined like 2kg or 2litre/2l or 2pcs/2pc etc. and then the amount will be there. and then it will repeat the same for the next item. Also the item name and quantity will should be put in one column of itemNameAndQuantity"}"

    Example Input:
    "${flag
      ? "Wholesale milk purchase 234 sell 254, amul purchase 367 sell 1102"
      : "512 me 200rs ka chawal, 1lt ka tel ka 321, aur 20rs ka pani"}"
    
    Expected JSON Array Output:
    ${flag ?
      '[{"itemNameAndQuantity": "milk", "purchasePrice": 234, "sellingPrice": 254}, {"itemNameAndQuantity": "amul", "purchasePrice": 367, "sellingPrice": 1102}]'
      :
      '[{"username": "512", "itemNameAndQuantity": "chawal (rice)", "amount": 200}, {"username": "512", "itemNameAndQuantity": "1lt tel (oil)", "amount": 321}, {"username": "512", "itemNameAndQuantity": "pani (water)", "amount": 20}]'
    }

    Unbreakable Rules:
    - All the prices are in INR.
    - JUST return the **JSON array** and nothing else (no text, no explanation).
    - The JSON array must be **valid and properly formatted**.
    - Remove unnecessary spaces, \\n , +, or \ characters.
    - Kindly stick to the Expected JSON Array Output format. do not add any other new attribute or change the attribute name.
    - Ensure that output is a **real JSON array** and NOT an array of JSON strings.
    - You Output should be REAL JSON ARRAY.
    
    

    Now, process the following input:
    "${msg}"
  `;

  const result = await client.predict("/chat", {
    prompt: systemPrompt,
    temperature: 0.2,
    max_new_tokens: 450,
    top_p: 0.3,
    repetition_penalty: 1.2,
  });

  try {
    // Get the raw data
    const rawData = Array.isArray(result.data) ? result.data[0] : result.data;
    console.log("Raw AI Response:", rawData);

    // First, remove the </s> tag and trim
    let cleanedData = rawData.replace(/<\/s>$/, '').trim();

    // Remove escaped characters and format the JSON properly
    cleanedData = cleanedData
      // Remove escaped quotes
      .replace(/\\"/g, '"')
      // Handle array of JSON strings case
      .replace(/"\{/g, '{')
      .replace(/\}"/g, '}')
      // Clean up any remaining escaped characters
      .replace(/\\n/g, '')
      .replace(/\\/g, '')
      .trim();

    // Parse and validate the data
    try {
      const parsed = JSON.parse(cleanedData);

      if (Array.isArray(parsed)) {
        // Keep the original data, just ensure proper types for numbers
        const validatedData = parsed.map(item => {
          if (flag) {
            // Wholesale/Buy format
            return {
              itemNameAndQuantity: item.itemNameAndQuantity,
              purchasePrice: Number(item.purchasePrice),
              sellingPrice: Number(item.sellingPrice)
            };
          } else {
            // Credit format
            return {
              username: item.username,
              itemNameAndQuantity: item.itemNameAndQuantity,
              amount: Number(item.amount)
            };
          }
        });

        console.log("Validated data:", validatedData);
        return JSON.stringify(validatedData);
      }
    } catch (error) {
      console.error("JSON parsing error:", error);
      // If there's an error, try parsing as an array of JSON strings
      try {
        const stringArray = JSON.parse(cleanedData);
        const parsedArray = stringArray.map(str => JSON.parse(str));

        const validatedData = parsedArray.map(item => {
          if (flag) {
            return {
              itemNameAndQuantity: item.itemNameAndQuantity,
              purchasePrice: Number(item.purchasePrice),
              sellingPrice: Number(item.sellingPrice)
            };
          } else {
            return {
              username: item.username,
              itemNameAndQuantity: item.itemNameAndQuantity,
              amount: Number(item.amount)
            };
          }
        });

        console.log("Validated data (from string array):", validatedData);
        return JSON.stringify(validatedData);
      } catch (nestedError) {
        console.error("Nested parsing error:", nestedError);
        return '[]';
      }
    }

    return cleanedData;
  } catch (error) {
    console.error("Error in mistralHandle:", error);
    return '[]';
  }
};

const textMistralHandle = async (msg, flag) => {
  const { Client } = await import("@gradio/client");
  const client = await Client.connect("Skier8402/mistral-super-fast");

  const systemPrompt = `Consider this as your system_prompt = 
    (You are an AI translator designed to convert natural language shopping lists into a structured JSON array format. You live in India. You currency is INR.) 

    Instructions:  
    - The user will give a **spoken or written shopping list** in **English, Hindi, or Urdu**.
    - Your task is to convert it into a JSON array format as follows:
    - Most of the time the first word will be the username.
    - "${flag
      ? "I case of wholesale the first word will be wholesale afther that the item name and quantity will be there there is a 50% chance that after the item name there can be quantity defined like 2kg or 2litre/2l or 2pcs/2pc etc. and then purchase price and selling price will be there. and then it will repeat the same for the next item. Also the item name and quantity will should be put in one column of itemNameAndQuantity"
      : "I case of credit the first word will be the username and then the item name and quantity will be there there is a 50% chance that after the item name there can be quantity defined like 2kg or 2litre/2l or 2pcs/2pc etc. and then the amount will be there. and then it will repeat the same for the next item. Also the item name and quantity will should be put in one column of itemNameAndQuantity"}"

    Example Input:
    "${flag
      ? "Wholesale milk purchase 234 sell 254, amul purchase 367 sell 1102"
      : "512 me 200rs ka chawal, 1lt ka tel ka 321, aur 20rs ka pani"}"
    
    Expected JSON Array Output:
    ${flag ?
      '[{"itemNameAndQuantity": "milk", "purchasePrice": 234, "sellingPrice": 254}, {"itemNameAndQuantity": "amul", "purchasePrice": 367, "sellingPrice": 1102}]'
      :
      '[{"username": "512", "itemNameAndQuantity": "chawal", "amount": 200}, {"username": "512", "itemNameAndQuantity": "1lt tel", "amount": 321}, {"username": "512", "itemNameAndQuantity": "pani", "amount": 20}]'
    }

    Unbreakable Rules:
    - All the prices are in INR.
    - JUST return the **JSON array** and nothing else (no text, no explanation).
    - The JSON array must be **valid and properly formatted**.
    - Remove unnecessary spaces, \\n , +, or \ characters.
    - Kindly stick to the Expected JSON Array Output format. do not add any other new attribute or change the attribute name.
    - Ensure that output is a **real JSON array** and NOT an array of JSON strings.
    - You Output should be REAL JSON ARRAY.
    
    

    Now, process the following input:
    "${msg}"
  `;

  const result = await client.predict("/chat", {
    prompt: systemPrompt,
    temperature: 0.2,
    max_new_tokens: 450,
    top_p: 0.3,
    repetition_penalty: 1.2,
  });

  try {
    // Get the raw data
    const rawData = Array.isArray(result.data) ? result.data[0] : result.data;
    console.log("Raw AI Response:", rawData);

    // First, remove the </s> tag and trim
    let cleanedData = rawData.replace(/<\/s>$/, '').trim();

    // Remove escaped characters and format the JSON properly
    cleanedData = cleanedData
      // Remove escaped quotes
      .replace(/\\"/g, '"')
      // Handle array of JSON strings case
      .replace(/"\{/g, '{')
      .replace(/\}"/g, '}')
      // Clean up any remaining escaped characters
      .replace(/\\n/g, '')
      .replace(/\\/g, '')
      .trim();

    // Parse and validate the data
    try {
      const parsed = JSON.parse(cleanedData);

      if (Array.isArray(parsed)) {
        // Keep the original data, just ensure proper types for numbers
        const validatedData = parsed.map(item => {
          if (flag) {
            // Wholesale/Buy format
            return {
              itemNameAndQuantity: item.itemNameAndQuantity,
              purchasePrice: Number(item.purchasePrice),
              sellingPrice: Number(item.sellingPrice)
            };
          } else {
            // Credit format
            return {
              username: item.username,
              itemNameAndQuantity: item.itemNameAndQuantity,
              amount: Number(item.amount)
            };
          }
        });

        console.log("Validated data:", validatedData);
        return JSON.stringify(validatedData);
      }
    } catch (error) {
      console.error("JSON parsing error:", error);
      // If there's an error, try parsing as an array of JSON strings
      try {
        const stringArray = JSON.parse(cleanedData);
        const parsedArray = stringArray.map(str => JSON.parse(str));

        const validatedData = parsedArray.map(item => {
          if (flag) {
            return {
              itemNameAndQuantity: item.itemNameAndQuantity,
              purchasePrice: Number(item.purchasePrice),
              sellingPrice: Number(item.sellingPrice)
            };
          } else {
            return {
              username: item.username,
              itemNameAndQuantity: item.itemNameAndQuantity,
              amount: Number(item.amount)
            };
          }
        });

        console.log("Validated data (from string array):", validatedData);
        return JSON.stringify(validatedData);
      } catch (nestedError) {
        console.error("Nested parsing error:", nestedError);
        return '[]';
      }
    }

    return cleanedData;
  } catch (error) {
    console.error("Error in mistralHandle:", error);
    return '[]';
  }
};


const whispherHandle = async (audioBlob, to) => {
  try {
    const { Client } = await import("@gradio/client");
    logger.checkpoint('Starting Whisper processing');

    const client = await Client.connect("Rio0913/openai-whisper-large-v3-turbo");
    const result = await client.predict("/predict", {
      param_0: audioBlob,
    });
    logger.checkpoint('Whisper processing complete', { result: result.data });

    const match = result.data[0].match(/text=['"](.*?)['"]/);

    if (match) {
      let extractedText = match[1].trim();
      extractedText = extractedText.replace(/^["'\s]+|["'\s]+$/g, "");
      logger.checkpoint('Text extracted', { extractedText });

      const wholesale = await wholesaleMistralHandle(extractedText);
      logger.checkpoint('Wholesale check complete', { wholesale });

      try {
        if (wholesale === "true") {
          const jsonArray = await mistralHandle(extractedText, true);
          logger.checkpoint('Mistral processing complete (wholesale)', { jsonArray });
          const query = await sendConfirmationMsg(to, jsonArray, true);
        } else {
          const jsonArray = await mistralHandle(extractedText, false);
          logger.checkpoint('Mistral processing complete (retail)', { jsonArray });
          const query = await sendConfirmationMsg(to, jsonArray, false);
        }
      } catch (error) {
        logger.error("Error processing message with Mistral", error);
      }
    } else {
      logger.checkpoint('No text match found in Whisper response');
      return null;
    }
  } catch (error) {
    logger.error("Error in whispherHandle", error);
    throw error;
  }
};

module.exports = { whispherHandle, mistralHandle, wholesaleMistralHandle, textMistralHandle };
