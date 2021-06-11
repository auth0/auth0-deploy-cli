function ValidationError(message) {
  Error.call(this, message);
  if (process.env.NODE_ENV !== 'production') {
    Error.captureStackTrace(this, this.constructor);
  }
  this.name = 'ValidationError';
  this.message = message;
  this.status = 400;
}

ValidationError.prototype = Object.create(Error.prototype);
ValidationError.prototype.constructor = ValidationError;
module.exports = ValidationError;
