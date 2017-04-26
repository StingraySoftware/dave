
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
    var paramsData = $.extend(true, {}, currentObj.plot.plotConfig);
    paramsData.models = currentObj.modelSelector.getModels();

    currentObj.service.request_fit_powerspectrum_result(paramsData, function( jsdata ) {

      log("FitData received!, FitTabPanel: " + currentObj.id);
      var data = JSON.parse(jsdata);
      if (!isNull(data)) {
        currentObj.modelSelector.setEstimation(data[0].values);
        data[1].values.count = currentObj.plot.data[0].values.length;
        currentObj.addInfoPanel(data[1].values);
      }
    });

  };

  this.addInfoPanel = function ( statsData ) {
    this.outputPanel.$body.find(".infoPanel").remove();
    this.infoPanel = new InfoPanel("infoPanel", "Fitting statistics:", statsData, [], null);
    this.infoPanel.redraw = function() {
      this.container.html("");

      var content = "<tr><td> Number of data points = " + this.header.count + "</td></tr>" +
                    "<tr><td> Deviance [-2 log L] D = " + this.header.deviance.toFixed(3) + "</td></tr>" +
                    "<tr><td> The Akaike Information Criterion of the model is: " + this.header.aic.toFixed(3) + "</td></tr>" +
                    "<tr><td> The Bayesian Information Criterion of the model is: " + this.header.bic.toFixed(3) + "</td></tr>" +
                    "<tr><td> The figure-of-merit function for this model is: " + this.header.merit.toFixed(3) + " and the fit for " + this.header.dof.toFixed(3) + " dof is " + this.header.dof_ratio.toFixed(3) + "</td></tr>" +
                    "<tr><td> Summed Residuals S = " + this.header.sobs.toFixed(3) + "</td></tr>" +
                    "<tr><td> Expected S ~ " + this.header.sexp.toFixed(3) + " +/- " + this.header.ssd.toFixed(3) + "</td></tr>" +
                    "<tr><td> Merit function (SSE) M = " + this.header.merit.toFixed(3) + "</td></tr>";
      this.container.append($(content));

    }
    this.infoPanel.redraw();
    this.outputPanel.$body.append(this.infoPanel.$html);
  }

  //Set the selected plot configs
  this.projectConfig.updateFromProjectConfigs([ projectConfig ]);

  this.modelSelector = new ModelSelector(this.id + "_modelSelector_" + (new Date()).getTime(), this.onModelsChanged, this.onFitClicked);

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
