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
  this.modelsData = null;
  this.estimatedModels = [];

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

      currentObj.refreshModelsData(false);

    } else {
      currentObj.showWarn("Wrong data received");
      log("onPlotDataReceived wrong data!, plot" + currentObj.id);
      currentObj.setReadyState(true);
      currentObj.onPlotReady();
    }
  }

  this.refreshModelsData = function (estimated) {
    var modelsConfig = { x_values: currentObj.data[0].values, estimated: estimated = isNull(estimated) || !estimated };

    if (modelsConfig.estimated){
      currentObj.modelsData = null;
      currentObj.models = currentObj.getModelsFn(false);
      modelsConfig.models = currentObj.models;
    } else {
      currentObj.estimatedModels = currentObj.getModelsFn(true);
      modelsConfig.models = currentObj.estimatedModels;
    }

    currentObj.getModelsDataFromServerFn( modelsConfig, currentObj.onModelsDataReceived );
  }

  this.onModelsDataReceived = function ( data ) {
    log("onModelsDataReceived passed data!, plot" + currentObj.id);
    data = JSON.parse(data);

    if (data != null && currentObj.data != null) {
      if (isNull(currentObj.modelsData)) {
        currentObj.modelsData = data;
        if (currentObj.getModelsFn(true).length > 0){
          currentObj.refreshModelsData (true);
        } else {
          currentObj.setData(currentObj.data, currentObj.modelsData);
        }
      } else {
        currentObj.setData(currentObj.data, currentObj.modelsData, data);
      }
    } else {
      currentObj.showWarn("Wrong models data received");
      log("onModelsDataReceived wrong models data!, plot" + currentObj.id);
      currentObj.setReadyState(true);
      currentObj.onPlotReady();
    }
  }

  this.updatePlotConfig = function () {}

  this.setData = function ( data, modelsData, estimatedModelsData ) {

    currentObj.updatePlotConfig();

    currentObj.showWarn("");

    if (isNull(data) || isNull(modelsData)) {

      currentObj.showWarn("Wrong data received");
      log("setData wrong passed data!, plot" + currentObj.id);

    } else {

      var plotlyConfig = currentObj.getPlotlyConfig(data);

      if (modelsData.length > 0) {
        plotlyConfig = this.preparePlotConfigWithModelsData (plotlyConfig, data, modelsData, currentObj.models, false);
      } else {
        log("setData no models data received, plot" + currentObj.id);
      }

      if (!isNull(estimatedModelsData) && estimatedModelsData.length > 0) {
        plotlyConfig = this.preparePlotConfigWithModelsData (plotlyConfig, data, estimatedModelsData, currentObj.estimatedModels, true);
      } else {
        log("setData no estimatedModelsData data received, plot" + currentObj.id);
      }

      currentObj.redrawPlot(plotlyConfig);

      if (currentObj.data.length == 0 || currentObj.data[0].values.length == 0){
        currentObj.showWarn("Empty plot data");
      }

    }

    currentObj.setReadyState(true);
    currentObj.onPlotReady();
  }

  this.preparePlotConfigWithModelsData = function (plotlyConfig, data, modelsData, models, estimated) {

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
                                        width : isNull(models[m]) ? 3 : 2,
                                        color : isNull(models[m]) ? CombinedModelColor : models[m].color,
                                        dash : isNull(estimated) || !estimated ? "solid" : "dash",
                                      }
                              });
      } else {
        log("setData no values received for model: " + m + ", plot" + currentObj.id);
      }
    }

    return plotlyConfig;
  }

  log ("new FitPlot id: " + this.id);

  return this;
}
