const { log } = require("console");

const extractTypeAndArray = (aiResponse) => {
  const jsonString = aiResponse[0]; // Extracting the first item in array

  // Extract type (post, get, etc.)
  const typeMatch = jsonString.match(/"(\w+)"\s*:/);
  const type = typeMatch ? typeMatch[1] : "Unknown";

  // Extract JSON array
  const arrayMatch = jsonString.match(/:\s*(\[\s*{[\s\S]*}\s*])/);
  const jsonArray = arrayMatch ? arrayMatch[1] : "[]";
  log(type, jsonArray)
  return { type, jsonArray };
};

module.exports = {extractTypeAndArray}