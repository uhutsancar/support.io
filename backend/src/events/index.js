const EventEmitter = require('events');

class AppEvents extends EventEmitter {}

module.exports = new AppEvents();
