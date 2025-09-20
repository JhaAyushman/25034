const axios = require('axios');

async function registerUser(registrationData) {
  try {
    const response = await axios.post(
      'http://20.244.56.144/evaluation-service/register',
      registrationData
    );
    return { data: response.data, status: response.status };
  } catch (error) {
    return {
      error: error.response ? error.response.data : error.message,
      status: error.response ? error.response.status : 500
    };
  }
}

module.exports = { registerUser };
