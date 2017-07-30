function PhaseLagPlot(id, plotConfig, getDataFromServerFn, onFiltersChangedFn, onPlotReadyFn, toolbar, cssClass, switchable, projectConfig) {

  var currentObj = this;
  RmsPlot.call(this, id, plotConfig, getDataFromServerFn, onFiltersChangedFn, onPlotReadyFn, toolbar, cssClass, switchable, projectConfig);

  this.freq_range_title = "Phase lag frequency range (Hz):";

  log ("new PhaseLagPlot id: " + this.id);

  return this;
}
