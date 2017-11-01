//Timing plot

function TimingPlot(id, plotConfig, getDataFromServerFn, onFiltersChangedFn, onPlotReadyFn, toolbar, cssClass, switchable) {

  var currentObj = this;

  PlotWithSettings.call(this, id, plotConfig, getDataFromServerFn, onFiltersChangedFn, onPlotReadyFn, toolbar, cssClass, switchable);

  this.plotConfig.xAxisType = "linear";
  this.plotConfig.yAxisType = "linear";

  //Overrides Btn back from setting for redraw plot with current data, without server call
  this.btnBack.click(function(event){
      currentObj.hideSettings();
      if (!isNull(currentObj.data)) {
        var plotlyConfig = currentObj.getPlotlyConfig(currentObj.data);
        currentObj.redrawPlot(plotlyConfig);
      }
      currentObj.setReadyState(true);
      currentObj.onPlotReady();
      gaTracker.sendEvent("Plots", "HidePlotSettings", currentObj.getTitle());
  });

  //TimingPlot plot methods:
  this.addSettingsControls = function(){

    if (this.settingsPanel.find(".AxisType").length == 0) {
      this.addAxesTypeControlsToSettings(".leftCol");
      this.onSettingsCreated();
    }
  }

  this.getPlotlyConfig = function (data) {

    var coords = this.getSwitchedCoords( { x: 0, y: 1} );
    var plotDefaultConfig = currentObj.getDefaultPlotlyConfig();

    var plotlyConfig = get_plotdiv_lightcurve(data[0].values, data[1].values,
                                        [], data[2].values,
                                        (data.length > 4) ? this.getWtiRangesFromGtis(data[3].values, data[4].values, data[0].values) : [],
                                        this.plotConfig.styles.labels[coords.x],
                                        this.plotConfig.styles.labels[coords.y],
                                        this.getTitle(),
                                        plotDefaultConfig);

    plotlyConfig = this.addExtraDataConfig(plotlyConfig, plotDefaultConfig);
    plotlyConfig = this.prepareAxis(plotlyConfig);

    return plotlyConfig;
  }

  log ("new TimingPlot id: " + this.id);

  return this;
}
