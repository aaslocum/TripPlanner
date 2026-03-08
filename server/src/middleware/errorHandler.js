export function errorHandler(err, req, res, _next) {
  console.error('Error:', err.message);
  if (process.env.NODE_ENV !== 'production') {
    console.error(err.stack);
  }
  res.status(err.status || 500).json({
    success: false,
    error: { message: err.message || 'Internal server error' },
  });
}
