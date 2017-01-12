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

const runningMeasures = {};
const measureTargetDurations = {}; // stores optional expected durations
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
    if (!SUPPORTS_NOW) return false; // Silently fail if high resolution timing is not supported
    runningMeasures[name] = name;
    if (targetDuration) {
      measureTargetDurations[name] = targetDuration;
    }

    if (SUPPORTS_TIMING) {
      window.performance.mark(`${name}_start`);
      return true;
    }

    // fallback if User Timing API is not supported
    const startTime = window.performance.now();
    storedMeasures[name] = { name, startTime };

    return true;
  },

  /**
   * Stop a running measure with the provided name
   * @param  {string} name
   */
  stopMeasure(name) {
    if (!SUPPORTS_NOW) return false; // Silently fail if high resolution timing is not supported
    if (!runningMeasures[name]) return false; // To ease usage we do not throw an error in this case
    delete runningMeasures[name];

    if (SUPPORTS_TIMING) {
      storedMeasures.push(name);
      window.performance.mark(`${name}_end`);
      return true;
    }

    // fallback if User Timing API is not supported
    const endTime = window.performance.now();
    const targetDuration = measureTargetDurations[name] || false;
    const measure = storedMeasures[name];
    measure.duration = endTime - measure.startTime;
    if (targetDuration) measure.targetDuration = targetDuration;
    Object.assign(storedMeasures[name], measure);

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
  }
};

// some private methods
function _popCompletedMetric () {
  let measure;
  if (typeof storedMeasures.pop === 'function') {
    measure = storedMeasures.pop();
  } else {
    const key = Object.keys(storedMeasures).pop();
    measure = storedMeasures[key];
    delete storedMeasures[key];
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

  const prepareTimingMeasure = (m) => {
    // No need to store the entryType
    const measure = {
      name: m.name,
      start_time: m.startTime,
      duration: m.duration,
    };
    const targetDuration = measureTargetDurations[m.name];
    if (targetDuration) measure.target_duration = targetDuration;
    _store(measure);
  };

  while (deadline.timeRemaining() > 0 && storedMeasures.length > 0) {
    const metricName = _popCompletedMetric();
    window.performance.measure(metricName, `${metricName}_start`, `${metricName}_end`);
    const metrics = window.performance.getEntriesByName(metricName);
    metrics.forEach(prepareTimingMeasure);
  }

  window.performance.clearMeasures();
  if (storedMeasures.length === 0) {
    _processAndSendMetrics();
  } else {
    window.performance.clearMarks();
  }
}

// Process manually created measures and send those over to Buffer Metrics
function _processAndSendMeasures (deadline) {
  _isRequestIdleCallbackScheduled = false;

  while (deadline.timeRemaining() > 0 && Object.keys(storedMeasures).length > 0) {
    const measure = _popCompletedMetric();
    if (measure) _store({
      name: measure.name,
      start_time: measure.startTime,
      duration: measure.duration,
      target_duration: measure.targetDuration
    });
  }

  window.performance.clearMeasures();
  if (Object.keys(storedMeasures).length > 0) {
    _processAndSendMetrics();
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
