function RmsPlot(id, plotConfig, getDataFromServerFn, onFiltersChangedFn, onPlotReadyFn, toolbar, cssClass, switchable, projectConfig) {

  var currentObj = this;
  plotConfig.styles.showFitBtn = false;
  plotConfig.n_bands = 10;
  plotConfig.freq_range = [-1, -1];
  plotConfig.default_freq_range = [-1, -1];
  plotConfig.energy_range = [-1, -1];
  plotConfig.default_energy_range = [-1, -1];

  if (projectConfig.schema.isEventsFile()) {
      var column = projectConfig.schema.getTable()["E"];
      if (!isNull(column)){

        //Adds Reference Band filter
        plotConfig.n_bands = Math.floor(column.max_value - column.min_value);
        plotConfig.energy_range = [column.min_value, column.max_value];
        plotConfig.default_energy_range = [column.min_value, column.max_value];
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

  this.onFreqRangeValuesChanged = function() {
    currentObj.plotConfig.freq_range = [currentObj.freqRangeSelector.fromValue, currentObj.freqRangeSelector.toValue];
  }

  this.onEnergyRangeValuesChanged = function() {
    currentObj.plotConfig.n_bands = Math.max.apply(Math, [1, Math.floor(currentObj.energyRangeSelector.toValue - currentObj.energyRangeSelector.fromValue)]);
    currentObj.settingsPanel.find(".inputNBands").val(currentObj.plotConfig.n_bands);
    currentObj.plotConfig.energy_range = [currentObj.energyRangeSelector.fromValue, currentObj.energyRangeSelector.toValue];
  }

  this.onNBandsChanged = function(){
    currentObj.plotConfig.n_bands = getInputIntValueCropped(currentObj.settingsPanel.find(".inputNBands"), currentObj.plotConfig.n_bands, 1, CONFIG.MAX_PLOT_POINTS);
  }

  this.settingCreated = function(){

    //Hides pds settings controls that doesn't apply to rms plot
    this.binSelector.$html.hide();
    this.xAxisRadios.hide();
    this.yAxisRadios.hide();
    this.plotTypeRadios.hide();

    //Adds frequency range selector
    var freqRange = this.getDefaultFreqRange();
    this.freqRangeSelector = new sliderSelector(this.id + "_FreqRange",
                                      "RMS Frequency range (Hz):",
                                      { table:"EVENTS", column:"FREQ", source: "frequency" },
                                      "From", "To",
                                      freqRange[0], freqRange[1],
                                      this.onFreqRangeValuesChanged,
                                      null);
    this.freqRangeSelector.step = 0.1;
    this.freqRangeSelector.slider.slider({
           min: this.freqRangeSelector.fromValue,
           max: this.freqRangeSelector.toValue,
           values: [this.freqRangeSelector.fromValue, this.freqRangeSelector.toValue],
           step: this.freqRangeSelector.step,
           slide: function( event, ui ) {
             currentObj.freqRangeSelector.setValues( ui.values[ 0 ], ui.values[ 1 ], "slider");
             currentObj.onFreqRangeValuesChanged();
           }
       });
    this.freqRangeSelector.setEnabled(true);
    if (this.plotConfig.freq_range[0] > -1) {
      this.freqRangeSelector.setValues(this.plotConfig.freq_range[0], this.plotConfig.freq_range[1]);
    }
    this.settingsPanel.find(".rightCol").append(this.freqRangeSelector.$html);

    //Adds energy range selector
    this.energyRangeSelector = new sliderSelector(this.id + "_EnergyRange",
                                      "Energy range (keV):",
                                      { table:"EVENTS", column:"E", source: "energy" },
                                      "From", "To",
                                      this.plotConfig.default_energy_range[0], this.plotConfig.default_energy_range[1],
                                      this.onEnergyRangeValuesChanged,
                                      null);
    this.energyRangeSelector.slider.slider({
           min: this.energyRangeSelector.fromValue,
           max: this.energyRangeSelector.toValue,
           values: [this.energyRangeSelector.fromValue, this.energyRangeSelector.toValue],
           step: 1,
           slide: function( event, ui ) {
             currentObj.energyRangeSelector.setValues( ui.values[ 0 ], ui.values[ 1 ], "slider");
             currentObj.onEnergyRangeValuesChanged();
           }
       });
    this.energyRangeSelector.setEnabled(true);
    this.energyRangeSelector.setValues(this.plotConfig.energy_range[0], this.plotConfig.energy_range[1]);
    this.settingsPanel.find(".rightCol").append(this.energyRangeSelector.$html);

    //Adds number of point control of rms plot
    this.settingsPanel.find(".rightCol").append('</br><p>Nº Energy Segments: <input id="n_bands_' + this.id + '" class="inputNBands" type="text" name="n_bands_' + this.id + '" placeholder="' + this.plotConfig.n_bands + '" value="' + this.plotConfig.n_bands + '" /></p>');
    this.settingsPanel.find(".rightCol").find(".inputNBands").on('change', this.onNBandsChanged);
  }

  this.getDefaultFreqRange = function (){
    if (this.plotConfig.default_freq_range[0] < 0 && !isNull(this.data) && this.data.length >= 5) {
      if (this.data[4].values.length == 2) {
        this.plotConfig.default_freq_range = this.data[4].values;
      }
    }
    return this.plotConfig.default_freq_range;
  }

  log ("new RmsPlot id: " + this.id);

  return this;
}
