function PhaseLagPlot(id, plotConfig, getDataFromServerFn, onFiltersChangedFn, onPlotReadyFn, toolbar, cssClass, switchable, projectConfig) {

  var currentObj = this;
  RmsPlot.call(this, id, plotConfig, getDataFromServerFn, onFiltersChangedFn, onPlotReadyFn, toolbar, cssClass, switchable, projectConfig);

  this.freq_range_title = "Phase lag frequency range (Hz):";
  this.energy_range_title = "Reference energy range (keV)";

  log ("new PhaseLagPlot id: " + this.id);

  return this;
}
