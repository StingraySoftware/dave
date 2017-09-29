//Fit plot for fitting PDS plots
var CombinedModelColor = '#FF0000';

function FitPlot(id, plotConfig, getModelsFn, getDataFromServerFn, getModelsDataFromServerFn, onFiltersChangedFn, onPlotReadyFn, toolbar, cssClass, switchable, projectConfig) {

  var currentObj = this;
  plotConfig.styles.showFitBtn = false;
  var tmpPlotConfig = $.extend(true, {}, plotConfig);

  PDSPlot.call(this, id, plotConfig, getDataFromServerFn, onFiltersChangedFn, onPlotReadyFn, toolbar, cssClass, switchable, projectConfig);

  this.plotConfig = tmpPlotConfig;
  this.getModelsFn = getModelsFn;
  this.getModelsDataFromServerFn = getModelsDataFromServerFn;
  this.models = [];
  this.modelsData = null;
  this.estimatedModels = [];
  this.errorsData = null;

  this.btnFullScreen.remove();
  this.btnSettings.remove();
  this.btnLoad.remove();

  this.onPlotDataReceived = function ( data ) {

    if (!isNull(data.abort)){
      log("Current request aborted, Plot: " + currentObj.id);
      if (data.statusText == "error"){
        //If abort cause is because python server died
        currentObj.setReadyState(true);
        currentObj.showWarn("Connection lost!");
      }
      return; //Comes from request abort call.
    }

    log("onPlotDataReceived passed data!, plot" + currentObj.id);
    data = JSON.parse(data);

    if (!isNull(data)) {
      if (isNull(data.error)) {

        //Prepares PDS Data
        currentObj.data = currentObj.prepareData(data);
        currentObj.updateMinMaxCoords();

        currentObj.refreshModelsData(false);
        return;

      } else {
        currentObj.showWarn(data.error);
        log("onPlotDataReceived data error: " + data.error + ", plot" + currentObj.id);
      }
    } else {
      currentObj.showWarn("Wrong data received");
      log("onPlotDataReceived wrong data!, plot" + currentObj.id);
    }

    currentObj.setReadyState(true);
    currentObj.onPlotReady();
  }

  this.refreshModelsData = function (estimated) {
    var modelsConfig = { x_values: currentObj.data[0].values, estimated: estimated = isNull(estimated) || !estimated };

    if (modelsConfig.estimated){
      currentObj.errorsData = null;
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
          currentObj.setData(currentObj.data, currentObj.modelsData, null, currentObj.errorsData);
        }
      } else {
        currentObj.setData(currentObj.data, currentObj.modelsData, data, currentObj.errorsData);
      }
    } else {
      currentObj.showWarn("Wrong models data received");
      log("onModelsDataReceived wrong models data!, plot" + currentObj.id);
      currentObj.setReadyState(true);
      currentObj.onPlotReady();
    }
  }

  this.setErrorData = function (values, errors) {
    if (!isNull(values) && !isNull(errors)) {
      currentObj.errorsData = { values : values, errors: errors };
      currentObj.setData(currentObj.data, currentObj.modelsData, null, currentObj.errorsData);
    }
  }

  this.updatePlotConfig = function () {}

  this.setData = function ( data, modelsData, estimatedModelsData, errorsData ) {

    currentObj.showWarn("");

    if (isNull(data) || isNull(modelsData)) {

      currentObj.showWarn("Wrong data received");
      log("setData wrong passed data!, plot" + currentObj.id);

    } else {

      var plotlyConfig = currentObj.getPlotlyConfig(data);

      if (modelsData.length > 0) {
        plotlyConfig = this.preparePlotConfigWithModelsData (plotlyConfig, data, modelsData, currentObj.models, false, isNull(errorsData));
      } else {
        log("setData no models data received, plot" + currentObj.id);
      }

      if (!isNull(estimatedModelsData) && estimatedModelsData.length > 0) {
        plotlyConfig = this.preparePlotConfigWithModelsData (plotlyConfig, data, estimatedModelsData, currentObj.estimatedModels, true, isNull(errorsData));
      } else {
        log("setData no estimatedModelsData data received, plot" + currentObj.id);
      }

      if (!isNull(errorsData)) {
        plotlyConfig = this.preparePlotConfigWithErrorsData (plotlyConfig, data, errorsData);
      } else {
        log("setData no errorsData data received, plot" + currentObj.id);
      }

      currentObj.redrawPlot(plotlyConfig);

      if (currentObj.data.length == 0 || currentObj.data[0].values.length == 0){
        currentObj.showWarn("Empty plot data");
      }

    }

    currentObj.setReadyState(true);
    currentObj.onPlotReady();
  }

  this.preparePlotConfigWithModelsData = function (plotlyConfig, data, modelsData, models, estimated, showAllModels) {

    for (m in modelsData) {
      var model = modelsData[m];
      if (model.values.length > 0) {
        if (showAllModels || isNull(models[m])) {
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
          }
      } else {
        log("setData no values received for model: " + m + ", plot" + currentObj.id);
      }
    }

    return plotlyConfig;
  }

  this.preparePlotConfigWithErrorsData = function (plotlyConfig, data, errorsData) {

    if (errorsData.values.length > 0) {

      //Prepares trace for error data values
      if (currentObj.plotConfig.plotType == "X*Y") {
        for (i in errorsData.values) {
          errorsData.values[i] = errorsData.values[i] * data[0].values[i];
          errorsData.errors[i] = errorsData.errors[i] * data[0].values[i];
        }
      }

      var errors_x = [];
      var errors_vals = [];
      for (i = 0; i < errorsData.values.length; i++ ) {
        errors_x.push(data[0].values[i]);
        errors_vals.push(errorsData.values[i] + Math.abs(errorsData.errors[i]));
      }
      for (i = errorsData.values.length - 1; i >= 0; i-- ) {
        errors_x.push(data[0].values[i]);
        errors_vals.push(errorsData.values[i] - Math.abs(errorsData.errors[i]));
      }

      plotlyConfig.data.push({
                              type : 'scatter',
                              showlegend : false,
                              hoverinfo : 'none',
                              connectgaps : false,
                              x : errors_x,
                              y : errors_vals,
                              fill: "tozerox",
                              fillcolor: "rgba(0,246,176,0.2)",
                              line: {
                                      color: "transparent",
                                      shape	:	'hvh'
                                    }
                            });

      plotlyConfig.data.push({
                              type : 'scatter',
                              showlegend : false,
                              hoverinfo : 'none',
                              connectgaps : false,
                              x : data[0].values,
                              y : errorsData.values,
                              line : {
                                      width : 3,
                                      color : "rgb(0,246,176)",
                                      shape	:	'hvh'
                                    }
                            });
    } else {
      log("setData no error values received, plot" + currentObj.id);
    }

    return plotlyConfig;
  }

  this.showAddAnnotationDialog = function (x, y){
    log ("Annotations not supported!, FitPlot id: " + this.id);
  }

  log ("new FitPlot id: " + this.id);

  return this;
}
