/* globals window */

// Shim requestIdleCallback [source](https://developers.google.com/web/updates/2015/08/using-requestidlecallback)
window.requestIdleCallback =
  window.requestIdleCallback ||
  function (cb) {
    var start = Date.now();
    return setTimeout(() => {
      cb({
        didTimeout: false,
        timeRemaining() {
          return Math.max(0, 50 - (Date.now() - start));
        }
      });
    }, 1);
  };

window.cancelIdleCallback =
  window.cancelIdleCallback ||
  function (id) {
    clearTimeout(id);
  };

const ERROR_MISSING_STORE = 'Missing storing method';
const SUPPORTS_NOW = window.performance && window.performance.now;
const SUPPORTS_TIMING = window.performance && window.performance.mark;
const NAVIGATION_START = window.performance.timing.navigationStart;

const runningMeasureKeys = {};
const runningMeasures = {};
const measureTargetDurations = {}; // stores optional expected durations
let isDebugMode = false;
let specialMeasures = {}; // thisis used to track measures that start from special markers (es. navigationStart)
let storedMeasures = [];
// stopMetric will deal with Now measures in a different way compared to Timing measures
if (!SUPPORTS_TIMING) storedMeasures = {};
// this is the method used to save the store must be set with chronos.setStoreMethod
let storingMethod;
let _isRequestIdleCallbackScheduled = false;

const chronos = {
  /**
   * Start a new measure with the provided name
   * @param  name String
   * @param  targetDuration Float, this is an optional parameter
   /*        useful to understand how the measure is performing
   */
  startMeasure(name, targetDuration = false) {
    if (isDebugMode) console.log(`Chronos startMeasure ${name}`);

    if (!SUPPORTS_NOW) return false; // Silently fail if high resolution timing is not supported
    runningMeasureKeys[name] = name;
    if (targetDuration) {
      measureTargetDurations[name] = targetDuration;
    }

    if (SUPPORTS_TIMING) {
      window.performance.mark(`${name}_start`);
      return true;
    }

    // fallback if User Timing API is not supported
    const startTime = window.performance.now();
    runningMeasures[name] = { name, startTime };

    return true;
  },

  /**
   * Create a new measure starting from an existing performance event
   * @param  name String
   * @param  eventName String
   * @param  targetDuration Float, this is an optional parameter
   /*        useful to understand how the measure is performing
   */
  measureFromSpecialEvent(name, eventName, targetDuration = false) {
    if (!eventName) return false;
    if (isDebugMode) console.log(`Chronos measureFromSpecialEvent ${name}`);
    if (!SUPPORTS_NOW) return false; // Silently fail if high resolution timing is not supported
    
    const startTime = window.performance.timing[eventName];
    if (!startTime) return false;
    const timeFromNavigationStart = startTime - NAVIGATION_START;
    const duration = window.performance.now() - timeFromNavigationStart;
    const measure = { 
      duration,
      event_name: eventName,
      name,
      navigation_start: NAVIGATION_START,
      start_time: NAVIGATION_START - startTime
    };
    if (targetDuration) measure.target_duration = targetDuration;
    specialMeasures[name] = measure;

    return true;
  },

  /**
   * Create a new measure starting from the NavigationStart event
   * @param  name String
   * @param  targetDuration Float, this is an optional parameter
   /*        useful to understand how the measure is performing
   */
  measureFromNavigationStart(name, targetDuration = false) {
    if (!SUPPORTS_NOW) return false; // Silently fail if high resolution timing is not supported
    
    if (isDebugMode) console.log(`Chronos measureFromNavigationStart ${name}`);
    this.measureFromSpecialEvent(name, 'navigationStart', targetDuration);
    
    return true;
  },

  /**
   * Stop a running measure with the provided name
   * @param  {string} name
   */
  stopMeasure(name) {
    if (!SUPPORTS_NOW) return false; // Silently fail if high resolution timing is not supported
    if (!runningMeasureKeys[name]) return false; // To ease usage we do not throw an error in this case
    delete runningMeasureKeys[name];

    if (isDebugMode) console.log(`Chronos stopMeasure ${name}`);
    if (SUPPORTS_TIMING) {
      storedMeasures.push(name);
      window.performance.mark(`${name}_end`);
      return true;
    }

    // fallback if User Timing API is not supported
    const endTime = window.performance.now();
    const targetDuration = measureTargetDurations[name] || false;
    const measure = runningMeasures[name];
    measure.duration = endTime - measure.startTime;
    if (targetDuration) measure.targetDuration = targetDuration;
    storedMeasures[name] = measure;

    return true;
  },

  /**
   * Setup the Store to save measures into
   * @param  {function} method
   */
  setStoreMethod(method) {
    storingMethod = method;
  },

  // send all metrics to the provided store
  saveToStore() {
    // as this process will delete data when saving it to a store
    // we interup it at this stage to avoid losing data if a strore isn't set
    if (typeof storingMethod === 'function') {
      _processAndSendMetrics();
    } else {
      throw new Error(ERROR_MISSING_STORE);
    }
  },

  /**
   * set Debug mode
   * @param  {boolean} status
   */
  setDebugMode(status) {
    isDebugMode = status;
    if (isDebugMode) {
      this._runningMeasureKeys = runningMeasureKeys;
      this._runningMeasures = runningMeasures;
      this._specialMeasures = specialMeasures;
      this._storedMeasures = storedMeasures;
    } else {
      delete this._runningMeasureKeys;
      delete this._runningMeasures;
      delete this._specialMeasures;
      delete this._storedMeasures;
    }
  }
};

