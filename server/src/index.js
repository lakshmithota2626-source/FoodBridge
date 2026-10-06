const env = require('./config/env');
const app = require('./app');
const { startJobs } = require('./utils/jobs');

app.listen(env.port, () => {
  console.log(`FoodBridge API listening on :${env.port}`);
  startJobs(); // expiry + reminder worker (runs every minute)
});
