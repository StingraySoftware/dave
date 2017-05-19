
//Adds new Fit Tab Panel
function addFitTabPanel(navBarList, panelContainer, plot, projectConfig){
  tab = new FitTabPanel("Tab_" + tabPanels.length, "TabPanelTemplate", "NavItem_" + tabPanels.length, theService, navBarList, panelContainer, plot, projectConfig);
}

function FitTabPanel (id, classSelector, navItemClass, service, navBarList, panelContainer, plot, projectConfig) {

  var currentObj = this;
  tabPanels.push(this); // Insert on tabPanels here for preparing access to getTabForSelector from plots

  TabPanel.call(this, id, classSelector, navItemClass, service, navBarList, panelContainer);

  //FitTabPanel METHODS:
  this.addPlot = function (plot){
    this.outputPanel.plots.push(plot);
    this.projectConfig.plots.push(plot);
    this.outputPanel.appendPlot(plot);
  };

  this.onModelsChanged = function (){
    currentObj.plot.refreshModelsData(false);
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
    paramsData.n_iter = 100;
    paramsData.mean = 0.1;
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
                                    '<label for="mean">Lightcurve mean:</label>' +
                                    '<input name="mean" id="mean_' + currentObj.id + '" class="input_mean" type="text" placeholder="' + paramsData.mean + '" value="' + paramsData.mean + '" />' +
                                  '</div>' +
                                  '<div class="row">' +
                                    '<label for="red_noise">Red noise level:</label>' +
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
             } else {
               log("Bootstrap wrong data received!!");
             }

             waitingDialog.hide();

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
  }

  this.addInfoPanel = function ( statsData ) {
    this.outputPanel.$body.find(".infoPanel").remove();
    this.infoPanel = new InfoPanel("infoPanel", "Fitting statistics:", statsData, [], null);
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

  //Set the selected plot configs
  this.projectConfig.updateFromProjectConfigs([ projectConfig ]);

  this.modelSelector = new ModelSelector(this.id + "_modelSelector_" + (new Date()).getTime(),
                                        this.onModelsChanged,
                                        this.onFitClicked,
                                        this.applyBootstrap);

  this.plot = new FitPlot(plot.id + "_" + (new Date()).getTime(),
                           $.extend(true, {}, plot.plotConfig),
                           this.modelSelector.getModels,
                           plot.getDataFromServerFn,
                           service.request_plot_data_from_models,
                           this.outputPanel.onFiltersChangedFromPlot,
                           this.outputPanel.onPlotReady,
                           null,
                           "fullWidth",
                           false,
                           this.projectConfig);

  this.setTitle("Fit " + this.plot.plotConfig.styles.title);
  this.wfSelector.find(".loadBtn").html('<i class="fa fa-fw fa-line-chart"></i>Models');

  this.toolPanel.clearFileSelectors();
  var label = isNull(this.plot.plotConfig.styles.title) ? "File: " + this.plot.plotConfig.filename : this.plot.plotConfig.styles.title;
  this.toolPanel.addSelectedFile(label, this.plot.plotConfig.filename);
  this.toolPanel.$html.find(".fileSelectorsContainer").append(this.modelSelector.$html);

  this.outputPanel.getFilters = function () {
    return currentObj.plot.plotConfig.filters;
  }
  this.addPlot(this.plot);

  log("FitTabPanel ready! id: " + this.id);
}
