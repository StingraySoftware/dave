
function ProjectConfig(){
  this.filename = "";
  this.filenames = [];
  this.schema = null;
  this.bckFilename = "";
  this.bckFilenames = [];
  this.gtiFilename = "";
  this.gtiFilenames = [];
  this.rmfFilename = "";
  this.selectorFilenames = [];
  this.binSize = 100;
  this.timeUnit = "s";
  this.plots = [];

  this.hasSchema = function (schema) {
    return this.schema != null;
  }

  this.setSchema = function (schema) {

    this.schema = schema;

    // Sets the time unit
    if (!isNull(schema["EVENTS"])
        && !isNull(schema["EVENTS"]["HEADER"])
        && !isNull(schema["EVENTS"]["HEADER"]["TUNIT1"])) {
      this.timeUnit = schema["EVENTS"]["HEADER"]["TUNIT1"];
    } else if (!isNull(schema["RATE"])
        && !isNull(schema["RATE"]["HEADER"])
        && !isNull(schema["RATE"]["HEADER"]["TUNIT1"])) {
      this.timeUnit = schema["RATE"]["HEADER"]["TUNIT1"];
    }

    // Sets the time unit
    if (!isNull(schema["RATE"])
        && !isNull(schema["RATE"]["HEADER"])
        && !isNull(schema["RATE"]["HEADER"]["TIMEDEL"])) {
      this.binSize = parseFloat(schema["RATE"]["HEADER"]["TIMEDEL"]);
    }
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
    }

  }

  this.setFile = function (selectorKey, filename) {
    this.selectorFilenames[selectorKey] = filename;
  }

  this.getFile = function (selectorKey, filename) {
    if (!isNull(this.selectorFilenames[selectorKey])) {
      return this.selectorFilenames[selectorKey];
    }
    return "";
  }
}
