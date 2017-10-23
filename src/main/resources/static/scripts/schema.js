
function Schema(schema){

  this.contents = $.extend(true, [], schema);

  this.isEventsFile = function () {
    return !isNull(this.contents["EVENTS"]);
  }

  this.isLightCurveFile = function () {
    return !isNull(this.contents["RATE"]);
  }

  this.isGTIFile = function () {
    return !isNull(this.contents["GTI"])
          || !isNull(this.contents["STDGTI"])
          || !isNull(this.contents["STDGTI04"]);
  }

  this.isRMFFile = function () {
    return !isNull(this.contents["EBOUNDS"]);
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
    } else if (this.isRMFFile()) {
        return this.contents["EBOUNDS"];
    } else if (this.isGTIFile()) {
        return this.contents[0];
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

      if (!isNull(tableHeader["TIMEUNIT"])) {
        return tableHeader["TIMEUNIT"];
      }
    }

    return "";
  }

  this.getBackgroundSubstracted = function () {
    if (this.hasHeader()){
      return getBackgroundSubstracted (this.getHeader());
    }

    return false;
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

    /*var eventsCount = this.getEventsCount();
    if (eventsCount > 0) {
      return this.getTotalDuration() / eventsCount;
    } else {
      return 1.0;
    }*/

    return Math.pow(10, -CONFIG.MAX_TIME_RESOLUTION_DECIMALS);
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

      } else if (this.hasTable() && this.hasColumn(CONFIG.TIME_COLUMN)){

        var timeColumn = this.getTable()[CONFIG.TIME_COLUMN];
        start = timeColumn.min_value;
        stop = timeColumn.max_value;
      }
    }

    return stop - start;
  }

  this.getEventsCount = function () {
    if (this.hasTable() && this.hasColumn(CONFIG.TIME_COLUMN)){
      return this.getTable()[CONFIG.TIME_COLUMN].count;
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
    } else {

      return this.getTimeResolution();
    }
  }

  this.getMaxSegmentSize = function () {
    return this.getTotalDuration() * CONFIG.TIMERANGE_MULTIPLIER;
  }

  return this;
}

//STATIC HEADER METHODS:

//Returns if a lightcurve is background substracted
function getBackgroundSubstracted (rateTableHeader) {
  if (!isNull(rateTableHeader)){
    if (!isNull(rateTableHeader["BACKAPP"])) {
      return rateTableHeader["BACKAPP"].toLowerCase() == "true";
    }
  }
  return false;
}

//Extracts te text for the energy range used to create a lightcurve
function extractEnergyRangeTextFromHeader (header) {
  var tableName = "RATE";
  if (!isNull(header) && !isNull(header[tableName])) {
    return extractEnergyRangeTextRateTable(header[tableName]);
  }
  return "";
}

function extractEnergyRangeTextFromSchema (schema) {
  if (schema.hasHeader()) {
    return extractEnergyRangeTextRateTable(schema.getHeader());
  }
  return "";
}

function extractEnergyRangeTextRateTable (rateTable) {

  var filterColumn = "PI";
  var searchFieldPrefix = "DSTYP";
  var unitFieldPrefix = "DSUNI";
  var valueFieldPrefix = "DSVAL";

  for (i=0; i<20; i++) {
    //Looks for the searchField index
    var searchField = searchFieldPrefix + i;
    if (!isNull(rateTable[searchField]) && rateTable[searchField] == filterColumn){
      var unit = rateTable[unitFieldPrefix + i];
      var range = rateTable[valueFieldPrefix + i];

      if (!isNull(unit) && !isNull(range) && range.indexOf(":") > -1){
        var rangeVals = range.split(":");
        var rangeStart = rangeVals[0].replace(/[^\d.-]/g, '');
        var rangeEnd = rangeVals[1].replace(/[^\d.-]/g, '');
        if (jQuery.isNumeric(rangeStart) && jQuery.isNumeric(rangeEnd)){
          if (unit.toLowerCase() == "ev") {
            return fixedPrecision(rangeStart/1000, 3) + " - " + fixedPrecision(rangeEnd/1000, 3) + " keV";
          } else {
            return rangeStart + " - " + rangeEnd + " " + unit;
          }
        }
      }
    }
  }

  return "";
}

function isValidSrcSchema(schema) {
  return !isNull(schema["EVENTS"]) || !isNull(schema["RATE"]);
}
