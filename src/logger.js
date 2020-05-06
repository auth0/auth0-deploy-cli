import winston from 'winston';

winston.emitErrs = true;

const log = new winston.Logger({
  transports: [
    new winston.transports.Console({
      timestamp: true,
      level: process.env.AUTH0_LOG || 'info',
      handleExceptions: true,
      json: false,
      colorize: true
    })
  ],
  exitOnError: false
});


export default log;