function _popFromObject (obj) {
    const key = Object.keys(obj).pop();
    let measure = obj[key];
    delete obj[key];
    return measure;
}

// some private methods
function _popCompletedMetric () {
  let measure;
  if (typeof storedMeasures.pop === 'function') {
    measure = storedMeasures.pop();
  } else {
    measure = _popFromObject(storedMeasures);
  }
  return measure;
}

function _store(data) {
  if (typeof storingMethod === 'function') {
    storingMethod(data);
  } else {
    throw new Error(ERROR_MISSING_STORE);
  }
}

// Process User Timing metrics and send those over to Buffer Metrics
function _processAndSendTimingMeasures (deadline) {
  _isRequestIdleCallbackScheduled = false;

  const storeTimingMeasure = (m) => {
    // No need to store the entryType
    const measure = {
      duration: m.duration,
      name: m.name,
      navigation_start: NAVIGATION_START,
      start_time: m.startTime
    };
    const targetDuration = measureTargetDurations[m.name];
    if (targetDuration) measure.target_duration = targetDuration;
    if (isDebugMode) console.log(`Chronos StoreTimingMeasure ${m.name}`);
    _store(measure);
  };

  while (deadline.timeRemaining() > 0 && storedMeasures.length > 0) {
    const metricName = _popCompletedMetric();
    window.performance.measure(metricName, `${metricName}_start`, `${metricName}_end`);
    const metrics = window.performance.getEntriesByName(metricName);
    metrics.forEach(storeTimingMeasure);
  }

  _processAndSendSpecialMeasures(deadline);

  if (storedMeasures.length > 0 ||  Object.keys(specialMeasures).length > 0) {
    _processAndSendMetrics();
  } else if(Object.keys(runningMeasureKeys).length === 0 && storedMeasures.length === 0) {
    if (isDebugMode) console.log(`Chronos cleanup marks and measures`);
    window.performance.clearMarks();
    window.performance.clearMeasures();
  }
}

// Process manually created measures and send those over to Buffer Metrics
function _processAndSendMeasures (deadline) {
  _isRequestIdleCallbackScheduled = false;

  while (deadline.timeRemaining() > 0 && Object.keys(storedMeasures).length > 0) {
    const measure = _popCompletedMetric();
    if (measure) _store({
      duration: measure.duration,
      name: measure.name,
      navigation_start: NAVIGATION_START,
      start_time: measure.startTime,
      target_duration: measure.targetDuration
    });
    if (isDebugMode) console.log(`Chronos StoreMeasure ${measure.name}`);
  }

  _processAndSendSpecialMeasures(deadline);

  if (Object.keys(storedMeasures).length > 0 ||  Object.keys(specialMeasures).length > 0) {
    _processAndSendMetrics();
  }
}

// Process special measure, ex measureFromNavigationStart
function _processAndSendSpecialMeasures (deadline) {
  while (deadline.timeRemaining() > 0 && Object.keys(specialMeasures).length > 0) {
    let measure = _popFromObject(specialMeasures);
    if (isDebugMode) console.log(`Chronos StoreSpecialMeasure ${measure.name}`);
    _store(measure);
  }

}

function _processAndSendMetrics () {
  if (_isRequestIdleCallbackScheduled) return;
  _isRequestIdleCallbackScheduled = true;

  if (SUPPORTS_TIMING) {
    window.requestIdleCallback(_processAndSendTimingMeasures, { timeout: 2000 });
  } else {
    window.requestIdleCallback(_processAndSendMeasures, { timeout: 2000 });
  }
}

export default chronos;
