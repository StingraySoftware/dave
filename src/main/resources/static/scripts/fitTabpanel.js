
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
    currentObj.outputPanel.plots[0].refreshModelsData();
  };

  //Set the selected plot configs
  this.projectConfig.updateFromProjectConfigs([ projectConfig ]);

  this.modelSelector = new ModelSelector(this.id + "_modelSelector_" + (new Date()).getTime(), this.onModelsChanged);

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
