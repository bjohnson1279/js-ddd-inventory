import { jest } from '@jest/globals';
jest.useFakeTimers();
jest.setSystemTime(new Date("2023-05-15T12:00:00Z"));
console.log(new Date());
