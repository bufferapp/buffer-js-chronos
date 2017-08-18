/* globals jest describe test beforeEach expect */

import { middleware, actionTypes, actions } from '../src/middleware';
import chronos from '../src/chronos';

const mockChronos = {
  startMeasure: jest.fn(),
  stopMeasure: jest.fn(),
  measureFromSpecialEvent: jest.fn(),
  measureFromNavigationStart: jest.fn(),
};
const mockChronosSetup = jest.fn(() => mockChronos);
jest.mock('../src/chronos');
chronos.mockImplementation(mockChronosSetup);

beforeEach(() => {
});

describe('middleware', () => {
  let storeMethod;
  const middlewareOptions = {};
  let next;
  let action;

  beforeEach(() => {
    storeMethod = jest.fn();
    middlewareOptions.store = storeMethod;
    next = jest.fn();
    action = {
      measureName: 'testMeasure',
      measureData: {},
    };
  });

  test('should require a store method', () => {
    expect(() => { middleware(); }).toThrow();
  });

  test('should throw if the store is not a function', () => {
    expect(() => { middleware({}); }).toThrow();
  });

  test('should accept a store function', () => {
    expect(() => { middleware(middlewareOptions); }).not.toThrow();
  });

  test('should pass the storeMethod to chronos on setup', () => {
    middleware(middlewareOptions);
    expect(mockChronosSetup).toBeCalledWith(middlewareOptions);
  });

  test('should call next when running', () => {
    const chronosMiddleware = middleware(middlewareOptions);
    chronosMiddleware()(next)({});
    expect(next).toBeCalled();
  });

  test('should start a measure', () => {
    const chronosMiddleware = middleware(middlewareOptions);
    action.type = actionTypes.PERFORMANCE_START_MEASURE;
    chronosMiddleware()(next)(action);
    expect(mockChronos.startMeasure)
      .toBeCalledWith(action.measureName, action.measureData);
  });

  test('should start a measure from special event', () => {
    const chronosMiddleware = middleware(middlewareOptions);
    action.type = actionTypes.PERFORMANCE_MEASURE_FROM_EVENT;
    chronosMiddleware()(next)(action);
    expect(mockChronos.measureFromSpecialEvent)
      .toBeCalledWith(action.measureName, action.measureData);
  });

  test('should start a measure from navigation start', () => {
    const chronosMiddleware = middleware(middlewareOptions);
    action.type = actionTypes.PERFORMANCE_MEASURE_FROM_NAVIGATION_START;
    chronosMiddleware()(next)(action);
    expect(mockChronos.measureFromNavigationStart)
      .toBeCalledWith(action.measureName, action.measureData);
  });

  test('should stop a measure', () => {
    const chronosMiddleware = middleware(middlewareOptions);
    action.type = actionTypes.PERFORMANCE_STOP_MEASURE;
    chronosMiddleware()(next)(action);
    expect(mockChronos.stopMeasure).toBeCalledWith(action.measureName);
  });
});

describe('actions', () => {
  test('should dispacth PERFORMANCE_START_MEASURE', () => {
    expect(actions.startMeasure({
      name: 'test',
      data: {},
    })).toMatchObject({
      measureName: 'test',
      measureData: {},
      type: actionTypes.PERFORMANCE_START_MEASURE,
    });
  });

  test('should dispacth PERFORMANCE_MEASURE_FROM_EVENT', () => {
    expect(actions.measureFromSpecialEvent({
      name: 'test',
      data: {},
    })).toMatchObject({
      measureName: 'test',
      measureData: {},
      type: actionTypes.PERFORMANCE_MEASURE_FROM_EVENT,
    });
  });

  test('should dispacth PERFORMANCE_MEASURE_FROM_NAVIGATION_START', () => {
    expect(actions.measureFromNavigationStart({
      name: 'test',
      data: {},
    })).toMatchObject({
      measureName: 'test',
      measureData: {},
      type: actionTypes.PERFORMANCE_MEASURE_FROM_NAVIGATION_START,
    });
  });

  test('should dispacth PERFORMANCE_STOP_MEASURE', () => {
    expect(actions.stopMeasure({
      name: 'test',
    })).toMatchObject({
      measureName: 'test',
      type: actionTypes.PERFORMANCE_STOP_MEASURE,
    });
  });
});
