'use strict';

var winston = require('winston');

winston.emitErrs = true;

var logger = new winston.Logger({
    transports: [new winston.transports.Console({
        timestamp: true,
        level: 'debug',
        handleExceptions: true,
        json: false,
        colorize: true
    })],
    exitOnError: false
});

module.exports = logger;
module.exports.stream = {
    write: function write(message) {
        logger.info(message.replace(/\n$/, ''));
    }
};