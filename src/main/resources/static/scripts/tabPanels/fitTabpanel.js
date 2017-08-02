
//Adds new Fit Tab Panel
function addFitTabPanel(navBarList, panelContainer, plotConfig, projectConfig, id, navItemClass){
  return new FitTabPanel(!isNull(id) ? id : "Tab_" + tabPanels.length,
                        "TabPanelTemplate",
                        !isNull(navItemClass) ? navItemClass : "NavItem_" + tabPanels.length,
                        theService,
                        navBarList,
                        panelContainer,
                        plotConfig,
                        projectConfig);
}

function FitTabPanel (id, classSelector, navItemClass, service, navBarList, panelContainer, plotConfig, projectConfig) {

  var currentObj = this;
  tabPanels.push(this); // Insert on tabPanels here for preparing access to getTabForSelector from plots

  WfTabPanel.call(this, id, classSelector, navItemClass, service, navBarList, panelContainer);

  //FitTabPanel METHODS:
  this.addPlot = function (plot){
    this.outputPanel.plots.push(plot);
    this.projectConfig.plots.push(plot);
    this.outputPanel.appendPlot(plot);
  };

  this.onModelsChanged = function (){
    if (!isNull(currentObj.plot)){
      currentObj.plot.refreshModelsData(false);
    } else {
      log("Plot not created yet, FitTabPanel: " + currentObj.id);
    }
  };

  this.onFitClicked = function (){

    waitingDialog.show('Fitting power spectrum...');

    var paramsData = $.extend(true, {}, currentObj.plot.plotConfig);
    paramsData.models = currentObj.modelSelector.getModels(false);
    currentObj.modelSelector.clearAllEstimationsAndErrors();

    currentObj.service.request_fit_powerspectrum_result(paramsData, function( jsdata ) {

      log("FitData received!, FitTabPanel: " + currentObj.id);
      var data = JSON.parse(jsdata);
      if (!isNull(data) && data.length > 0) {
        currentObj.modelSelector.setEstimation(data[0].values, true);
        data[1].values.count = currentObj.plot.data[0].values.length;
        currentObj.addInfoPanel(data[1].values);
        waitingDialog.hide();
      } else {
        showError();
      }
    });

  };

  this.applyBootstrap = function () {

    var paramsData = $.extend(true, {}, currentObj.plot.plotConfig);
    paramsData.models = currentObj.modelSelector.getModels(false);
    paramsData.n_iter = 250;
    paramsData.mean = 0;
    paramsData.red_noise = 1;
    paramsData.seed = -1;

    var $bootstrapDialog = $('<div id="dialog_' + currentObj.id +  '" title="Bootstrap settings:">' +
                              '<form>' +
                                '<fieldset>' +
                                  '<div class="row">' +
                                    '<label for="n_iter">Number of iterations:</label>' +
                                    '<input name="n_iter" id="n_iter_' + currentObj.id + '" class="input_n_iter" type="text" placeholder="' + paramsData.n_iter + '" value="' + paramsData.n_iter + '" />' +
                                  '</div>' +
                                  '<div class="row">' +
                                    '<label for="mean">Lightcurve mean (default = 0):</label>' +
                                    '<input name="mean" id="mean_' + currentObj.id + '" class="input_mean" type="text" placeholder="' + paramsData.mean + '" value="' + paramsData.mean + '" />' +
                                  '</div>' +
                                  '<div class="row">' +
                                    '<label for="red_noise">Red noise level (default = 1):</label>' +
                                    '<input name="red_noise" id="red_noise_' + currentObj.id + '" class="input_red_noise" type="text" placeholder="' + paramsData.red_noise + '" value="' + paramsData.red_noise + '" />' +
                                  '</div>' +
                                  '<div class="row">' +
                                    '<label for="seed">Random Seed (Set <0 for default):</label>' +
                                    '<input name="seed" id="seed_' + currentObj.id + '" class="input_seed" type="text" placeholder="' + paramsData.seed + '" value="' + paramsData.seed + '" />' +
                                  '</div>' +
                                '</fieldset>' +
                              '</form>' +
                            '</div>');

    $bootstrapDialog.find("input").on('change', function(){
      try {
        var params = ["n_iter", "mean", "red_noise", "seed"];
        for (p in params){
          var paramName = params[p];
          var value = getInputFloatValue($bootstrapDialog.find(".input_" + paramName), paramsData[paramName]);
          if (paramsData[paramName] != value){
            if (isInt(paramsData[paramName])) {
              paramsData[paramName] = Math.floor(value);
            } else {
              paramsData[paramName] = value;
            }
          }
        }
      } catch (e) {
        log("bootstrapDialog onValuesChanged error: " + e);
      }
    });

    currentObj.$html.append($bootstrapDialog);
    $bootstrapDialog.dialog({
       height: 220,
       width: 350,
       modal: true,
       buttons: {
         'Apply Bootstrap': function() {

           currentObj.service.request_bootstrap_results( paramsData, function( jsdata ) {

             log("Bootstrap data received!, FitTabPanel: " + currentObj.id);
             var data = JSON.parse(jsdata);
             if (!isNull(data) && data.length > 0) {
               currentObj.modelSelector.setEstimation(data[0].values, false);
               currentObj.plot.setErrorData(data[1].values, data[2].values);
               waitingDialog.hide();
             } else {
               showError("Bootstrap wrong data received!!");
             }

           });

            $(this).dialog('close');
            $bootstrapDialog.remove();

            waitingDialog.show('Applying Bootstrap...');
         },
         'Cancel': function() {
            $(this).dialog('close');
            $bootstrapDialog.remove();
         }
       }
     });
     $bootstrapDialog.parent().find(".ui-dialog-titlebar-close").html('<i class="fa fa-times" aria-hidden="true"></i>');
  }

  this.addInfoPanel = function ( statsData ) {
    this.infoPanelData = statsData;
    this.outputPanel.$body.find(".infoPanel").remove();
    this.infoPanel = new InfoPanel("infoPanel", "Fitting statistics", statsData, [], null);
    this.infoPanel.redraw = function() {

      var content = "<tr><td> Number of data points = " + this.header.count + "</td></tr>";

      if (this.header.deviance != "ERROR") {
        content += "<tr><td> Deviance [-2 log L] D = " + this.header.deviance.toFixed(3) + "</td></tr>" +
                    "<tr><td> The Akaike Information Criterion of the model is: " + this.header.aic.toFixed(3) + "</td></tr>" +
                    "<tr><td> The Bayesian Information Criterion of the model is: " + this.header.bic.toFixed(3) + "</td></tr>";
      } else {
        content += "<tr><td> Deviance [-2 log L] D = ERROR: DEVIANCE NOT CALCULATED </td></tr>";
      }

      if (this.header.merit != "ERROR") {
        content += "<tr><td> The figure-of-merit function for this model is: " + this.header.merit.toFixed(3) + " and the fit for " + this.header.dof.toFixed(3) + " dof is " + this.header.dof_ratio.toFixed(3) + "</td></tr>" +
                    "<tr><td> Summed Residuals S = " + this.header.sobs.toFixed(3) + "</td></tr>" +
                    "<tr><td> Expected S ~ " + this.header.sexp.toFixed(3) + " +/- " + this.header.ssd.toFixed(3) + "</td></tr>" +
                    "<tr><td> Merit function (SSE) M = " + this.header.merit.toFixed(3) + "</td></tr>";
      } else {
        content += "<tr><td> Merit function (SSE) M = ERROR: MERIT NOT CALCULATED</td></tr>";
      }

      this.container.html(content);
    }
    this.infoPanel.redraw();
    this.outputPanel.$body.append(this.infoPanel.$html);
  }

  this.getConfig = function () {
    return { type: "FitTabPanel",
             id: this.id,
             navItemClass: this.navItemClass,
             plotConfig: this.plot.getConfig(),
             projectConfig: this.projectConfig.getConfig(),
             modelsConfig: this.modelSelector.getConfig(),
             infoPanelData: this.infoPanelData
           };
  }

  this.setConfig = function (tabConfig, callback) {
    log("setConfig for tab " + this.id);

    this.projectConfig = $.extend( this.projectConfig, tabConfig.projectConfig );
    this.modelSelector.setConfig( tabConfig.modelsConfig );
    this.createFitPlot();
    this.outputPanel.setConfig( [tabConfig.plotConfig] );
    this.plot.onDatasetValuesChanged(this.outputPanel.getFilters());

    if (!isNull(tabConfig.infoPanelData)){
      this.addInfoPanel(tabConfig.infoPanelData);
    }

    callback();
  }

  this.createFitPlot = function () {

    //Set the selected plot configs
    this.plot = new FitPlot(this.outputPanel.generatePlotId("FitPlot_" + plotConfig.filename),
                             $.extend(true, {}, plotConfig),
                             this.modelSelector.getModels,
                             service.request_power_density_spectrum,
                             service.request_plot_data_from_models,
                             this.outputPanel.onFiltersChangedFromPlot,
                             this.outputPanel.onPlotReady,
                             null,
                             "fullWidth",
                             false,
                             this.projectConfig);

    this.setTitle("Fit " + this.plot.plotConfig.styles.title);

    var label = isNull(this.plot.plotConfig.styles.title) ? "File: " + this.plot.plotConfig.filename : this.plot.plotConfig.styles.title;
    this.toolPanel.addSelectedFile(label, this.plot.plotConfig.filename);
    this.toolPanel.$html.find(".fileSelectorsContainer").append(this.modelSelector.$html);

    this.addPlot(this.plot);
  }

  //FitTabPanel Initialzation:
  this.infoPanelData = null;
  this.wfSelector.find(".loadBtn").html('<i class="fa fa-fw fa-line-chart"></i>Models');

  this.toolPanel.clearFileSelectors();

  this.modelSelector = new ModelSelector(this.id + "_modelSelector_" + (new Date()).getTime(),
                                        this.onModelsChanged,
                                        this.onFitClicked,
                                        this.applyBootstrap,
                                        isNull(plotConfig.styles.title) ? plotConfig.filename : plotConfig.styles.title);

  this.outputPanel.getFilters = function () {
    return currentObj.plot.plotConfig.filters;
  }

  if (!isNull(projectConfig)){
    this.projectConfig.updateFromProjectConfigs([ projectConfig ]);
    this.createFitPlot();
  }

  log("FitTabPanel ready! id: " + this.id);
}
