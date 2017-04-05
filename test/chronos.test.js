/* globals jest describe test beforeEach expect */

import chronos from '../src/chronos'

let performance = {}
let ch

beforeEach(() => {
  performance = {
    now: jest.fn().mockImplementation( () => {
      return Date.now()
    }),
    mark: jest.fn().mockImplementation( name => {
      return true
    }),
    measure: jest.fn().mockImplementation( ({ name, start, end }) => {
      return true
    }),
    getEntriesByName: jest.fn().mockImplementation( name => {
      return [{
        duration: 4392.679999999702,
        entryType: 'measure',
        name: name,
        startTime: 8396525.785
      }]
    }),
    clearMeasures: jest.fn(),
    clearMarks: jest.fn(),
    timing: {
      navigationStart: Date.now()
    }
  }
})

describe('High Resolution Time Unsupported', () => {
  beforeEach(() => {
    performance.now = undefined
    ch = chronos({
      performance,
    })
    ch.setDebugMode(false)
  })

  test('start measure | should fail', () => {
    expect(ch.startMeasure('foo')).toBe(false)
  })

  test('measure from Navigation Start | should fail', () => {
    expect(ch.measureFromNavigationStart('foo')).toBe(false)
  })

  test('measure from special event | should fail', () => {
    expect(ch.measureFromSpecialEvent('foo', 'navigationStart')).toBe(false)
  })

  test('stop measure | should fail', () => {
    expect(ch.stopMeasure('foo')).toBe(false)
  })
})

describe('start measure', () => {
  beforeEach(() => {
    performance.mark = undefined
    ch = chronos({
      performance,
    })
    ch.setDebugMode(false)
  })

  test('starting multiple measures with the same name should override the previos one', () => {
    expect(ch.startMeasure('foo')).toBe(true)
    expect(ch.startMeasure('foo')).toBe(true)
    expect(performance.now).toHaveBeenCalledTimes(2)
    ch.setDebugMode(true)
    expect(ch._runningMeasures).toHaveProperty('foo')
  })

})

describe('User Timing API Unsupported', () => {
  beforeEach(() => {
    performance.mark = undefined
    ch = chronos({
      performance,
    })
    ch.setDebugMode(false)
  })
  
  test('start measure', () => {
    expect(ch.startMeasure('foo')).toBe(true)
    expect(performance.now).toHaveBeenCalledTimes(1)
    ch.setDebugMode(true)
    expect(ch._runningMeasures).toHaveProperty('foo')
    expect(ch._runningMeasures.foo).toHaveProperty('name', 'foo')
    expect(ch._runningMeasures.foo).toHaveProperty('startTime')
  })

  test('stop measure', () => {
    ch.startMeasure('foo')
    expect(ch.stopMeasure('foo')).toBe(true)
    ch.setDebugMode(true)
    expect(ch._storedMeasures).toHaveProperty('foo')
    expect(ch._storedMeasures['foo']).toHaveProperty('name')
    expect(ch._storedMeasures['foo']).toHaveProperty('duration')
    expect(ch._storedMeasures['foo']).toHaveProperty('startTime')
  })
})

describe('User Timing API Supported', () => {
  beforeEach(() => {
    ch = chronos({ performance })
    ch.setDebugMode(false)
  })

  test('start measure', () => {
    expect(ch.startMeasure('foo')).toBe(true)
    expect(performance.mark).toHaveBeenCalledTimes(1)
  })

  test('stop measure', () => {
    expect(ch.stopMeasure('foo')).toBe(true)
    expect(performance.mark).toHaveBeenCalledTimes(1)
    ch.setDebugMode(true)
    expect(ch._storedMeasures).toContain('foo')
  })
})

describe('processing and save', () => {
  beforeEach(() => {
    ch = chronos({})
  })
  
  test("should throw an error if it's missing a storing method", () => {
    expect(ch.saveToStore).toThrow()
  })
})

describe('processing and save | Timing', () => {
  test('it should store on stop if a store is set', () => {
    ch.saveToStore = jest.fn()
    ch = chronos({
      performance,
      store: jest.fn()
    })
    expect(ch.startMeasure('foo')).toBe(true)
    expect(ch.stopMeasure('foo')).toBe(true)
    expect(ch.saveToStore).toHaveBeenCalledTimes(1)
  })

  test('it should store all the measures')
})

describe('processing and save | Now', () => {
  test('it should store on stop')
  test('it should store all the measures')
})

describe('Measure from Timing events', () => {
  test('should fail if the Timing event is missing')
  test('should measure from an existing timing event')
  test('should measure from navigationStart')
  test('on autosave it should try to store the measures on stop')
})

describe('Extra Data | Global', () => {
  test('extraData provide on start method should deeply merge with teh global one')
})

describe('Global Extra Data', () => {
  const extraData = { tags: ['foo:bar'] }

  beforeEach(() => {
    ch = chronos({
      performance,
      extraData,
      debug: true
    })
  })

  test('should be possible to provide global extraData on setup', () => {
    expect(ch._extraData.global).toBe(extraData)
  })
  test('global and measure specific Array extraData shoould be merged together', () => {
    ch.startMeasure({
      name: 'foo',
      data: {
        tags: ['bar:foobar'],
        foo: 'foo'
      }
    })
    expect(ch._extraData.foo).toMatchObject({
      tags: ['foo:bar', 'bar:foobar'],
      foo: 'foo'
    })
  })
})
