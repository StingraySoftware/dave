
function ProjectConfig(){
  this.filename = "";
  this.filenames = [];
  this.schema = null;
  this.bckFilename = "";
  this.bckFilenames = [];
  this.gtiFilename = "";
  this.gtiFilenames = [];
  this.rmfFilename = "";
  this.arfFilename = "";
  this.selectorFilenames = [];
  this.binSize = 100;
  this.minBinSize = 0;
  this.timeUnit = "s";
  this.totalDuration = 0;
  this.plots = [];

  this.hasSchema = function (schema) {
    return this.schema != null;
  }

  this.setSchema = function (schema) {

    this.schema = schema;

    var tableHeader = null;

    if (!isNull(schema["EVENTS"])
        && !isNull(schema["EVENTS"]["HEADER"])) {

        tableHeader = schema["EVENTS"]["HEADER"];

    } else if (!isNull(schema["RATE"])
                && !isNull(schema["RATE"]["HEADER"])) {

        tableHeader = schema["RATE"]["HEADER"];
    }

    if (!isNull(tableHeader)) {

        // Sets the time unit
        if (!isNull(tableHeader["TUNIT1"])) {
          this.timeUnit = tableHeader["TUNIT1"];
        }

        // Sets the time resolution
        if (!isNull(tableHeader["TIMEDEL"])) {
          this.binSize = parseFloat(tableHeader["TIMEDEL"]);
        }

        // Sets the minimun resolution
        if (!isNull(tableHeader["FRMTIME"])) {
          this.minBinSize = parseInt(tableHeader["FRMTIME"]) / 1000;
        } else {
          this.minBinSize = this.binSize;
        }

        // Sets the total duration
        if (!isNull(tableHeader["TSTART"])
            && !isNull(tableHeader["TSTOP"])) {

          var start = parseInt(tableHeader["TSTART"]);
          var stop = parseInt(tableHeader["TSTOP"]);
          this.totalDuration = stop - start;

        } else if (!isNull(tableHeader["TSTARTI"])
                    && !isNull(tableHeader["TSTOPI"])
                    && !isNull(tableHeader["TSTARTF"])
                    && !isNull(tableHeader["TSTOPF"])) {

          var start = parseInt(tableHeader["TSTARTI"]) + parseFloat(tableHeader["TSTARTF"]);
          var stop = parseInt(tableHeader["TSTOPI"]) + parseFloat(tableHeader["TSTOPF"]);
          this.totalDuration = stop - start;
        }

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
    } else if (selectorKey == "ARF") {
      this.arfFilename = filename;
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
