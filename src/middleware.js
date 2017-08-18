import chronos from './chronos';

export const actionTypes = {
  PERFORMANCE_START_MEASURE: 'PERFORMANCE_START_MEASURE',
  PERFORMANCE_STOP_MEASURE: 'PERFORMANCE_STOP_MEASURE',
  PERFORMANCE_MEASURE_FROM_EVENT: 'MEASURE_FROM_EVENT',
  PERFORMANCE_MEASURE_FROM_NAVIGATION_START: 'MEASURE_FROM_NAVIGATION_START',
};

export const actions = {
  startMeasure: ({ name, data }) => ({
    type: actionTypes.PERFORMANCE_START_MEASURE,
    measureName: name,
    measureData: data,
  }),
  measureFromSpecialEvent: ({ name, data }) => ({
    type: actionTypes.PERFORMANCE_MEASURE_FROM_EVENT,
    measureName: name,
    measureData: data,
  }),
  measureFromNavigationStart: ({ name, data }) => ({
    type: actionTypes.PERFORMANCE_MEASURE_FROM_NAVIGATION_START,
    measureName: name,
    measureData: data,
  }),
  stopMeasure: ({ name }) => ({
    type: actionTypes.PERFORMANCE_STOP_MEASURE,
    measureName: name,
  }),
};

export const middleware = (options = {}) => {
  if (!options.store) throw new Error('Undefined Chonos store');
  if (typeof options.store !== 'function') throw new Error('Chonos store should be a function');

  const thisChronos = chronos(options);

  /*
   * expetect action object should have the folowing parameters:
   * @param type String
   * @param measureName String
   * @param measureData Object
   */
  return store => next => (action) => {
    switch (action.type) {
      case actionTypes.PERFORMANCE_START_MEASURE:
        thisChronos.startMeasure(action.measureName, action.measureData);
        break;
      case actionTypes.PERFORMANCE_STOP_MEASURE:
        thisChronos.stopMeasure(action.measureName);
        break;
      case actionTypes.PERFORMANCE_MEASURE_FROM_EVENT:
        thisChronos.measureFromSpecialEvent(action.measureName, action.measureData);
        break;
      case actionTypes.PERFORMANCE_MEASURE_FROM_NAVIGATION_START:
        thisChronos.measureFromNavigationStart(action.measureName, action.measureData);
        break;
      default:
        break;
    }
    next(action);
  };
};

export default middleware;
