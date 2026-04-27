import type { RequestHandler } from "express";

export const notFoundHandler: RequestHandler = (req, res) => {
  res.status(404).json({
    error: "not_found",
    message: `No route for ${req.method} ${req.originalUrl}`,
  });
};
