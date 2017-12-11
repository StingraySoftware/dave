//Long-Term Variability plot

function AgnPlot(id, plotConfig, getDataFromServerFn, onFiltersChangedFn, onPlotReadyFn, toolbar, cssClass, switchable, plotStyle) {

  var currentObj = this;

  plotConfig.styles.selectable = false;

  if (!plotConfig.styles.title.startsWith("$")){
    //If X axis label is not LaTeX set it to LaTeX
    plotConfig.styles.title = "$\\text{" + plotConfig.styles.title + " Long-Term Variability}$";
  } else {
    plotConfig.styles.title = "$\\text{Long-Term Variability}$";
  }

  if (!plotConfig.styles.labels[0].startsWith("$")){
    //If X axis label is not LaTeX set it to LaTeX
    plotConfig.styles.labels[0] = "$\\text{" + plotConfig.styles.labels[0] + "}$";
  }

  LcPlot.call(this, id, plotConfig, getDataFromServerFn, onFiltersChangedFn, onPlotReadyFn, toolbar, cssClass, switchable);

  this.plotStyle = !isNull(plotStyle) ? plotStyle : null;

  //AGN plot attributes:
  this.variance_opts = {};
  this.variance_opts.min_counts = { default:100, min:1, max: 100000}; //Minimum number of counts for each chunk on excess variance
  this.variance_opts.min_bins = { default:100, min:1, max: 100000}; //Minimum number of time bins on excess variance
  this.plotConfig.variance_opts = {};

  this.axisLabels = ["$<F _{var}>$", "$F _{var}$", "$<{\\sigma _{XS}}^{2}>$", "${\\sigma _{XS}}^{2}$", "$<\\chi>$", "$\\chi$"];

  this.btnFullScreen.remove();
  this.btnLoad.remove();

  //AGN plot methods:
  this.getPlotlyConfig = function (data) {

    if (!isNull(this.plotStyle)){
      if (!isNull(this.plotStyle.axisLabels)){
        //Load axisLabels from saved plotStyle
        this.axisLabels = this.plotStyle.axisLabels;
      }
    }

    var coords = currentObj.getSwitchedCoords( { x: 0, y: 1} );
    var plotDefaultConfig = currentObj.getDefaultPlotlyConfig();

    var dataWithGaps = this.addGapsToData(data[0].values, data[1].values, data[2].values, currentObj.plotConfig.dt * 5);

    var plotlyConfig = { data: [], layout: {} };
    var lcPlotlyConfig = get_plotdiv_lightcurve(dataWithGaps[0], dataWithGaps[1],
                                        [], dataWithGaps[2],
                                        (data.length > 4) ? currentObj.getWtiRangesFromGtis(data[3].values, data[4].values, data[0].values) : [],
                                        currentObj.plotConfig.styles.labels[coords.x],
                                        currentObj.axisLabels[5],
                                        currentObj.getTitle(),
                                        plotDefaultConfig);
    if (data.length == 23) {

      lcPlotlyConfig.data[0].yaxis = 'y6';

      if (data[5].values.length > 0) {
        //Lightcurve has baseline values
        var baselineTrace = getLine (data[0].values, data[5].values, plotDefaultConfig.BASELINE_COLOR, plotDefaultConfig.DEFAULT_LINE_WIDTH.default);
        baselineTrace.yaxis = 'y6';
        lcPlotlyConfig.data.push(baselineTrace);
      }

      if (data[6].values.length > 0) {
        //Lightcurve has meanflux values
        var meanfluxTrace = getLine (data[0].values, data[6].values, plotDefaultConfig.MEANFLUX_COLOR, plotDefaultConfig.DEFAULT_LINE_WIDTH.default);
        meanfluxTrace.yaxis = 'y6';
        lcPlotlyConfig.data.push(meanfluxTrace);
      }

      if (data[7].values.length > 0) {

        //Lightcurve has Long-Term Variability values
        plotlyConfig.data.push(getAgnPlotTrace("y5", data[7].values, data[9].values, data[10].values, plotDefaultConfig, plotDefaultConfig.AGN_COLORS[0]));
        plotlyConfig.data.push(getAgnPlotTrace("y4", data[7].values, data[11].values, data[12].values, plotDefaultConfig, plotDefaultConfig.AGN_COLORS[1]));
        plotlyConfig.data.push(getAgnPlotTraceWithXErrorData("y3", data[19].values, data[13].values, data[20].values, data[14].values, plotDefaultConfig, plotDefaultConfig.AGN_COLORS[2]));
        plotlyConfig.data.push(getAgnPlotTrace("y2", data[7].values, data[15].values, data[16].values, plotDefaultConfig, plotDefaultConfig.AGN_COLORS[3]));
        plotlyConfig.data.push(getAgnPlotTraceWithXErrorData(null, data[19].values, data[17].values, data[20].values, data[18].values, plotDefaultConfig, plotDefaultConfig.AGN_COLORS[4]));

        plotlyConfig.data.push($.extend(lcPlotlyConfig.data[0], { hoverinfo : 'x+y' }));
        for (var i = 1; i < lcPlotlyConfig.data.length; i++){
          plotlyConfig.data.push(lcPlotlyConfig.data[i]);
        }

        plotlyConfig.layout = $.extend({}, lcPlotlyConfig.layout);
        plotlyConfig.layout.yaxis.domain = [0, 0.166];
        plotlyConfig.layout.yaxis.title = currentObj.axisLabels[0];

        plotlyConfig.layout.yaxis2 = $.extend({}, plotlyConfig.layout.yaxis);
        plotlyConfig.layout.yaxis2.domain = [0.166, 0.333];
        plotlyConfig.layout.yaxis2.title = currentObj.axisLabels[1];

        plotlyConfig.layout.yaxis3 = $.extend({}, plotlyConfig.layout.yaxis);
        plotlyConfig.layout.yaxis3.domain = [0.333, 0.50];
        plotlyConfig.layout.yaxis3.title = currentObj.axisLabels[2];

        plotlyConfig.layout.yaxis4 = $.extend({}, plotlyConfig.layout.yaxis);
        plotlyConfig.layout.yaxis4.domain = [0.50, 0.666];
        plotlyConfig.layout.yaxis4.title = currentObj.axisLabels[3];

        plotlyConfig.layout.yaxis5 = $.extend({}, plotlyConfig.layout.yaxis);
        plotlyConfig.layout.yaxis5.domain = [0.666, 0.833];
        plotlyConfig.layout.yaxis5.title = currentObj.axisLabels[4];

        plotlyConfig.layout.yaxis6 = $.extend({}, plotlyConfig.layout.yaxis);
        plotlyConfig.layout.yaxis6.domain = [0.833, 1];
        plotlyConfig.layout.yaxis6.title = currentObj.axisLabels[5];

      }

      if ((data[22].values.length > 0) && (data[22].values[0] != "")){
          this.showWarn(data[22].values[0]);
      }

    } else {
      currentObj.btnSettings.hide();
    }

    plotlyConfig = this.prepareAxis(plotlyConfig);

    return plotlyConfig;
  }

  this.saveAsCSV = function () {
    var data = currentObj.data;
    if (!isNull(data)){
      var csvContent = "data:text/csv;charset=utf-8,";
      data[0].values.forEach(function(values, index){
        var infoArray = [];
        for (col = 0; col < data.length; col++) {
          infoArray.push(data[col].values[index]);
        }
        dataString = Array.prototype.join.call(infoArray, ",");
        csvContent += index < data[0].values.length ? dataString + "\n" : dataString;
      });
      saveRawToFile(currentObj.getTitle() + ".csv", encodeURI(csvContent));
    }
  }

  this.getCoordsFromPlotlyHoverEvent = function (){
    return null;
  }

  this.showAddAnnotationDialog = function (x, y){
    log ("Annotations not supported!, AgnPlot id: " + this.id);
  }

  this.addTitleAndAxisLabelsToStyleJQElem = function ($style) {

    //Adds the title style controls
    $style.append(getTextBox ("TITLE" + this.id, "inputTITLE width100",
                              "Title", this.getTitle(),
                              function(value, input) {
                                currentObj.plotConfig.styles.title = value;
                                currentObj.redrawDiffered();
                              }));

    //Add the Time axis label
    $style.append(getTextBox ("LABEL_TIME_" + this.id, "inputLABELTIME width100",
                              "Label Time", this.getLabel(0),
                              function(value, input) {
                                currentObj.setLabel(0, value);
                                currentObj.redrawDiffered();
                              }));

    //Adds the axis labels style controls
    for (i in this.axisLabels){
      $style.append(getTextBox ("LABEL_" + i + "_" + this.id, "inputLABEL" + i + " width100",
                                "Label " + i, this.axisLabels[i],
                                function(value, input) {
                                  var i = input.attr("name").split("_")[1];
                                  currentObj.axisLabels[i] = value;
                                  currentObj.plotStyle.axisLabels = currentObj.axisLabels; //Saves axisLabels on plotStyle
                                  currentObj.redrawDiffered();
                                }));
    }

    return $style;
  }

  //Sets default plot.setLegendText, that was overriden on LcPlot
  this.setLegendText = function (text) {
   this.$hoverinfo.html(text);
  }

  log ("new AgnPlot id: " + this.id);

  return this;
}
