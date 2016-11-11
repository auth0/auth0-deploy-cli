const winston = require('winston');

winston.emitErrs = true;

const logger = new winston.Logger({
    transports: [
        new winston.transports.Console({
            timestamp: true,
            level: 'debug',
            handleExceptions: true,
            json: false,
            colorize: true
        })
    ],
    exitOnError: false
});

module.exports = logger;
module.exports.stream = {
    write: (message) => {
        logger.info(message.replace(/\n$/, ''));
    }
};
