// models.js
const mongoose = require("mongoose");
const moment = require('moment-timezone');

// Pre-save middleware to convert dates to IST
const dateToIST = function (next) {
  if (!this.date) {
    // If no date is set, use current IST time
    this.date = moment().tz('Asia/Kolkata').toDate();
  } else {
    // If date exists, ensure it's in IST
    this.date = moment(this.date).tz('Asia/Kolkata').toDate();
  }
  next();
};

// Credit Schema
const creditSchema = new mongoose.Schema({
  username: { type: String, required: true },
  uid: { type: String, required: true, maxlength: 8 },
  itemNameAndQuantity: { type: String, required: true },
  amount: { type: Number, required: true }, // Changed from purchasePrice to amount
  date: { type: Date, default: () => moment().tz('Asia/Kolkata').toDate() },
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
    default: () => moment().tz('Asia/Kolkata').toDate()
  },
  previousBalance: Number
});

// Buy Schema
const buySchema = new mongoose.Schema({
  itemNameAndQuantity: { type: String, required: true },
  // Format: "item_name_quantity"
  purchasePrice: { type: Number, required: true },
  date: { type: Date, default: () => moment().tz('Asia/Kolkata').toDate() },
  // Date of purchase
  uid: { type: String, required: true, maxlength: 8 },
  // Unique ID for deletion
  sellingPrice: { type: Number, required: true }, // New field for selling price
});

// Sales Schema
const salesSchema = new mongoose.Schema({
  onlineSales: { type: Number, default: 0 },
  offlineSales: { type: Number, default: 0 },
  totalSales: { type: Number, default: 0 },
  // Will be calculated automatically
  date: { type: Date, default: () => moment().tz('Asia/Kolkata').toDate() }
});

// Add pre-save middleware to all schemas
creditSchema.pre('save', dateToIST);
hisabSchema.pre('save', dateToIST);
buySchema.pre('save', dateToIST);
salesSchema.pre('save', dateToIST);

// Models
const Credit = mongoose.model("Credit", creditSchema);
const Hisab = mongoose.model("Hisab", hisabSchema);
const Buy = mongoose.model("Buy", buySchema);
const Sales = mongoose.model("Sales", salesSchema);

module.exports = { Credit, Hisab, Buy, Sales };
