
function Schema(schema){

  this.contents = $.extend(true, [], schema);

  this.isEventsFile = function () {
    return !isNull(this.contents["EVENTS"]);
  }

  this.isLightCurveFile = function () {
    return !isNull(this.contents["RATE"]);
  }

  this.hasTable = function () {
    return this.isEventsFile() || this.isLightCurveFile();
  }

  this.hasColumn = function (columnName) {
    return this.hasTable() && !isNull(this.getTable()[columnName]);
  }

  this.getTable = function () {
    if (this.isEventsFile()) {
        return this.contents["EVENTS"];
    } else if (this.isLightCurveFile()) {
        return this.contents["RATE"];
    }

    return null;
  }

  this.hasHeader = function () {
    return this.hasTable() && !isNull(this.getTable()["HEADER"]);
  }

  this.getHeader = function () {
    if (this.hasHeader()) {
      return this.getTable()["HEADER"];
    }

    return null;
  }

  this.hasGTIs = function () {
    return !isNull(this.contents["GTI"])
            && !isNull(this.contents["GTI"]["START"])
            && !isNull(this.contents["GTI"]["STOP"]);
  }

  this.getGTIs = function () {
    if (this.hasGTIs()) {
      return this.contents["GTI"];
    }

    return null;
  }

  this.getTimeUnit = function () {
    if (this.hasHeader()){
      var tableHeader = this.getHeader();

      if (!isNull(tableHeader["TUNIT1"])) {
        return tableHeader["TUNIT1"];
      }
    }

    return "";
  }

  this.getTimeResolution = function () {
    if (this.hasHeader()){
      var tableHeader = this.getHeader();

      if (!isNull(tableHeader["TIMEDEL"])) {
        return parseFloat(tableHeader["TIMEDEL"]);
      } else if (!isNull(tableHeader["FRMTIME"])) {
        return parseInt(tableHeader["FRMTIME"]) / 1000;
      }
    }

    return 1.0;
  }

  this.getTotalDuration = function () {

    var start = 0;
    var stop = 0;

    if (this.hasHeader()){
      var tableHeader = this.getHeader();

      if (!isNull(tableHeader["TSTART"])
          && !isNull(tableHeader["TSTOP"])) {

        start = parseInt(tableHeader["TSTART"]);
        stop = parseInt(tableHeader["TSTOP"]);

      } else if (!isNull(tableHeader["TSTARTI"])
                  && !isNull(tableHeader["TSTOPI"])
                  && !isNull(tableHeader["TSTARTF"])
                  && !isNull(tableHeader["TSTOPF"])) {

        start = parseInt(tableHeader["TSTARTI"]) + parseFloat(tableHeader["TSTARTF"]);
        stop = parseInt(tableHeader["TSTOPI"]) + parseFloat(tableHeader["TSTOPF"]);

      } else if (this.hasTable() && this.hasColumn("TIME")){

        var timeColumn = this.getTable()["TIME"];
        start = timeColumn.min_value;
        stop = timeColumn.max_value;
      }
    }

    return stop - start;
  }

  this.getEventsCount = function () {
    if (this.hasTable() && this.hasColumn("TIME")){
      return this.getTable()["TIME"].count;
    }

    return 0;
  }

  this.getAvgSegmentSize = function () {
    if (this.hasGTIs()) {
      var gtiTable = this.getGTIs();

      if (gtiTable["START"].count > 1) {

        //If there are more than one gti then get segmSize from avg gti size
        return gtiTable["STOP"].min_value - gtiTable["START"].min_value;
      } else {

        //Else set segmSize from splitting totalDuration by 30
        return this.getTotalDuration() / 30;
      }
    }

    return this.getTimeResolution();
  }

  this.getMaxSegmentSize = function () {
    return this.getTotalDuration() * 0.95;
  }

  return this;
}
