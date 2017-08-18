/* globals jest describe test beforeEach expect */

import chronos from '../src/chronos';

let performance = {};
let ch;

beforeEach(() => {
  performance = {
    now: jest.fn().mockImplementation(() => Date.now()),
    mark: jest.fn().mockImplementation(() => true),
    measure: jest.fn().mockImplementation(() => true),
    getEntriesByName: jest.fn().mockImplementation(() =>
      [{
        duration: 4392.679999999702,
        entryType: 'measure',
        name,
        startTime: 8396525.785,
      }],
    ),
    clearMeasures: jest.fn(),
    clearMarks: jest.fn(),
    timing: {
      navigationStart: Date.now(),
    },
  };
});

describe('High Resolution Time Unsupported', () => {
  beforeEach(() => {
    performance.now = undefined;
    ch = chronos({
      performance,
    });
    ch.setDebugMode(false);
  });

  test('start measure | should fail', () => {
    expect(ch.startMeasure('foo')).toBe(false);
  });

  test('measure from Navigation Start | should fail', () => {
    expect(ch.measureFromNavigationStart('foo')).toBe(false);
  });

  test('measure from special event | should fail', () => {
    expect(ch.measureFromSpecialEvent('foo', 'navigationStart')).toBe(false);
  });

  test('stop measure | should fail', () => {
    expect(ch.stopMeasure('foo')).toBe(false);
  });
});

describe('start measure', () => {
  beforeEach(() => {
    performance.mark = undefined;
    ch = chronos({
      performance,
    });
    ch.setDebugMode(false);
  });

  test('starting multiple measures with the same name should override the previos one', () => {
    expect(ch.startMeasure('foo')).toBe(true);
    expect(ch.startMeasure('foo')).toBe(true);
    expect(performance.now).toHaveBeenCalledTimes(2);
    ch.setDebugMode(true);
    expect(ch._runningMeasures).toHaveProperty('foo');
  });
});

describe('User Timing API Unsupported', () => {
  beforeEach(() => {
    performance.mark = undefined;
    ch = chronos({
      performance,
    });
    ch.setDebugMode(false);
  });

  test('start measure', () => {
    expect(ch.startMeasure('foo')).toBe(true);
    expect(performance.now).toHaveBeenCalledTimes(1);
    ch.setDebugMode(true);
    expect(ch._runningMeasures).toHaveProperty('foo');
    expect(ch._runningMeasures.foo).toHaveProperty('name', 'foo');
    expect(ch._runningMeasures.foo).toHaveProperty('startTime');
  });

  test('stop measure', () => {
    ch.startMeasure('foo');
    expect(ch.stopMeasure('foo')).toBe(true);
    ch.setDebugMode(true);
    expect(ch._storedMeasures).toHaveProperty('foo');
    expect(ch._storedMeasures.foo).toHaveProperty('name');
    expect(ch._storedMeasures.foo).toHaveProperty('duration');
    expect(ch._storedMeasures.foo).toHaveProperty('startTime');
  });
});

describe('User Timing API Supported', () => {
  beforeEach(() => {
    ch = chronos({ performance });
    ch.setDebugMode(false);
  });

  test('start measure', () => {
    expect(ch.startMeasure('foo')).toBe(true);
    expect(performance.mark).toHaveBeenCalledTimes(1);
  });

  test('stop measure', () => {
    expect(ch.stopMeasure('foo')).toBe(true);
    expect(performance.mark).toHaveBeenCalledTimes(1);
    ch.setDebugMode(true);
    expect(ch._storedMeasures).toContain('foo');
  });
});

describe('processing and save', () => {
  beforeEach(() => {
    ch = chronos({});
  });

  test("should throw an error if it's missing a storing method", () => {
    expect(ch.saveToStore).toThrow();
  });
});

describe('processing and save | Timing', () => {
  test('it should store on stop if a store is set', () => {
    ch.saveToStore = jest.fn();
    ch = chronos({
      performance,
      store: jest.fn(),
    });
    expect(ch.startMeasure('foo')).toBe(true);
    expect(ch.stopMeasure('foo')).toBe(true);
    expect(ch.saveToStore).toHaveBeenCalledTimes(1);
  });

  test('it should store all the measures');
});

describe('processing and save | Now', () => {
  test('it should store on stop');
  test('it should store all the measures');
});

describe('Measure from Timing events', () => {
  test('should fail if the Timing event is missing');
  test('should measure from an existing timing event');
  test('should measure from navigationStart');
  test('on autosave it should try to store the measures on stop');
});

describe('Global Extra Data', () => {
  const data = { tags: ['bar:bar'] };

  beforeEach(() => {
    ch = chronos({
      performance,
      data,
      debug: true,
    });
  });

  test('should be possible to provide global extraData on setup', () => {
    expect(ch._extraData.global).toBe(data);
  });

  test('global and measure specific Array data should be merged together', () => {
    ch.startMeasure(
      'foo',
      {
        tags: ['bar:foobar'],
        foo: 'foo',
      },
    );
    expect(ch._extraData.foo).toMatchObject({
      tags: ['bar:foobar', 'bar:bar'],
      foo: 'foo',
    });
  });

  test('merged arrays should not have duplicates', () => {
    ch.startMeasure(
      'foo',
      {
        tags: ['bar:foobar', 'foo:bar', 'bar:bar'],
      },
    );
    expect(ch._extraData.foo).toMatchObject({
      tags: ['bar:foobar', 'foo:bar', 'bar:bar'],
    });
  });

  test('global extraData should not be mudated when mergin extraData', () => {
    ch.startMeasure(
      'foo',
      {
        tags: ['bar:foobar', 'foo:bar'],
      },
    );
    expect(ch._extraData.global).toMatchObject({
      tags: ['bar:bar'],
    });
  });
});
