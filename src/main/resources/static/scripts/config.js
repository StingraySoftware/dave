
// General config file:
CONFIG = {
  DOMAIN_URL: "http://localhost:5000", //Set as Dave Server Ip:Port
  IS_LOCAL_SERVER: true, //If false server considers running as remote server (diferent machine that Dave GUI client), remote server is not fully tested.
  INITIAL_VISIBLE_PLOTS: 1,
  MIN_PLOT_POINTS: 2,
  MAX_PLOT_POINTS: 1000,
  AUTO_BINSIZE: true, //If AUTO_BINSIZE is enabled, then the binSize will be automatically calculated to avoid exceding MAX_PLOT_POINTS, else the time filter will have a maxTimeRange to avoid exeding the MAX_PLOT_POINTS
  MIN_SEGMENT_MULTIPLIER: 1,
  TIMERANGE_MULTIPLIER: 0.95,
  DEFAULT_SEGMENT_DIVIDER: 4,
  PLOT_ENABLE_HOVER_TIMEOUT: 1000,
  PLOT_TRIGGER_HOVER_TIMEOUT: 250,
  INMEDIATE_TIMEOUT: 25,
  EXCLUDED_FILTERS: [ "HEADER", "HEADER_COMMENTS", "E", "PI" ],
  ENERGY_FILTER_STEP: 0.005, // Stepping value for energy filters in keV (default: 5eV)
  BULK_ANALYSIS_ENABLED: false,
  LOG_TO_SERVER_ENABLED: true, //If true, python server logs will be visible from GUI Log tab
  LOG_LEVEL: -1, // PYTHON SERVER LOG LEVEL -> ALL = -1, DEBUG = 0, INFO = 1, WARN = 2, ERROR = 3, NONE = 4
  DENY_BCK_IF_SUBS: true, //Avoid set background file if lightcurve bck data is already substracted
  MAX_TIME_RESOLUTION_DECIMALS: 5, //Defines the maximun time resolution of DAVE GUI, default 100ns
  DEFAULT_NUMBER_DECIMALS: 3, //The default number precision on selectors and textboxes
  BIN_SELECTOR_LOG_SCALE_STEPS: 1000,
  BIN_SELECTOR_LOG_SCALE_POWER: 4,
  TIME_COLUMN: 'TIME', //Represents the Time column name
  GTI_STRING: 'GTI,STDGTI,STDGTI04,STDGTI04-1,SRC_GTIS,BKG_GTIS', //Supported GTI HDU names
  FRACEXP_LIMIT: 0.5, // Minimum exposure fraction allowed

  PLOT_CONFIG: {

    DEFAULT_TITLE_FONT: {
                          family: 'Arial',
                          size: 15,
                          color: '#3d3d3d'
                        },

    SUPPORTED_FONTS : ['Arial', 'Arial Black', 'Comic Sans MS',
                        'Courier New', 'Georgia', 'Impact',
                        'Lucida Console', 'Lucida Sans Unicode', 'Palatino Linotype',
                        'Tahoma', 'Times New Roman', 'Trebuchet MS',
                        'Verdana', 'MS Sans Serif', 'MS Serif'],

    DEFAULT_MARGINS: { b: 38, r: 8, l: 56, t: 38 },

    DEFAULT_LINE_WIDTH: { default: 2, min: 1, max: 9 },
    DEFAULT_MARKER_SIZE: { default: 6, min: 1, max: 20 },
    DEFAULT_MARKER_TYPE: 'circle',
    DEFAULT_MARKER_OPACITY: 0.8,

    DEFAULT_PLOT_COLOR: '#1f77b4',
    EXTRA_DATA_COLOR: '#888888',
    ERROR_BAR_COLOR: 'rgba(30, 117, 179, 0.2)',

    WTI_FILLCOLOR: '#dd4814',
    WTI_OPACITY: 0.1,

    CONFIDENCE_FILLCOLOR: '#265a88',
    CONFIDENCE_OPACITY: 0.2,

    ANNOTATION_ARROWHEAD: 7,

    DEFAULT_COLORSCALE: { x0: 0.5, y0: 0.5, m: 0.25, color1: "#0000FF", color2: "#FF0000", numColors: 10 },

    COMBINED_MDL_COLOR: '#FF0000',
    BASELINE_COLOR: '#DD3333',
    CANDIDATE_FREQ_COLOR: '#DD3333',
    AGN_COLORS: ['#20b378', '#6fb320', '#cc8d10', '#cc2610', '#cc10a6']
  }
}
