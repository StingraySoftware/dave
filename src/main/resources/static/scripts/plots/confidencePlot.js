//Confidence Intervals Plot

function ConfidencePlot(id, plotConfig, getDataFromServerFn, onFiltersChangedFn, onPlotReadyFn, toolbar, cssClass, switchable, projectConfig) {

  var currentObj = this;

  Plot.call(this, id, plotConfig, getDataFromServerFn, onFiltersChangedFn, onPlotReadyFn, toolbar, cssClass, switchable);

  this.btnLoad.hide();

  this.getPlotlyConfig = function (data) {

    var coords = this.getSwitchedCoords( { x: 0, y: 1} );
    var plotDefaultConfig = currentObj.getDefaultPlotlyConfig();

    var plotlyConfig = get_plotdiv_scatter(data[coords.x].values, data[coords.y].values,
                                      this.getLabel(coords.x),
                                      this.getLabel(coords.y),
                                      this.plotConfig.styles.title,
                                      plotDefaultConfig);

    plotlyConfig.data.push(getCrossLine ([this.minX, this.maxX], [ data[2].values[0], data[2].values[0] ], '#222222', 2, 'solid'));
    plotlyConfig.data.push(getCrossLine ([this.minX, this.maxX], [ data[2].values[1], data[2].values[1] ], '#666666', 2, 'dot'));
    plotlyConfig.data.push(getCrossLine ([this.minX, this.maxX], [ data[2].values[2], data[2].values[2] ], '#666666', 2, 'dot'));

    plotlyConfig.data.push(getCrossLine ([this.minX, this.maxX], [ data[3].values[1], data[3].values[1] ], '#888888', 2, 'dash'));
    plotlyConfig.data.push(getCrossLine ([this.minX, this.maxX], [ data[3].values[2], data[3].values[2] ], '#888888', 2, 'dash'));

    plotlyConfig = this.addExtraDataConfig(plotlyConfig, plotDefaultConfig);
    plotlyConfig = this.prepareAxis(plotlyConfig);

    return plotlyConfig;
  }

  log ("new ConfidencePlot id: " + this.id);

  return this;
}
