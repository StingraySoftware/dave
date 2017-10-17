
//Adds new Fit Tab Panel
function addFitTabPanel(navBarList, panelContainer, plotConfig, projectConfig, plotStyle, id, navItemClass){
  return new FitTabPanel(!isNull(id) ? id : "Tab_" + tabPanels.length,
                        "TabPanelTemplate",
                        !isNull(navItemClass) ? navItemClass : "NavItem_" + tabPanels.length,
                        theService,
                        navBarList,
                        panelContainer,
                        plotConfig,
                        projectConfig,
                        plotStyle);
}

//Subscribes the load workspace FitTabPanel function
tabPanelsLoadFns["FitTabPanel"] = function (tabConfig) {
  //Creates new Fit Tab Panel
  return addFitTabPanel($("#navbar").find("ul").first(),
                       $(".daveContainer"),
                       tabConfig.plotConfig,
                       null,
                       tabConfig.plotConfig.plotStyle,
                       tabConfig.id,
                       tabConfig.navItemClass);
}

//Fit Tab Panel
function FitTabPanel (id, classSelector, navItemClass, service, navBarList, panelContainer, plotConfig, projectConfig, plotStyle) {

  var currentObj = this;
  tabPanels.push(this); // Insert on tabPanels here for preparing access to getTabForSelector from plots

  WfTabPanel.call(this, id, classSelector, navItemClass, service, navBarList, panelContainer);

  //FitTabPanel METHODS:
  this.onModelsChanged = function (){
    if (!isNull(currentObj.plot)){
      if (!isNull(currentObj.onModelsChangedTimeout)) {
        clearTimeout(currentObj.onModelsChangedTimeout);
        currentObj.onModelsChangedTimeout = null;
      }
      currentObj.onModelsChangedTimeout = setTimeout(function(){
        currentObj.plot.refreshModelsData(false);
      }, CONFIG.INMEDIATE_TIMEOUT);
    } else {
      log("Plot not created yet, FitTabPanel: " + currentObj.id);
    }
  };

  this.onFitClicked = function (){

    waitingDialog.show('Fitting power spectrum...');

    var paramsData = $.extend(true, {}, currentObj.plot.plotConfig);
    paramsData.models = currentObj.modelSelector.getModels(false);
    currentObj.modelSelector.clearAllEstimationsAndErrors();


    currentObj.fitCallFn(paramsData, function( jsdata ) {

      log("FitData received!, FitTabPanel: " + currentObj.id);
      var data = JSON.parse(jsdata);
      if (!isNull(data) && data.length > 0) {
        currentObj.modelSelector.setEstimation(data[0].values, true);
        data[1].values.count = currentObj.plot.data[0].values.length;
        currentObj.addInfoPanel(data[1].values, null);
        waitingDialog.hide();
      } else {
        showError("Wrong fit data received!");
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

    var $bootstrapDialog = $('<div id="dialog_' + currentObj.id +  '" title="Bootstrap Settings:">' +
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

  this.showBayesianParEst = function () {

    //Get models from modelSelector
    var models = currentObj.modelSelector.getModels(false);

    //Gets analizeContainer from toolPanel.AnalyzePanel
    var $container = currentObj.toolPanel.$html.find(".analyzeContainer");
    $container.addClass("BayesianParEst");
    $container.html("");

    //Adds the back button to panel
    var btnBack = $('<button class="btn btn-default btnBack' + currentObj.id + '" data-toggle="tooltip" title="Go back to Fit"><i class="fa fa-arrow-left" aria-hidden="true"></i> Back</button>');
    $container.append(btnBack);
    btnBack.click(function(event){
      currentObj.toolPanel.showPanel("loadPanel");
    });

    //For each model add its parameters controls
    $container.append($('<h2>Prior parameters:</h2>'));
    var $priorsContainer = $('<div class="priorsContainer"></div>');
    $container.append($priorsContainer);

    for (var i = 0; i < models.length; i++) {
      var model = models[i];
      var modelParams = ModelParameters[model["type"]];
      var firstParam = true;
      for (p in modelParams){
        var paramName = modelParams[p];

        if (isNull(model["fixed"]) || !(model["fixed"].includes(paramName))){
          //If param is not fixed add it to select the prior data

          if (firstParam){
            //If is first param of model add the model title
            $priorsContainer.append($('<h3 style="color: ' + model["color"] + '">' + model["type"] + " " + i + ':</h3>'));
            firstParam = false;
          }

          var name = paramName + "-" + i;

          //Add the prior type selector for this parameter
          var $priorTypeRadioCont = getRadioControl(currentObj.id,
                                            paramName + " (" + model[paramName].toFixed(3)  + ")",
                                            "priorType_" + name,
                                            [
                                              { id:"Uni", label:"Uniform", value:"uniform"},
                                              { id:"Nor", label:"Normal", value:"normal"},
                                              { id:"Log", label:"Lognormal", value:"lognormal"}
                                            ],
                                            "uniform",
                                            function(value, id) {
                                              var $radioBtn = currentObj.toolPanel.$html.find("#" + id);
                                              var paramName = $radioBtn.attr("name").replace(currentObj.id, "").replace("_priorType_", "");
                                              currentObj.onPriorTypeChanged(paramName, value);
                                            });
          $priorTypeRadioCont.addClass("priorType");
          $priorsContainer.append($priorTypeRadioCont);

          //Add the prior values selector
          $priorsContainer.append($('<div class="' + currentObj.id + "_prior_" + name + '"></div>'));
          currentObj.onPriorTypeChanged(name, "uniform");
        }
      }
    }


    //Adds the sampling controls
    var $samplingSection = getSection ("Markov Chain Monte Carlo", "samplingSection", currentObj.sampleEnabled, function ( enabled ) {
       currentObj.sampleEnabled = enabled;
    });
    var $samplingSectionContainer = getSectionContainer($samplingSection);
    $samplingSectionContainer.append("<p>Sample the posterior distribution using MCMC.</p>");
    $samplingSectionContainer.append(getRangeBoxCfg ("nwalkers_" + currentObj.id, "inputNwalkers",
                                                      "Nº of walkers", currentObj.sampleOpts.nwalkers,
                                                     function(value, input) { currentObj.sampleParams.nwalkers = value; }));
    $samplingSectionContainer.append(getRangeBoxCfg ("niter_" + currentObj.id, "inputNiter",
                                                      "Nº of iterations", currentObj.sampleOpts.niter,
                                                      function(value, input) { currentObj.sampleParams.niter = value; }));
    $samplingSectionContainer.append(getRangeBoxCfg ("burnin_" + currentObj.id, "inputBurnin",
                                                      "Burnin value", currentObj.sampleOpts.burnin,
                                                      function(value, input) { currentObj.sampleParams.burnin = value; }));
    /*Looks like using multiple threads on Stingray causes lost of contexts in Flask
    $samplingSectionContainer.append(getRangeBoxCfg ("threads_" + currentObj.id, "inputThreads",
                                                      "Nº of threads", currentObj.sampleOpts.threads,
                                                      function(value, input) { currentObj.sampleParams.threads = value; }));*/
    $samplingSectionContainer.append(getRangeBoxCfg ("nsamples_" + currentObj.id, "inputNsamples",
                                                      "Nº of plot samples", currentObj.sampleOpts.nsamples,
                                                      function(value, input) { currentObj.sampleParams.nsamples = value; }));
    $container.append($samplingSection);


    //Adds the procced with BAYESIAN PAR. EST. button
    var $parEstBtn = $('<button class="btn btn-danger parEstBtn"><i class="fa fa-line-chart" aria-hidden="true"></i> BAYESIAN PAR. EST.</button>');
    $parEstBtn.click(function(event){
      currentObj.launchBayesianParEst();
    });
    $container.append($parEstBtn);

    //Shows the analyze panel
    currentObj.toolPanel.analyzeContainer.removeClass("hidden");
    currentObj.toolPanel.showPanel("analyzePanel");
  }

  this.onPriorTypeChanged = function (paramName, priorType) {
    var nameArr = paramName.split("-");

    if (nameArr.length == 2) {
      var estModels = currentObj.modelSelector.getModels(true);
      var paramValue = estModels[parseInt(nameArr[1])][nameArr[0]];
      var paramError = estModels[parseInt(nameArr[1])][nameArr[0] + "Err"];

      var $container = currentObj.toolPanel.$html.find("." + currentObj.id + "_prior_" + paramName);
      $container.html("");
      if (priorType == "uniform") {
        var paramDelta = paramValue * 0.5;
        currentObj.addUniformPrior (paramName, (paramValue - paramDelta), (paramValue + paramDelta), $container);
      } else if (priorType == "normal") {
        currentObj.addNormPrior (paramName, paramValue, paramError, $container);
      } else if (priorType == "lognormal") {
        currentObj.addLognormPrior (paramName, paramValue, paramError, $container);
      }
    }
  }

  this.addUniformPrior = function (paramName, minValue, maxValue, $container){
    var $input = $(getInputBox (paramName + "-min", paramName + "-min", "Min", minValue.toFixed(3)));
    $input.attr("priorType", "uniform");
    $container.append($input);
    $container.append("</br>");
    $container.append(getInputBox (paramName + "-max", paramName + "-max", "Max", maxValue.toFixed(3)));
  }

  this.addNormPrior = function (paramName, mean, sigma, $container){
    var $input = $(getInputBox (paramName + "-mean", paramName + "-mean", "Mean", mean.toFixed(3)));
    $input.attr("priorType", "normal");
    $container.append($input);
    $container.append("</br>");
    $container.append(getInputBox (paramName + "-sigma", paramName + "-sigma", "Sigma", sigma.toFixed(3)));
  }

  this.addLognormPrior = function (paramName, mean, sigma, $container){
    var $input = $(getInputBox (paramName + "-mean", paramName + "-mean", "Mean", mean.toFixed(3)));
    $input.attr("priorType", "lognormal");
    $container.append($input);
    $container.append("</br>");
    $container.append(getInputBox (paramName + "-sigma", paramName + "-sigma", "Sigma", sigma.toFixed(3)));
  }

  //Returns the priors data to be sent to server
  this.getPriors = function (){

    var priorsArray = [];

    currentObj.paramNames = []; //Reset the param names array

    //For each input get the values and store in priorsArray
    currentObj.toolPanel.$html.find(".priorsContainer").find("input:text").each(function(index) {
      var nameArr = $(this).attr("name").split("-");

      if (nameArr.length == 3) {
        var paramName = nameArr[0];
        var modelIdx = parseInt(nameArr[1]);
        var priorName = nameArr[2];

        //Prepares arrays
        if (isNull(priorsArray[modelIdx])) { priorsArray[modelIdx] = {}; }
        if (isNull(priorsArray[modelIdx][paramName])) { priorsArray[modelIdx][paramName] = {}; }

        if (!isNull($(this).attr("priorType"))) {
          priorsArray[modelIdx][paramName]["type"] = $(this).attr("priorType");
          currentObj.paramNames.push(paramName + "-" + modelIdx); //Stores the param name
        }

        priorsArray[modelIdx][paramName][priorName] = $(this).val();

      } else {
        logErr("Can't extract priors values from string: " + $(this).attr("name"));
      }

    });

    return priorsArray;
  }

  //Calls server to do Bayesian Parameter Estimation
  this.launchBayesianParEst = function () {

    waitingDialog.show('Applying Bayesian Parameter Estimation...');
    disableLogError();

    var paramsData = $.extend(true, {}, currentObj.plot.plotConfig);
    paramsData.models = currentObj.modelSelector.getModels(false);
    paramsData.priors = currentObj.getPriors();
    if (currentObj.sampleEnabled) {
      paramsData.sampling_params = currentObj.sampleParams;
    }

    currentObj.modelSelector.clearAllEstimationsAndErrors();

    currentObj.fitCallFn(paramsData, function( jsdata ) {

      log("Bayesian Par. Est. data received!, FitTabPanel: " + currentObj.id);
      enableLogError();

      var data = JSON.parse(jsdata);
      if (!isNull(data) && data.length > 0) {
        currentObj.modelSelector.setEstimation(data[0].values, true);
        data[1].values.count = currentObj.plot.data[0].values.length;
        currentObj.addInfoPanel(data[1].values, (data.length > 2) ? data[2].values : null);
        currentObj.toolPanel.showPanel("loadPanel");
        waitingDialog.hide();
      } else {
        showError("Bayesian Par. Est. wrong data received!!");
      }
    });
  }

  this.addInfoPanel = function ( statsData, sampleData ) {
    this.infoPanelData = statsData;
    this.infoPanelSampleData = sampleData;
    this.outputPanel.$body.find(".infoPanel").remove();
    this.infoPanel = new InfoPanel("infoPanel", "Fitting statistics", statsData, sampleData, null);
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

      if (!isNull(this.headerComments) && !isNull(this.headerComments.acceptance)) {
        //MCMC Sample data were passed
        this.$html.addClass("fullScreen"); //Makes panel bigger

        content += "<tr><td></br></td></tr>";
        content += "<tr><td><h3>Markov Chain Monte Carlo results:</h3></td></tr>";

        if (this.headerComments.acceptance != "ERROR"){

          content += "<tr><td> The acceptance fraction is: " + this.headerComments.acceptance.toFixed(5) + "</td></tr>";

          if (this.headerComments.acor != "ERROR"){
            content += "<tr><td> The autocorrelation time is: " + this.headerComments.acor.toFixed(5) + "</td></tr>";
          } else {
            content += "<tr><td> The autocorrelation time is: Chains too short to compute autocorrelation lengths.</td></tr>";
          }

          //Adds Posterior Summary of Parameters
          content += "<tr><td><h3>Posterior Summary of Parameters:</h3></td></tr>";

          var models = currentObj.modelSelector.getModels(false); //Get models from modelSelector
          var prevIdx = -1;
          var posteriorTable = '<table class="posteriorTable">';
          posteriorTable += "<tr><th>Parameter</th><th>Mean</th><th>Std</th><th>5%</th><th>95%</th><th>R Hat</th></tr>";
          for (var i=0; i<this.headerComments.mean.length; i++){
            var splitStr = currentObj.paramNames[i].split("-");
            var paramName = splitStr[0];
            var idx = splitStr[1];

            if (prevIdx != idx){
              posteriorTable += "<tr>" +
                                  "<td colspan='6'><h3 style='color: " + models[idx]["color"] + "; font-size: 1.1em;'>" + models[idx]["type"] + " " + idx + ":</h3></td>" +
                                "</tr>";
              prevIdx = idx;
            }

            posteriorTable += "<tr>" +
                                "<td>" + paramName + "</td>" +
                                "<td>" + this.headerComments.mean[i].toFixed(5) + "</td>" +
                                "<td>" + this.headerComments.std[i].toFixed(5) + "</td>" +
                                "<td>" + this.headerComments.ci[0][i].toFixed(5) + "</td>" +
                                "<td>" + this.headerComments.ci[1][i].toFixed(5) + "</td>" +
                                "<td>" + this.headerComments.rhat[i].toFixed(5) + "</td>" +
                              "</tr>";
          }
          posteriorTable += '</table>';
          content += "<tr><td>" + posteriorTable + "</td></tr>";

          //Adds the MCMC Corner plot
          if (this.headerComments.img != "ERROR"){
            content += "<tr><td>" + this.headerComments.img + "</td></tr>";
          } else {
            content += "<tr><td> ERROR CREATING MCMC CORNER PLOT </td></tr>";
          }

        } else {
         content += "<tr><td> WRONG MCMC RETURNED SAMPLE DATA</td></tr>";
        }
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
             infoPanelData: this.infoPanelData,
             infoPanelSampleData: this.infoPanelSampleData,
             plotDefaultConfig: this.plotDefaultConfig
           };
  }

  this.setConfig = function (tabConfig, callback) {
    log("setConfig for tab " + this.id);

    if (!isNull(tabConfig.plotDefaultConfig)){
      this.plotDefaultConfig = $.extend(true, {}, tabConfig.plotDefaultConfig);
    }
    this.projectConfig = $.extend( this.projectConfig, tabConfig.projectConfig );
    this.modelSelector.setConfig( tabConfig.modelsConfig );
    this.createFitPlot();
    this.outputPanel.setConfig( [tabConfig.plotConfig] );
    this.plot.onDatasetValuesChanged(this.outputPanel.getFilters());

    if (!isNull(tabConfig.infoPanelData)){
      this.addInfoPanel(tabConfig.infoPanelData, tabConfig.infoPanelSampleData);
    }

    callback();
  }

  this.createFitPlot = function () {

    //Set the fit call method and the request data call method
    this.fitCallFn = this.service.request_fit_powerspectrum_result; //Default PDS Fit method
    var dataCallFn = this.service.request_power_density_spectrum; //Default PDS method
    if (!isNull(plotConfig.ls_norm)){
      //If plotConfig comes from PgPlot then use fit LombScargle method
      this.fitCallFn = this.service.request_fit_lomb_scargle_result;
      dataCallFn = this.service.request_lomb_scargle_results;
    }

    //Set the selected plot configs
    this.plot = new FitPlot(this.outputPanel.generatePlotId("FitPlot_" + plotConfig.filename),
                             $.extend(true, {}, plotConfig),
                             this.modelSelector.getModels,
                             dataCallFn,
                             this.service.request_plot_data_from_models,
                             this.outputPanel.onFiltersChangedFromPlot,
                             this.outputPanel.onPlotReady,
                             null,
                             "fullWidth",
                             false,
                             this.projectConfig,
                             !isNull(plotStyle) ? $.extend(true, {}, plotStyle) : null);

    this.setTitle("Fit " + this.plot.plotConfig.styles.title);

    var label = isNull(this.plot.plotConfig.styles.title) ? "File: " + this.plot.plotConfig.filename : this.plot.plotConfig.styles.title;
    this.toolPanel.addSelectedFile(label, getFilename(this.plot.plotConfig.filename));
    this.toolPanel.$html.find(".fileSelectorsContainer").append(this.modelSelector.$html);

    this.addPlot(this.plot);
  }

  this.containsId = function (id) {
    return (this.id == id)
            || (this.toolPanel.containsId(id))
            || (this.outputPanel.containsId(id))
            || (this.modelSelector.containsId(id));
  }

  //FitTabPanel Initialzation:
  this.infoPanelData = null;
  this.infoPanelSampleData = null;
  this.paramNames = [];
  this.sampleEnabled = false;

  this.sampleOpts = {}; //Default, min and max values for sample params
  this.sampleOpts.nwalkers = { default:250, min:1, max: 2500}; //The number of walkers (chains) to use during the MCMC
  this.sampleOpts.niter = { default:50, min:1, max: 500}; //The number of iterations to run the MCMC chains
  this.sampleOpts.burnin = { default:50, min:1, max: 500}; //The number of iterations to run the walkers before convergence is assumed to have occurred.
  this.sampleOpts.threads = { default:1, min:1, max: 100}; //The number of threads for parallelization. FIXED TO 1 for avoid Flask context loss
  this.sampleOpts.nsamples = { default:500, min:1, max: 5000}; //The number of threads for parallelization.

  this.sampleParams = {}; //Sample params values to be sent, initialized to default values
  this.sampleParams.nwalkers = this.sampleOpts.nwalkers.default;
  this.sampleParams.niter = this.sampleOpts.niter.default;
  this.sampleParams.burnin = this.sampleOpts.burnin.default;
  this.sampleParams.threads = this.sampleOpts.threads.default;
  this.sampleParams.nsamples = this.sampleOpts.nsamples.default;

  this.wfSelector.find(".loadBtn").html('<i class="fa fa-fw fa-line-chart"></i>Models');
  this.prepareTabButton(this.wfSelector.find(".styleBtn"));
  this.wfSelector.find(".styleBtn").show();
  this.toolPanel.styleContainer.removeClass("hidden");
  this.toolPanel.clearFileSelectors();

  this.modelSelector = new ModelSelector(this.id + "_modelSelector_" + (new Date()).getTime(),
                                        this.onModelsChanged,
                                        this.onFitClicked,
                                        this.applyBootstrap,
                                        this.showBayesianParEst,
                                        isNull(plotConfig.styles.title) ? getFilename(plotConfig.filename) : plotConfig.styles.title);

  this.outputPanel.getFilters = function () {
    return currentObj.plot.plotConfig.filters;
  }

  if (!isNull(projectConfig)){
    this.projectConfig.updateFromProjectConfigs([ projectConfig ]);
    this.createFitPlot();
  }

  log("FitTabPanel ready! id: " + this.id);
  return this;
}
