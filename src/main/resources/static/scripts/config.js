
// General config file:
CONFIG = {
  DOMAIN_URL: "http://localhost:5000", //Set as Dave Server Ip:Port
  IS_LOCAL_SERVER: true, //If false server considers running as remote server (diferent machine that Dave GUI client), remote server is not fully tested.
  INITIAL_VISIBLE_PLOTS: 1,
  MIN_PLOT_POINTS: 2,
  MAX_PLOT_POINTS: 1000,
  AUTO_BINSIZE: true, //If AUTO_BINSIZE is enabled, then the binSize will be automatically calculated to avoid exceding MAX_PLOT_POINTS, else the time filter will have a maxTimeRange to avoid exeding the MAX_PLOT_POINTS
  MIN_SEGMENT_MULTIPLIER: 6,
  DEFAULT_SEGMENT_DIVIDER: 4,
  PLOT_ENABLE_HOVER_TIMEOUT: 1000,
  PLOT_TRIGGER_HOVER_TIMEOUT: 250,
  INMEDIATE_TIMEOUT: 5,
  EXCLUDED_FILTERS: [ "HEADER", "HEADER_COMMENTS", "E", "PI" ],
  ENERGY_FILTER_STEP: 0.005,
  BULK_ANALYSIS_ENABLED: false,
  LOG_TO_SERVER_ENABLED: true, //If true, python server logs will be visible from GUI Log tab
  LOG_LEVEL: -1 // PYTHON SERVER LOG LEVEL -> ALL = -1, DEBUG = 0, INFO = 1, WARN = 2, ERROR = 3, NONE = 4
}
