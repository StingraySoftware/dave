
//Adds new Long term variability of AGN Tab Panel
function addAGNTabPanel(navBarList, panelContainer, plotConfig, projectConfig, id, navItemClass){
  return new AGNTabPanel(!isNull(id) ? id : "Tab_" + tabPanels.length,
                        "TabPanelTemplate",
                        !isNull(navItemClass) ? navItemClass : "NavItem_" + tabPanels.length,
                        theService, navBarList, panelContainer, plotConfig, projectConfig);
}

//Subscribes the load workspace AGNTabPanel function
tabPanelsLoadFns["AGNTabPanel"] = function (tabConfig) {
  //Creates new Long term variability of AGN Tab Panel
  return addAGNTabPanel($("#navbar").find("ul").first(),
                      $(".daveContainer"),
                      tabConfig.plotConfig,
                      null,
                      tabConfig.id,
                      tabConfig.navItemClass);
}

//Long term variability of AGN Tab Panel
function AGNTabPanel (id, classSelector, navItemClass, service, navBarList, panelContainer, plotConfig, projectConfig) {

  var currentObj = this;
  tabPanels.push(this); // Insert on tabPanels here for preparing access to getTabForSelector from plots

  WfTabPanel.call(this, id, classSelector, navItemClass, service, navBarList, panelContainer);

  //AGNTabPanel METHODS:
  this.getAGNDataFromServer = function (paramsData) {

    log("AGNTabPanel getAGNDataFromServer...");

    if (!isNull(currentObj.currentRequest) && !isNull(currentObj.currentRequest.abort)) {
      currentObj.currentRequest.abort();
    }

    currentObj.outputPanel.setPlotsReadyState(false);

    currentObj.currentRequest = currentObj.service.request_lightcurve(paramsData, function( jsdata ) {

      if (!isNull(jsdata.abort)){
        log("Current request aborted, AGNTabPanel: " + currentObj.id);
        if (data.statusText == "error"){
          //If abort cause is because python server died
          currentObj.outputPanel.setPlotsReadyState(true);
        }
        return; //Comes from request abort call.
      }

      log("AGNData received!, AGNTabPanel: " + currentObj.id);
      data = JSON.parse(jsdata);

      if (isNull(data)) {
        log("onPlotReceived wrong data!, AGNTabPanel: " + currentObj.id);
        currentObj.outputPanel.setPlotsReadyState(true);
        return;

      } else {

        //Sends data to agnPlot
        if (currentObj.agnPlot.isVisible) {
          currentObj.agnPlot.setData(data);
        }

        //Prepares Excess Variance Confidence interval Plot data and sends it to plot
        if (currentObj.exVarConfPlot.isVisible) {
          currentObj.exVarConfPlot.setData([ data[6],
                                             data[10],
                                            { values: [ data[20].values[0], data[20].values[1], data[20].values[2] ] },
                                            { values: [ data[20].values[3], data[20].values[4], data[20].values[5] ] } ]);
        }

        //Prepares Fvar Confidence interval Plot data and sends it to plot
        if (currentObj.fvarConfPlot.isVisible) {
          currentObj.fvarConfPlot.setData([ data[6],
                                            data[14],
                                            { values: [ data[20].values[6], data[20].values[7], data[20].values[8] ] },
                                            { values: [ data[20].values[9], data[20].values[10], data[20].values[11] ] } ]);
        }

        //Prepares Absolute RMS Plot data and sends it to plot
        if (currentObj.absRMSPlot.isVisible) {
          currentObj.absRMSPlot.setData([ { values: data[8].values, error_values: data[9].values },
                                          { values: data[10].values, error_values: data[11].values } ]);
        }

        //Prepares Fractional RMS Plot data and sends it to plot
        if (currentObj.fracRMSPlot.isVisible) {
          currentObj.fracRMSPlot.setData([ { values: data[8].values, error_values: data[9].values },
                                          { values: data[14].values, error_values: data[15].values } ]);
        }

      }
    });

  };

  this.getConfig = function () {
    return { type: "AGNTabPanel",
             id: this.id,
             navItemClass: this.navItemClass,
             plotConfig: this.plotConfig,
             projectConfig: this.projectConfig.getConfig(),
             outputPanelConfig: this.outputPanel.getConfig()
           };
  }

  this.setConfig = function (tabConfig, callback) {
    log("setConfig for tab " + this.id);

    this.projectConfig = $.extend( this.projectConfig, tabConfig.projectConfig );
    this.createPlots();
    this.outputPanel.setConfig(tabConfig.outputPanelConfig);

    callback();
  }

  this.createPlots = function () {
    //Adds Long-term variability of AGN Plot to outputPanel
    this.agnPlot = new AgnPlot(
                              this.id + "_agn_" + (new Date()).getTime(),
                              $.extend(true, {}, plotConfig),
                              this.getAGNDataFromServer,
                              this.outputPanel.onFiltersChangedFromPlot,
                              this.outputPanel.onPlotReady,
                              null,
                              "fullScreen",
                              false,
                              this.projectConfig
                            );
    this.addPlot(this.agnPlot, false);

    //Adds Excess Variance Confidence Intervals Plot to outputPanel
    this.exVarConfPlot = new ConfidencePlot(
                              this.id + "_exVarConf_" + (new Date()).getTime(),
                              $.extend(true, $.extend(true, {}, plotConfig), {
                                styles: { type: "scatter",
                                          labels: ["TIME (" + this.projectConfig.timeUnit  + ")", "S2"],
                                          title: "S2 Confidence Intervals",
                                          selectable: false }
                              }),
                              null,
                              this.outputPanel.onFiltersChangedFromPlot,
                              this.outputPanel.onPlotReady,
                              null,
                              "",
                              false
                            );
    this.addPlot(this.exVarConfPlot, false);

    //Adds Fvar Confidence Intervals Plot to outputPanel
    this.fvarConfPlot = new ConfidencePlot(
                              this.id + "_FvarConf_" + (new Date()).getTime(),
                              $.extend(true, $.extend(true, {}, plotConfig), {
                                styles: { type: "scatter",
                                          labels: ["TIME (" + this.projectConfig.timeUnit  + ")", "Fvar"],
                                          title: "Fvar Confidence Intervals",
                                          selectable: false }
                              }),
                              null,
                              this.outputPanel.onFiltersChangedFromPlot,
                              this.outputPanel.onPlotReady,
                              null,
                              "",
                              false
                            );
    this.addPlot(this.fvarConfPlot, false);

    //Adds Avg. Absolute RMS: S2 Vs Count Rate plot to outputPanel
    this.absRMSPlot = new Plot(
                              this.id + "_absRms_" + (new Date()).getTime(),
                              $.extend(true, $.extend(true, {}, plotConfig), {
                                styles: { type: "scatter_with_errors",
                                          labels: ["<x>", "S2"],
                                          title: "Avg. Absolute RMS",
                                          selectable: false }
                              }),
                              null,
                              this.outputPanel.onFiltersChangedFromPlot,
                              this.outputPanel.onPlotReady,
                              null,
                              "",
                              false
                            );
    this.addPlot(this.absRMSPlot, false);

    //Adds Avg. Fractional RMS: Fvar Vs Count Rate plot to outputPanel
    this.fracRMSPlot = new Plot(
                              this.id + "_fracRms_" + (new Date()).getTime(),
                              $.extend(true, $.extend(true, {}, plotConfig), {
                                styles: { type: "scatter_with_errors",
                                          labels: ["<x>", "Fvar"],
                                          title: "Avg. Fractional RMS",
                                          selectable: false }
                              }),
                              null,
                              this.outputPanel.onFiltersChangedFromPlot,
                              this.outputPanel.onPlotReady,
                              null,
                              "",
                              false
                            );
    this.addPlot(this.fracRMSPlot, false);

    //Request plot data after all plots were added
    this.onVarianceValuesChanged();
  }

  this.getVarianceSelector = function () {
    //Long-term AGN Variability controls set
    var $variance = $('<div class="variance">' +
                        '<h3>' +
                          'Long-term variability parammeters:' +
                        '</h3>' +
                        '<div class="varianceContainer">' +
                          '<p>Min counts for each chunk:</br><input id="mc_' + this.id + '" class="inputMinPhotons" type="text" name="mp_' + this.id + '" placeholder="' + this.variance_opts.min_counts.default + '" value="' + this.variance_opts.min_counts.default + '" /> <span style="font-size:0.8em; color:#777777;">' + this.variance_opts.min_counts.min + '-' + this.variance_opts.min_counts.max + '</span></p>' +
                          '<p>Min. time bins:</br><input id="mb_' + this.id + '" class="inputMinBins" type="text" name="mb_' + this.id + '" placeholder="' + this.variance_opts.min_bins.default + '" value="' + this.variance_opts.min_bins.default + '" /> <span style="font-size:0.8em; color:#777777;">' + this.variance_opts.min_bins.min + '-' + this.variance_opts.min_bins.max + '</span></p>' +
                          '<p>Mean count:</br><input id="mc_' + this.id + '" class="inputMeanCount" type="text" name="mc_' + this.id + '" placeholder="' + this.variance_opts.mean_count.default + '" value="' + this.variance_opts.mean_count.default + '" /> <span style="font-size:0.8em; color:#777777;">' + this.variance_opts.mean_count.min + '-' + this.variance_opts.mean_count.max + '</span></p>' +
                          '<p style="font-size:0.8em; color:#777777;">Algorithm: Vaughan et al. 2003</p>' +
                        '</div>' +
                      '</div>');
    $variance.find("input").on('change', this.onVarianceValuesChanged);
    return $variance;
  }

  this.onVarianceValuesChanged = function(){
    currentObj.agnPlot.plotConfig.variance_opts.min_counts = getInputIntValueCropped(currentObj.toolPanel.$html.find(".inputMinPhotons"), currentObj.agnPlot.plotConfig.variance_opts.min_counts, currentObj.variance_opts.min_counts.min, currentObj.variance_opts.min_counts.max);
    currentObj.agnPlot.plotConfig.variance_opts.min_bins = getInputIntValueCropped(currentObj.toolPanel.$html.find(".inputMinBins"), currentObj.agnPlot.plotConfig.variance_opts.min_bins, currentObj.variance_opts.min_bins.min, currentObj.variance_opts.min_bins.max);
    currentObj.agnPlot.plotConfig.variance_opts.mean_count = getInputIntValueCropped(currentObj.toolPanel.$html.find(".inputMeanCount"), currentObj.agnPlot.plotConfig.variance_opts.mean_count, currentObj.variance_opts.mean_count.min, currentObj.variance_opts.mean_count.max);
    currentObj.agnPlot.onDatasetValuesChanged(currentObj.outputPanel.getFilters());
  }

  //Set the selected plot configs
  this.plotConfig = plotConfig;

  this.variance_opts = {};
  this.variance_opts.min_counts = { default:20, min:10, max: 10000}; //Minimum number of counts for each chunk on excess variance
  this.variance_opts.min_bins = { default:20, min:10, max: 10000}; //Minimum number of time bins on excess variance
  this.variance_opts.mean_count = { default:10, min:1, max: 10000}; //Number of elements to calculate the means

  this.setTitle("AGN Variability");
  this.wfSelector.find(".loadBtn").html('<i class="fa fa-fw fa-line-chart"></i>Analyze');

  //Preapares AGN toolpanel data
  this.toolPanel.clearFileSelectors();
  var label = isNull(plotConfig.styles.title) ? "File:" : plotConfig.styles.title;
  this.toolPanel.addSelectedFile(label, getFilename(plotConfig.filename));
  this.toolPanel.$html.find(".fileSelectorsContainer").append(this.getVarianceSelector());

  this.outputPanel.getFilters = function () {
    return currentObj.agnPlot.plotConfig.filters;
  }

  if (!isNull(projectConfig)){
    this.projectConfig.updateFromProjectConfigs([projectConfig]);
    this.createPlots();
  }

  log("AGNTabPanel ready! id: " + this.id);
  return this;
}
