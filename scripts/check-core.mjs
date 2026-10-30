// Runs the same assertions as Vitest when package installation is unavailable.
import {test} from 'node:test';
import {registerSuite} from '../tests/suite.js';
registerSuite(test);
