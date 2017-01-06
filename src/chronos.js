/* globals _ window */

import Immutable from 'immutable';

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

let runningMeasures = Immutable.List();
let measureTargetDurations = Immutable.Map(); // the optional expected duration of a measure
let storedMeasures = Immutable.List();
// stopMetric will deal with Now measures in a different way compared to Timing measures
if (!SUPPORTS_TIMING) storedMeasures = Immutable.Map();
// this is the method used to save the store must be set with chronos.setStoreMethod
let storingMethod;
let _isRequestIdleCallbackScheduled = false;

const chronos = {
  getRunningMetrics() {
    return runningMeasures.toArray();
  },

  /**
   * Start a new measure with the provided name
   * @param  name String
   * @param  targetDuration Float, this is an optional parameter
   /*        useful to understand how the measure is performing
   */
  startMetric(name, targetDuration = false) {
    if (!SUPPORTS_NOW) return false; // Silently fail if high resolution timing is not supported
    if (runningMeasures.includes(name)) throw new Error(`metric ${name} is already running`);
    runningMeasures = runningMeasures.push(name);
    if (targetDuration) {
      measureTargetDurations = measureTargetDurations.set(name, targetDuration);
    }

    if (SUPPORTS_TIMING) {
      window.performance.mark(`${name}_start`);
      return true;
    }

    // fallback if User Timing API is not supported
    const startTime = window.performance.now();
    storedMeasures = storedMeasures.set(name, Immutable.fromJS({
      name,
      startTime
    }));


    return true;
  },

  /**
   * Stop a running measure with the provided name
   * @param  {string} name
   */
  stopMetric(name) {
    if (!SUPPORTS_NOW) return false; // Silently fail if high resolution timing is not supported
    const metricIndex = runningMeasures.indexOf(name);
    if (metricIndex === -1) throw new Error(`metric ${name} is not running`);
    runningMeasures = runningMeasures.remove(metricIndex);

    if (SUPPORTS_TIMING) {
      storedMeasures = storedMeasures.push(name);
      window.performance.mark(`${name}_end`);
      return true;
    }

    // fallback if User Timing API is not supported
    const endTime = window.performance.now();
    storedMeasures = storedMeasures.update(name, (m) => {
      const duration = endTime - m.get('startTime');
      const targetDuration = measureTargetDurations.get(name);
      m = m.set('duration', duration);
      if (targetDuration) m = m.set('target_duration', targetDuration);
      return m;
    });

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
function _popCompletedMetricName () {
  var measure = storedMeasures.last();
  if (typeof storedMeasures.pop !== 'undefined') {
    storedMeasures = storedMeasures.pop();
  } else {
    storedMeasures = storedMeasures.remove(measure.get('name'));
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
    m = _.omit(m.toJSON(), 'entryType');
    const targetDuration = measureTargetDurations.get(m.name);
    if (targetDuration) m.target_duration = targetDuration;
    _store(m);
  };

  while (deadline.timeRemaining() > 0 && storedMeasures.size > 0) {
    const metricName = _popCompletedMetricName();
    window.performance.measure(metricName, `${metricName}_start`, `${metricName}_end`);
    const metrics = window.performance.getEntriesByName(metricName);
    metrics.forEach(prepareTimingMeasure);
  }

  window.performance.clearMeasures();
  if (storedMeasures.size > 0) {
    _processAndSendMetrics();
  } else {
    window.performance.clearMarks();
  }
}

// Process manually created measures and send those over to Buffer Metrics
function _processAndSendMeasures (deadline) {
  _isRequestIdleCallbackScheduled = false;

  while (deadline.timeRemaining() > 0 && storedMeasures.size > 0) {
    const measure = _popCompletedMetricName();
    if (measure) _store(measure.toJSON());
  }

  window.performance.clearMeasures();
  if (storedMeasures.size > 0) {
    _processAndSendMetrics();
  } else {
    storedMeasures = storedMeasures.clear();
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
