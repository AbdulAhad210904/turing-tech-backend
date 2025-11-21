"use strict";

import chalk from 'chalk';

const log = (message, color) => {
  console.log(chalk[color](message));
};

export default log;