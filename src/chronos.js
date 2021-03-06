/* globals window */

const ERROR_MISSING_STORE = 'Missing storing method';
// stores optionals data, this are passed down to the store as individual fields
const extraData = { global: {} };
const runningMeasureKeys = {};
const runningMeasures = {};

let performance;
let storingMethod;
let supportsNow;
let supportsTiming;
let navigationStart;
let supportPerformance = false;
let shouldAutoSave = true;
let isDebugMode = false;
// this is used to track measures that start from special markers (es. navigationStart)
const specialMeasures = {};
let storedMeasures = [];
// this is the method used to save the store must be set with chronos.setStoreMethod
let _isRequestIdleCallbackScheduled = false;

const chronos = {
  /*
   * Start a new measure with the provided name
   * @param  name String
   * @param  data Object, any additional data you whish to store with the measure
  */
  startMeasure (name, data) {
    if (isDebugMode) console.log(`Chronos startMeasure ${name}`);

    // Silently fail if high resolution timing is not supported
    if (!supportPerformance || !supportsNow) return false;
    runningMeasureKeys[name] = name;

    if (data) _storeExtraData(name, data);

    if (supportsTiming) {
      performance.mark(`${name}_start`);
      return true;
    }

    // fallback if User Timing API is not supported
    const startTime = performance.now();
    runningMeasures[name] = { name, startTime };

    return true;
  },

  /*
   * Create a new measure starting from an existing performance event
   * @param  name String
   * @param  eventName String
   * @param  data Object, any additional data you whish to store with the measure
  */
  measureFromSpecialEvent (name, eventName, data) {
    if (!eventName) return false;
    if (isDebugMode) console.log(`Chronos measureFromSpecialEvent ${name}`);
    // Silently fail if high resolution timing is not supported
    if (!supportPerformance || !supportsNow) return false;

    const startTime = performance.timing[eventName];
    if (!startTime) return false;
    const timeFromNavigationStart = startTime - navigationStart;
    const duration = performance.now() - timeFromNavigationStart;
    const measure = {
      duration,
      event_name: eventName,
      name,
      navigationStart,
      start_time: navigationStart - startTime,
    };
    specialMeasures[name] = measure;

    // store extra data
    if (data) _storeExtraData(name, data);

    if (shouldAutoSave) this.saveToStore();
    return true;
  },

  /*
   * Create a new measure starting from the NavigationStart event
   * @param  name String
   * @param  data Object, any additional data you whish to store with the measure
  */
  measureFromNavigationStart (name, data) {
    // Silently fail if high resolution timing is not supported
    if (!supportPerformance || !supportsNow) return false;

    if (isDebugMode) console.log(`Chronos measureFromNavigationStart ${name}`);
    this.measureFromSpecialEvent(
      name,
      'navigationStart',
      data,
    );

    return true;
  },

  /**
   * Stop a running measure with the provided name
   * @param  {string} name
   */
  stopMeasure (name) {
    // Silently fail if high resolution timing is not supported
    if (!supportPerformance || !supportsNow) return false;
    // To ease usage we do not throw an error in this case
    if (!runningMeasureKeys[name]) return false;
    delete runningMeasureKeys[name];

    if (isDebugMode) console.log(`Chronos stopMeasure ${name}`);
    if (supportsTiming) {
      storedMeasures.push(name);
      performance.mark(`${name}_end`);
      if (shouldAutoSave) this.saveToStore();
      return true;
    }

    // fallback if User Timing API is not supported
    const endTime = performance.now();
    const measure = runningMeasures[name];
    measure.duration = endTime - measure.startTime;
    storedMeasures[name] = measure;

    if (shouldAutoSave) this.saveToStore();
    return true;
  },

  // send all metrics to the provided store
  saveToStore () {
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
  setDebugMode (status) {
    isDebugMode = status;
    if (isDebugMode) {
      this._runningMeasureKeys = runningMeasureKeys;
      this._runningMeasures = runningMeasures;
      this._specialMeasures = specialMeasures;
      this._storedMeasures = storedMeasures;
      this._extraData = extraData;
    } else {
      delete this._runningMeasureKeys;
      delete this._runningMeasures;
      delete this._specialMeasures;
      delete this._storedMeasures;
      delete this._extraData;
    }
  },
};

function _storeExtraData (name, data) {
  const measureData = {};

  const keys = Object.keys(data);
  keys.forEach((key) => {
    let value = data[key];

    if (typeof value.push === 'function' && extraData.global[key]) {
      value = value.concat(extraData.global[key]);
      // remove duplicates
      const cleanValues = [];
      const hash = {};
      value.forEach((v) => { if (!hash[v]) hash[v] = v; });
      for (const v in hash) { cleanValues.push(v); }
      value = cleanValues;
    }

    measureData[key] = value;
  });

  extraData[name] = measureData;
}

function _popFromObject (obj) {
  const key = Object.keys(obj).pop();
  const measure = obj[key];
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

function _store (data) {
  if (typeof storingMethod === 'function') {
    storingMethod(data);
  } else {
    throw new Error(ERROR_MISSING_STORE);
  }
}

// Process User Timing metrics and send those over to the given store
function _processAndSendTimingMeasures (deadline) {
  _isRequestIdleCallbackScheduled = false;

  const storeTimingMeasure = (m) => {
    // No need to store the entryType
    let measure = {
      duration: m.duration,
      name: m.name,
      navigationStart,
      start_time: m.startTime,
    };
    const data = extraData[measure.name];
    if (data) {
      measure = Object.assign(measure, data);
      delete extraData[measure.name];
    }
    if (isDebugMode) console.log(`Chronos StoreTimingMeasure ${m.name}`);
    _store(measure);
  };

  while (deadline.timeRemaining() > 0 && storedMeasures.length > 0) {
    const metricName = _popCompletedMetric();
    performance.measure(metricName, `${metricName}_start`, `${metricName}_end`);
    const metrics = performance.getEntriesByName(metricName);
    metrics.forEach(storeTimingMeasure);
  }

  _processAndSendSpecialMeasures(deadline);

  if (storedMeasures.length > 0 || Object.keys(specialMeasures).length > 0) {
    _processAndSendMetrics();
  } else if (Object.keys(runningMeasureKeys).length === 0 && storedMeasures.length === 0) {
    if (isDebugMode) console.log(`Chronos cleanup marks and measures`);
    performance.clearMarks();
    performance.clearMeasures();
  }
}

// Process manually created measures and send those over to the given store
function _processAndSendMeasures (deadline) {
  _isRequestIdleCallbackScheduled = false;

  while (deadline.timeRemaining() > 0 && Object.keys(storedMeasures).length > 0) {
    const measureData = _popCompletedMetric();
    let measure = {
      duration: measureData.duration,
      name: measureData.name,
      navigationStart,
      start_time: measureData.startTime,
    };
    const data = extraData[measure.name];
    if (data) {
      measure = Object.assign(measure, data);
      delete extraData[measure.name];
    }
    if (isDebugMode) console.log(`Chronos StoreMeasure ${measure.name}`);
    _store(measure);
  }

  _processAndSendSpecialMeasures(deadline);

  if (Object.keys(storedMeasures).length > 0 || Object.keys(specialMeasures).length > 0) {
    _processAndSendMetrics();
  }
}

// Process special measure, ex measureFromNavigationStart
function _processAndSendSpecialMeasures (deadline) {
  while (deadline.timeRemaining() > 0 && Object.keys(specialMeasures).length > 0) {
    let measure = _popFromObject(specialMeasures);
    const data = extraData[measure.name];
    if (data) {
      measure = Object.assign(measure, data);
      delete extraData[measure.name];
    }
    if (isDebugMode) console.log(`Chronos StoreSpecialMeasure ${measure.name}`);
    _store(measure);
  }
}

function _processAndSendMetrics () {
  if (_isRequestIdleCallbackScheduled) return;
  _isRequestIdleCallbackScheduled = true;

  if (supportsTiming) {
    window.requestIdleCallback(_processAndSendTimingMeasures, { timeout: 2000 });
  } else {
    window.requestIdleCallback(_processAndSendMeasures, { timeout: 2000 });
  }
}
/**
 * _setup
 * @param  {boolean} autoSave
 * @param  {boolean} debug
 * @param  {function} store
 * @param  {object} data
 * @param  {object} performance
 */
function _setup (options = {}) {
  storingMethod = options.store;
  isDebugMode = options.debug || false;
  shouldAutoSave = options.autoSave || Boolean(typeof storingMethod !== 'undefined');
  performance = options.performance || window.performance;

  supportPerformance = typeof performance !== 'undefined';
  supportsNow = Boolean(performance && performance.now);
  supportsTiming = Boolean(supportsNow && performance.mark);

  navigationStart = 0;
  if (supportPerformance && performance.timing) {
    navigationStart = performance.timing.navigationStart;
  }
  // stopMetric will deal with Now measures in a different way compared to Timing measures
  storedMeasures = !supportsTiming ? {} : [];

  if (options.data) extraData.global = options.data;
  chronos.setDebugMode(isDebugMode);
}

export default (options) => {
  _setup(options);
  return chronos;
};
