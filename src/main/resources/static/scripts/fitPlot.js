//Fit plot for fitting PDS plots
var CombinedModelColor = '#FF0000';

function FitPlot(id, plotConfig, getModelsFn, getDataFromServerFn, getModelsDataFromServerFn, onFiltersChangedFn, onPlotReadyFn, toolbar, cssClass, switchable, projectConfig) {

  var currentObj = this;
  var tmpPlotConfig = $.extend(true, {}, plotConfig);

  PDSPlot.call(this, id, plotConfig, getDataFromServerFn, onFiltersChangedFn, onPlotReadyFn, toolbar, cssClass, switchable, projectConfig);

  this.plotConfig = tmpPlotConfig;
  this.getModelsFn = getModelsFn;
  this.getModelsDataFromServerFn = getModelsDataFromServerFn;
  this.models = [];

  this.btnFullScreen.remove();
  this.btnFit.remove();
  this.btnSettings.hide();

  this.onPlotDataReceived = function ( data ) {
    log("onPlotDataReceived passed data!, plot" + currentObj.id);
    data = JSON.parse(data);

    if (data != null) {

      //Prepares PDS Data
      currentObj.data = currentObj.prepareData(data);
      currentObj.updateMinMaxCoords();

      currentObj.refreshModelsData();

    } else {
      currentObj.showWarn("Wrong data received");
      log("onPlotDataReceived wrong data!, plot" + currentObj.id);
      currentObj.setReadyState(true);
      currentObj.onPlotReady();
    }
  }

  this.refreshModelsData = function () {
    currentObj.models = currentObj.getModelsFn();
    var modelsConfig = { models: currentObj.models, x_values: currentObj.data[0].values };
    currentObj.getModelsDataFromServerFn( modelsConfig, currentObj.onModelsDataReceived );
  }

  this.onModelsDataReceived = function ( data ) {
    log("onModelsDataReceived passed data!, plot" + currentObj.id);
    data = JSON.parse(data);

    if (data != null && currentObj.data != null) {
      currentObj.setData(currentObj.data, data);
    } else {
      currentObj.showWarn("Wrong models data received");
      log("onModelsDataReceived wrong models data!, plot" + currentObj.id);
      currentObj.setReadyState(true);
      currentObj.onPlotReady();
    }
  }

  this.updatePlotConfig = function () {}

  this.setData = function ( data, modelsData ) {

    currentObj.updatePlotConfig();

    currentObj.showWarn("");

    if (isNull(data) || isNull(modelsData)) {

      currentObj.showWarn("Wrong data received");
      log("setData wrong passed data!, plot" + currentObj.id);

    } else {

      var plotlyConfig = currentObj.getPlotlyConfig(data);

      if (modelsData.length > 0) {
        for (m in modelsData) {
          var model = modelsData[m];
          if (model.values.length > 0) {

            //Prepares trace for model data values

            if (currentObj.plotConfig.plotType == "X*Y") {
              for (i in model.values) {
                model.values[i] = model.values[i] * data[0].values[i];
              }
            }

            plotlyConfig.data.push({
                                    type : 'scatter',
                                    showlegend : false,
                                    hoverinfo : 'none',
                                    connectgaps : false,
                                    x : data[0].values,
                                    y : model.values,
                                    line : {
                                            width : isNull(currentObj.models[m]) ? 3 : 2,
                                            color : isNull(currentObj.models[m]) ? CombinedModelColor : currentObj.models[m].color
                                          }
                                  });
          } else {
            log("setData no values received for model: " + m + ", plot" + currentObj.id);
          }
        }
      } else {
        log("setData no models data received, plot" + currentObj.id);
      }

      currentObj.redrawPlot(plotlyConfig);

      if (currentObj.data.length == 0 || currentObj.data[0].values.length == 0){
        currentObj.showWarn("Empty plot data");
      }

    }

    currentObj.setReadyState(true);
    currentObj.onPlotReady();
  }

  log ("new FitPlot id: " + this.id);

  return this;
}
