// models.js
const mongoose = require("mongoose");

// Helper function to convert to IST
function convertToIST(date) {
  return new Date(date.toLocaleString('en-US', { timeZone: 'Asia/Kolkata' }));
}

// Credit Schema
const creditSchema = new mongoose.Schema({
  username: { type: String, required: true },
  uid: { type: String, required: true, maxlength: 8 },
  itemNameAndQuantity: { type: String, required: true },
  amount: { type: Number, required: true }, // Changed from purchasePrice to amount
  date: { type: Date, default: Date.now },
});

// Hisab Schema
const hisabSchema = new mongoose.Schema({
  username: {
    type: String,
    required: true
  },
  amount: {
    type: Number,
    required: true
  },
  date: {
    type: Date,
    default: Date.now
  }
});

// Buy Schema
const buySchema = new mongoose.Schema({
  itemNameAndQuantity: { type: String, required: true }, 
  // Format: "item_name_quantity"
  purchasePrice: { type: Number, required: true },
  date: { type: Date, default: Date.now }, 
  // Date of purchase
  uid: { type: String, required: true, maxlength: 8 }, 
  // Unique ID for deletion
  sellingPrice: { type: Number, required: true }, // New field for selling price
});

// Sales Schema
const salesSchema = new mongoose.Schema({
  date: { type: Date, default: Date.now },
  // Date of the sales record
  onlineSales: { type: Number, default: 0 },
  offlineSales: { type: Number, default: 0 },
  totalSales: { type: Number, default: 0 }, 
  // Will be calculated automatically
});

// Add pre-save middleware to convert dates to IST
creditSchema.pre('save', function(next) {
  if (this.date) {
    this.date = convertToIST(this.date);
  }
  next();
});

hisabSchema.pre('save', function(next) {
  if (this.date) {
    this.date = convertToIST(this.date);
  }
  next();
});

buySchema.pre('save', function(next) {
  if (this.date) {
    this.date = convertToIST(this.date);
  }
  next();
});

salesSchema.pre('save', function(next) {
  if (this.date) {
    this.date = convertToIST(this.date);
  }
  next();
});

// Models
const Credit = mongoose.model("Credit", creditSchema);
const Hisab = mongoose.model("Hisab", hisabSchema);
const Buy = mongoose.model("Buy", buySchema);
const Sales = mongoose.model("Sales", salesSchema);

module.exports = { Credit, Hisab, Buy, Sales };
