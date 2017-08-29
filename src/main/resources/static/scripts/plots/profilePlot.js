//Profile plot

function ProfilePlot(id, plotConfig, getDataFromServerFn, onFiltersChangedFn, onPlotReadyFn, toolbar, cssClass, switchable) {

  var currentObj = this;

  Plot.call(this, id, plotConfig, getDataFromServerFn, onFiltersChangedFn, onPlotReadyFn, toolbar, cssClass, switchable);

  this.btnFullScreen.remove();

  this.getPlotlyConfig = function (data) {

    var coords = currentObj.getSwitchedCoords( { x: 0, y: 1} );

    var plotlyConfig = get_plotdiv_lightcurve(data[0].values, data[1].values, [], [], [],
                                        currentObj.plotConfig.styles.labels[coords.x],
                                        currentObj.plotConfig.styles.labels[coords.y],
                                        currentObj.plotConfig.styles.title);

    plotlyConfig.layout.shapes = [ getConfidenceShape( [ data[2].values[0], data[2].values[1] ] ) ];

    plotlyConfig = currentObj.prepareAxis(plotlyConfig);

    return plotlyConfig;
  }

  this.getCoordsFromPlotlyHoverEvent = function (){
    return null;
  }

  log ("new ProfilePlot id: " + this.id);

  return this;
}
