
function ProjectConfig(){
  this.filename = "";
  this.filenames = [];
  this.bckFilename = "";
  this.bckFilenames = [];
  this.gtiFilename = "";
  this.gtiFilenames = [];
  this.rmfFilename = "";
  this.selectorFilenames = [];
  this.bulkFilename = "";
  this.bulkFilenames = [];

  this.binSize = 0;
  this.minBinSize = 0;
  this.maxBinSize = 0;

  this.avgSegmentSize = 0;
  this.maxSegmentSize = 0;

  this.timeUnit = "s";
  this.backgroundSubstracted = false;
  this.totalDuration = 0;
  this.eventCountRatio = 1.0;

  this.schema = null;
  this.plots = [];
  this.plotsIdsByKey = {};
  this.rmfData = [];

  this.hasSchema = function (schema) {
    return !isNull(this.schema);
  }

  this.setSchema = function (schema) {

    this.updateSchema(schema);

    // Sets the time unit
    this.timeUnit = this.schema.getTimeUnit();

    // Sets the background substracted value
    this.backgroundSubstracted = this.schema.getBackgroundSubstracted();

    // Sets the total duration
    this.totalDuration = this.schema.getTotalDuration();

    // Sets the time resolution
    this.minBinSize = this.schema.getTimeResolution();
    this.maxBinSize = this.totalDuration / CONFIG.MIN_PLOT_POINTS;
    this.binSize = this.minBinSize;

    // Sets the event count ratio
    this.eventCountRatio = Math.min ((CONFIG.MAX_PLOT_POINTS / this.schema.getEventsCount()), 1.0);

    //Sets the segment size for spectrums
    this.maxSegmentSize = this.schema.getMaxSegmentSize();
    this.avgSegmentSize = this.schema.getAvgSegmentSize();
  }

  this.updateSchema = function (schema) {
    this.schema = new Schema(schema);
  }

  this.setFiles = function (selectorKey, filenames, filename) {
    if (selectorKey == "SRC") {
      this.filenames = filenames;
      this.filename = filename;
    } else if (selectorKey == "BCK") {
      this.bckFilenames = filenames;
      this.bckFilename = filename;
    } else if (selectorKey == "GTI") {
      this.gtiFilenames = filenames;
      this.gtiFilename = filename;
    } else if (selectorKey == "RMF") {
      this.rmfFilename = filename;
    } else if (selectorKey == "BULK") {
      this.bulkFilenames = filenames;
      this.bulkFilename = filename;
    }
  }

  this.setFile = function (selectorKey, filename) {
    this.selectorFilenames[selectorKey] = filename;
  }

  this.getFile = function (selectorKey) {
    if (!isNull(this.selectorFilenames[selectorKey])) {
      return this.selectorFilenames[selectorKey];
    }
    return "";
  }

  this.updateFile = function (selectorKey) {
    if (selectorKey == "SRC") {
      this.setFile("SRC", this.filename);
    } else if (selectorKey == "BCK") {
      this.setFile("BCK", this.bckFilename);
    } else if (selectorKey == "GTI") {
      this.setFile("GTI", this.gtiFilename);
    } else if (selectorKey == "RMF") {
      this.setFile("RMF", this.rmfFilename);
    } else if (selectorKey == "BULK") {
      this.setFile("BULK", this.bulkFilename);
    }
  }

  this.setRmfData = function (rmfData) {
    this.rmfData = rmfData;
  }

  this.getEnergyForChannel = function (channel) {
    if (this.rmfData.length > 0
        && channel >= 0
        && channel < this.rmfData.length) {
          return this.rmfData[channel];
        }
    return -1;
  }

  this.getChannelFromEnergy = function (energy) {
    if (this.rmfData.length > 0) {
      for (i in this.rmfData) {
        var tmpEnergy = this.rmfData[i];
        if (tmpEnergy > energy){
          return i - 1; //Return prevChannel
        }
      }
      return this.rmfData.length - 1; //Return lastChannel
    }
    return -1;
  }

  this.binSizeCouldHaveAliasing = function () {
    return this.binSize != this.minBinSize && this.binSize < (this.minBinSize * 2.0);
  }

  this.setTimeRange = function (timeRange) {
    this.timeRange = timeRange;
    this.maxSegmentSize = timeRange * CONFIG.TIMERANGE_MULTIPLIER;
    this.avgSegmentSize = this.maxSegmentSize / CONFIG.DEFAULT_SEGMENT_DIVIDER;
  }

  this.getTimeRange = function () {
    if (!isNull(this.timeRange)) {
      return this.timeRange;
    } else {
      return this.totalDuration;
    }
  }

  this.getMaxTimeRange = function () {
    return this.totalDuration * this.binSize * this.eventCountRatio;
  }

  this.isMaxTimeRangeRatioFixed = function () {
    return this.eventCountRatio < 1.0;
  }

  this.getNumPoints = function () {
    return Math.ceil(this.getTimeRange() / this.binSize);
  }

  this.updateFromProjectConfigs = function (projectConfigs) {
    for (i in projectConfigs) {
      this.totalDuration = (this.totalDuration != 0) ? Math.min(this.totalDuration, projectConfigs[i].totalDuration) : projectConfigs[i].totalDuration;
      this.minBinSize = (this.minBinSize != 0) ? Math.max(this.minBinSize, projectConfigs[i].minBinSize) : projectConfigs[i].minBinSize;
      this.maxBinSize = (this.maxBinSize != 0) ? Math.max(this.maxBinSize, projectConfigs[i].maxBinSize) : projectConfigs[i].maxBinSize;
      this.binSize = (this.binSize != 0) ? Math.max(this.binSize, projectConfigs[i].binSize) : projectConfigs[i].binSize;
      this.avgSegmentSize = (this.avgSegmentSize != 0) ? Math.min(this.avgSegmentSize, projectConfigs[i].avgSegmentSize) : projectConfigs[i].avgSegmentSize;
      this.maxSegmentSize = (this.maxSegmentSize != 0) ? Math.min(this.maxSegmentSize, projectConfigs[i].maxSegmentSize) * 0.95 : projectConfigs[i].maxSegmentSize * 0.95;
    }

    this.binSize = Math.max(this.binSize, this.minBinSize);
  }

  this.addPlotId = function (plotId, key) {
    if (!isNull(key)) {
      if (isNull(this.plotsIdsByKey[key])){
        this.plotsIdsByKey[key] = [];
      }
      this.plotsIdsByKey[key].push(plotId);
    }
  }

  this.getPlotsIdsByKey = function (key) {
    if (!isNull(this.plotsIdsByKey[key])) {
      return this.plotsIdsByKey[key];
    }

    return [];
  }

  this.cleanPlotsIdsKey = function (key) {
    if (!isNull(this.plotsIdsByKey[key])) {
      this.plotsIdsByKey[key] = [];
    }
  }

  this.getChannelColumn = function () {
    if (this.hasSchema()){
      return this.schema.getChannelColumn();
    }
    return CONFIG.DEFAULT_CHANNEL_COLUMN;
  }

  this.getConfig = function () {
    var config = $.extend( {}, this );
    config.selectorFilenames = Object.assign({}, this.selectorFilenames);

    //Remove cache properties
    delete config.schema;
    delete config.plots;
    delete config.plotsIdsByKey;
    delete config.rmfData;

    //Removes all functions from config
    for(var k in config) if(config[k].constructor.toString().match(/^function Function\(/)) delete config[k];

    return config;
  }

  return this;
}
