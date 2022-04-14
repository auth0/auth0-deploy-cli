import { format, createLogger, transports } from 'winston';

const { combine, timestamp, colorize } = format;

const logger = createLogger({
  level: process.env.AUTH0_LOG || 'info',
  format: combine(
    colorize(),
    timestamp(),
    format.printf((info) => `[${info.timestamp}] ${info.level}: ${info.message}`)
  ),
  transports: [new transports.Console()],
  exitOnError: false,
});

export default logger;
