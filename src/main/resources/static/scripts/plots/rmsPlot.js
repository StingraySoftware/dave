function RmsPlot(id, plotConfig, getDataFromServerFn, onFiltersChangedFn, onPlotReadyFn, toolbar, cssClass, switchable, projectConfig) {

  var currentObj = this;
  plotConfig.n_bands = 10;
  plotConfig.freq_range = [-1, -1];
  plotConfig.energy_range = [-1, -1];
  plotConfig.default_energy_range = [-1, -1];

  this.freq_range_title = (plotConfig.x_axis_type != "countrate") ? "RMS Frequency Range (Hz):" : "Frequency Range (Hz):";

  if (projectConfig.schema.isEventsFile()) {
      var column = projectConfig.schema.getTable()["E"];
      if (!isNull(column)){

        //Adds Reference Band filter
        plotConfig.energy_range = [column.min_value, column.max_value];
        plotConfig.default_energy_range = [column.min_value, column.max_value];
        plotConfig.n_bands = (plotConfig.x_axis_type != "countrate") ? Math.floor(column.max_value - column.min_value) : 20;

      } else {
        log("RmsPlot error, plot" + currentObj.id + ", NO ENERGY COLUMN ON SCHEMA");
      }
  } else {
    log("RmsPlot error, plot" + currentObj.id + ", NO EVENTS TABLE ON SCHEMA");
  }

  PDSPlot.call(this, id, plotConfig, getDataFromServerFn, onFiltersChangedFn, onPlotReadyFn, toolbar, cssClass, switchable, projectConfig);

  this.plotConfig.xAxisType = "linear";
  this.plotConfig.yAxisType = "linear";
  this.plotConfig.plotType = "X";

  this.onSettingsCreated = function(){

    //Hides pds settings controls that doesn't apply to rms plot
    this.binSelector.$html.hide();
    this.xAxisRadios.hide();
    this.yAxisRadios.hide();
    this.plotTypeRadios.hide();

    //Adds frequency range selector
    this.addFrequencyRangeSelector(this.freq_range_title,
                                    { table:"EVENTS", column:"FREQ", source: "frequency" },
                                    ".rightCol");

    //Adds energy range selector
    this.addEnergyRangeControlToSetting("Energy range (keV)", ".rightCol");

    //Adds number of point control of rms plot
    this.addNumberOfBandsControlToSettings((plotConfig.x_axis_type != "countrate") ? "Nº Energy Segments" : "Nº Time Segments", ".rightCol");
  }

  this.getLabel = function (axis) {
    return this.plotConfig.styles.labels[axis];
  }

  log ("new RmsPlot id: " + this.id);

  return this;
}
