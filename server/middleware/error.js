import { env } from '../config/env.js';

export const notFound = (req, res) =>
  res.status(404).json({ success: false, message: `Route not found: ${req.method} ${req.originalUrl}` });

// eslint-disable-next-line no-unused-vars
export const errorHandler = (err, req, res, _next) => {
  let status = err.statusCode || 500;
  let message = err.message || 'Something went wrong';
  let details = err.details;
  let code = err.code;

  if (err.name === 'ValidationError' && err.errors) {
    status = 422;
    details = Object.fromEntries(Object.entries(err.errors).map(([k, v]) => [k, v.message]));
    message = Object.values(details)[0];
    code = 'VALIDATION_ERROR';
  } else if (err.name === 'CastError') {
    status = 400; message = 'Invalid identifier supplied';
  } else if (err.code === 11000) {
    status = 409;
    const key = Object.keys(err.keyPattern || {})[0] || 'value';
    message = key.includes('barcode') ? 'A barcode you entered is already in use' : key === 'email' ? 'An account with this email already exists' : `Duplicate ${key}`;
    code = 'DUPLICATE';
  } else if (err.name === 'MulterError') {
    status = 400; message = err.code === 'LIMIT_FILE_SIZE' ? 'Image is too large (max 5 MB)' : err.message;
  } else if (!err.isOperational && status === 500) {
    console.error('[error]', err);
    if (env.isProd) message = 'Internal server error';
  }
  res.status(status).json({ success: false, message, ...(details ? { errors: details } : {}), ...(code ? { code } : {}) });
};
