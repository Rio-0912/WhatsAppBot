const moment = require('moment-timezone');

const getIndianTime = () => {
  return moment().tz('Asia/Kolkata');
};

const formatIndianTime = (date) => {
  return moment(date).tz('Asia/Kolkata').format('DD MMM YY, hh:mm A');
};

module.exports = {
  getIndianTime,
  formatIndianTime
}; 