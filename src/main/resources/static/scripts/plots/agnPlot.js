//Long-term variance AGN plot

function AgnPlot(id, plotConfig, getDataFromServerFn, onFiltersChangedFn, onPlotReadyFn, toolbar, cssClass, switchable) {

  var currentObj = this;

  plotConfig.styles.selectable = false;
  plotConfig.styles.title += " Long-term Variability";

  LcPlot.call(this, id, plotConfig, getDataFromServerFn, onFiltersChangedFn, onPlotReadyFn, toolbar, cssClass, switchable);

  //AGN plot attributes:
  this.variance_opts = {};
  this.variance_opts.min_counts = { default:100, min:1, max: 100000}; //Minimum number of counts for each chunk on excess variance
  this.variance_opts.min_bins = { default:100, min:1, max: 100000}; //Minimum number of time bins on excess variance
  this.plotConfig.variance_opts = {};

  this.btnFullScreen.remove();

  //AGN plot methods:
  this.getPlotlyConfig = function (data) {

    var coords = currentObj.getSwitchedCoords( { x: 0, y: 1} );

    var dataWithGaps = this.addGapsToData(data[0].values, data[1].values, data[2].values, currentObj.plotConfig.dt * 5);

    var plotlyConfig = { data: [], layout: {} };
    var lcPlotlyConfig = get_plotdiv_lightcurve(dataWithGaps[0], dataWithGaps[1],
                                        [], dataWithGaps[2],
                                        (data.length > 4) ? currentObj.getWtiRangesFromGtis(data[3].values, data[4].values, data[0].values) : [],
                                        currentObj.plotConfig.styles.labels[coords.x],
                                        "x",
                                        currentObj.plotConfig.styles.title);
    if (data.length == 20) {

      lcPlotlyConfig.data[0].yaxis = 'y6';

      if (data[5].values.length > 0) {
        //Lightcurve has baseline values
        lcPlotlyConfig.data.push({
                                type : 'scatter',
                                yaxis : 'y6',
                                showlegend : false,
                                hoverinfo : 'x+y',
                                connectgaps : false,
                                x : data[0].values,
                                y : data[5].values,
                                line : {
                                        color : '#DD3333'
                                      }
                              });
      }

      if (data[6].values.length > 0) {

        //Lightcurve has Long-term variability AGN values
        plotlyConfig.data.push(getAgnPlotTrace("y5", data[6].values, data[8].values, data[9].values));
        plotlyConfig.data.push(getAgnPlotTrace("y4", data[6].values, data[10].values, data[11].values));
        plotlyConfig.data.push(getAgnPlotTraceWithXErrorData("y3", data[18].values, data[12].values, data[19].values, data[13].values));
        plotlyConfig.data.push(getAgnPlotTrace("y2", data[6].values, data[14].values, data[15].values));
        plotlyConfig.data.push(getAgnPlotTraceWithXErrorData(null, data[18].values, data[16].values, data[19].values, data[17].values));

        plotlyConfig.data.push($.extend(lcPlotlyConfig.data[0], { hoverinfo : 'x+y' }));
        if (lcPlotlyConfig.data.length > 1) {
          plotlyConfig.data.push(lcPlotlyConfig.data[1]);
        }

        plotlyConfig.layout = $.extend({}, lcPlotlyConfig.layout);
        plotlyConfig.layout.yaxis.domain = [0, 0.166];
        plotlyConfig.layout.yaxis.title = "<Fvar>";

        plotlyConfig.layout.yaxis2 = $.extend({}, plotlyConfig.layout.yaxis);
        plotlyConfig.layout.yaxis2.domain = [0.166, 0.333];
        plotlyConfig.layout.yaxis2.title = "Fvar";

        plotlyConfig.layout.yaxis3 = $.extend({}, plotlyConfig.layout.yaxis);
        plotlyConfig.layout.yaxis3.domain = [0.333, 0.50];
        plotlyConfig.layout.yaxis3.title = "<S2>";

        plotlyConfig.layout.yaxis4 = $.extend({}, plotlyConfig.layout.yaxis);
        plotlyConfig.layout.yaxis4.domain = [0.50, 0.666];
        plotlyConfig.layout.yaxis4.title = "S2";

        plotlyConfig.layout.yaxis5 = $.extend({}, plotlyConfig.layout.yaxis);
        plotlyConfig.layout.yaxis5.domain = [0.666, 0.833];
        plotlyConfig.layout.yaxis5.title = "<x>";

        plotlyConfig.layout.yaxis6 = $.extend({}, plotlyConfig.layout.yaxis);
        plotlyConfig.layout.yaxis6.domain = [0.833, 1];
        plotlyConfig.layout.yaxis6.title = "x";
      }
    } else {
      currentObj.btnSettings.hide();
    }

    plotlyConfig = currentObj.prepareAxis(plotlyConfig);

    /*
    //Shows plot Fvar Vs Count Rate
    plotlyConfig = get_plotdiv_scatter_with_errors(data[7].values, data[9].values,
                                                  data[8].values, data[10].values,
                                                  "Count rate", "Fvar",
                                                  currentObj.plotConfig.styles.title + " Excess Variance");
    plotlyConfig.data[0].hoverinfo = 'x+y';
    plotlyConfig.layout.xaxis.type = 'log';
    plotlyConfig.layout.xaxis.autorange = true;
    plotlyConfig.layout.yaxis.type = 'log';
    plotlyConfig.layout.yaxis.autorange = true;
    */

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
      var encodedUri = encodeURI(csvContent);
      var link = document.createElement("a");
      link.setAttribute("href", encodedUri);
      link.setAttribute("download", currentObj.plotConfig.styles.title + ".csv");
      link.click();
    }
  }

  this.getCoordsFromPlotlyHoverEvent = function (){
    return null;
  }

  log ("new AgnPlot id: " + this.id);

  return this;
}
