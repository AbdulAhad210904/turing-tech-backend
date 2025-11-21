'use strict'
import { createLogger, transports as _transports, format as _format } from 'winston';
export const logger =  createLogger({
  transports: [
    new _transports.File({
      level: 'info',
      filename: 'filelog-info.log',
      json: true,
      format: _format.combine(_format.timestamp(), _format.json())
    }),
    new _transports.File({
      level: 'error',
      filename: 'filelog-error.log',
      json: true,
      format: _format.combine(_format.timestamp(), _format.json())
    })
  ]
});

