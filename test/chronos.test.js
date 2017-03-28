import chronos from '../src/chronos'

let performance = {}
let ch

beforeEach(() => {
  performance = {
    mark() { return true },
    now() { return true },
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
      autosave: false
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

describe('User Timing API Unsupported', () => {
  beforeEach(() => {
    performance.mark = undefined
    ch = chronos({
      performance,
      autosave: false
    })
    ch.setDebugMode(false)

    performance.now = jest.fn().mockImplementation( () => {
      return Date.now()
    })
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
    performance.mark = jest.fn().mockImplementation( name => {
      return true
    })
    ch = chronos({
      performance,
      autosave: false
    })
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


describe('processing and save | with Timing', () => {
  test("should throw an error if it's missing a storing method")
  test('on autosave it should try to store the measures on stop')
  test('it should store all the measures')
})

describe('processing and save | with Now', () => {
  test("should throw an error if it's missing a storing method")
  test('on autosave it should try to store the measures on stop')
  test('it should store all the measures')
})

describe('Measure from Timing events', () => {
  test('should fail if the Timing event is missing')
  test('should measure from an existing timing event')
  test('should measure from navigationStart')
  test('on autosave it should try to store the measures on stop')
})
