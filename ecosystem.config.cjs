const path = require('path');

module.exports = {
  apps: [
    {
      name: 'turingtest',
      script: 'bin/www',            // your ESM entry is fine
      exec_mode: 'fork',            // or 'cluster' for multi-core
      instances: 1,                 // or 'max'
      autorestart: true,
      restart_delay: 1000,
      kill_timeout: 3000,

      // show your debug() logs
      env: {
        NODE_ENV: 'develop',
      },
      env_production: {
        NODE_ENV: 'production',
      },

      // logs
      output: path.join(__dirname, 'logs', 'express.log'),
      error:  path.join(__dirname, 'logs', 'express_error.log'),
      time: true
    }
  ]
};
