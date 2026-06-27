export const notFoundHandler = (req, res) => {
  res.status(404).json({
    error: `Route not found: ${req.method} ${req.originalUrl}`
  });
};

export const errorHandler = (error, _req, res, _next) => {
  const status = error.status || 500;
  const message = status === 500 ? 'The server could not complete the request.' : error.message;

  if (status === 500) {
    console.error(error);
  }

  res.status(status).json({ error: message });
};
