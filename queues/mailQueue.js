const Queue = require("bull");

module.exports = new Queue('my-queue', 'redis://127.0.0.1:6379');