import chronos from '../src/chronos'

let performance = {}
let runningMeasures = []
let ch
let mockPerfMark = jest.fn().mockImplementation( name => {
  runningMeasures.push(name)
  return undefined
})

let mockPerfNow = jest.fn().mockImplementation( () => {
  return Date.now()
})

beforeEach(() => {
  performance = {
    timing: {
      navigationStart: Date.now()
    }
  }

  performance.mark = mockPerfMark
  performance.now = mockPerfNow
})

describe('High Resolution Time Unsupported', () => {
  beforeEach(() => {
    performance.now = undefined
    ch = chronos({
      performance,
      autosave: false
    })
  })

  test('start measure | should fail if high resolution timing is not supported', () => {
    expect(ch.startMeasure("foo")).toBe(false)
  })
  test('stop measure')
  test('measure from special event')
})

describe('User Timing API Unsupported', () => {
  beforeEach(() => {
    performance.mark = undefined
  })
  test('start measure | should fallback if User Timing API isn\'t supported')
  test('measure from special event')
  test('stop measure')
})

describe('User Timing API Supported', () => {
  test('start measure | should use User Timing API if it\'s suported')
  test('start measure from special event')
  test('stop measure')
})


describe('processing and save', () => {
  test('save | should throw an error if it\s missing a storing method')
  test('stop measure | on autosave it should try to store the measures')
})
