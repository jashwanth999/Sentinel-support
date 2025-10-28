import { nanoid } from 'nanoid';

export default function requestContext () {
  return function attachContext (req, res, next) {
    req.requestId = nanoid();
    res.setHeader('X-Request-Id', req.requestId);
    res.locals.requestId = req.requestId;
    next();
  };
}
