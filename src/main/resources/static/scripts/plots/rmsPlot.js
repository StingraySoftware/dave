function RmsPlot(id, plotConfig, getDataFromServerFn, onFiltersChangedFn, onPlotReadyFn, toolbar, cssClass, switchable, projectConfig) {

  var currentObj = this;
  plotConfig.styles.showFitBtn = false;

  var schema = projectConfig.schema;
  plotConfig.n_bands = 10;
  plotConfig.freq_range = [-1, -1];
  if (!isNull(schema["EVENTS"])) {
      table = schema["EVENTS"];
      if (!isNull(table["E"])){
        //Adds Reference Band filter
        plotConfig.n_bands = Math.floor(table["E"].max_value - table["E"].min_value);
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

  this.onNBandsChanged = function(){
    currentObj.plotConfig.n_bands = getInputIntValue(currentObj.settingsPanel.find(".inputNBands"), currentObj.plotConfig.n_bands);
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
                                      "Frequency range (Hz):",
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
    this.settingsPanel.find(".rightCol").append(this.freqRangeSelector.$html);

    //Adds number of point control of rms plot
    this.settingsPanel.find(".rightCol").append('</br><p>Nº Points: <input id="n_bands_' + this.id + '" class="inputNBands" type="text" name="n_bands_' + this.id + '" placeholder="' + this.plotConfig.n_bands + '" value="' + this.plotConfig.n_bands + '" /></p>');
    this.settingsPanel.find(".rightCol").find(".inputNBands").on('change', this.onNBandsChanged);
  }

  this.getDefaultFreqRange = function (){
    if (this.data != null) {
      if (this.data[0].values.length > 0) {
        return [ Math.floor(Math.min.apply(Math,this.data[0].values)), Math.ceil(Math.max.apply(Math,this.data[0].values)) ];
      }
    }
    return [-1, -1];
  }

  log ("new RmsPlot id: " + this.id);

  return this;
}
