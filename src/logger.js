import winston from 'winston';

winston.emitErrs = true;

export const logger = new winston.Logger({
  transports: [
    new winston.transports.Console({
      timestamp: true,
      level: 'info',
      handleExceptions: true,
      json: false,
      colorize: true
    })
  ],
  exitOnError: false
});


export const stream = {
  write: (message) => {
    logger.info(message.replace(/\n$/, ''));
  }
};
