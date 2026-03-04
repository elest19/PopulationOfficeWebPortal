function errorHandler(err, req, res, next) {
  console.error(err);

  if (res.headersSent) {
    return next(err);
  }

  const status = err.code === 'LIMIT_FILE_SIZE' ? 413 : (err.status || 500);
  const message =
    err.message === 'Validation error' && Array.isArray(err.details) && err.details.length
      ? err.details[0]
      : err.code === 'LIMIT_FILE_SIZE'
        ? 'Image is too large. Please upload a smaller file.'
      : err.message || 'Internal server error';

  res.status(status).json({
    success: false,
    error: {
      message,
      code: err.code || undefined,
      details: err.details || undefined
    }
  });
}

module.exports = errorHandler;
