const axios = require('axios');


async function getHotelsByLocation(location, startDate, endDate) {
  const response = await axios.get('http://localhost:5501/api/hotel/search', {
    params: { location, startDate, endDate }
  });
  return response.data;
}


module.exports = {
  getHotelsByLocation,
};
