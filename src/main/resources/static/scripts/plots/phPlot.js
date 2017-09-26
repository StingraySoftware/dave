//Phaseogram plot

function PhPlot(id, plotConfig, getDataFromServerFn, onFiltersChangedFn, onPlotReadyFn, toolbar, cssClass, switchable) {

  var currentObj = this;

  Plot.call(this, id, plotConfig, getDataFromServerFn, onFiltersChangedFn, onPlotReadyFn, toolbar, cssClass, switchable);

  this.ph_opts = {};
  this.ph_opts.nph = { default:32, min:1, max: 256}; //Number of phase bins of the phaseogram
  this.ph_opts.nt = { default:64, min:1, max: 512}; //Number of time bins of the phaseogram

  this.plotConfig.f = 0;
  this.plotConfig.nph = this.ph_opts.nph.default;
  this.plotConfig.nt = this.ph_opts.nt.default;
  this.plotConfig.colorScale = { x0: 0.5, y0: 0.5, m: 1.0 };

  this.btnFullScreen.remove();
  this.btnLoad.remove();

  this.getPlotlyConfig = function (data) {

    var plotlyConfig = get_plotdiv_dynamical_spectrum(data[1].values,
                                                  data[2].values,
                                                  data[0].values,
                                                  currentObj.plotConfig.styles.labels[1],
                                                  currentObj.plotConfig.styles.labels[2],
                                                  currentObj.plotConfig.styles.labels[0],
                                                  this.getColorScale(),
                                                  currentObj.plotConfig.styles.title);
    plotlyConfig.data[0].type = "heatmap";

    return plotlyConfig;
  }

  this.getColorScale = function () {
    var numColors = 10;
    var colorscale = [];
    var x0 = this.plotConfig.colorScale.x0;
    var y0 = this.plotConfig.colorScale.y0;
    var m = this.plotConfig.colorScale.m;
    for (i = 0; i <= 1.0; i+=(1.0/numColors)) {
      var c = Math.max(Math.min(Math.floor(255.0 * ((i - y0)*m + x0)), 255), 0);
      var color = 'rgb(' + c + ',0,' + (255 - c) + ')';
      var ratio = "" + fixedPrecision(i, 2);
      colorscale.push([((ratio.length == 1) ? ratio + ".0" : ratio), color]);
    }
    return colorscale;
  }

  this.getCoordsFromPlotlyHoverEvent = function (){
    return null;
  }

  log ("new PhPlot id: " + this.id);

  return this;
}
