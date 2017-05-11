//Dynamical spectrum plots

function DynSpPlot(id, plotConfig, getDataFromServerFn, onFiltersChangedFn, onPlotReadyFn, toolbar, cssClass, switchable, projectConfig) {

  var currentObj = this;

  PDSPlot.call(this, id, plotConfig, getDataFromServerFn, onFiltersChangedFn, onPlotReadyFn, toolbar, cssClass, switchable, projectConfig);

  this.plotConfig.yAxisType = "linear";
  this.plotConfig.zAxisType = "log";
  this.plotConfig.plotStyle = "3d";

  this.btnFullScreen.unbind("click").click(function( event ) {
    if (currentObj.$html.hasClass("fullScreen")) {
      currentObj.btnFullScreen.find("i").switchClass( "fa-compress", "fa-arrows-alt");
    } else {
      currentObj.btnFullScreen.find("i").switchClass( "fa-arrows-alt", "fa-compress");
    }
    currentObj.$html.toggleClass("fullScreen");
    currentObj.resize();
  });

  //If plot is pds adds Fits button to plot
  this.btnStyle = $('<button class="btn btn-default btnStyle">2D</button>');
  this.$html.find(".plotTools").prepend(this.btnStyle);
  this.btnStyle.click(function(event){
    if (currentObj.plotConfig.plotStyle == "3d") {
      currentObj.plotConfig.plotStyle = "2d";
      currentObj.btnStyle.html("3D");
      currentObj.settingsPanel.find(".AxisType").hide();
    } else {
      currentObj.plotConfig.plotStyle = "3d";
      currentObj.btnStyle.html("2D");
      currentObj.settingsPanel.find(".AxisType").show();
    }
    currentObj.refreshData();
  });

  this.btnFit.remove();

  this.prepareData = function (data) {

    if (!isNull(data) && data.length == 5) {
      if (this.plotConfig.rebinEnabled && this.plotConfig.rebinSize != 0) {
        try {
          for (pds_idx in data[1].values) {
            var rebinnedData = this.rebinData(data[0].values, data[1].values[pds_idx].values, this.plotConfig.rebinSize, "sum");
            data[0].values = rebinnedData.x;
            data[1].values[pds_idx].values = rebinnedData.y;
          }
        } catch (ex) {
          log("Rebin plot data " + this.id + " error: " + ex);
        }
      } else if (data[0].values.length > 1) {
          this.plotConfig.minRebinSize = data[0].values[1] - data[0].values[0];
          this.plotConfig.maxRebinSize = (data[0].values[data[0].values.length - 1] - data[0].values[0]) / 4;
      }

      if (currentObj.plotConfig.plotType == "X*Y") {
        for (pds_idx in data[1].values) {
          for (i in data[0].values) {
            data[1].values[pds_idx].values[i] = data[1].values[pds_idx].values[i] * data[0].values[i];
          }
        }
      }

      if (data[3].values.length > 0
          && data[3].values[0] > 0) {
        this.plotConfig.duration = data[3].values[0];
      }
    } else {
      this.showWarn("Wrong data received");
    }

    return data;
  }

  this.getPlotlyConfig = function (data) {

    var zLabel = currentObj.plotConfig.styles.labels[2];
    if (currentObj.plotConfig.plotType == "X*Y") {
      zLabel += " X " + currentObj.plotConfig.styles.labels[0];
    }

    var plotlyConfig = null;
    if (currentObj.plotConfig.plotStyle == "2d") {

      //ZDATA is an array of arrays with the powers of each time as values
      var z_data=[];
      for (freq_idx in data[0].values) {
        var powers_for_time_data=[];
        for (time_idx in data[2].values) {
          powers_for_time_data.push(data[1].values[time_idx].values[freq_idx]);
        }
        z_data.push(powers_for_time_data);
      }

      plotlyConfig = get_plotdiv_dynamical_spectrum(data[2].values,
                                                      data[0].values,
                                                      z_data,
                                                      currentObj.plotConfig.styles.labels[1],
                                                      currentObj.plotConfig.styles.labels[0],
                                                      zLabel,
                                                      currentObj.plotConfig.styles.title);
      plotlyConfig.data[0].type = "heatmap";

    } else {

      //ZDATA is a flattened array with the powers
      var z_data=[];
      for (pds_idx in data[1].values) {
        z_data.push(data[1].values[pds_idx].values);
      }

      plotlyConfig = get_plotdiv_dynamical_spectrum(data[0].values,
                                                      data[2].values,
                                                      z_data,
                                                      currentObj.plotConfig.styles.labels[0],
                                                      currentObj.plotConfig.styles.labels[1],
                                                      zLabel,
                                                      currentObj.plotConfig.styles.title);

      //Set axis type for 3D plot only, log axes not supported on heatmaps
      if (currentObj.plotConfig.xAxisType == "log") {
        plotlyConfig.layout.scene.xaxis.type = 'log';
        plotlyConfig.layout.scene.xaxis.autorange = true;
      }

      if (currentObj.plotConfig.yAxisType == "log") {
        plotlyConfig.layout.scene.yaxis.type = 'log';
        plotlyConfig.layout.scene.yaxis.autorange = true;
      }

      if (currentObj.plotConfig.zAxisType == "log") {
        plotlyConfig.layout.scene.zaxis.type = 'log';
        plotlyConfig.layout.scene.zaxis.autorange = true;
      }

    }

    return plotlyConfig;
  }

  this.registerPlotEvents = function () {
    //Dynamical spectrum plot events disabled
  }

  this.getWarnMsg = function (){
    if (this.data != null) {
      if (this.data[4].values.length > 0) {
        return this.data[4].values[0];
      }
    }
    return "";
  }

  this.saveAsCSV = function () {
    var data = currentObj.data;
    if (!isNull(data)){
      var csvContent = "data:text/csv;charset=utf-8,";
      for (time_idx in data[2].values) {
        for (frec_idx in data[0].values) {
          var infoArray = [data[2].values[time_idx], data[0].values[frec_idx], data[1].values[time_idx].values[frec_idx]];
          dataString = Array.prototype.join.call(infoArray, ",");
          csvContent += time_idx < data[2].values.length ? dataString + "\n" : dataString;
        }
      }
      var encodedUri = encodeURI(csvContent);
      var link = document.createElement("a");
      link.setAttribute("href", encodedUri);
      link.setAttribute("download", currentObj.plotConfig.styles.title + ".csv");
      link.click();
    }
  }

  log ("new DynSpPlot id: " + this.id);

  return this;
}
