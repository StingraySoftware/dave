//Periodogram plot

function PgPlot(id, plotConfig, getDataFromServerFn, onFiltersChangedFn, onPlotReadyFn, toolbar, cssClass, switchable, projectConfig, plotStyle) {

  var currentObj = this;
  plotConfig.freq_range = [-1, -1];
  plotConfig.default_freq_range = [-1, -1];

  PDSPlot.call(this, id, plotConfig, getDataFromServerFn, onFiltersChangedFn, onPlotReadyFn, toolbar, cssClass, switchable, projectConfig);

  this.plotStyle = !isNull(plotStyle) ? plotStyle : null;
  this.ls_opts = {};
  this.ls_opts.samples_per_peak = { default:5, min:1, max: 100}; //Samples per peak for LombScargle method
  this.ls_opts.nyquist_factor = { default:1, min:1, max: 100}; //The nyquist factor for LombScargle method

  this.plotConfig.xAxisType = "linear";
  this.plotConfig.yAxisType = "log";
  this.plotConfig.plotType = "X";
  this.plotConfig.ls_norm = "standard";
  this.plotConfig.samples_per_peak = this.ls_opts.samples_per_peak.default;
  this.plotConfig.nyquist_factor = this.ls_opts.nyquist_factor.default;

  this.onSettingsCreated = function(){
    this.settingsPanel.find(".leftCol").hide();
  }

  this.getDefaultFreqRange = function (){
    if (this.plotConfig.default_freq_range[0] < 0
        && !isNull(this.data) && this.data.length >= 4) {
      var minMax = minMax2DArray(this.data[0].values);
      this.plotConfig.default_freq_range = [ minMax.min, minMax.max ];
    }
    return this.plotConfig.default_freq_range;
  }

  this.mustPropagateAxisFilter = function (axis) {
    return axis == 0;
  }

  this.getLabel = function (axis) {
    if (axis == this.XYLabelAxis){
      var yLabel = this.plotConfig.styles.labels[this.XYLabelAxis];
      if (this.plotConfig.plotType == "X*Y" &&
          (isNull(this.plotConfig.styles.XYLabelIsCustom)
              || !this.plotConfig.styles.XYLabelIsCustom)) {
        yLabel += " x " + this.plotConfig.styles.labels[0];
      }
      return yLabel;
    } else {
      return this.plotConfig.styles.labels[axis];
    }
  }

  log ("new PgPlot id: " + this.id);

  return this;
}
