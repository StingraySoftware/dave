//Covariance plot

function CovariancePlot(id, plotConfig, getDataFromServerFn, onFiltersChangedFn, onPlotReadyFn, toolbar, cssClass, switchable, projectConfig) {

  var currentObj = this;

  if (projectConfig.schema.isEventsFile()) {
      var column = projectConfig.schema.getTable()["E"];
      if (!isNull(column)){

        //Adds Reference Band filter
        plotConfig.ref_band_interest = [column.min_value, column.max_value];
        plotConfig.energy_range = [column.min_value, column.max_value];
        plotConfig.default_energy_range = [column.min_value, column.max_value];
        plotConfig.n_bands = Math.floor(column.max_value - column.min_value);
        plotConfig.std = -1;

      } else {
        log("CovariancePlot error, plot" + currentObj.id + ", NO ENERGY COLUMN ON SCHEMA");
      }
  } else {
    log("CovariancePlot error, plot" + currentObj.id + ", NO EVENTS TABLE ON SCHEMA");
  }

  PlotWithSettings.call(this, id, plotConfig, getDataFromServerFn, onFiltersChangedFn, onPlotReadyFn, toolbar, cssClass, switchable);

  //Covariance plot methods:

  this.onReferenceBandValuesChanged = function() {
    try {
      currentObj.plotConfig.ref_band_interest = [currentObj.refBandSelector.fromValue, currentObj.refBandSelector.toValue];
    } catch (e) {
      log("onReferenceBandValuesChanged error, plot" + currentObj.id + ", error: " + e);
    }
  }

  this.onStdChanged = function(){
    currentObj.plotConfig.std = getInputIntValueCropped(currentObj.settingsPanel.find(".inputStd"), currentObj.plotConfig.std, -1, CONFIG.MAX_PLOT_POINTS);
  }

  //CovariancePlot plot attributes:
  if (!isNull(this.plotConfig.ref_band_interest)){

    //Adds Band of Interest selector
    this.addEnergyRangeControlToSetting("Band of interest (keV)", ".leftCol");

    //Adds Reference Band selector
    this.refBandSelector = new sliderSelector(this.id + "_RefBand",
                                      "Reference Band (keV):",
                                      { table:"EVENTS", column:"E", source: "RefBand" },
                                      "From", "To",
                                      this.plotConfig.ref_band_interest[0], this.plotConfig.ref_band_interest[1],
                                      this.onReferenceBandValuesChanged,
                                      null,
                                      function( event, ui ) {
                                        currentObj.refBandSelector.setValues( ui.values[ 0 ], ui.values[ 1 ], "slider");
                                        currentObj.onReferenceBandValuesChanged();
                                      });
    this.refBandSelector.setFixedStep(CONFIG.ENERGY_FILTER_STEP);
    this.refBandSelector.setEnabled(true);
    this.settingsPanel.find(".leftCol").append(this.refBandSelector.$html);

    //Adds number of point control of rms plot
    this.addNumberOfBandsControlToSettings("Nº Bands", ".rightCol");

    this.settingsPanel.find(".rightCol").append('<p>Standard deviation (<0 Default): <input id="std_' + this.id + '" class="inputStd" type="text" name="std_' + this.id + '" placeholder="' + this.plotConfig.std + '" value="' + this.plotConfig.std + '" /></p>');
    this.settingsPanel.find(".rightCol").find(".inputStd").on('change', this.onStdChanged);
  }

  log ("new CovariancePlot id: " + this.id);

  return this;
}
